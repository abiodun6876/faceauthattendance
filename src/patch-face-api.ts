// src/patch-face-api.ts
// Patch face-api.js to work in browser environment

// Add export statement to make it a module
export function patchFaceAPI() {
  // Only run in browser
  if (typeof window === 'undefined') return;

  console.log('Patching face-api.js for browser environment...');

  // Mock Node.js modules
  const mockFs = {
    readFileSync: () => '',
    writeFileSync: () => {},
    existsSync: () => false,
    mkdirSync: () => {},
    readdirSync: () => []
  };

  const mockPath = {
    join: (...args: string[]) => args.join('/'),
    dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
    resolve: (...args: string[]) => args.join('/'),
    sep: '/'
  };

  const mockOs = {
    tmpdir: () => '/tmp',
    platform: () => 'browser'
  };

  // Override require function
  const originalRequire = (window as any).require;

  (window as any).require = function(moduleName: string) {
    switch (moduleName) {
      case 'fs':
        return mockFs;
      case 'path':
        return mockPath;
      case 'os':
        return mockOs;
      default:
        return originalRequire ? originalRequire(moduleName) : {};
    }
  };

  // Mock process
  if (typeof (global as any).process === 'undefined') {
    (global as any).process = {
      env: { NODE_ENV: 'development' },
      cwd: () => '/',
      platform: 'browser'
    };
  }

  // Mock Buffer
  if (typeof (global as any).Buffer === 'undefined') {
    (global as any).Buffer = {
      from: (data: any) => ({ toString: () => String(data) }),
      alloc: (size: number) => ({ fill: () => ({}) })
    };
  }
}