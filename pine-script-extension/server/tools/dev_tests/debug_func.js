const { Parser, Language } = require('web-tree-sitter');
const path = require('path');

async function debug() {
    await Parser.init();
    const parser = new Parser();
    const wasmPath = path.join(__dirname, '../wasm/tree-sitter-pinescript.wasm');
    const lang = await Language.load(wasmPath);
    parser.setLanguage(lang);

    const code = `finalizeConsolidatedScores(float bS, float sS, bool bSw, bool bF, bool sSw, bool sF, bool isNH, int wStg, bool iG, bool hasRS, bool hasAccel) =>
    // Base Bonuses
    float bBonus = (bSw ? 10 : 0) + (bF ? 5 : 0) + (hasRS ? 10 : 0) + (hasAccel ? 5 : 0)
    float sBonus = (sSw ? 10 : 0) + (sF ? 5 : 0) + (hasRS ? 0 : 0) + (hasAccel ? 5 : 0) // RS usually bullish, Accel works both ways if slope checked correctly
    
    b = bS + bBonus
    s = sS + sBonus
    
    // Stage Constraints
    bFnl = (isNH and wStg == 2 and b < 80) ? 85 : b
    sFnl = (iG and s > 60) ? 60 : s
    
    [math.min(100, bFnl), math.min(100, sFnl)]`;

    console.log(`--- Testing finalizeConsolidatedScores ---`);
    const tree = parser.parse(code);
    const printNode = (node, indent = 0) => {
        if (node.type === 'ERROR') {
            console.warn(`${'  '.repeat(indent)}ERROR: "${node.text.substring(0, 50).replace(/\n/g, '\\n')}"`);
        }
        for (const child of node.children) printNode(child, indent + 1);
    };
    printNode(tree.rootNode);

    // Print the types of the main nodes
    console.log('\n--- Top Level Structure ---');
    tree.rootNode.children.forEach(c => console.log(`${c.type}: "${c.text.substring(0, 30)}..."`));
}
debug().catch(err => { console.error(err); process.exit(1); });
