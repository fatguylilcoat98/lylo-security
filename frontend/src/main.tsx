// --- THE GLOBAL TRAP (Starts Here) ---
window.onerror = function(message, source, lineno, colno, error) {
  // 1. Wipe the screen clean
  document.body.innerHTML = '';
  
  // 2. Create the Red Error Box
  const container = document.createElement('div');
  container.style.cssText = 'background: #1a0000; color: #ff4444; padding: 30px; font-family: monospace; height: 100vh; overflow: auto;';
  
  container.innerHTML = `
    <h1 style="color: white; font-size: 28px; border-bottom: 2px solid #ff4444; padding-bottom: 15px;">🚨 CRITICAL STARTUP ERROR</h1>
    <div style="margin-top: 20px; font-size: 18px;">
      <p><strong>The Crash:</strong> <span style="color: white;">${message}</span></p>
      <p><strong>File:</strong> ${source}</p>
      <p><strong>Line Number:</strong> ${lineno}</p>
    </div>
    <div style="margin-top: 30px; background: black; padding: 20px; border: 1px solid #ff4444; color: #cccccc;">
      <strong>Stack Trace:</strong><br/>
      <pre style="white-space: pre-wrap;">${error ? error.stack : 'No stack trace available.'}</pre>
    </div>
    <h2 style="margin-top: 40px; color: #4ade80;">👉 SCREENSHOT THIS FOR GEMINI</h2>
  `;
  
  document.body.appendChild(container);
};
// --- THE GLOBAL TRAP (Ends Here) ---


import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
