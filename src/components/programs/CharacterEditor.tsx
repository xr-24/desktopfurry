import React, { useState, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setAppearance } from '../../store/playerSlice';
import { closeProgram } from '../../store/programSlice';
import ProgramWindow from '../ProgramWindow';
import { socketService } from '../../services/socketService';
import Character from '../Character';

interface CharacterEditorProps {
  windowId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
  controllerId: string;
  currentPlayerId: string;
  programState: any; // unused
}

// Load filenames dynamically from src/assets/characters/* using Webpack context
// eslint-disable-next-line @typescript-eslint/no-var-requires
const eyesCtx = (require as any).context('../../assets/characters/eyes', false, /\.png$/);
const earsCtx = (require as any).context('../../assets/characters/ears', false, /\.png$/);
const fluffCtx = (require as any).context('../../assets/characters/fluff', false, /\.png$/);
const tailCtx = (require as any).context('../../assets/characters/tail', false, /\.png$/);

const listFrom = (ctx:any)=> ctx.keys().map((k:string)=>k.replace('./','').replace('.png',''));

const EYES  = ['none', ...listFrom(eyesCtx).filter((n:string)=>n!=='none')];
const EARS  = ['none', ...listFrom(earsCtx).filter((n:string)=>n!=='none')];
const FLUFF = ['none', ...listFrom(fluffCtx).filter((n:string)=>n!=='none')];
const TAIL  = ['none', ...listFrom(tailCtx).filter((n:string)=>n!=='none')];

const CharacterEditor: React.FC<CharacterEditorProps> = ({
  windowId, position, size, zIndex, isMinimized,
  controllerId, currentPlayerId
}) => {
  const dispatch = useAppDispatch();
  const currentAppearance = useAppSelector((s:any)=> s.player.appearance);

  // Local editable state
  const [hue, setHue] = useState<number>(currentAppearance?.hue ?? 0);
  const safeIndex = (arr:string[], val?:string)=>{
    const i = arr.indexOf(val || '');
    return i >=0 ? i : 0;
  };
  const [eyesIdx, setEyesIdx] = useState<number>(safeIndex(EYES, currentAppearance?.eyes));
  const [earsIdx, setEarsIdx] = useState<number>(safeIndex(EARS, currentAppearance?.ears));
  const [fluffIdx, setFluffIdx] = useState<number>(safeIndex(FLUFF, currentAppearance?.fluff));
  const [tailIdx, setTailIdx] = useState<number>(safeIndex(TAIL, currentAppearance?.tail));

  const previewAppearance = useMemo(()=>({
    hue,
    eyes: EYES[eyesIdx],
    ears: EARS[earsIdx],
    fluff: FLUFF[fluffIdx],
    tail: TAIL[tailIdx],
    body: 'CustomBase'
  }), [hue, eyesIdx, earsIdx, fluffIdx, tailIdx]);

  const cycle = (arr: string[], idx: number, dir: number) => (idx + dir + arr.length) % arr.length;

  const save = () => {
    dispatch(setAppearance(previewAppearance));
    socketService.updateAppearance(previewAppearance);
    // Close window via program slice minimise
    dispatch(closeProgram(windowId));
  };

  const cancel = () => {
    dispatch(closeProgram(windowId));
  };

  if (isMinimized) return null;

  const editorStyles = {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      height: '100%',
      padding: '12px',
      background: '#c0c0c0',
      fontFamily: 'Better VCR, MS Sans Serif, sans-serif',
      fontSize: '11px'
    },
    header: {
      textAlign: 'center' as const,
      marginBottom: '16px',
      fontSize: '13px',
      fontWeight: 'bold' as const,
      color: '#000080'
    },
    mainContent: {
      display: 'flex',
      gap: '20px',
      flex: 1,
      alignItems: 'center'
    },
    previewSection: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      gap: '12px',
      background: '#ffffff',
      border: '2px inset #c0c0c0',
      padding: '20px',
      borderRadius: '4px',
      minWidth: '180px'
    },
    previewLabel: {
      fontSize: '12px',
      fontWeight: 'bold' as const,
      color: '#000080',
      marginBottom: '8px'
    },
    controlsSection: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '14px'
    },
    controlGroup: {
      background: '#f0f0f0',
      border: '1px inset #c0c0c0',
      padding: '12px',
      borderRadius: '2px'
    },
    controlRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '8px'
    },
    label: {
      minWidth: '50px',
      fontWeight: 'bold' as const,
      color: '#000080'
    },
    cycleButton: {
      background: '#c0c0c0',
      border: '1px outset #c0c0c0',
      width: '24px',
      height: '20px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      fontFamily: 'Better VCR, MS Sans Serif, sans-serif'
    },
    valueDisplay: {
      flex: 1,
      textAlign: 'center' as const,
      background: '#ffffff',
      border: '1px inset #c0c0c0',
      padding: '4px 8px',
      fontSize: '11px'
    },
    colorSection: {
      background: '#f0f0f0',
      border: '1px inset #c0c0c0',
      padding: '12px',
      borderRadius: '2px'
    },
    colorSlider: {
      width: '100%',
      margin: '8px 0'
    },
    buttonSection: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '8px',
      marginTop: '16px',
      paddingTop: '12px',
      borderTop: '1px solid #808080'
    },
    button: {
      background: '#c0c0c0',
      border: '2px outset #c0c0c0',
      padding: '6px 16px',
      cursor: 'pointer',
      fontFamily: 'Better VCR, MS Sans Serif, sans-serif',
      fontSize: '11px',
      fontWeight: 'bold' as const
    }
  };

  return (
    <ProgramWindow
      windowId={windowId}
      title="Character Editor"
      icon="🖌️"
      position={position}
      size={size}
      zIndex={zIndex}
      isMinimized={false}
      isResizable={false}
    >
      <div style={editorStyles.container}>
        <div style={editorStyles.header}>
          Customize Your Avatar
        </div>
        
        <div style={editorStyles.mainContent}>
          {/* Preview Section */}
          <div style={editorStyles.previewSection}>
            <div style={editorStyles.previewLabel}>Preview</div>
            <Character 
              player={{ id: currentPlayerId, username:'You', position:{x:0, y:0}, quadrant:0, appearance:previewAppearance }}
              isCurrentPlayer={true}
            />
          </div>

          {/* Controls Section */}
          <div style={editorStyles.controlsSection}>
            {/* Features */}
            <div style={editorStyles.controlGroup}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#000080', marginBottom: '10px' }}>
                Features
              </div>
              {[
                {label:'Eyes',   arr:EYES,   idx:eyesIdx,  set:setEyesIdx},
                {label:'Ears',   arr:EARS,   idx:earsIdx,  set:setEarsIdx},
                {label:'Fluff',  arr:FLUFF,  idx:fluffIdx, set:setFluffIdx},
                {label:'Tail',   arr:TAIL,   idx:tailIdx,  set:setTailIdx},
              ].map(({label, arr, idx, set})=> (
                <div key={label} style={editorStyles.controlRow}>
                  <span style={editorStyles.label}>{label}:</span>
                  <button 
                    style={editorStyles.cycleButton}
                    onClick={()=>set(cycle(arr,idx,-1))}
                    onMouseDown={(e) => e.currentTarget.style.border = '1px inset #c0c0c0'}
                    onMouseUp={(e) => e.currentTarget.style.border = '1px outset #c0c0c0'}
                    onMouseLeave={(e) => e.currentTarget.style.border = '1px outset #c0c0c0'}
                  >
                    ◀
                  </button>
                  <div style={editorStyles.valueDisplay}>{arr[idx]}</div>
                  <button 
                    style={editorStyles.cycleButton}
                    onClick={()=>set(cycle(arr,idx,1))}
                    onMouseDown={(e) => e.currentTarget.style.border = '1px inset #c0c0c0'}
                    onMouseUp={(e) => e.currentTarget.style.border = '1px outset #c0c0c0'}
                    onMouseLeave={(e) => e.currentTarget.style.border = '1px outset #c0c0c0'}
                  >
                    ▶
                  </button>
                </div>
              ))}
            </div>

            {/* Color */}
            <div style={editorStyles.colorSection}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#000080', marginBottom: '10px' }}>
                Color
              </div>
              <div style={editorStyles.controlRow}>
                <span style={editorStyles.label}>Hue:</span>
                <input 
                  type="range" 
                  min={0} 
                  max={359} 
                  value={hue} 
                  onChange={e=>setHue(parseInt(e.target.value))} 
                  style={editorStyles.colorSlider}
                />
                <div style={{...editorStyles.valueDisplay, minWidth: '40px'}}>
                  {hue}°
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={editorStyles.buttonSection}>
          <button 
            style={editorStyles.button}
            onClick={cancel}
            onMouseDown={(e) => e.currentTarget.style.border = '2px inset #c0c0c0'}
            onMouseUp={(e) => e.currentTarget.style.border = '2px outset #c0c0c0'}
            onMouseLeave={(e) => e.currentTarget.style.border = '2px outset #c0c0c0'}
          >
            Cancel
          </button>
          <button 
            style={{...editorStyles.button, background: '#0000ff', color: '#ffffff'}}
            onClick={save}
            onMouseDown={(e) => e.currentTarget.style.border = '2px inset #0000ff'}
            onMouseUp={(e) => e.currentTarget.style.border = '2px outset #0000ff'}
            onMouseLeave={(e) => e.currentTarget.style.border = '2px outset #0000ff'}
          >
            Save
          </button>
        </div>
      </div>
    </ProgramWindow>
  );
};

export default CharacterEditor; 