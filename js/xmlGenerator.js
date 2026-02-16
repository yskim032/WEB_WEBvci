/**
 * XML Generator for VCI Format
 * Generates VCI-formatted XML from container data
 */

/**
 * Build VCI XML structure
 * @param {object} containersDict - Container data dictionary
 * @param {string} selectedPort - Selected port code
 * @returns {Document} XML document
 */
function buildVcidataXml(containersDict, selectedPort) {
    // Create XML document
    const doc = document.implementation.createDocument(null, 'vcidata');
    const root = doc.documentElement;

    // Create containers element
    const containersEl = doc.createElement('containers');
    root.appendChild(containersEl);

    // Sort container numbers for determinism
    const sortedNumbers = Object.keys(containersDict).sort();

    for (const number of sortedNumbers) {
        const rec = containersDict[number];
        const containerEl = doc.createElement('container');

        // Helper function to add child element
        function addElement(tag, value) {
            const el = doc.createElement(tag);
            el.textContent = value === null || value === undefined ? '' : String(value);
            containerEl.appendChild(el);
        }

        // Add all container fields
        addElement('pod', rec.pod || '');
        addElement('pol', rec.pol || '');
        addElement('grossweight', rec.grossweight || '0');
        addElement('coastalcargo', rec.coastalcargo || 0);
        addElement('soc', rec.soc || 0);

        // IMO (DG) - check appState.dgContainers first
        let imoValue = rec.imo || 0;
        if (appState && appState.dgContainers) {
            // Check if container is in DG lists (dis or load)
            const isInDgDis = appState.dgContainers.dis && appState.dgContainers.dis.includes(number);
            const isInDgLoad = appState.dgContainers.load && appState.dgContainers.load.includes(number);
            if (isInDgDis || isInDgLoad) {
                imoValue = 1;
            }
        }
        addElement('imo', imoValue);

        addElement('damagedcargo', rec.damagedcargo || 0);

        // OOG Cargo - check appState.oogContainers first
        let oogValue = rec.oogcargo || 0;
        if (appState && appState.oogContainers) {
            // Check if container is in OOG lists (dis or load)
            const isInOogDis = appState.oogContainers.dis && appState.oogContainers.dis.includes(number);
            const isInOogLoad = appState.oogContainers.load && appState.oogContainers.load.includes(number);
            if (isInOogDis || isInOogLoad) {
                oogValue = 1;
            }
        }
        addElement('oogcargo', oogValue);

        addElement('operatorcode', rec.operatorcode || '');
        addElement('fullempty', rec.fullempty || '');
        const typeabrev = rec.typeabrev || '';
        addElement('typeabrev', typeabrev);

        // Map isocode based on typeabrev if available
        let isocode = rec.isocode || 1;
        if (typeabrev && typeof TYPEABREV_CODE_MAPPING !== 'undefined' && TYPEABREV_CODE_MAPPING[typeabrev]) {
            isocode = TYPEABREV_CODE_MAPPING[typeabrev];
        } else if (rec.isocode) {
            isocode = rec.isocode;
        }

        addElement('isocode', isocode);
        addElement('type', rec.type || '');
        addElement('number', number);
        addElement('OOG_Handling', rec.OOG_Handling || 0);
        addElement('Account', rec.Account || '');
        addElement('fromtorail', rec.fromtorail || 0);
        addElement('fromtobarge', rec.fromtobarge || 0);
        addElement('fromtotpf', rec.fromtotpf || 0);
        addElement('fromtotruck', rec.fromtotruck || 0);
        addElement('transdischargelocal', 0);
        addElement('transloadlocal', 0);
        addElement('transdischargeservicecode', '');
        addElement('transloadservicecode', '');
        addElement('transdischargeoverseas', 0);
        addElement('transloadoverseas', 0);
        addElement('transdischargecoastalflag', 0);
        addElement('transloadcoastalflag', 0);
        addElement('Terminal', 0);

        // Add stowposition for lashing calculations
        const line = rec._line || '';
        if (line && typeof extractStowposition === 'function') {
            const stowpos = extractStowposition(line);
            addElement('stowposition', stowpos || '');
        } else {
            addElement('stowposition', '');
        }

        containersEl.appendChild(containerEl);
    }

    return doc;
}

/**
 * Prettify XML with indentation
 * @param {Document} xmlDoc - XML document to prettify
 * @returns {string} Formatted XML string
 */
function prettifyXml(xmlDoc) {
    const serializer = new XMLSerializer();
    let xmlString = serializer.serializeToString(xmlDoc);

    // Add XML declaration if not present
    if (!xmlString.startsWith('<?xml')) {
        xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlString;
    }

    // Simple indentation (basic approach)
    try {
        return formatXmlString(xmlString);
    } catch (e) {
        console.error('Failed to format XML:', e);
        return xmlString;
    }
}

/**
 * Format XML string with proper indentation
 * @param {string} xml - XML string
 * @returns {string} Formatted XML
 */
function formatXmlString(xml) {
    const PADDING = '  '; // 2 spaces
    const reg = /(>)(<)(\/*)/g;
    let pad = 0;

    xml = xml.replace(reg, '$1\n$2$3');

    return xml.split('\n').map(node => {
        let indent = 0;
        if (node.match(/.+<\/\w[^>]*>$/)) {
            indent = 0;
        } else if (node.match(/^<\/\w/)) {
            if (pad !== 0) {
                pad -= 1;
            }
        } else if (node.match(/^<\w([^>]*[^\/])?>.*$/)) {
            indent = 1;
        } else {
            indent = 0;
        }

        const padding = PADDING.repeat(pad);
        pad += indent;

        return padding + node;
    }).join('\n');
}

/**
 * Download XML file
 * @param {Document} xmlDoc - XML document
 * @param {string} filename - Output filename
 */
function downloadXml(xmlDoc, filename) {
    const xmlString = prettifyXml(xmlDoc);
    const blob = new Blob([xmlString], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

/**
 * Generate filename for XML download
 * @param {string} port - Port code
 * @param {object} metadata - Vessel/voyage metadata
 * @returns {string} Generated filename
 */
function generateXmlFilename(port, metadata = {}) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '');

    let filename = `VCI_${port || 'KRPUS'}`;

    if (metadata.vessel && metadata.vessel !== 'UNKNOWNVSL') {
        filename += `_${metadata.vessel}`;
    }

    if (metadata.voyage && metadata.voyage !== 'UNKNOWNVOY') {
        filename += `_${metadata.voyage}`;
    }

    filename += `_${dateStr}_${timeStr}.xml`;

    return filename;
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        buildVcidataXml,
        prettifyXml,
        downloadXml,
        generateXmlFilename
    };
}
