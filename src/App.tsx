import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { socketService } from './services/socketService';
import Lobby from './components/Lobby';
import Desktop from './components/Desktop';
import './App.css';

const AppContent: React.FC = () => {
  useEffect(() => {
    // Connect to socket when app starts
    socketService.connect();

    // Cleanup on unmount
    return () => {
      socketService.disconnect();
    };
  }, []);

  return (
    <div className="App">
      <Lobby />
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
