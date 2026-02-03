// src/index.tsx
// Move ALL imports to the top
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Then run the setup code
if (typeof window !== 'undefined') {
  // Mock Node.js modules for browser
  (window as any).global = window;
  
  // Mock require function
  (window as any).require = function(moduleName: string) {
    const mocks: Record<string, any> = {
      'fs': {
        readFileSync: () => '',
        writeFileSync: () => {},
        existsSync: () => false,
        mkdirSync: () => {},
        readdirSync: () => []
      },
      'path': {
        join: (...args: string[]) => args.join('/'),
        dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
        resolve: (...args: string[]) => args.join('/'),
        sep: '/'
      },
      'os': {
        tmpdir: () => '/tmp',
        platform: () => 'browser'
      }
    };
    return mocks[moduleName] || {};
  };

  // Mock process
  if (!(window as any).process) {
    (window as any).process = {
      env: { NODE_ENV: process.env.NODE_ENV || 'development' },
      cwd: () => '/',
      platform: 'browser',
      nextTick: (cb: Function) => setTimeout(cb, 0)
    };
  }

  // Mock Buffer
  if (!(window as any).Buffer) {
    (window as any).Buffer = {
      from: (data: any) => ({ toString: () => String(data) }),
      alloc: (size: number) => ({ fill: () => ({}) })
    };
  }
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);