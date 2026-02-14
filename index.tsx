import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Explicitly resolve the Service Worker URL to the current window's origin.
    // This prevents the browser from incorrectly resolving relative paths to the platform's
    // root domain (e.g., ai.studio) instead of the actual hosted origin (e.g., usercontent.goog).
    try {
      const swUrl = new URL('./sw.js', window.location.href).href;
      
      navigator.serviceWorker.register(swUrl)
        .then((registration) => {
          console.log('IronFlow SW registered at:', registration.scope);
        })
        .catch((err) => {
          // Log as warning rather than error to avoid cluttering consoles in development/sandbox environments
          // where Service Workers might be blocked by platform security policies.
          console.warn('IronFlow SW registration failed:', err.message);
        });
    } catch (e) {
      console.warn('IronFlow SW URL resolution failed:', e);
    }
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
