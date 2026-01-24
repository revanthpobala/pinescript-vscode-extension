const { Parser, Language } = require('web-tree-sitter');
const path = require('path');
const fs = require('fs');

async function main() {
    await Parser.init();
    const parser = new Parser();
    const wasmPath = path.join(__dirname, '../out/tree-sitter-pinescript.wasm');
    const lang = await Language.load(wasmPath);
    parser.setLanguage(lang);

    const scriptPath = process.argv[2];
    const targetLine = parseInt(process.argv[3]);

    if (!scriptPath || isNaN(targetLine)) {
        console.error("Usage: node inspect_ast.js <path_to_pine_script> <line_number>");
        process.exit(1);
    }

    const code = fs.readFileSync(scriptPath, 'utf8');
    const lines = code.split('\n');
    const tree = parser.parse(code);

    // Find all nodes that overlap the target line
    const overlappingNodes = [];
    const collectOverlapping = (n) => {
        if (n.startPosition.row <= targetLine - 1 && n.endPosition.row >= targetLine - 1) {
            overlappingNodes.push(n);
        }
        for (let j = 0; j < n.childCount; j++) {
            collectOverlapping(n.child(j));
        }
    };
    collectOverlapping(tree.rootNode);

    const node = overlappingNodes[overlappingNodes.length - 1]; // Deepest node

    if (!node) {
        console.log(`No node found on line ${targetLine}`);
        process.exit(0);
    }

    console.log(`Line ${targetLine}: ${lines[targetLine - 1].trim()}`);
    console.log(`Node Type: ${node.type}`);
    console.log(`Node Text: ${node.text.substring(0, 100)}`);

    let current = node;
    console.log('\n--- Ancestor Chain & Siblings ---');
    while (current) {
        console.log(`\nNode: ${current.type} [${current.startPosition.row + 1}:${current.startPosition.column}]`);
        if (current.parent) {
            console.log('Siblings:');
            for (let i = 0; i < current.parent.childCount; i++) {
                const child = current.parent.child(i);
                const isMatch = child.startIndex === current.startIndex;
                console.log(`${isMatch ? '*' : ' '} ${child.type}: ${child.text.substring(0, 50).replace(/\n/g, ' ')}`);
            }
        }
        current = current.parent;
    }
}

main().catch(console.error);
