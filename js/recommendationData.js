
/**
 * ISO Container Type Recommendations
 * Format: { code: 'ISO Code', desc: 'Description', type: 'Size & Type' }
 */
const RECOMMENDATION_DATA = [
    { code: '20DV', desc: '20\' DRY VAN', type: '20DV' },
    { code: '2210', desc: '20\' DRY VAN', type: '20DV' },
    { code: '22G1', desc: '20\' DRY VAN', type: '20DV' },
    { code: '40DV', desc: '40\' DRY VAN', type: '40DV' },
    { code: '4210', desc: '40\' DRY VAN', type: '40DV' },
    { code: '42G1', desc: '40\' DRY VAN', type: '40DV' },
    { code: '40HC', desc: '40\' HIGH CUBE', type: '40HC' },
    { code: '4510', desc: '40\' HIGH CUBE', type: '40HC' },
    { code: '45G1', desc: '40\' HIGH CUBE', type: '40HC' },
    { code: '45HC', desc: '45\' HIGH CUBE', type: '45HC' },
    { code: '9510', desc: '45\' HIGH CUBE', type: '45HC' },
    { code: '20RE', desc: '20\' REEFER', type: '20RE' },
    { code: '2232', desc: '20\' REEFER', type: '20RE' },
    { code: '22R1', desc: '20\' REEFER', type: '20RE' },
    { code: '40RE', desc: '40\' REEFER', type: '40RE' },
    { code: '4232', desc: '40\' REEFER', type: '40RE' },
    { code: '40HR', desc: '40\' HIGH CUBE REEFER', type: '40HR' },
    { code: '4532', desc: '40\' HIGH CUBE REEFER', type: '40HR' },
    { code: '45R1', desc: '40\' HIGH CUBE REEFER', type: '40HR' },
    { code: '20OT', desc: '20\' OPEN TOP', type: '20OT' },
    { code: '2251', desc: '20\' OPEN TOP', type: '20OT' },
    { code: '22U1', desc: '20\' OPEN TOP', type: '20OT' },
    { code: '40OT', desc: '40\' OPEN TOP', type: '40OT' },
    { code: '4251', desc: '40\' OPEN TOP', type: '40OT' },
    { code: '42U1', desc: '40\' OPEN TOP', type: '40OT' },
    { code: '40HO', desc: '40\' HIGH CUBE OPEN TOP', type: '40HO' },
    { code: '20FR', desc: '20\' FLAT RACK', type: '20FL' },
    { code: '2261', desc: '20\' FLAT RACK', type: '20FL' },
    { code: '22P1', desc: '20\' FLAT RACK', type: '20FL' },
    { code: '40FR', desc: '40\' FLAT RACK', type: '40FL' },
    { code: '4261', desc: '40\' FLAT RACK', type: '40FL' },
    { code: '42P1', desc: '40\' FLAT RACK', type: '40FL' },
    { code: '40HF', desc: '40\' HIGH CUBE FLAT RACK', type: '40HF' },
    { code: '20TK', desc: '20\' TANK', type: '20TK' },
    { code: '2270', desc: '20\' TANK', type: '20TK' },
    { code: '22T1', desc: '20\' TANK', type: '20TK' },
    { code: '20OS', desc: '20\' OPEN SIDE', type: '20OS' },
    { code: '2201', desc: '20\' OPEN SIDE', type: '20OS' },
    { code: '40OS', desc: '40\' OPEN SIDE', type: '40OS' },
    { code: '4201', desc: '40\' OPEN SIDE', type: '40OS' },
    // Add more common codes as needed
    { code: 'L5G1', desc: '45\' HIGH CUBE', type: '45HC' },
    { code: '9551', desc: '45\' OPEN TOP', type: '45HO' }
];

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RECOMMENDATION_DATA };
}
