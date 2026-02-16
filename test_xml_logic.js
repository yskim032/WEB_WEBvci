
// Mock global mapping
global.TYPEABREV_CODE_MAPPING = {
    '20DV': 2210,
    '40HC': 4532
};

// Mock document/XML structure for node environment (minimal)
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const dom = new JSDOM(`<!DOCTYPE html>`);
global.document = dom.window.document;
global.XMLSerializer = dom.window.XMLSerializer;

// Require the generator (assuming it exports buildVcidataXml)
// We need to modify xmlGenerator.js to export if we want to require it easily,
// but it checks module.exports.
const { buildVcidataXml, prettifyXml } = require('./js/xmlGenerator.js');

console.log("Testing buildVcidataXml with isocode mapping...");

const containers = {
    'CNTR1': { typeabrev: '20DV', isocode: 1 }, // Should map to 2210
    'CNTR2': { typeabrev: 'USER_TYPE', isocode: 9999 }, // Should keep 9999 if not in mapping
    'CNTR3': { typeabrev: '40HC', isocode: 1 } // Should map to 4532
};

try {
    const xmlDoc = buildVcidataXml(containers, 'KRPUS');
    const xmlString = prettifyXml(xmlDoc);

    console.log("Generated XML fragment:");
    // Extract container sections to verify
    const containersXml = xmlString.match(/<container>[\s\S]*?<\/container>/g);

    let pass = true;

    // Check CNTR1
    if (containersXml[0].includes('<typeabrev>20DV</typeabrev>') && containersXml[0].includes('<isocode>2210</isocode>')) {
        console.log("CNTR1: PASS (20DV -> 2210)");
    } else {
        console.error("CNTR1: FAIL");
        console.log(containersXml[0]);
        pass = false;
    }

    // Check CNTR2
    if (containersXml[1].includes('<typeabrev>USER_TYPE</typeabrev>') && containersXml[1].includes('<isocode>9999</isocode>')) {
        console.log("CNTR2: PASS (USER_TYPE -> 9999 [preserved])");
    } else {
        console.error("CNTR2: FAIL");
        console.log(containersXml[1]);
        pass = false;
    }

    // Check CNTR3
    if (containersXml[2].includes('<typeabrev>40HC</typeabrev>') && containersXml[2].includes('<isocode>4532</isocode>')) {
        console.log("CNTR3: PASS (40HC -> 4532)");
    } else {
        console.error("CNTR3: FAIL");
        console.log(containersXml[2]);
        pass = false;
    }

    if (pass) console.log("ALL TESTS PASSED");
    else console.error("SOME TESTS FAILED");

} catch (e) {
    console.error("Test Error:", e);
}
