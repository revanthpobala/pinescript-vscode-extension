const Parser = require('web-tree-sitter');
const path = require('path');
const fs = require('fs');

async function debug() {
    await Parser.init();
    const parser = new Parser();
    const WasmPath = path.join(__dirname, '../out/tree-sitter-pinescript.wasm');
    const Lang = await Parser.Language.load(WasmPath);
    parser.setLanguage(Lang);

    const filePath = process.argv[2];
    const targetLine = parseInt(process.argv[3]) - 1;
    const content = fs.readFileSync(filePath, 'utf8');
    const tree = parser.parse(content);

    function walk(node, depth = 0) {
        if (node.startPosition.row === targetLine) {
            console.log('  '.repeat(depth) + `Node: ${node.type} [${node.text}] Parent: ${node.parent?.type}`);
        }
        for (let i = 0; i < node.childCount; i++) {
            walk(node.child(i), depth + 1);
        }
    }

    walk(tree.rootNode);
}

debug();
