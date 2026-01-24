
const { Analyzer } = require('./src/analyzer');
const { Parser, Language } = require('web-tree-sitter');
const path = require('path');
const fs = require('fs');

async function test() {
    await Parser.init();
    const parser = new Parser();
    const wasmPath = path.join(__dirname, 'out/tree-sitter-pinescript.wasm');
    const lang = await Language.load(wasmPath);
    parser.setLanguage(lang);

    const definitions = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/data/definitions.json'), 'utf8'));
    const analyzer = new Analyzer(definitions);

    const code = fs.readFileSync('../../testing/testing.pine', 'utf8');
    const tree = parser.parse(code);
    analyzer.analyze(tree.rootNode);
    // Dump global scope
    const globalScope = analyzer.scopeStack[0];
    console.log('Global Scope Count: ' + globalScope.size);
    for (const [name, info] of globalScope) {
        if (info.name !== 'any' && info.name !== 'namespace') {
            console.log(`  ${name}: ${info.name}`);
        }
    }
}

test();
