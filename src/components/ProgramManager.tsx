import React from 'react';
import { useAppSelector } from '../store/hooks';
import { ProgramWindow } from '../store/programSlice';
import Notepad from './programs/Notepad';
import Winamp from './programs/Winamp';
import Snake from './programs/Snake';
// Import other programs as they're created
// import Paint from './programs/Paint';
// import Checkers from './programs/Checkers';

const ProgramManager: React.FC = () => {
  const { openPrograms } = useAppSelector((state) => state.programs);
  const { id: currentPlayerId } = useAppSelector((state: any) => state.player || {});

  const renderProgram = (program: ProgramWindow) => {
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
        // Placeholder for Paint program
        return (
          <div key={program.id} style={{ 
            position: 'absolute', 
            left: program.position.x, 
            top: program.position.y,
            zIndex: program.zIndex,
            background: 'white',
            border: '2px solid #ccc',
            padding: '10px'
          }}>
            🎨 Paint Program (Coming Soon!)
            <br />
            <small>Controlled by: {program.controllerId}</small>
          </div>
        );
      
      case 'winamp':
        return (
          <Winamp
            key={program.id}
            {...commonProps}
          />
        );
      
      case 'checkers':
        // Placeholder for Checkers program
        return (
          <div key={program.id} style={{ 
            position: 'absolute', 
            left: program.position.x, 
            top: program.position.y,
            zIndex: program.zIndex,
            background: 'white',
            border: '2px solid #ccc',
            padding: '10px'
          }}>
            🔴 Checkers Game (Coming Soon!)
            <br />
            <small>Multiplayer - All players can interact</small>
          </div>
        );
      
      case 'snake':
        return (
          <Snake
            key={program.id}
            {...commonProps}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <>
      {Object.values(openPrograms).map(renderProgram)}
    </>
  );
};

export default ProgramManager; 