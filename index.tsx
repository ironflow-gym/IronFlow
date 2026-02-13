import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Relative path is safest for same-origin requirements
    // and correctly resolves relative to the current page.
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('IronFlow SW registered at:', registration.scope);
      })
      .catch((err) => {
        console.error('IronFlow SW registration failed:', err);
      });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);