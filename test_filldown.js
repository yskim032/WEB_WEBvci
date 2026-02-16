const { TypeMapper } = require('./js/typeMapper.js');

console.log("Testing fillDown...");

const tm = new TypeMapper();
// Setup: C1 with override, C2 empty, C3 empty
tm.setOverride('C1', '20DV');
tm.setUnmappedRecords([
    { container: 'C1', type: 'UNK' },
    { container: 'C2', type: 'UNK' },
    { container: 'C3', type: 'UNK' }
]);

console.log("Initial C1 Override:", tm.getOverride('C1')); // 20DV

// Test 1: Fill down existing value
console.log("--- Test 1: Fill Down '20DV' ---");
tm.fillDown(['C1', 'C2', 'C3']);
console.log("C2 Override:", tm.getOverride('C2'));
console.log("C3 Override:", tm.getOverride('C3'));

if (tm.getOverride('C2') === '20DV' && tm.getOverride('C3') === '20DV') {
    console.log("PASS: Filled down value correctly.");
} else {
    console.error("FAIL: Did not fill down.");
}

// Test 2: Fill down empty value (clear)
console.log("--- Test 2: Fill Down Empty (Clear) ---");
// Clear C1
tm.setOverride('C1', '');
console.log("C1 Override (should be null):", tm.getOverride('C1'));

// Fill down C1 (empty) to C2, C3
tm.fillDown(['C1', 'C2', 'C3']);
console.log("C2 Override:", tm.getOverride('C2'));
console.log("C3 Override:", tm.getOverride('C3'));

if (!tm.getOverride('C2') && !tm.getOverride('C3')) {
    console.log("PASS: Cleared overrides correctly.");
} else {
    console.error("FAIL: Did not clear overrides.");
}
