import React, { useState, useRef, useEffect } from 'react';
import { useAppDispatch } from '../../store/hooks';
import { updateProgramState } from '../../store/programSlice';
import ProgramWindow from '../ProgramWindow';

// YouTube API type declarations
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface BDEMediaPlayerProps {
  windowId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
  programState: {
    playlist: Array<{
      id: string;
      title: string;
      youtubeId: string;
      addedBy: string;
      duration?: number;
    }>;
    currentTrack: number;
    isPlaying: boolean;
    volume: number;
    currentTime: number;
    totalTime: number;
    isFullscreen: boolean;
  };
  controllerId: string;
  currentPlayerId: string;
}

// Load YouTube API
const loadYouTubeAPI = (): Promise<void> => {
  return new Promise((resolve) => {
    if (window.YT) {
      resolve();
      return;
    }
    
    window.onYouTubeIframeAPIReady = () => {
      resolve();
    };
    
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(script);
    }
  });
};

// Extract YouTube video ID from various URL formats
const extractVideoId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// Get video title using YouTube oEmbed API (no API key required)
const getVideoTitle = async (videoId: string): Promise<string> => {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (response.ok) {
      const data = await response.json();
      return data.title || `Unknown Video`;
    }
  } catch (error) {
    console.log('Failed to fetch video title:', error);
  }
  return `YouTube Video ${videoId.substring(0, 8)}`;
};

const BDEMediaPlayer: React.FC<BDEMediaPlayerProps> = ({
  windowId,
  position,
  size,
  zIndex,
  isMinimized,
  programState,
  controllerId,
  currentPlayerId,
}) => {
  const dispatch = useAppDispatch();
  const playerRef = useRef<any>(null);
  const [urlInput, setUrlInput] = useState('');
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [localVolume, setLocalVolume] = useState<number>(programState.volume);
  
  const isHost = controllerId === currentPlayerId;
  const currentVideo = programState.playlist[programState.currentTrack];

  // Calculate video player dimensions based on window size
  const playerWidth = size.width - 20; // Account for padding
  const playerHeight = Math.min(size.height - 140, Math.floor(playerWidth * 9 / 16)); // 16:9 aspect ratio, leave room for controls

  // Initialize / re-initialize YouTube player
  useEffect(() => {
    loadYouTubeAPI().then(() => {
      if (currentVideo) {
        // Destroy existing player if it exists
        if (playerRef.current) {
          playerRef.current.destroy();
        }
        
        // Create new player with current video for everyone
        playerRef.current = new window.YT.Player(`youtube-player-${windowId}`, {
          height: playerHeight,
          width: playerWidth,
          videoId: currentVideo.youtubeId,
          playerVars: {
            autoplay: 0,
            controls: 0, // Hide default controls, we'll use custom ones
            disablekb: 1,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
          },
          events: {
            onReady: (event: any) => {
              // Set volume to local preference
              if (playerRef.current) {
                playerRef.current.setVolume(localVolume);
              }
              
              // Get initial state
              setTimeout(() => {
                updateStateFromPlayer();
              }, 100);
            },
            onStateChange: (event: any) => {
              const isPlaying = event.data === window.YT.PlayerState.PLAYING;
              // Only the host should broadcast play/pause state changes
              if (isHost) {
                dispatch(updateProgramState({
                  windowId,
                  newState: { isPlaying }
                }));
              }
              
              // Auto-advance to next track when current one ends (host only)
              if (isHost && event.data === window.YT.PlayerState.ENDED) {
                nextTrack();
              }
            },
          },
        });
      }
    });

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [currentVideo?.youtubeId, isHost, playerHeight, playerWidth]);

  // Update time periodically when playing
  useEffect(() => {
    if (!isHost || !programState.isPlaying) return;
    
    const interval = setInterval(() => {
      updateStateFromPlayer();
    }, 1000);
    
    return () => clearInterval(interval);
  }, [programState.isPlaying, isHost]);

  // Sync remote state to local player for non-host spectators
  useEffect(() => {
    if (!playerRef.current || !currentVideo) return;

    // Load the correct video if mismatch
    const currentId = playerRef.current.getVideoData()?.video_id;
    if (currentId !== currentVideo.youtubeId) {
      playerRef.current.loadVideoById(currentVideo.youtubeId, programState.currentTime);
    }

    // Ensure play / pause state matches
    if (programState.isPlaying) {
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
    }

    // Keep time roughly in sync (seek if drift >2s)
    try {
      const diff = Math.abs(playerRef.current.getCurrentTime() - programState.currentTime);
      if (diff > 2) {
        playerRef.current.seekTo(programState.currentTime, true);
      }
    } catch {}

  }, [currentVideo?.youtubeId, programState.isPlaying, programState.currentTime]);

  const updateStateFromPlayer = () => {
    if (!playerRef.current || !isHost) return;

    try {
      const currentTime = playerRef.current.getCurrentTime() || 0;
      const totalTime = playerRef.current.getDuration() || 0;
      
      dispatch(updateProgramState({
        windowId,
        newState: {
          currentTime: Math.floor(currentTime),
          totalTime: Math.floor(totalTime),
        }
      }));
    } catch (error) {
      console.log('Failed to update player state:', error);
    }
  };

  const addVideo = async () => {
    if (!isHost || !urlInput.trim()) return;

    const videoId = extractVideoId(urlInput.trim());
    if (!videoId) {
      alert('Please enter a valid YouTube URL');
      return;
    }

    const title = await getVideoTitle(videoId);
    const newVideo = {
      id: `${videoId}-${Date.now()}`,
      title,
      youtubeId: videoId,
      addedBy: currentPlayerId || 'Unknown',
    };

    const newPlaylist = [...programState.playlist, newVideo];
    
    dispatch(updateProgramState({
      windowId,
      newState: { playlist: newPlaylist }
    }));

    setUrlInput('');

    // If this is the first video, start playing it
    if (programState.playlist.length === 0) {
      dispatch(updateProgramState({
        windowId,
        newState: { currentTrack: 0 }
      }));
    }
  };

  const togglePlayPause = () => {
    if (!isHost || !currentVideo) return;
    
    dispatch(updateProgramState({
      windowId,
      newState: { isPlaying: !programState.isPlaying }
    }));
  };

  const nextTrack = () => {
    if (!isHost) return;
    
    const nextIndex = (programState.currentTrack + 1) % programState.playlist.length;
    dispatch(updateProgramState({
      windowId,
      newState: { 
        currentTrack: nextIndex,
        currentTime: 0,
        isPlaying: true,
      }
    }));
  };

  const prevTrack = () => {
    if (!isHost) return;
    
    const prevIndex = programState.currentTrack === 0 
      ? programState.playlist.length - 1 
      : programState.currentTrack - 1;
    
    dispatch(updateProgramState({
      windowId,
      newState: { 
        currentTrack: prevIndex,
        currentTime: 0,
        isPlaying: true,
      }
    }));
  };

  const setVolume = (volume: number) => {
    setLocalVolume(volume);
    if (playerRef.current) {
      playerRef.current.setVolume(volume);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getWindowTitle = () => {
    const videoInfo = currentVideo ? ` - ${currentVideo.title}` : '';
    const controllerInfo = !isHost ? ` (Controlled by ${controllerId})` : '';
    return `🚧 BDE Media Player${videoInfo}${controllerInfo}`;
  };

  return (
    <ProgramWindow
      windowId={windowId}
      title={getWindowTitle()}
      icon="🚧"
      position={position}
      size={size}
      zIndex={zIndex}
      isMinimized={isMinimized}
      isResizable={false}
    >
      <div className="bde-media-player">
        {/* Video Display Area */}
        <div className="video-container" style={{ 
          width: '100%', 
          height: playerHeight + 10,
          backgroundColor: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}>
          {currentVideo ? (
            <div id={`youtube-player-${windowId}`} />
          ) : (
            <div style={{ 
              color: '#fff', 
              textAlign: 'center',
              fontFamily: 'Better VCR, MS Sans Serif, sans-serif',
              fontSize: '14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '10px'
            }}>
              <div style={{ fontSize: '48px' }}>🚧</div>
              <div>BDE Media Player</div>
              <div style={{ fontSize: '12px', opacity: '0.8' }}>
                {isHost ? 'Add a YouTube video below to get started' : 'Waiting for host to add videos...'}
              </div>
            </div>
          )}
        </div>

        {/* Control Panel */}
        <div className="media-controls" style={{
          background: '#c0c0c0',
          padding: '8px',
          borderTop: '1px solid #808080',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {/* Playback Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              className="win98-button"
              onClick={prevTrack}
              disabled={!isHost || programState.playlist.length === 0}
              title="Previous"
            >
              ⏮️
            </button>
            <button 
              className="win98-button"
              onClick={togglePlayPause}
              disabled={!isHost || !currentVideo}
              title={programState.isPlaying ? "Pause" : "Play"}
            >
              {programState.isPlaying ? '⏸️' : '▶️'}
            </button>
            <button 
              className="win98-button"
              onClick={nextTrack}
              disabled={!isHost || programState.playlist.length === 0}
              title="Next"
            >
              ⏭️
            </button>
            
            {/* Time Display */}
            <span style={{ 
              fontFamily: 'Better VCR, MS Sans Serif, sans-serif',
              fontSize: '11px',
              minWidth: '80px'
            }}>
              {formatTime(programState.currentTime)} / {formatTime(programState.totalTime)}
            </span>

            {/* Volume Control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
              <span style={{ fontSize: '11px' }}>🔊</span>
              <input
                type="range"
                min="0"
                max="100"
                value={localVolume}
                onChange={(e) => setVolume(parseInt(e.target.value))}
                style={{ width: '80px' }}
                title="Volume"
              />
            </div>
          </div>

          {/* Add Video (Host Only) */}
          {isHost && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="win98-input"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Enter YouTube URL..."
                style={{ flex: 1 }}
                onKeyPress={(e) => e.key === 'Enter' && addVideo()}
              />
              <button className="win98-button" onClick={addVideo}>
                Add Video
              </button>
              <button 
                className="win98-button" 
                onClick={() => setShowPlaylist(!showPlaylist)}
              >
                Playlist ({programState.playlist.length})
              </button>
            </div>
          )}

          {/* Playlist */}
          {showPlaylist && (
            <div style={{
              maxHeight: '150px',
              overflowY: 'auto',
              border: '1px inset #c0c0c0',
              background: '#fff',
              padding: '4px',
            }}>
              {programState.playlist.length === 0 ? (
                <div style={{ padding: '8px', textAlign: 'center', color: '#666' }}>
                  No videos in playlist
                </div>
              ) : (
                programState.playlist.map((video, index) => (
                  <div 
                    key={video.id}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: index === programState.currentTrack ? '#0080ff' : 'transparent',
                      color: index === programState.currentTrack ? 'white' : 'black',
                      cursor: isHost ? 'pointer' : 'default',
                      fontSize: '11px',
                      fontFamily: 'Better VCR, MS Sans Serif, sans-serif',
                    }}
                    onClick={() => {
                      if (isHost) {
                        dispatch(updateProgramState({
                          windowId,
                          newState: { 
                            currentTrack: index,
                            currentTime: 0,
                            isPlaying: true,
                          }
                        }));
                      }
                    }}
                  >
                    {index + 1}. {video.title} {video.addedBy && `(by ${video.addedBy})`}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </ProgramWindow>
  );
};

export default BDEMediaPlayer; 