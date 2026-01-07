const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs-extra');

const production = process.argv.includes('--production');

async function build() {
    // Ensure output directories exist
    await fs.ensureDir('./client/out');
    await fs.ensureDir('./server/out');

    // Bundle client
    await esbuild.build({
        entryPoints: ['./client/src/extension.ts'],
        bundle: true,
        outfile: './client/out/extension.js',
        external: ['vscode'],
        format: 'cjs',
        platform: 'node',
        target: 'node18',
        sourcemap: !production,
        minify: production,
    });

    // Bundle server
    await esbuild.build({
        entryPoints: ['./server/src/server.ts'],
        bundle: true,
        outfile: './server/out/server.js',
        external: ['vscode', 'web-tree-sitter'],
        format: 'cjs',
        platform: 'node',
        target: 'node18',
        sourcemap: !production,
        minify: production,
        loader: {
            '.json': 'json'
        }
    });

    // Copy tree-sitter.wasm (library)
    const treeSitterWasmSrc = './server/node_modules/web-tree-sitter/tree-sitter.wasm';
    const treeSitterWasmDest = './server/out/tree-sitter.wasm';
    if (await fs.pathExists(treeSitterWasmSrc)) {
        await fs.copy(treeSitterWasmSrc, treeSitterWasmDest);
        console.log('Copied tree-sitter.wasm to server/out');
    } else {
        console.warn('Warning: tree-sitter.wasm not found in node_modules');
    }

    // Copy tree-sitter-pinescript.wasm (grammar)
    const grammarWasmSrc = './server/wasm/tree-sitter-pinescript.wasm';
    const grammarWasmDest = './server/out/tree-sitter-pinescript.wasm';
    if (await fs.pathExists(grammarWasmSrc)) {
        await fs.copy(grammarWasmSrc, grammarWasmDest);
        console.log('Copied tree-sitter-pinescript.wasm to server/out');
    }

    console.log('Build complete!');
}

build().catch((err) => {
    console.error(err);
    process.exit(1);
});
