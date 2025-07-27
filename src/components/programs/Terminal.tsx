import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateProgramState } from '../../store/programSlice';
import { setVehicle, setGamingState, setSpeedMultiplier } from '../../store/playerSlice';
import { setInventoryData } from '../../store/inventorySlice';
import { earnMoney, spendMoney } from '../../store/inventorySlice';
import { updateUserMoney } from '../../store/shopSlice';
import { toggleHud, toggleRetro, toggleTrailerMode } from '../../store/uiSlice';
import ProgramWindow from '../ProgramWindow';
import { authService } from '../../services/authService';
import { deleteDummyIcons, addDummyIcon, hideIcon, restoreIcons, hideAllIcons, resetToDefaults } from '../../store/iconSlice';
import { store } from '../../store/store';

interface TerminalProps {
  windowId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
  programState: {
    history: string[];
  };
  controllerId: string;
  currentPlayerId: string;
}

const Terminal: React.FC<TerminalProps> = ({
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
  const currentVehicle = useAppSelector((state:any)=> state.player.vehicle);
  const currentSpeed = useAppSelector((state:any)=> state.player.speedMultiplier);
  const inventoryMoney = useAppSelector((state:any)=> state.inventory.money);
  const [history, setHistory] = useState<string[]>(programState.history || []);
  const [input, setInput] = useState('');

  // UI state selectors for toggling feedback
  const showHud = useAppSelector((state:any)=> state.ui.showHud);
  const showRetro = useAppSelector((state:any)=> state.ui.showRetro);
  const trailerMode = useAppSelector((state:any)=> state.ui.trailerMode);

  const isController = controllerId === currentPlayerId;

  const appendHistory = (line: string) => {
    const newHistory = [...history, line];
    setHistory(newHistory);
    dispatch(updateProgramState({ windowId, newState: { history: newHistory } }));
  };

  const handleCommand = (cmd: string) => {
    switch (cmd.toLowerCase()) {
      case 'hud':
        dispatch(toggleHud());
        appendHistory(showHud ? 'HUD hidden.' : 'HUD shown.');
        break;
      case 'retro':
        dispatch(toggleRetro());
        appendHistory(showRetro ? 'CRT overlay disabled.' : 'CRT overlay enabled.');
        break;
      case 'ufo':
        if (currentVehicle === 'ufo') {
          dispatch(setVehicle('none'));
          dispatch(setGamingState({ isGaming: false }));
          appendHistory('UFO mode deactivated.');
        } else {
          dispatch(setVehicle('ufo'));
          dispatch(setGamingState({ isGaming: true }));
          appendHistory('UFO mode activated!');
        }
        break;
      case 'lightspeed':
        if (currentSpeed === 3) {
          dispatch(setSpeedMultiplier(1));
          appendHistory('Lightspeed disengaged.');
        } else {
          dispatch(setSpeedMultiplier(3));
          appendHistory('Lightspeed engaged!');
        }
        break;
      case 'money':
        authService.adjustMoney(1000).then((res: any) => {
          if (res.success && typeof res.newBalance === 'number') {
            const diff = res.newBalance - inventoryMoney;
            if (diff > 0) dispatch(earnMoney(diff));
            else if (diff < 0) dispatch(spendMoney(-diff));
            dispatch(updateUserMoney(res.newBalance));
            appendHistory('You have received $1,000!');
          } else {
            // Fallback client-side only
            const newBal = inventoryMoney + 1000;
            dispatch(earnMoney(1000));
            dispatch(updateUserMoney(newBal));
            appendHistory('You have received $1,000 (local only)!');
          }
        });
        break;
      case 'xr242112':
        authService.grantTitle('ADMIN', { color: '#ff0000', fontWeight: 'bold', textShadow: '0 0 5px #fff' }).then((res:any)=>{
          if(res.success){
            appendHistory('ADMIN title granted!');
            // reload inventory to capture new title
            authService.loadInventory().then((inv:any)=>{
              if(inv){
                dispatch(setInventoryData(inv));
              }
            });
          } else {
            appendHistory('Failed to grant ADMIN title');
          }
        });
        break;
      case 'trailer':
        dispatch(toggleTrailerMode());
        appendHistory(trailerMode ? 'Trailer mode deactivated.' : 'Trailer mode activated! Press U to chat invisibly.');
        break;
      case 'decay':
        authService.decayFish().then((result: any) => {
          if (result) {
            appendHistory(`Fish stats decayed! Hunger: ${result.hunger_level}, Cleanliness: ${result.tank_cleanliness}`);
            
            // Update any open SeaBuddy windows with the new fish stats
            const state = store.getState() as any;
            const openPrograms = state.programs.openPrograms;
            const seaBuddyWindow = Object.values(openPrograms).find((w: any) => w.type === 'seabuddy') as any;
            
            if (seaBuddyWindow) {
              const newHappiness = Math.round((result.hunger_level + result.tank_cleanliness) / 2);
              const newHealth = Math.round(result.tank_cleanliness * 0.8 + 20);
              
              dispatch(updateProgramState({
                windowId: seaBuddyWindow.id,
                newState: {
                  hunger: result.hunger_level,
                  cleanliness: result.tank_cleanliness,
                  happiness: newHappiness,
                  health: newHealth,
                }
              }));
            }
          } else {
            appendHistory('Failed to decay fish stats. Make sure you have a fish!');
          }
        }).catch((error: any) => {
          appendHistory('Error decaying fish stats: ' + (error.message || 'Unknown error'));
        });
        break;
      default:
        // Handle dummy command patterns
        if (cmd.toLowerCase().startsWith('hide icon ')) {
          const label = cmd.substring(9).trim();
          const icons = (store.getState() as any).icons.icons as any[];
          const matchIcon = icons.find((i:any)=> i.label.toLowerCase()===label.toLowerCase() || i.id.toLowerCase()===label.toLowerCase());
          if (matchIcon) {
            dispatch(hideIcon(matchIcon.id));
            appendHistory(`Icon '${label}' hidden.`);
          } else {
            appendHistory(`Icon '${label}' not found.`);
          }
        } else if (cmd.toLowerCase()==='restore icons default') {
          dispatch(resetToDefaults());
          appendHistory('Icons reset to default layout.');
        } else if (cmd.toLowerCase()==='restore icons') {
          dispatch(restoreIcons());
          appendHistory('All icons restored.');
        } else if (cmd.toLowerCase()==='hide icons all') {
          dispatch(hideAllIcons());
          appendHistory('All current icons hidden.');
        } else if (cmd.toLowerCase().startsWith('dummy')) {
          const parts = cmd.split(' ');
          if (parts.length >= 2) {
            if (parts[1].toLowerCase() === 'delete') {
              dispatch(deleteDummyIcons());
              appendHistory('All dummy icons removed.');
            } else {
              // Expect format: dummy "Label" <icon>
              const match = cmd.match(/^dummy\s+\"([^\"]+)\"\s+(.*)$/i);
              if (match) {
                const label = match[1];
                const iconChar = match[2].trim();
                if (iconChar) {
                  dispatch(addDummyIcon({ label, iconChar }));
                  appendHistory(`Dummy icon '${label}' added.`);
                } else {
                  appendHistory('Invalid dummy icon format. Example: dummy "Tetris 2" 🕹️');
                }
              } else {
                appendHistory('Invalid dummy icon format. Use: dummy "Label" <icon>');
              }
            }
          } else {
            appendHistory('Invalid dummy command.');
          }
        } else {
          appendHistory(`Unknown command: ${cmd}`);
        }
        break;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    appendHistory(`> ${trimmed}`);
    if (isController) handleCommand(trimmed);
    setInput('');
  };

  const getWindowTitle = () => {
    return 'Terminal';
  };

  return (
    <ProgramWindow
      windowId={windowId}
      title={getWindowTitle()}
      icon="🖥️"
      position={position}
      size={size}
      zIndex={zIndex}
      isMinimized={isMinimized}
      isResizable={true}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: '#000',
          color: '#0f0',
          fontFamily: 'Courier New, monospace',
          fontSize: '12px',
          padding: '4px',
        }}
      >
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '4px' }}>
          {history.map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex' }}>
          <span style={{ marginRight: '4px' }}>&gt;</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!isController}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#0f0',
            }}
          />
        </form>
      </div>
    </ProgramWindow>
  );
};

export default Terminal; 