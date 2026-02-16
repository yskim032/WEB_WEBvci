const parser = require('./js/parser.js');

console.log("Testing resolveTypeEntry...");

const testCases = [
    { input: '20DV', expected: '20DV' },
    { input: ' 20dv ', expected: '20DV' },
    { input: '2210', expected: '20DV' }, // 2210 -> 20DV or 20DC (first match)
    { input: 2210, expected: '20DV' },
    { input: '40HC', expected: '40HC' },
    { input: '4510', expected: '40HC' },
    { input: 'UNKNOWN', expected: 'UNKNOWN' },
    { input: '9999', expected: '9999' }
];

let passed = 0;
testCases.forEach(tc => {
    const result = parser.resolveTypeEntry(tc.input);
    // For 2210, it could be 20DV or 20DC depending on key order. 20DV is first.
    if (result === tc.expected) {
        console.log(`PASS: ${tc.input} -> ${result}`);
        passed++;
    } else {
        console.error(`FAIL: ${tc.input} -> ${result} (expected ${tc.expected})`);

        // Allow for 20DC if mapping order differs
        if (tc.input == '2210' && result == '20DC') {
            console.log("...Acceptable alternative match");
            passed++;
        }
    }
});

console.log("\nTesting mapTypeabrevToCode...");
// Mock unmappedTypes
parser.resetUnmappedTypes();

const mappingTests = [
    { input: '20DV', expected: 2210, unmapped: false },
    { input: 'XXXX', expected: null, unmapped: true },
    { input: '22G1', expected: 2210, unmapped: true }, // Starts with 2, not in map -> fallback + unmapped
    { input: '45G1', expected: 4310, unmapped: true }  // Starts with 4, not in map -> fallback + unmapped
];

mappingTests.forEach(tc => {
    parser.resetUnmappedTypes();
    const code = parser.mapTypeabrevToCode(tc.input, 'TEST001');
    const records = parser.getUnmappedTypeRecords();
    const isUnmapped = records.length > 0;

    if (code === tc.expected && isUnmapped === tc.unmapped) {
        console.log(`PASS: ${tc.input} -> ${code} (Unmapped: ${isUnmapped})`);
        passed++;
    } else {
        console.error(`FAIL: ${tc.input} -> ${code} (Unmapped: ${isUnmapped}) - Expected ${tc.expected}, Unmapped: ${tc.unmapped}`);
    }
});

console.log(`\nTotal Passed: ${passed} / ${testCases.length + mappingTests.length}`);
