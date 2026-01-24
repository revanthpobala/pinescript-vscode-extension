import * as path from 'path';
import { Parser, Language } from 'web-tree-sitter';

async function debugStructure() {
    await Parser.init();
    const parser = new Parser();
    const wasmPath = path.join(__dirname, '../wasm/tree-sitter-pinescript.wasm');
    const lang = await Language.load(wasmPath);
    parser.setLanguage(lang);

    const code = `//@version=6
if alert('hi')
    plot(close)
`;

    const tree = parser.parse(code);
    if (!tree) {
        console.log('Parser returned null tree');
        return;
    }
    const root = tree.rootNode;

    function walk(node: any, depth = 0) {
        const indent = '  '.repeat(depth);
        console.log(`${indent}${node.type} (text: ${node.text.split('\n')[0].substring(0, 20)}...) - Parent: ${node.parent ? node.parent.type : 'null'}`);
        for (let i = 0; i < node.namedChildCount; i++) {
            walk(node.namedChild(i), depth + 1);
        }
    }

    walk(root);
}

debugStructure();
