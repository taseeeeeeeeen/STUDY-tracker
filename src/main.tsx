// Intercept Firestore network timeout notifications and log as warnings
if (typeof console !== 'undefined' && console.error) {
  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const fullLog = args
      .map((a) => {
        if (typeof a === 'string') return a;
        if (a && typeof a === 'object' && 'message' in a && typeof (a as { message?: unknown }).message === 'string') {
          return (a as { message: string }).message;
        }
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(' ')
      .toLowerCase();

    if (
      fullLog.includes('could not reach cloud firestore backend') ||
      fullLog.includes('@firebase/firestore') ||
      fullLog.includes("backend didn't respond within") ||
      fullLog.includes('client will operate in offline mode') ||
      fullLog.includes('connection failed') ||
      fullLog.includes('failed to get document') ||
      fullLog.includes('failed to set chapter progress batch') ||
      fullLog.includes('failed to sync') ||
      fullLog.includes('firestore connectivity issue')
    ) {
      console.warn(...args);
      return;
    }
    originalConsoleError(...args);
  };
}

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
