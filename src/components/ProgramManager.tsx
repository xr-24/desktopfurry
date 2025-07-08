import React from 'react';
import { useAppSelector } from '../store/hooks';
import { ProgramWindow as ProgramWindowType } from '../store/programSlice';
import ProgramWindow from './ProgramWindow';
import Notepad from './programs/Notepad';
import Winamp from './programs/Winamp';
import Snake from './programs/Snake';
import Pong from './programs/Pong';
import CharacterEditor from './programs/CharacterEditor';
import BDEMediaPlayer from './programs/BDEMediaPlayer';
import Paint from './programs/Paint';
import Browser98 from './programs/Browser98';
import Terminal from './programs/Terminal';
import Inventory from './programs/Inventory';
import Breakout from './programs/Breakout';
import Sudoku from './programs/Sudoku';
import Checkers from './programs/Checkers';
import Shop from './programs/Shop';
// DexSocial moved to taskbar widget
// import DexSocial from './programs/DexSocial';

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
        return (
          <Checkers
            key={program.id}
            {...commonProps}
          />
        );
      
      case 'pong':
        return (
          <Pong
            key={program.id}
            {...commonProps}
          />
        );
      
      case 'snake':
        return (
          <Snake
            key={program.id}
            {...commonProps}
          />
        );
      
      case 'sudoku':
        return (
          <Sudoku
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
      
      case 'browser98':
        return (
          <Browser98
            key={program.id}
            {...commonProps}
          />
        );
      
      case 'terminal':
        return (
          <Terminal
            key={program.id}
            {...commonProps}
          />
        );
      
      case 'inventory':
        return (
          <Inventory
            key={program.id}
            {...commonProps}
          />
        );
      
      case 'breakout':
        return (
          <Breakout
            key={program.id}
            {...commonProps}
          />
        );
      
      case 'shop':
        return (
          <Shop
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