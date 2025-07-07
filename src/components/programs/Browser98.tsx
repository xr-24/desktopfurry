import React, { useState, useEffect, useCallback } from 'react';
import ProgramWindow from '../ProgramWindow';
import { useAppDispatch } from '../../store/hooks';
import { updateProgramState } from '../../store/programSlice';

interface BrowserState {
  currentUrl: string;
  history: string[];
  historyIndex: number;
  snapshotTimestamp?: string | null;
}

interface BrowserProps {
  windowId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
  programState: BrowserState;
  controllerId: string;
  currentPlayerId: string;
}

// Helper to normalise user input (prepend http if missing)
const normaliseUrl = (raw: string) => {
  if (!raw) return 'https://www.gameinformer.com';
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = 'http://' + url;
  }
  return url;
};

const JAN1998_TS = '19980101000000';
const buildWayback = (url: string, ts?: string | null) => {
  const base = `https://web.archive.org/web/${ts || JAN1998_TS}if_/${url}`;
  return base.endsWith('/') ? base : base + '/';
};

const Browser98: React.FC<BrowserProps> = ({
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
  const [addressBar, setAddressBar] = useState(programState.currentUrl || '');
  const isHost = controllerId === currentPlayerId;

  // Keep address bar in sync if host navigates elsewhere
  useEffect(() => {
    setAddressBar(programState.currentUrl || '');
  }, [programState.currentUrl]);

  const fetchTimestamp = async (url: string): Promise<string | null> => {
    try {
      const resp = await fetch(
        `https://archive.org/wayback/available?url=${encodeURIComponent(url)}&timestamp=19980101`
      );
      const data = await resp.json();
      if (data?.archived_snapshots?.closest?.available) {
        return data.archived_snapshots.closest.timestamp as string;
      }
    } catch (err) {
      console.warn('Wayback lookup failed', err);
    }
    return null;
  };

  const navigate = useCallback(
    async (raw: string) => {
      if (!isHost) return; // spectators cannot navigate
      const url = normaliseUrl(raw);

      const ts = await fetchTimestamp(url);

      const newHistory = [...programState.history.slice(0, programState.historyIndex + 1), url];
      dispatch(
        updateProgramState({
          windowId,
          newState: {
            currentUrl: url,
            history: newHistory,
            historyIndex: newHistory.length - 1,
            snapshotTimestamp: ts,
          },
        })
      );
    },
    [dispatch, isHost, programState.history, programState.historyIndex, windowId]
  );

  const goBack = async () => {
    if (!isHost) return;
    if (programState.historyIndex > 0) {
      const newIndex = programState.historyIndex - 1;
      const url = programState.history[newIndex];
      const ts = await fetchTimestamp(url);
      dispatch(
        updateProgramState({
          windowId,
          newState: {
            currentUrl: url,
            historyIndex: newIndex,
            snapshotTimestamp: ts,
          },
        })
      );
    }
  };

  const goForward = async () => {
    if (!isHost) return;
    if (programState.historyIndex < programState.history.length - 1) {
      const newIndex = programState.historyIndex + 1;
      const url = programState.history[newIndex];
      const ts = await fetchTimestamp(url);
      dispatch(
        updateProgramState({
          windowId,
          newState: {
            currentUrl: url,
            historyIndex: newIndex,
            snapshotTimestamp: ts,
          },
        })
      );
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      navigate(addressBar);
    }
  };

  if (isMinimized) return null;

  const toolbarHeight = 32;
  const iframeHeight = size.height - toolbarHeight - 20; // padding compensation

  const targetSrc = buildWayback(programState.currentUrl, programState.snapshotTimestamp);

  return (
    <ProgramWindow
      windowId={windowId}
      title={`Browser 98`}
      icon="🌐"
      position={position}
      size={size}
      zIndex={zIndex}
      isMinimized={false}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px',
          background: '#c0c0c0',
          height: toolbarHeight,
          fontFamily: 'Better VCR, MS Sans Serif, sans-serif',
          fontSize: 12,
        }}
      >
        <button onClick={goBack} disabled={!isHost || programState.historyIndex <= 0}>
          ◀
        </button>
        <button
          onClick={goForward}
          disabled={!isHost || programState.historyIndex >= programState.history.length - 1}
        >
          ▶
        </button>
        <input
          style={{ flex: 1 }}
          value={addressBar}
          onChange={(e) => setAddressBar(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={!isHost}
        />
        <button onClick={() => navigate(addressBar)} disabled={!isHost}>
          Go
        </button>
      </div>

      {/* Content */}
      <iframe
        key={programState.currentUrl + (programState.snapshotTimestamp || '')} // reload when url changes
        src={targetSrc}
        style={{ width: '100%', height: iframeHeight, border: 'none' }}
        sandbox="allow-same-origin allow-scripts allow-forms"
        title="Browser98"
      />
    </ProgramWindow>
  );
};

export default Browser98; 