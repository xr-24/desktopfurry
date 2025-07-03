import React from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { openProgram } from '../store/programSlice';
// Dynamically load all pattern images from assets/patterns
// eslint-disable-next-line @typescript-eslint/no-var-requires
const patternsContext = (require as any).context('../assets/patterns', false, /\.(png|jpe?g|gif)$/);

interface StartMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onChangeBackground: (background: string) => void;
  currentBackground: string;
}

type Background = { id: string; name: string; pattern: string };

const RETRO_BACKGROUNDS: Background[] = patternsContext.keys().map((file: string) => {
  const patternPath = patternsContext(file) as string;
  const fileName = file.replace('./', '');
  const id = fileName.substring(0, fileName.lastIndexOf('.')).toLowerCase();
  const name = id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ');
  return { id, name, pattern: patternPath };
});

const StartMenu: React.FC<StartMenuProps> = ({ isOpen, onClose, onChangeBackground, currentBackground }) => {
  const dispatch = useAppDispatch();
  const { id: currentPlayerId } = useAppSelector((state: any) => state.player || {});

  if (!isOpen) return null;

  const handleBackgroundChange = (backgroundId: string) => {
    onChangeBackground(backgroundId);
    onClose();
  };

  return (
    <>
      {/* Backdrop to close menu */}
      <div className="start-menu-backdrop" onClick={onClose} />
      
      <div className="start-menu">
        <div className="start-menu-header">
          <span>🖥️</span>
          <span>Michaelsoft Binbows 95</span>
        </div>
        
        <div className="start-menu-items">
          <div className="start-menu-item" onClick={() => {}}>
            <span>📁</span>
            <span>Programs</span>
            <span className="arrow">▶</span>
          </div>
          
          <div className="start-menu-item" onClick={() => {}}>
            <span>📄</span>
            <span>Documents</span>
            <span className="arrow">▶</span>
          </div>
          
          <div className="start-menu-separator"></div>
          
          <div className="start-menu-item backgrounds-item">
            <span>🎨</span>
            <span>Backgrounds</span>
            <span className="arrow">▶</span>
            
            <div className="backgrounds-submenu">
              {RETRO_BACKGROUNDS.map((bg) => (
                <div 
                  key={bg.id}
                  className={`background-option ${currentBackground === bg.id ? 'selected' : ''}`}
                  onClick={() => handleBackgroundChange(bg.id)}
                >
                  <div 
                    className="background-preview" 
                    style={{ 
                      backgroundImage: `url(${bg.pattern})`,
                      backgroundSize: 'cover'
                    }}
                  ></div>
                  <span>{bg.name}</span>
                  {currentBackground === bg.id && <span>✓</span>}
                </div>
              ))}
            </div>
          </div>
          
          <div className="start-menu-separator"></div>
          
          <div className="start-menu-item" onClick={() => {}}>
            <span>⚙️</span>
            <span>Settings</span>
          </div>
          
          <div className="start-menu-item" onClick={() => {
            if (currentPlayerId) {
              dispatch(openProgram({ type: 'characterEditor', controllerId: currentPlayerId }));
              onClose();
            }
          }}>
            <span>🖌️</span>
            <span>Character Editor</span>
          </div>
          
          <div className="start-menu-item" onClick={() => {}}>
            <span>❓</span>
            <span>Help</span>
          </div>
          
          <div className="start-menu-separator"></div>
          
          <div className="start-menu-item" onClick={() => {}}>
            <span>🚪</span>
            <span>Shut Down...</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default StartMenu; 