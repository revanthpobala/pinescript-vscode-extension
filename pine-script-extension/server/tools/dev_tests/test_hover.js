const { Analyzer } = require('../out/analyzer');
const { Parser, Language } = require('web-tree-sitter');
const path = require('path');
const fs = require('fs');

async function testHover() {
    console.log('--- Testing Hover Logic (Simulated) ---');
    await Parser.init();
    const parser = new Parser();
    const wasmPath = path.join(__dirname, '../wasm/tree-sitter-pinescript.wasm');
    const lang = await Language.load(wasmPath);
    parser.setLanguage(lang);

    const definitions = JSON.parse(fs.readFileSync(path.join(__dirname, '../out/data/definitions.json'), 'utf8'));

    const code = `adx := ta.alma()`;
    const tree = parser.parse(code);
    const root = tree.rootNode;

    // Simulation of hover logic in server.ts
    const findNodeAt = (node, line, col) => {
        if (node.startPosition.row <= line && node.endPosition.row >= line &&
            (node.startPosition.row < line || node.startPosition.column <= col) &&
            (node.endPosition.row > line || node.endPosition.column >= col)) {
            for (const child of node.children) {
                const found = findNodeAt(child, line, col);
                if (found) return found;
            }
            return node;
        }
        return null;
    };

    const testPos = { line: 0, char: 10 }; // on 'alma'
    const node = findNodeAt(root, testPos.line, testPos.char);

    console.log(`Node at ${testPos.line}:${testPos.char}: "${node.text}" (type: ${node.type})`);
    console.log(`Parent type: ${node.parent.type}`);

    let word = node.text;
    if (node.parent?.type === 'member_access') {
        word = node.parent.text;
    }
    console.log(`Derived word for hover: "${word}"`);

    const def = definitions.functions.find(f => f.name === word);
    console.log(`Definition found: ${!!def}`);
    if (def) console.log(`Description: ${def.description.substring(0, 50)}...`);
}

testHover().catch(err => { console.error(err); process.exit(1); });
