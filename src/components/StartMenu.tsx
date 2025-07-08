import React from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { openProgram } from '../store/programSlice';
import { setChatColorHue } from '../store/playerSlice';
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
  const chatColorHue = useAppSelector((state:any)=> state.player.chatColorHue);

  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  if (!isOpen) return null;

  const toggleSettings = () => {
    setIsSettingsOpen(prev => !prev);
  };

  const handleBackgroundChange = (backgroundId: string) => {
    onChangeBackground(backgroundId);
    onClose();
  };

  const handleHueChange = (hue:number)=>{
    dispatch(setChatColorHue(hue));
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
          
          <div className={`start-menu-item settings-item ${isSettingsOpen ? 'active' : ''}`} onClick={toggleSettings}>
            <span>⚙️</span>
            <span>Settings</span>
            <span className="arrow">▶</span>
            {isSettingsOpen && (
              <div className="settings-submenu">
                <div style={{padding:'8px', fontFamily:'Better VCR, monospace', fontSize:'11px'}}>
                  <div style={{marginBottom:'8px', fontWeight:'bold'}}>Chat Color</div>
                  <div style={{display:'flex', flexDirection:'column', gap:'6px'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                      <input
                        type="range"
                        min={0}
                        max={359}
                        value={chatColorHue}
                        onChange={e => handleHueChange(parseInt(e.target.value))}
                        style={{flex:1}}
                      />
                      <div style={{width:'24px', height:'16px', background:`hsl(${chatColorHue},100%,50%)`, border:'1px solid #000'}} />
                      <span style={{minWidth:'40px'}}>{chatColorHue}°</span>
                    </div>
                    <div style={{fontSize:'10px', color:'#000080'}}>
                      Preview: <span style={{color:`hsl(${chatColorHue},100%,50%)`}}>Hello World!</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
          
          <div className="start-menu-item" onClick={() => {
            if (currentPlayerId) {
              dispatch(openProgram({ type: 'inventory', controllerId: currentPlayerId }));
              onClose();
            }
          }}>
            <span>🎒</span>
            <span>Inventory</span>
          </div>
          
          <div className="start-menu-item" onClick={() => {
            if (currentPlayerId) {
              dispatch(openProgram({ type: 'shop', controllerId: currentPlayerId }));
              onClose();
            }
          }}>
            <span>🛒</span>
            <span>Shop</span>
          </div>
          
          <div className="start-menu-item" onClick={() => {
            if (currentPlayerId) {
              dispatch(openProgram({ type: 'terminal', controllerId: currentPlayerId }));
              onClose();
            }
          }}>
            <span>🖥️</span>
            <span>Terminal</span>
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