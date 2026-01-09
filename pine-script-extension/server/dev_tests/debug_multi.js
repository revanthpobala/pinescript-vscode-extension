const { Parser, Language } = require('web-tree-sitter');
const path = require('path');

async function debug() {
    await Parser.init();
    const parser = new Parser();
    const wasmPath = path.join(__dirname, '../wasm/tree-sitter-pinescript.wasm');
    const lang = await Language.load(wasmPath);
    parser.setLanguage(lang);

    const code = `float bScore = array.get(mtr, 0), float sScore = array.get(mtr, 1), float sigQual = array.get(mtr, 2)`;

    console.log(`--- Testing multi-declaration ---`);
    const tree = parser.parse(code);
    const printNode = (node, indent = 0) => {
        const prefix = '  '.repeat(indent);
        console.log(`${prefix}${node.type}: "${node.text.substring(0, 40).replace(/\n/g, '\\n')}"`);
        for (const child of node.children) printNode(child, indent + 1);
    };
    printNode(tree.rootNode);
}
debug().catch(err => { console.error(err); process.exit(1); });
