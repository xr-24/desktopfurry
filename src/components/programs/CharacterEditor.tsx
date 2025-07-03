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

const EYES  = listFrom(eyesCtx);
const EARS  = listFrom(earsCtx);
const FLUFF = listFrom(fluffCtx);
const TAIL  = listFrom(tailCtx);

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
    tail: TAIL[tailIdx]
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
      <div style={{ display:'flex', height:'100%', padding:8 }}>
        {/* Preview */}
        <div style={{ flex:'0 0 180px', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Character 
            player={{ id: currentPlayerId, username:'You', position:{x:0, y:0}, quadrant:0, appearance:previewAppearance }}
            isCurrentPlayer={true}
          />
        </div>
        {/* Controls */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
          {[
            {label:'Eyes',   arr:EYES,   idx:eyesIdx,  set:setEyesIdx},
            {label:'Ears',   arr:EARS,   idx:earsIdx,  set:setEarsIdx},
            {label:'Fluff',  arr:FLUFF,  idx:fluffIdx, set:setFluffIdx},
            {label:'Tail',   arr:TAIL,   idx:tailIdx,  set:setTailIdx},
          ].map(({label, arr, idx, set})=> (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ width:60 }}>{label}:</span>
              <button onClick={()=>set(cycle(arr,idx,-1))}>{'◀'}</button>
              <span style={{ flex:1, textAlign:'center' }}>{arr[idx]}</span>
              <button onClick={()=>set(cycle(arr,idx,1))}>{'▶'}</button>
            </div>
          ))}

          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ width:60 }}>Colour:</span>
            <input type="range" min={0} max={359} value={hue} onChange={e=>setHue(parseInt(e.target.value))} style={{ flex:1 }} />
          </div>

          <div style={{ marginTop:'auto', display:'flex', justifyContent:'flex-end', gap:6 }}>
            <button onClick={save}>Save</button>
            <button onClick={cancel}>Cancel</button>
          </div>
        </div>
      </div>
    </ProgramWindow>
  );
};

export default CharacterEditor; 