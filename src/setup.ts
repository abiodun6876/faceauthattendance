// src/setup.ts
/**
 * Polyfills for the browser environment.
 * These must be imported BEFORE anything else in index.tsx.
 */

if (typeof window !== 'undefined') {
    // Mock 'global'
    (window as any).global = window;

    // Mock 'process'
    if (!(window as any).process) {
        (window as any).process = {
            env: { NODE_ENV: 'development' }, // Placeholder, bundler will usually override
            cwd: () => '/',
            platform: 'browser',
            nextTick: (cb: Function) => setTimeout(cb, 0)
        };
    }

    // Mock 'Buffer'
    if (!(window as any).Buffer) {
        (window as any).Buffer = {
            from: (data: any) => ({ toString: () => String(data) }),
            alloc: (size: number) => ({ fill: () => ({}) })
        };
    }

    // Mock 'require' for libraries that check for it
    if (!(window as any).require) {
        (window as any).require = function (moduleName: string) {
            const mocks: Record<string, any> = {
                'fs': {
                    readFileSync: () => '',
                    writeFileSync: () => { },
                    existsSync: () => false,
                    mkdirSync: () => { },
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
    }
}

export { };
