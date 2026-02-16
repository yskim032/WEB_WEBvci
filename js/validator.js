/**
 * Validator
 * Validates containers between ASC files and Excel paste data
 */

class Validator {
    constructor() {
        this.validationPassed = false;
        this.correctionIssues = {
            discharge: [],
            load: []
        };
    }
    
    /**
     * Validate containers
     * @param {object} discContainers - Discharge containers from ASC
     * @param {object} loadContainers - Load containers from ASC
     * @param {object} typeAssignments - Type assignments from Excel/UI
     * @returns {object} Validation results
     */
    validate(discContainers, loadContainers, typeAssignments) {
        this.correctionIssues = {
            discharge: [],
            load: []
        };
        
        // Get all container numbers from ASC files
        const ascDiscNumbers = new Set(Object.keys(discContainers));
        const ascLoadNumbers = new Set(Object.keys(loadContainers));
        
        // Get all container numbers from Excel/type assignments
        const excelDiscNumbers = new Set([
            ...typeAssignments.DIS,
            ...typeAssignments.TSD
        ]);
        const excelLoadNumbers = new Set([
            ...typeAssignments.LOD,
            ...typeAssignments.TSL
        ]);
        
        // Validate discharge
        this._validateSet(
            ascDiscNumbers,
            excelDiscNumbers,
            'discharge',
            'Discharge'
        );
        
        // Validate load
        this._validateSet(
            ascLoadNumbers,
            excelLoadNumbers,
            'load',
            'Load'
        );
        
        // Check if validation passed
        this.validationPassed = 
            this.correctionIssues.discharge.length === 0 &&
            this.correctionIssues.load.length === 0;
        
        return {
            passed: this.validationPassed,
            issues: this.correctionIssues,
            summary: this._generateSummary(ascDiscNumbers, ascLoadNumbers, excelDiscNumbers, excelLoadNumbers)
        };
    }
    
    /**
     * Validate a set of containers
     */
    _validateSet(ascSet, excelSet, type, label) {
        // Find containers in ASC but not in Excel
        for (const cnum of ascSet) {
            if (!excelSet.has(cnum)) {
                this.correctionIssues[type].push({
                    status: 'Only in ASC',
                    container: cnum,
                    source: 'ASC File'
                });
            }
        }
        
        // Find containers in Excel but not in ASC
        for (const cnum of excelSet) {
            if (!ascSet.has(cnum)) {
                this.correctionIssues[type].push({
                    status: 'Only in Excel',
                    container: cnum,
                    source: 'Excel/Manual'
                });
            }
        }
        
        // Sort by status (Only in Excel first)
        this.correctionIssues[type].sort((a, b) => {
            if (a.status < b.status) return 1;
            if (a.status > b.status) return -1;
            return a.container.localeCompare(b.container);
        });
    }
    
    /**
     * Generate summary text
     */
    _generateSummary(ascDisc, ascLoad, excelDisc, excelLoad) {
        const discMatch = this._countMatches(ascDisc, excelDisc);
        const loadMatch = this._countMatches(ascLoad, excelLoad);
        
        let summary = '';
        
        if (this.validationPassed) {
            summary = '✓ All containers match! Validation passed.';
        } else {
            summary = `⚠ Validation issues found:\n`;
            summary += `Discharge: ${ascDisc.size} in ASC, ${excelDisc.size} in Excel (${discMatch} match)\n`;
            summary += `Load: ${ascLoad.size} in ASC, ${excelLoad.size} in Excel (${loadMatch} match)`;
        }
        
        return summary;
    }
    
    /**
     * Count matching items between two sets
     */
    _countMatches(set1, set2) {
        let count = 0;
        for (const item of set1) {
            if (set2.has(item)) count++;
        }
        return count;
    }
    
    /**
     * Get validation status
     */
    getStatus() {
        return {
            passed: this.validationPassed,
            issues: this.correctionIssues
        };
    }
    
    /**
     * Clear validation results
     */
    clear() {
        this.validationPassed = false;
        this.correctionIssues = {
            discharge: [],
            load: []
        };
    }
}

// Create singleton instance
const validator = new Validator();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Validator, validator };
}
