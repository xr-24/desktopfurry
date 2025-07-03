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

interface WinampProps {
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
      return data.title || `Unknown Track`;
    }
  } catch (error) {
    console.log('Failed to fetch video title:', error);
  }
  return `YouTube Video ${videoId.substring(0, 8)}`;
};

const Winamp: React.FC<WinampProps> = ({
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
  const [visualizerBars, setVisualizerBars] = useState<number[]>([]);
  const [localVolume, setLocalVolume] = useState<number>(programState.volume);
  
  const isHost = controllerId === currentPlayerId;
  const currentSong = programState.playlist[programState.currentTrack];

  // Initialize / re-initialize YouTube player (all clients create a player)
  useEffect(() => {
    loadYouTubeAPI().then(() => {
      if (currentSong) {
        // Destroy existing player if it exists
        if (playerRef.current) {
          playerRef.current.destroy();
        }
        
        // Create new player with current song for everyone
        playerRef.current = new window.YT.Player(`youtube-player-${windowId}`, {
          height: '0',
          width: '0',
          videoId: currentSong.youtubeId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
          },
          events: {
            onReady: (event: any) => {
              // Set volume to local preference
              if (playerRef.current) {
                playerRef.current.setVolume(localVolume);
              }
              
              // Get initial state and try to update title
              setTimeout(() => {
                updateStateFromPlayer();
              }, 100); // Small delay to ensure player is fully ready
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
  }, [currentSong?.youtubeId, isHost]);

  // Update time periodically when playing
  useEffect(() => {
    if (!isHost || !programState.isPlaying) return;
    
    const interval = setInterval(() => {
      updateStateFromPlayer();
    }, 1000);
    
    return () => clearInterval(interval);
  }, [programState.isPlaying, isHost]);

  // Fake visualizer animation
  useEffect(() => {
    if (!programState.isPlaying) {
      setVisualizerBars([]);
      return;
    }

    const interval = setInterval(() => {
      const bars = Array.from({ length: 20 }, () => Math.floor(Math.random() * 100));
      setVisualizerBars(bars);
    }, 100);

    return () => clearInterval(interval);
  }, [programState.isPlaying]);

  // Sync remote state to local player for non-host spectators (but works for host too)
  useEffect(() => {
    if (!playerRef.current || !currentSong) return;

    // Load the correct video if mismatch
    const currentId = playerRef.current.getVideoData()?.video_id;
    if (currentId !== currentSong.youtubeId) {
      playerRef.current.loadVideoById(currentSong.youtubeId, programState.currentTime);
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

  }, [currentSong?.youtubeId, programState.isPlaying, programState.currentTime]);

  const updateStateFromPlayer = () => {
    if (!playerRef.current || !isHost) return;
    
    const currentTime = playerRef.current.getCurrentTime() || 0;
    const totalTime = playerRef.current.getDuration() || 0;
    
    // Try to get the actual video title from the player
    try {
      const videoData = playerRef.current.getVideoData();
      if (videoData && videoData.title && currentSong) {
        const currentTitle = currentSong.title;
        // Only update if the title is still a placeholder
        if (currentTitle.startsWith('YouTube Video') || currentTitle === 'Unknown Track') {
          const updatedPlaylist = programState.playlist.map((song, index) => 
            index === programState.currentTrack 
              ? { ...song, title: videoData.title }
              : song
          );
          
          dispatch(updateProgramState({
            windowId,
            newState: { playlist: updatedPlaylist }
          }));
        }
      }
    } catch (error) {
      // Player might not be ready yet, ignore
    }
    
    dispatch(updateProgramState({
      windowId,
      newState: {
        currentTime: Math.floor(currentTime),
        totalTime: Math.floor(totalTime),
      }
    }));
  };

  const addSong = async () => {
    if (!isHost || !urlInput.trim()) return;
    
    const videoId = extractVideoId(urlInput);
    if (!videoId) {
      alert('Invalid YouTube URL');
      return;
    }

    const title = await getVideoTitle(videoId);
    const newSong = {
      id: `${videoId}-${Date.now()}`,
      title,
      youtubeId: videoId,
      addedBy: currentPlayerId,
    };

    const newPlaylist = [...programState.playlist, newSong];
    
    dispatch(updateProgramState({
      windowId,
      newState: { playlist: newPlaylist }
    }));
    
    setUrlInput('');
    
    // If this is the first song, start playing
    if (programState.playlist.length === 0) {
      dispatch(updateProgramState({
        windowId,
        newState: { currentTrack: 0 }
      }));
    }
  };

  const togglePlayPause = () => {
    if (!isHost || !playerRef.current) return;
    
    if (programState.isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const nextTrack = () => {
    if (!isHost) return;
    
    const nextIndex = (programState.currentTrack + 1) % programState.playlist.length;
    if (programState.playlist.length > 0) {
      dispatch(updateProgramState({
        windowId,
        newState: { currentTrack: nextIndex }
      }));
    }
  };

  const prevTrack = () => {
    if (!isHost) return;
    
    const prevIndex = programState.currentTrack === 0 
      ? programState.playlist.length - 1 
      : programState.currentTrack - 1;
    if (programState.playlist.length > 0) {
      dispatch(updateProgramState({
        windowId,
        newState: { currentTrack: prevIndex }
      }));
    }
  };

  const setVolume = (volume: number) => {
    setLocalVolume(volume);
    if (playerRef.current) {
      playerRef.current.setVolume(volume);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getWindowTitle = () => {
    const hostInfo = !isHost ? ` (DJ: ${controllerId})` : '';
    return `Muze${hostInfo}`;
  };

  return (
    <ProgramWindow
      windowId={windowId}
      title={getWindowTitle()}
      icon="🎵"
      position={position}
      size={size}
      zIndex={zIndex}
      isMinimized={isMinimized}
      isResizable={true}
    >
      <div className="winamp-player">
        {/* Hidden YouTube player (now for every client) */}
        <div id={`youtube-player-${windowId}`} style={{ display: 'none' }} />
        
        {/* Main Display */}
        <div className="winamp-display">
          <div className="winamp-screen">
            <div className="track-info">
              <div className="track-title">
                {currentSong ? currentSong.title : 'No track loaded'}
              </div>
              <div className="track-time">
                {formatTime(programState.currentTime)} / {formatTime(programState.totalTime)}
              </div>
            </div>
            
            {/* Visualizer */}
            <div className="winamp-visualizer">
              {visualizerBars.map((height, i) => (
                <div 
                  key={i}
                  className="visualizer-bar"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="winamp-controls">
          <button 
            className="winamp-btn" 
            onClick={prevTrack}
            disabled={!isHost || programState.playlist.length === 0}
            title="Previous"
          >
            ⏮
          </button>
          <button 
            className="winamp-btn play-pause" 
            onClick={togglePlayPause}
            disabled={!isHost || !currentSong}
            title={programState.isPlaying ? 'Pause' : 'Play'}
          >
            {programState.isPlaying ? '⏸' : '▶'}
          </button>
          <button 
            className="winamp-btn" 
            onClick={nextTrack}
            disabled={!isHost || programState.playlist.length === 0}
            title="Next"
          >
            ⏭
          </button>
          
          {/* Volume */}
          <div className="volume-control">
            <span>🔊</span>
            <input
              type="range"
              min="0"
              max="100"
              value={localVolume}
              onChange={(e) => setVolume(parseInt(e.target.value))}
              className="volume-slider"
            />
          </div>
        </div>

        {/* Add Song (Host Only) */}
        {isHost && (
          <div className="winamp-add-song">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste YouTube URL..."
              className="url-input"
              onKeyPress={(e) => e.key === 'Enter' && addSong()}
            />
            <button onClick={addSong} className="add-btn">Add</button>
          </div>
        )}

        {/* Playlist Toggle */}
        <div className="winamp-bottom">
          <button 
            className="playlist-toggle"
            onClick={() => setShowPlaylist(!showPlaylist)}
          >
            Playlist ({programState.playlist.length})
          </button>
        </div>

        {/* Playlist */}
        {showPlaylist && (
          <div className="winamp-playlist">
            {programState.playlist.length === 0 ? (
              <div className="empty-playlist">No songs in playlist</div>
            ) : (
              programState.playlist.map((song, index) => (
                <div 
                  key={song.id}
                  className={`playlist-item ${index === programState.currentTrack ? 'current' : ''}`}
                >
                  <span className="track-number">{index + 1}.</span>
                  <span className="track-title">{song.title}</span>
                  <span className="track-added-by">by {song.addedBy}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </ProgramWindow>
  );
};

export default Winamp; 