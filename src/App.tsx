import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { socketService } from './services/socketService';
import { useAppSelector, useAppDispatch } from './store/hooks';
import { setInventoryData } from './store/inventorySlice';
import AuthScreen from './components/AuthScreen';
import Desktop from './components/Desktop';
import './App.css';
import { authService } from './services/authService';
import CRTEffect from './components/CRTEffect';

const AppContent: React.FC = () => {
  const dispatchRedux = useAppDispatch();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const { current: currentDextop } = useAppSelector((state) => state.dextop);

  useEffect(() => {
    // Connect to socket when app starts (but don't join anything yet)
    socketService.connect();

    // Preload inventory once authenticated so cosmetics have asset paths
    const fetchInventory = async () => {
      if (!authService.isAuthenticated()) return;
      const inv = await authService.loadInventory();
      if (inv) {
        let processed = { ...inv } as any;
        if (processed.currentItemIds && processed.currentItemIds.length === 1) {
          const itemMeta = processed.items.find((it:any)=>it.id===processed.currentItemIds[0]);
          if (itemMeta && /happyface\.png$/i.test(itemMeta.asset_path || '')) {
            processed.currentItemIds = [];
          }
        }
        dispatchRedux(setInventoryData(processed));
        socketService.broadcastCosmetics();
      }
    };
    fetchInventory();

    // Cleanup on unmount
    return () => {
      socketService.disconnect();
    };
  }, []);

  // Show auth screen if not authenticated
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  // Show desktop if authenticated and dextop is loaded
  return (
    <div className="App">
      <CRTEffect />
      <Desktop />
    </div>
  );
};

function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}

export default App;
