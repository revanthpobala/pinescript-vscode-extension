import { Analyzer } from '../src/analyzer';
import * as definitions from '../src/data/definitions.json';


// Mock SyntaxNode
function createNode(type: string, text: string, parent: any = null): any {
    const node = {
        type,
        text,
        parent,
        childForFieldName: (name: string) => null,
        children: [],
        namedChildren: [],
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: text.length }
    };
    return node;
}

const analyzer = new Analyzer(definitions);

function test() {
    console.log("Running Linter Verification Tests (with more detailed cases)...\n");

    const cases = [
        { type: 'identifier', text: 'float', parentType: 'variable_declaration', expectedError: false },
        { type: 'identifier', text: 'na', parentType: 'assignment', expectedError: false },
        { type: 'identifier', text: 'alert.freq_all', parentType: 'argument', expectedError: false },
        { type: 'identifier', text: 'color.white', parentType: 'assignment', expectedError: false },
        { type: 'identifier', text: 'float', parentType: 'parameter', expectedError: false },
        { type: 'identifier', text: 'alert', parentType: 'assignment', expectedError: false },
        { type: 'identifier', text: 'ta.tr', parentType: 'argument', expectedError: false },
    ];

    for (const c of cases) {
        const parent = c.parentType ? createNode(c.parentType, 'parent') : null;
        const node = createNode(c.type, c.text, parent);

        const diagnostics: any[] = [];
        (analyzer as any).handleIdentifier(node, diagnostics);

        const hasError = diagnostics.length > 0;
        const passed = hasError === c.expectedError;

        console.log(`${passed ? '✅' : '❌'} Test case: "${c.text}" (context: ${c.parentType})`);
        if (!passed) {
            console.log(`   Expected error: ${c.expectedError}, Got error: ${hasError}`);
            if (hasError) console.log(`   Error message: ${diagnostics[0].message}`);
        }
    }
}

test();
