import React from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { openProgram } from '../store/programSlice';
import { setChatColorHue } from '../store/playerSlice';
import { toggleGridSnapping } from '../store/uiSlice';
import { resetToDefaults } from '../store/iconSlice';
import { setCurrentTheme, loadThemesStart, loadThemesSuccess, loadThemesFailure } from '../store/themeSlice';
import { authService } from '../services/authService';
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
  const name = fileName.substring(0, fileName.lastIndexOf('.'));
  return { id, name, pattern: patternPath };
});

const StartMenu: React.FC<StartMenuProps> = ({ isOpen, onClose, onChangeBackground, currentBackground }) => {
  const dispatch = useAppDispatch();
  const { id: currentPlayerId } = useAppSelector((state: any) => state.player || {});
  const chatColorHue = useAppSelector((state:any)=> state.player.chatColorHue);
  const gridSnappingEnabled = useAppSelector((state:any) => state.ui.gridSnappingEnabled);
  const { currentTheme, availableThemes } = useAppSelector((state: any) => state.theme);
  
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [purchasedBackgrounds, setPurchasedBackgrounds] = React.useState<string[]>([]);

  // Load purchased backgrounds and themes when component mounts
  React.useEffect(() => {
    const loadPurchasedItems = async () => {
      try {
        const purchaseHistory = await authService.loadPurchaseHistory();
        console.log('Purchase history:', purchaseHistory);
        if (purchaseHistory && purchaseHistory.purchases) {
          const backgroundPurchases = purchaseHistory.purchases.filter((purchase: any) => purchase.item_type === 'background');
          console.log('Background purchases:', backgroundPurchases);
          const backgroundIds = backgroundPurchases
            .map((purchase: any) => purchase.metadata?.background_id)
            .filter(Boolean);
          console.log('Extracted background IDs:', backgroundIds);
          setPurchasedBackgrounds(backgroundIds);

          // Load purchased themes
          dispatch(loadThemesStart());
          try {
            const purchasedThemes = await authService.loadPurchasedThemes();
            dispatch(loadThemesSuccess({ purchasedThemes }));
          } catch (error) {
            dispatch(loadThemesFailure('Failed to load themes'));
          }
        }
      } catch (error) {
        console.error('Failed to load purchased items:', error);
      }
    };

    if (isOpen) {
      loadPurchasedItems();
    }
  }, [isOpen, dispatch]);

  if (!isOpen) return null;

  // Define free backgrounds that are always available
  const FREE_BACKGROUNDS = [
    'sandstone', 'waves', 'circles', 'blocks', 'bubbles', 'clouds', 
    'paradise', 'metal links', 'palm tree'
  ];

  // Filter backgrounds to only show free ones + purchased ones
  const getAvailableBackgrounds = () => {
    console.log('All RETRO_BACKGROUNDS:', RETRO_BACKGROUNDS.map(bg => ({ id: bg.id, name: bg.name })));
    console.log('FREE_BACKGROUNDS:', FREE_BACKGROUNDS);
    console.log('purchasedBackgrounds:', purchasedBackgrounds);
    
    return RETRO_BACKGROUNDS.filter(bg => {
      const isFree = FREE_BACKGROUNDS.includes(bg.id);
      const isPurchased = purchasedBackgrounds.some(purchasedId => 
        purchasedId.toLowerCase() === bg.id || 
        purchasedId.toLowerCase().replace(/\s+/g, ' ') === bg.name.toLowerCase()
      );
      console.log(`Background ${bg.id} (${bg.name}): free=${isFree}, purchased=${isPurchased}`);
      return isFree || isPurchased;
    });
  };

  const availableBackgrounds = getAvailableBackgrounds();

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

  const handleGridSnappingToggle = () => {
    dispatch(toggleGridSnapping());
  };

  const handleResetIcons = () => {
    dispatch(resetToDefaults());
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
              {availableBackgrounds.map((bg) => (
                <div 
                  key={bg.id}
                  className={`background-option ${currentBackground === bg.id ? 'selected' : ''}`}
                  onClick={() => handleBackgroundChange(bg.id)}
                >
                  <div 
                    className="background-preview" 
                    style={{ 
                      backgroundImage: `url(${bg.pattern})`
                    }}
                  ></div>
                  <span>{bg.name}</span>
                  {currentBackground === bg.id && <span>✓</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="start-menu-item themes-item">
            <span>🎭</span>
            <span>Themes</span>
            <span className="arrow">▶</span>
            
            <div className="themes-submenu">
              {availableThemes.filter((theme: any) => theme.isPurchased).map((theme: any) => (
                <div 
                  key={theme.id}
                  className={`theme-option ${currentTheme === theme.id ? 'selected' : ''}`}
                  onClick={() => {
                    dispatch(setCurrentTheme(theme.id));
                    authService.saveCurrentTheme(theme.id);
                    onClose();
                  }}
                >
                  <div 
                    className="theme-preview" 
                    style={{ 
                      background: `linear-gradient(45deg, ${theme.colors.primary} 0%, ${theme.colors.accent} 100%)`,
                      width: '20px',
                      height: '20px',
                      border: '1px solid #999',
                      borderRadius: '2px'
                    }}
                  ></div>
                  <span>{theme.name}</span>
                  {currentTheme === theme.id && <span>✓</span>}
                  {!theme.isPurchased && <span>🔒</span>}
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
                  
                  <div style={{marginTop:'12px', marginBottom:'8px', fontWeight:'bold'}}>Desktop Icons</div>
                  <div style={{display:'flex', flexDirection:'column', gap:'6px'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                      <input
                        type="checkbox"
                        checked={gridSnappingEnabled}
                        onChange={handleGridSnappingToggle}
                        id="grid-snapping"
                      />
                      <label htmlFor="grid-snapping" style={{cursor:'pointer'}}>
                        Grid Snapping
                      </label>
                    </div>
                    <div style={{fontSize:'10px', color:'#000080'}}>
                      Snap icons to grid when dragging
                    </div>
                    <button 
                      className="win98-button small"
                      onClick={handleResetIcons}
                      style={{marginTop:'4px', fontSize:'10px', padding:'2px 6px'}}
                    >
                      Reset Icon Positions
                    </button>
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
              dispatch(openProgram({ type: 'dexdirectory', controllerId: currentPlayerId }));
              onClose();
            }
          }}>
            <span>👥</span>
            <span>DexDirectory</span>
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
