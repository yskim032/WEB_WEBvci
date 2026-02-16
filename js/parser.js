/**
 * ASC File Parser
 * JavaScript port of Python ASC parsing functions
 * Extracts container information from ASC format files
 */

// Regular expressions for parsing
const CONTAINER_RE = /\b([A-Z]{4}\d{7})\b/;
const MIDDLE_PATTERN = /^.{44}(\d{2}[A-Za-z]{2})([\s\d]{3})([EF])/;
const LAST_TOKEN_RE = /([A-Z0-9]{10})$/;
const OPCODE_RE = /^.{19}([A-Z]{3})/;

// Container type code mapping
const TYPEABREV_CODE_MAPPING = {
    '20DV': 2210, '20DC': 2210, '20RE': 2232, '20RF': 2232,
    '20OT': 2251, '20HT': 2256, '20FL': 2261, '20TK': 2270,
    '20PW': 2209, '20OS': 2201, '20IS': 2220, '20HR': 2532,
    '20HO': 2551, '20PL': 2960, '20PP': 2299, '20HH': 2651,
    '40DV': 4310, '40DC': 4310, '40RE': 4332, '40RF': 4332,
    '40OT': 4351, '40HT': 4256, '40FL': 4361, '40BV': 4380,
    '40PW': 4209, '40OS': 4301, '40IS': 4320, '40HC': 4510,
    '40HP': 4519, '40HR': 4532, '40HO': 4551, '40HF': 4563,
    '40PL': 4960, '40PP': 4399, '40XG': 4999,
    '45DV': 9000, '45PW': 9200, '45HC': 9400, '45HR': 4632,
    '45HO': 9451, '45HP': 9500, '48OS': 9452, '53OS': 5501, '53HC': 5511
};

// Track unmapped types
const unmappedTypes = {
    records: [],
    seen: new Set()
};

/**
 * Extract container number from line
 */
function extractContainerNumber(line) {
    const match = CONTAINER_RE.exec(line);
    return match ? match[1] : null;
}

/**
 * Extract middle fields: typeabrev, weight, full/empty
 */
function extractMiddleFields(line) {
    const match = MIDDLE_PATTERN.exec(line);
    if (!match) return null;

    const typeabrev = match[1];
    const weightStr = match[2].trim();
    const gross = parseInt(weightStr.replace(/^0+/, '') || '0');
    const fullempty = match[3];

    return { typeabrev, gross, fullempty };
}

/**
 * Extract POL and POD from last 10-character token
 */
function extractLastPolPod(line) {
    const match = LAST_TOKEN_RE.exec(line.trim());
    if (!match) return { pol: null, pod: null };

    const token = match[1];
    if (token.length >= 10) {
        let pol = token.substring(0, 5);
        let pod = token.substring(5, 10);

        // Replace KRBUS with KRPUS
        if (pol === 'KRBUS') pol = 'KRPUS';
        if (pod === 'KRBUS') pod = 'KRPUS';

        return { pol, pod };
    }

    return { pol: null, pod: null };
}

/**
 * Extract operator code
 */
function extractOperatorCode(line) {
    const match = OPCODE_RE.exec(line);
    return match ? match[1] : 'MSC';
}

/**
 * Extract vessel name and voyage number from header lines
 */
function extractVesselAndVoyage(lines) {
    for (let i = 0; i < Math.min(10, lines.length); i++) {
        const ln = lines[i].trim();
        if (ln.startsWith('$')) {
            const parts = ln.split('/');
            if (parts.length >= 3) {
                let vessel = parts[1].trim() || 'UNKNOWNVSL';
                let voyage = parts[2].trim() || 'UNKNOWNVOY';

                // Remove special characters
                vessel = vessel.replace(/[^A-Za-z0-9 ]+/g, '').trim();
                voyage = voyage.replace(/[^A-Za-z0-9\-]+/g, '').trim();

                return {
                    vessel: vessel || 'UNKNOWNVSL',
                    voyage: voyage || 'UNKNOWNVOY'
                };
            }
        }
    }

    return { vessel: 'UNKNOWNVSL', voyage: 'UNKNOWNVOY' };
}

/**
 * Detect IMO flag (dangerous goods)
 * Positions 59-63 (1-based) → 58-63 (0-based)
 */
function extractImoFlag(line) {
    const segment = line.substring(60, 63);
    return segment.trim() ? 1 : 0;
}

/**
 * Detect OOG flag (out of gauge cargo)
 */
function extractOogFlag(line) {
    // Condition 1: positions 101-107 (0-based) contain digit
    const segmentNum = line.substring(100, 107);
    const hasNumber = /\d/.test(segmentNum);

    // Condition 2: positions 52-55 (0-based) contain 'AK'
    const segmentAk = line.substring(52, 55);
    const hasAk = segmentAk.toUpperCase().includes('AK');

    return (hasNumber || hasAk) ? 1 : 0;
}

/**
 * Extract 6-digit stowposition from beginning of line
 */
function extractStowposition(line) {
    if (line.length < 6) return '';

    const stowpos = line.substring(0, 6).trim();

    // Verify it's a 6-digit number
    if (stowpos.length === 6 && /^\d{6}$/.test(stowpos)) {
        return stowpos;
    }

    return '';
}

/**
 * Determine if container should be included in lashing count
 * Rules:
 * 1. Only MSC containers
 * 2. 20' containers (odd bay): always include
 * 3. 40' containers (even bay): only if tier >= 69
 */
function isLashingContainer(line) {
    // Rule 1: Only MSC
    if (extractOperatorCode(line) !== 'MSC') {
        return false;
    }

    const stowpos = extractStowposition(line);
    if (!stowpos) return false;

    try {
        const bay = parseInt(stowpos.substring(0, 2));
        const tier = parseInt(stowpos.substring(4, 6));

        // 20' containers (odd bay): always include
        if (bay % 2 === 1) {
            return true;
        }

        // 40' containers (even bay): only if tier >= 69
        if (bay % 2 === 0 && tier >= 69) {
            return true;
        }
    } catch (e) {
        return false;
    }

    return false;
}

/**
 * Resolve type entry (handles Left or Right side input)
 * Returns the key (Left side) if found, otherwise returns processed input
 */
function resolveTypeEntry(input) {
    if (!input) return '';
    const cleanInput = String(input).trim().toUpperCase();

    // 1. Check if it matches a key (e.g. '20DV')
    if (TYPEABREV_CODE_MAPPING.hasOwnProperty(cleanInput)) {
        return cleanInput;
    }

    // 2. Check if it matches a value (e.g. 2210)
    // We reverse search the value. Return the first matching key.
    const numValue = parseInt(cleanInput, 10);
    if (!isNaN(numValue)) {
        for (const [key, val] of Object.entries(TYPEABREV_CODE_MAPPING)) {
            if (val === numValue) {
                return key;
            }
        }
    }

    return cleanInput;
}

/**
 * Map typeabrev to numeric code
 */
function mapTypeabrevToCode(typeabrev, containerNumber = null) {
    const raw = (typeabrev || '').trim();
    if (!raw) {
        recordUnmapped('', containerNumber);
        return null; // Should return null or appropriate fallback
    }

    const key = raw.toUpperCase();
    const val = TYPEABREV_CODE_MAPPING[key];

    if (val !== undefined) {
        return val;
    }

    // Default for 2x and 4x types - Check if fallback is still desired or strictly unmapped
    // User requested: "If not in mapping, must appear in unmapped type".
    // However, existing fallback might be useful. The user said "If no match... then unmapped".
    // I will KEEP the unmapped recording but still return the fallback code if possible to minimize valid-but-missing-entry errors,
    // OR I should return null to force user attention.
    // The prompt says: "반일 일치하지는 타입이 하나도 없으면 unmapped type에 나타나야해" (If no match, must appear in unmapped)
    // The current logic DOES call recordUnmapped() for fallbacks. So visual requirement is met.

    if (key.startsWith('2')) {
        recordUnmapped(key, containerNumber);
        return 2210;
    }
    if (key.startsWith('4')) {
        recordUnmapped(key, containerNumber);
        return 4310;
    }

    recordUnmapped(key, containerNumber);
    return null; // Or 0?
}

/**
 * Record unmapped type for user review
 */
function recordUnmapped(typeValue, containerNumber) {
    const displayValue = (typeValue || '').trim().toUpperCase();
    const cnum = String(containerNumber || '-').trim().toUpperCase() || '-';
    const entry = `${cnum}:${displayValue}`;

    if (!unmappedTypes.seen.has(entry)) {
        unmappedTypes.seen.add(entry);
        unmappedTypes.records.push({ container: cnum, type: displayValue });
    }
}

/**
 * Get and clear unmapped type records
 */
function getUnmappedTypeRecords() {
    const records = [...unmappedTypes.records];
    unmappedTypes.records = [];
    unmappedTypes.seen.clear();
    return records;
}

/**
 * Reset unmapped types tracking
 */
function resetUnmappedTypes() {
    unmappedTypes.records = [];
    unmappedTypes.seen.clear();
}

/**
 * Parse ASC file content
 * @param {string} content - File content as text
 * @param {string} originLabel - 'discharge' or 'load'
 * @returns {object} { containers: {}, lines: [] }
 */
function parseAscFile(content, originLabel) {
    const containers = {};
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
        // Stop parsing if we hit the stop marker
        if (line.toUpperCase().includes('***')) {
            console.log('Stop marker found, ending parse');
            break;
        }

        const cnum = extractContainerNumber(line);
        if (!cnum) continue;

        // Get or create record
        let rec = containers[cnum] || {};
        rec._origin = originLabel;
        rec._line = line;

        // Operator code
        if (!rec.operatorcode) {
            rec.operatorcode = extractOperatorCode(line);
        }

        // Middle fields
        const mid = extractMiddleFields(line);
        if (mid) {
            rec.typeabrev = rec.typeabrev || mid.typeabrev;
            rec.grossweight = rec.grossweight || String(mid.gross);
            rec.fullempty = rec.fullempty || mid.fullempty;

            // Map type abbreviation to ISO code (and record if unmapped)
            if (rec.typeabrev) {
                rec.isocode = mapTypeabrevToCode(rec.typeabrev, cnum);
            }
        }

        // IMO flag
        if (extractImoFlag(line)) {
            rec.imo = 1;
        }

        // OOG flag
        if (extractOogFlag(line)) {
            rec.oogcargo = 1;
            rec.OOG_Handling = 1;
        }

        // POL/POD from last token
        const { pol, pod } = extractLastPolPod(line);
        if (pol) rec.pol = pol;
        if (pod) rec.pod = pod;

        // Container number
        rec.number = rec.number || cnum;

        containers[cnum] = rec;
    }

    return { containers, lines };
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        extractContainerNumber,
        extractMiddleFields,
        extractLastPolPod,
        extractOperatorCode,
        extractVesselAndVoyage,
        extractImoFlag,
        extractOogFlag,
        extractStowposition,
        isLashingContainer,
        mapTypeabrevToCode,
        getUnmappedTypeRecords,
        resetUnmappedTypes,
        parseAscFile,
        resolveTypeEntry,
        TYPEABREV_CODE_MAPPING
    };
} else {
    // Expose to window for browser use
    window.extractContainerNumber = extractContainerNumber;
    window.extractMiddleFields = extractMiddleFields;
    window.extractLastPolPod = extractLastPolPod;
    window.extractOperatorCode = extractOperatorCode;
    window.extractVesselAndVoyage = extractVesselAndVoyage;
    window.extractImoFlag = extractImoFlag;
    window.extractOogFlag = extractOogFlag;
    window.extractStowposition = extractStowposition;
    window.isLashingContainer = isLashingContainer;
    window.mapTypeabrevToCode = mapTypeabrevToCode;
    window.getUnmappedTypeRecords = getUnmappedTypeRecords;
    window.resetUnmappedTypes = resetUnmappedTypes;
    window.parseAscFile = parseAscFile;
    window.resolveTypeEntry = resolveTypeEntry;
    window.TYPEABREV_CODE_MAPPING = TYPEABREV_CODE_MAPPING;
}
