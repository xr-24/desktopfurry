import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateProgramState } from '../../store/programSlice';
import { setVehicle, setGamingState, setSpeedMultiplier } from '../../store/playerSlice';
import { setInventoryData } from '../../store/inventorySlice';
import { earnMoney, spendMoney } from '../../store/inventorySlice';
import { updateUserMoney } from '../../store/shopSlice';
import ProgramWindow from '../ProgramWindow';
import { authService } from '../../services/authService';

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

  const isController = controllerId === currentPlayerId;

  const appendHistory = (line: string) => {
    const newHistory = [...history, line];
    setHistory(newHistory);
    dispatch(updateProgramState({ windowId, newState: { history: newHistory } }));
  };

  const handleCommand = (cmd: string) => {
    switch (cmd.toLowerCase()) {
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
      default:
        appendHistory(`Unknown command: ${cmd}`);
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