const { Parser, Language } = require('web-tree-sitter');
const path = require('path');
const fs = require('fs');

async function debug() {
    await Parser.init();
    const parser = new Parser();
    const wasmPath = path.join(__dirname, '../wasm/tree-sitter-pinescript.wasm');
    const lang = await Language.load(wasmPath);
    parser.setLanguage(lang);

    const scriptPath = '/Users/revanth/My-Code/Trading/pine-scripts/revanth-enhanced-indicator.pine';
    const code = fs.readFileSync(scriptPath, 'utf8');
    const tree = parser.parse(code);

    const startLine = 524;
    const endLine = 527;

    console.log(`--- Tree Detail (Lines ${startLine}-${endLine}) ---`);
    const printNode = (node, indent = 0) => {
        const line = node.startPosition.row + 1;
        if (line >= startLine && line <= endLine) {
            const prefix = '  '.repeat(indent);
            console.log(`${prefix}Line ${line}: ${node.type} (${node.text.substring(0, 40).replace(/\n/g, '\\n')})`);
            for (const child of node.children) printNode(child, indent + 1);
        } else {
            if (node.startPosition.row + 1 < startLine && node.endPosition.row + 1 >= startLine) {
                for (const child of node.children) printNode(child, indent);
            }
        }
    };
    printNode(tree.rootNode);
}
debug().catch(err => { console.error(err); process.exit(1); });
