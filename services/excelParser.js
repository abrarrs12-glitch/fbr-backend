// ============================================================
//  services/excelParser.js  — UPDATED for FBR JSON format
//  
//  Excel Columns → FBR JSON mapping
// ============================================================

const XLSX = require('xlsx');

/**
 * Excel se rows read karo aur FBR JSON format mein convert karo
 * @param {Buffer} fileBuffer
 * @param {Object} seller - Customer ka data (NTN, name, address etc)
 * @returns {{ invoices: Array, errors: Array, total: number }}
 */
function parseExcelFile(fileBuffer, seller = {}) {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    raw: true,
    defval: '',
  });

  if (rows.length === 0) {
    throw new Error('Excel file mein koi data nahi hai');
  }

  const invoices = [];
  const errors   = [];

  rows.forEach((row, index) => {
    const rowNum = index + 2;

    // Empty rows skip karo
    if (!row['Sale No Reference'] && !row['Name']) return;
    if (row['Sale No Reference'] === '#N/A') return;
    if (!row['Name']) return;

    try {
      const invoice = mapRowToFbrJson(row, seller, rowNum);
      invoices.push(invoice);
    } catch (err) {
      errors.push({ row: rowNum, error: err.message });
    }
  });

  return { invoices, errors, total: invoices.length };
}

/**
 * Ek Excel row → FBR JSON format
 */
function mapRowToFbrJson(row, seller, rowNum) {

  // ── Validation ─────────────────────────────────────────────
  if (!row['Sale No Reference']) throw new Error(`Row ${rowNum}: Sale No Reference missing`);
  if (!row['Name'])              throw new Error(`Row ${rowNum}: Buyer Name missing`);
  if (!row['Sale Date'])         throw new Error(`Row ${rowNum}: Sale Date missing`);

  // ── Date convert karo ───────────────────────────────────────
  // Excel date serial number → actual date
  const invoiceDate = excelDateToString(row['Sale Date']);

  // ── HS Code clean karo ─────────────────────────────────────
  // "2710.1951 - MINERAL FUELS..." → "2710.1951"
  const hsCodeRaw = String(row['HS Code'] || '');
  const hsCode    = hsCodeRaw.split(' - ')[0].trim();

  // ── Tax Rate ────────────────────────────────────────────────
  // 0.18 → "18%"
  const taxRateNum = parseFloat(row['Tax Rate'] || 0);
  const taxRate    = taxRateNum ? `${(taxRateNum * 100).toFixed(0)}%` : '0%';

  // ── FBR JSON Format ────────────────────────────────────────
  const fbrJson = {
    // Invoice info
    invoiceType:    row['Sale Type']   || 'Sale Invoice',
    invoiceDate:    invoiceDate,
    invoiceRefNo:   String(row['FBR Invoice Reference No If Debit Note'] || ''),
    scenarioId:     getScenarioId(row['Trans Type ID']),

    // Seller info — customer ka data
    sellerNTNCNIC:       seller.ntn        || '',
    sellerBusinessName:  seller.businessName || '',
    sellerProvince:      seller.province    || '',
    sellerAddress:       seller.address     || '',

    // Buyer info — Excel se
    buyerNTNCNIC:            String(row['CNIC/NTNNo'] || ''),
    buyerBusinessName:       String(row['Name']        || ''),
    buyerProvince:           String(row['State']       || ''),
    buyerAddress:            '',
    buyerRegistrationType:   row['Status'] === 'REGISTERED' ? 'Registered' : 'Un-Registered',

    // Invoice number — for our tracking
    invoiceNumber: String(row['Sale No Reference'] || ''),

    // Items array — ek row = ek item
    items: [
      {
        hsCode:                          hsCode,
        productDescription:              String(row['Item/Service Name'] || row['Sale Description'] || ''),
        rate:                            taxRate,
        uoM:                             String(row['UOM'] || ''),
        quantity:                        parseFloat(row['Quantity']    || 0),
        totalValues:                     parseFloat(row['Net Amount']  || 0),
        valueSalesExcludingST:           parseFloat(row['Sub Amount']  || 0),
        fixedNotifiedValueOrRetailPrice: parseFloat(row['Sale Price - 3rd Schedule Item'] || 0),
        salesTaxApplicable:              parseFloat(row['Tax Amount']  || 0),
        salesTaxWithheldAtSource:        0,
        extraTax:                        String(row['Advance Income Tax'] || ''),
        furtherTax:                      row['Further Tax'] === 'NONE' ? 0 : parseFloat(row['Further Tax'] || 0),
        sroScheduleNo:                   String(row['SRO Schedule No'] || ''),
        fedPayable:                      0,
        discount:                        0,
        saleType:                        String(row['Trans Type'] || ''),
        sroItemSerialNo:                 String(row['SRO Item No'] || ''),
      }
    ],

    // Extra fields for our system
    totalAmount:  parseFloat(row['Net Amount']  || 0),
    taxAmount:    parseFloat(row['Tax Amount']  || 0),
    saleValue:    parseFloat(row['Sub Amount']  || 0),
    status:       'pending',
  };

  return fbrJson;
}

/**
 * Trans Type ID → FBR Scenario ID
 */
function getScenarioId(transTypeId) {
  const map = {
    '1':  'SN001',  // Standard rated
    '2':  'SN002',  // Zero rated
    '3':  'SN003',  // Exempt
    '23': 'SN023',  // 3rd Schedule Goods
    '24': 'SN024',  // Fixed rate
  };
  return map[String(transTypeId)] || 'SN000';
}

/**
 * Excel serial date → "yyyy-MM-dd" string
 * Excel stores dates as numbers (e.g. 46184 = 2026-06-11)
 */
function excelDateToString(excelDate) {
  if (!excelDate) return new Date().toISOString().split('T')[0];

  // Agar already string hai (dd/mm/yyyy format)
  if (typeof excelDate === 'string' && excelDate.includes('/')) {
    const parts = excelDate.split('/');
    return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
  }

  // Excel serial number convert karo
  const num = parseInt(excelDate);
  if (!isNaN(num)) {
    // Excel epoch: January 1, 1900
    const date = new Date((num - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

module.exports = { parseExcelFile };
