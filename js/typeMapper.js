/**
 * Type Mapper
 * Handles unmapped container types and user corrections
 */

class TypeMapper {
    constructor() {
        this.unmappedOverrides = {}; // container -> newType mapping
        this.unmappedRecords = [];
    }

    /**
     * Set unmapped type records
     */
    setUnmappedRecords(records) {
        this.unmappedRecords = records;
    }

    /**
     * Get all unmapped records with current override status
     */
    getUnmappedRecordsWithStatus() {
        return this.unmappedRecords.map(rec => ({
            container: rec.container,
            original: rec.type,
            new: this.unmappedOverrides[rec.container] || '',
            status: this.unmappedOverrides[rec.container] ? 'Mapped' : 'Needs Mapping'
        }));
    }

    /**
     * Add and merge unmapped records
     */
    addUnmappedRecords(newRecords) {
        const existingMap = new Map(this.unmappedRecords.map(r => [r.container, r]));
        for (const rec of newRecords) {
            existingMap.set(rec.container, rec);
        }
        this.unmappedRecords = Array.from(existingMap.values());
    }

    /**
     * Remove records for containers that no longer exist
     */
    cleanup(validContainersSet) {
        this.unmappedRecords = this.unmappedRecords.filter(rec =>
            validContainersSet.has(rec.container)
        );

        // Also clean up overrides
        for (const cnum of Object.keys(this.unmappedOverrides)) {
            if (!validContainersSet.has(cnum)) {
                delete this.unmappedOverrides[cnum];
            }
        }
    }

    /**
     * Set override for a specific container
     */
    setOverride(containerNumber, newType) {
        if (newType && newType.trim()) {
            this.unmappedOverrides[containerNumber] = newType.trim().toUpperCase();
        } else {
            delete this.unmappedOverrides[containerNumber];
        }
    }

    /**
     * Get override for a container
     */
    getOverride(containerNumber) {
        return this.unmappedOverrides[containerNumber] || null;
    }

    /**
     * Apply overrides to containers dict
     */
    applyOverrides(containersDict) {
        for (const [cnum, newType] of Object.entries(this.unmappedOverrides)) {
            if (containersDict[cnum]) {
                containersDict[cnum].typeabrev = newType;
            }
        }
    }

    /**
     * Clear all overrides
     */
    clearOverrides() {
        this.unmappedOverrides = {};
    }

    /**
     * Fill down - copy top value to selected items
     */
    fillDown(containerNumbers) {
        if (containerNumbers.length < 2) return;

        const topContainer = containerNumbers[0];
        const topValue = this.unmappedOverrides[topContainer]; // Allow undefined/empty

        // If top value is undefined, it means no override. 
        // Should we clear overrides for others? Yes, that's expected "copy" behavior.
        if (topValue === undefined) {
            for (let i = 1; i < containerNumbers.length; i++) {
                delete this.unmappedOverrides[containerNumbers[i]];
            }
        } else {
            for (let i = 1; i < containerNumbers.length; i++) {
                this.setOverride(containerNumbers[i], topValue);
            }
        }
    }

    /**
     * Count how many need mapping
     */
    getNeedsMappingCount() {
        return this.unmappedRecords.filter(rec =>
            !this.unmappedOverrides[rec.container]
        ).length;
    }
}

// Create singleton instance
const typeMapper = new TypeMapper();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TypeMapper, typeMapper };
}
