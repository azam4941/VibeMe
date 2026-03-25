import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}

// Handle Android hardware back button
// Uses the Capacitor App plugin to intercept the back button
const setupBackButton = async () => {
  try {
    const { App: CapApp } = await import('@capacitor/app');
    
    CapApp.addListener('backButton', ({ canGoBack }) => {
      // If there's browser history to go back to, go back
      if (window.history.length > 1) {
        window.history.back();
      } else {
        // On the root/home page, minimize the app instead of exiting
        CapApp.minimizeApp();
      }
    });
  } catch (e) {
    // Not running in Capacitor (e.g. browser dev mode), skip
    console.log('Capacitor App plugin not available (running in browser)');
  }
};

setupBackButton();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
