import * as path from 'path';
import * as fs from 'fs';
import { Parser, Language } from 'web-tree-sitter';
import { Analyzer } from '../src/analyzer';

// @ts-ignore
import definitions from '../src/data/definitions.json';

declare global {
    interface EmscriptenModule { }
}

async function runTests() {
    const analyzer = new Analyzer(definitions);

    await Parser.init();
    const parser = new Parser();
    const wasmPath = path.join(__dirname, '../../wasm/tree-sitter-pinescript.wasm');
    const lang = await Language.load(wasmPath);
    parser.setLanguage(lang);

    const testCases = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8'));

    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
        console.log(`\nTesting: ${testCase.name}`);
        const tree = parser.parse(testCase.code);
        if (!tree) {
            console.log('❌ Failed: Parser returned null tree');
            failed++;
            continue;
        }

        const rootNode = adaptNode(tree.rootNode);
        const diagnostics = analyzer.analyze(rootNode);

        const errorCount = diagnostics.filter(d => d.severity === 1).length;

        if (errorCount === testCase.expectedErrors) {
            console.log('✅ Passed');
            passed++;
        } else {
            console.log(`❌ Failed: Expected ${testCase.expectedErrors} errors, found ${errorCount}`);
            diagnostics.forEach(d => console.log(`   - [${d.severity}] ${d.message}`));
            failed++;
        }

        if (testCase.errorMessages) {
            let messagesFound = true;
            for (const expectedMsg of testCase.errorMessages) {
                const found = diagnostics.some(d => {
                    const msg = typeof d.message === 'string' ? d.message : d.message.value;
                    return msg.includes(expectedMsg);
                });
                if (!found) {
                    console.log(`❌ Failed: Could not find expected message: "${expectedMsg}"`);
                    messagesFound = false;
                }
            }
            if (!messagesFound && errorCount === testCase.expectedErrors) {
                // We previously said "Passed" because the count matched, but now we must fail it
                console.log(`❌ Failed (Message mismatch)`);
                passed--;
                failed++;
                continue;
            }
        }

        // Definition Check (TDD)
        if (testCase.checkDefinition) {
            let targetNode: any = null;
            const stack = [rootNode];
            while(stack.length > 0) {
                const n = stack.pop();
                if (n.text === testCase.checkDefinition.name && n.type === 'identifier') {
                    targetNode = n;
                }
                for (let i = 0; i < n.childCount; i++) stack.push(n.child(i));
            }
            
            const range = (analyzer as any).getDefinitionLocation && targetNode ? (analyzer as any).getDefinitionLocation(targetNode) : undefined;
            if (!range) {
                const defFunc = (analyzer as any).getFunctionDefinition ? (analyzer as any).getFunctionDefinition(testCase.checkDefinition.name) : undefined;
                const defSym = analyzer.getSymbol(testCase.checkDefinition.name);
                const fbRange = defFunc?.range || defSym?.range;
                if (!fbRange) {
                    console.log(`❌ Failed: Could not find definition range for '${testCase.checkDefinition.name}'`);
                    passed--;
                    failed++;
                    continue;
                } else if (fbRange.start.line !== testCase.checkDefinition.expectedLine) {
                    console.log(`❌ Failed: Expected definition of '${testCase.checkDefinition.name}' at line ${testCase.checkDefinition.expectedLine}, found at ${fbRange.start.line}`);
                    passed--;
                    failed++;
                    continue;
                }
            } else if (range.start.line !== testCase.checkDefinition.expectedLine) {
                console.log(`❌ Failed: Expected definition of '${testCase.checkDefinition.name}' at line ${testCase.checkDefinition.expectedLine}, found at ${range.start.line}`);
                passed--;
                failed++;
                continue;
            }
        }

        // Inlay Hints Check (TDD)
        if (testCase.expectedInlayHints) {
            if (typeof (analyzer as any).getInlayHints !== 'function') {
                console.log(`❌ Failed: getInlayHints method not implemented on Analyzer yet.`);
                passed--;
                failed++;
                continue;
            }
            const hints = (analyzer as any).getInlayHints(rootNode);
            const hintLabels = hints.map((h: any) => h.label);
            let missing = false;
            for (const expected of testCase.expectedInlayHints) {
                if (!hintLabels.includes(expected)) {
                    console.log(`❌ Failed: Expected inlay hint '${expected}', found: [${hintLabels.join(', ')}]`);
                    missing = true;
                    break;
                }
            }
            if (missing) {
                passed--;
                failed++;
                continue;
            }
        }

        // Formatting Check (TDD)
        if (testCase.expectedFormattedCode) {
            if (typeof (analyzer as any).formatDocument !== 'function') {
                console.log(`❌ Failed: formatDocument method not implemented on Analyzer yet.`);
                passed--;
                failed++;
                continue;
            }
            const edits = (analyzer as any).formatDocument(testCase.code);
            let formattedText = testCase.code;
            const lines = testCase.code.split(/\r?\n/);
            for (const edit of edits) {
                lines[edit.range.start.line] = edit.newText;
            }
            formattedText = lines.join('\n');
            
            if (formattedText !== testCase.expectedFormattedCode) {
                console.log(`❌ Failed: Expected formatted code mismatch.\nExpected:\n${testCase.expectedFormattedCode}\n\nGot:\n${formattedText}`);
                passed--;
                failed++;
                continue;
            }
        }
    }

    console.log(`\n--- Results: ${passed} Passed, ${failed} Failed ---`);
    process.exit(failed > 0 ? 1 : 0);
}

function adaptNode(node: any, parent: any = null): any {
    const adapted: any = {
        type: node.type,
        text: node.text,
        startPosition: node.startPosition,
        endPosition: node.endPosition,
        startIndex: node.startIndex,
        endIndex: node.endIndex,
        childCount: node.childCount,
        namedChildCount: node.namedChildCount,
        parent: parent,
        child: (i: number) => {
            const c = node.child(i);
            return c ? adaptNode(c, adapted) : null;
        },
        namedChild: (i: number) => {
            const c = node.namedChild(i);
            return c ? adaptNode(c, adapted) : null;
        },
        childForFieldName: (name: string) => {
            const c = node.childForFieldName(name);
            return c ? adaptNode(c, adapted) : null;
        }
    };
    adapted.children = node.children.map((c: any) => adaptNode(c, adapted));
    adapted.namedChildren = node.namedChildren.map((c: any) => adaptNode(c, adapted));
    return adapted;
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
