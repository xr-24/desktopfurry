import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { openProgram, updateProgramState } from '../store/programSlice';
import { setShowWelcomeMessage } from '../store/dextopSlice';
import { authService } from '../services/authService';
import { store } from '../store/store';
import BDEMediaPlayer from './programs/BDEMediaPlayer';
import '../styles/welcomeVideo.css';

interface WelcomeVideoProps {
  onClose: () => void;
}

const WelcomeVideo: React.FC<WelcomeVideoProps> = ({ onClose }) => {
  const dispatch = useAppDispatch();
  const [showDisablePrompt, setShowDisablePrompt] = useState(false);
  const currentPlayerId = useAppSelector((state: any) => state.player?.id);
  const showWelcomeMessage = useAppSelector((state: any) => state.dextop.showWelcomeMessage);
  const openPrograms = useAppSelector((state: any) => state.programs.openPrograms);

  // Open BDE Media Player with welcome video
  useEffect(() => {
    if (currentPlayerId && showWelcomeMessage) {
      // Extract video ID from the YouTube URL
      const welcomeVideoId = 'EbIG4DUYGKA'; // From https://youtu.be/EbIG4DUYGKA
      
      dispatch(openProgram({
        type: 'bdemediaplayer',
        controllerId: currentPlayerId,
        position: { x: 100, y: 100 }
      }));

      // Add the welcome video to the playlist after a short delay
      setTimeout(() => {
        const welcomeVideo = {
          id: `${welcomeVideoId}-welcome`,
          title: 'Welcome to Dextop!',
          youtubeId: welcomeVideoId,
          addedBy: currentPlayerId,
        };

        // Update the program state to include the welcome video
        const currentPrograms = store.getState().programs.openPrograms;
        const bdeProgram = Object.values(currentPrograms).find((p: any) => p.type === 'bdemediaplayer') as any;
        
        if (bdeProgram && bdeProgram.id) {
          dispatch(updateProgramState({
            windowId: bdeProgram.id,
            newState: {
              playlist: [welcomeVideo],
              currentTrack: 0,
              isPlaying: true,
            }
          }));
        }
      }, 500); // Small delay to ensure the program is opened
    }
  }, [currentPlayerId, showWelcomeMessage, dispatch]);

  // Check if BDE Media Player is still open
  const bdeProgram = Object.values(openPrograms).find((p: any) => p.type === 'bdemediaplayer');
  
  // Track if we've opened the BDE Media Player
  const [hasOpenedBDE, setHasOpenedBDE] = useState(false);
  
  // Mark that we've opened the BDE Media Player
  useEffect(() => {
    if (bdeProgram && !hasOpenedBDE) {
      setHasOpenedBDE(true);
    }
  }, [bdeProgram, hasOpenedBDE]);
  
  // Show disable prompt when BDE Media Player is closed (but only after it was opened)
  useEffect(() => {
    if (showWelcomeMessage && hasOpenedBDE && !bdeProgram && !showDisablePrompt) {
      setShowDisablePrompt(true);
    }
  }, [bdeProgram, showWelcomeMessage, showDisablePrompt, hasOpenedBDE]);

  const handleDisableWelcome = async () => {
    try {
      await authService.setWelcomeMessagePreference(false);
      dispatch(setShowWelcomeMessage(false));
      setShowDisablePrompt(false);
      onClose();
    } catch (error) {
      console.error('Failed to save welcome message preference:', error);
      // Still close even if saving fails
      setShowDisablePrompt(false);
      onClose();
    }
  };

  const handleKeepWelcome = () => {
    setShowDisablePrompt(false);
    onClose();
  };

  if (!showWelcomeMessage) {
    return null;
  }

  return (
    <>
      {/* Disable Welcome Message Prompt */}
      {showDisablePrompt && (
        <div className="welcome-disable-overlay">
          <div className="welcome-disable-modal">
            <div className="welcome-disable-header">
              <h3>Welcome Message</h3>
            </div>
            <div className="welcome-disable-content">
              <p>Would you like to disable the welcome message for future visits?</p>
              <div className="welcome-disable-buttons">
                <button 
                  className="win98-button"
                  onClick={handleKeepWelcome}
                >
                  Keep Welcome Message
                </button>
                <button 
                  className="win98-button primary"
                  onClick={handleDisableWelcome}
                >
                  Disable Welcome Message
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WelcomeVideo; 