import React from 'react';
import { useAppSelector } from '../store/hooks';
import { ProgramWindow as ProgramWindowType } from '../store/programSlice';
import ProgramWindow from './ProgramWindow';
import Notepad from './programs/Notepad';
import Winamp from './programs/Winamp';
import Snake from './programs/Snake';
import CharacterEditor from './programs/CharacterEditor';
import BDEMediaPlayer from './programs/BDEMediaPlayer';
import Paint from './programs/Paint';
// DexSocial moved to taskbar widget
// import DexSocial from './programs/DexSocial';
// Import other programs as they're created
// import Checkers from './programs/Checkers';

const ProgramManager: React.FC = () => {
  const { openPrograms } = useAppSelector((state) => state.programs);
  const { id: currentPlayerId } = useAppSelector((state: any) => state.player || {});

  const renderProgram = (program: ProgramWindowType) => {
    const commonProps = {
      windowId: program.id,
      position: program.position,
      size: program.size,
      zIndex: program.zIndex,
      isMinimized: program.isMinimized,
      controllerId: program.controllerId,
      currentPlayerId: currentPlayerId || '',
      programState: program.state,
    };

    switch (program.type) {
      case 'notepad':
        return (
          <Notepad
            key={program.id}
            {...commonProps}
          />
        );
      
      case 'paint':
        return (
          <Paint
            key={program.id}
            {...commonProps}
          />
        );
      
      case 'winamp':
        return (
          <Winamp
            key={program.id}
            {...commonProps}
          />
        );
      
      case 'checkers':
        // Placeholder for Checkers program with proper window controls
        return (
          <ProgramWindow
            key={program.id}
            windowId={program.id}
            title="Checkers"
            icon="🔴"
            position={program.position}
            size={program.size}
            zIndex={program.zIndex}
            isMinimized={program.isMinimized}
          >
            <div style={{ 
              padding: '20px',
              textAlign: 'center',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              background: '#f0f0f0'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔴</div>
              <h3 style={{ margin: '0 0 10px 0', fontFamily: 'Better VCR, monospace' }}>Checkers Game</h3>
              <p style={{ margin: '0', fontFamily: 'Better VCR, monospace', fontSize: '12px' }}>Coming Soon!</p>
              <p style={{ margin: '10px 0 0 0', fontFamily: 'Better VCR, monospace', fontSize: '10px', color: '#666' }}>
                Multiplayer - All players can interact
              </p>
            </div>
          </ProgramWindow>
        );
      
      case 'snake':
        return (
          <Snake
            key={program.id}
            {...commonProps}
          />
        );
      
      case 'characterEditor':
        return (
          <CharacterEditor
            key={program.id}
            {...commonProps}
          />
        );
      
      case 'bdemediaplayer':
        return (
          <BDEMediaPlayer
            key={program.id}
            {...commonProps}
          />
        );
      
      default:
        return (
          <ProgramWindow
            key={program.id}
            windowId={program.id}
            title={`Unknown Program`}
            icon="❓"
            position={program.position}
            size={program.size}
            zIndex={program.zIndex}
            isMinimized={program.isMinimized}
          >
            <div style={{ 
              padding: '20px',
              textAlign: 'center',
              background: '#f0f0f0'
            }}>
              Program type '{program.type}' not implemented yet
            </div>
          </ProgramWindow>
        );
    }
  };

  return (
    <>
      {Object.values(openPrograms).map(renderProgram)}
    </>
  );
};

export default ProgramManager; 