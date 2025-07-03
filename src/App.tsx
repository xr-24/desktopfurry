import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { socketService } from './services/socketService';
import { useAppSelector } from './store/hooks';
import AuthScreen from './components/AuthScreen';
import Desktop from './components/Desktop';
import './App.css';

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const { current: currentDextop } = useAppSelector((state) => state.dextop);

  useEffect(() => {
    // Connect to socket when app starts (but don't join anything yet)
    socketService.connect();

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
