const { Parser, Language } = require('web-tree-sitter');
const path = require('path');

async function debug() {
    await Parser.init();
    const parser = new Parser();
    const wasmPath = path.join(__dirname, '../wasm/tree-sitter-pinescript.wasm');
    const lang = await Language.load(wasmPath);
    parser.setLanguage(lang);

    const snippets = [
        `[math.min(100, bFnl), math.min(100, sFnl)]`,
        `int[] gaps = array.from(23, 10, 4, 1)`,
        `sortByWeight(float[] lvls) =>\n    int n = 0\n    n`,
        `if isLong\n    math.max(1, 2)`
    ];

    snippets.forEach((code, i) => {
        console.log(`--- Snippet ${i} ---`);
        const tree = parser.parse(code);
        const printNode = (node, indent = 0) => {
            const prefix = '  '.repeat(indent);
            console.log(`${prefix}${node.type}: "${node.text.substring(0, 40).replace(/\n/g, '\\n')}"`);
            for (const child of node.children) printNode(child, indent + 1);
        };
        printNode(tree.rootNode);
    });
}
debug().catch(err => { console.error(err); process.exit(1); });
