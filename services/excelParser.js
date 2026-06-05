// ============================================================
//  services/excelParser.js
//  Reads the FBR-format Excel file and returns an array of
//  invoice objects ready to be saved to the database.
//
//  FBR Excel columns (standard format):
//  Invoice No | Invoice Date | Buyer Name | Buyer NTN |
//  Buyer CNIC | Buyer Address | Sale Value | Tax Amount |
//  Further Tax | Discount | Total Amount | Invoice Type
// ============================================================

const XLSX = require('xlsx');

// Map Excel column headers to our database field names
// Update these if FBR changes their column names
const COLUMN_MAP = {
  'Invoice No':        'invoiceNumber',
  'Invoice Number':    'invoiceNumber',
  'InvoiceNo':         'invoiceNumber',
  'Invoice Date':      'invoiceDate',
  'InvoiceDate':       'invoiceDate',
  'Buyer Name':        'buyerName',
  'BuyerName':         'buyerName',
  'Buyer NTN':         'buyerNtn',
  'BuyerNTN':          'buyerNtn',
  'Buyer CNIC':        'buyerCnic',
  'BuyerCNIC':         'buyerCnic',
  'Buyer Address':     'buyerAddress',
  'BuyerAddress':      'buyerAddress',
  'Sale Value':        'saleValue',
  'SaleValue':         'saleValue',
  'Taxable Value':     'saleValue',
  'Tax Amount':        'taxAmount',
  'TaxAmount':         'taxAmount',
  'Sales Tax':         'taxAmount',
  'Further Tax':       'furtherTax',
  'FurtherTax':        'furtherTax',
  'Discount':          'discount',
  'Total Amount':      'totalAmount',
  'TotalAmount':       'totalAmount',
  'Invoice Type':      'invoiceType',
  'InvoiceType':       'invoiceType',
};

/**
 * parseExcelFile
 * @param {Buffer} fileBuffer - The uploaded Excel file as a buffer
 * @param {string} originalName - Original filename for traceability
 * @returns {{ invoices: Array, errors: Array, total: number }}
 */
function parseExcelFile(fileBuffer, originalName = 'upload.xlsx') {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });

  // Use the first sheet (FBR format has one sheet)
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to array of row objects — header row becomes keys
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    raw: false,        // Convert dates to strings
    defval: '',        // Empty cells become ''
  });

  if (rows.length === 0) {
    throw new Error('Excel file is empty or has no data rows');
  }

  const invoices = [];
  const errors = [];

  rows.forEach((row, index) => {
    const rowNum = index + 2; // +2 because row 1 is headers
    try {
      const invoice = mapRowToInvoice(row, originalName, rowNum);
      invoices.push(invoice);
    } catch (err) {
      errors.push({ row: rowNum, error: err.message, data: row });
    }
  });

  return { invoices, errors, total: rows.length };
}

/**
 * mapRowToInvoice
 * Converts one Excel row to an invoice object using COLUMN_MAP
 */
function mapRowToInvoice(row, sourceFile, rowNum) {
  const invoice = { sourceFile };

  // Map each Excel column to our field name
  for (const [excelCol, dbField] of Object.entries(COLUMN_MAP)) {
    if (row[excelCol] !== undefined && row[excelCol] !== '') {
      invoice[dbField] = row[excelCol];
    }
  }

  // ── Validation ──────────────────────────────────────────
  if (!invoice.invoiceNumber) {
    throw new Error(`Row ${rowNum}: Invoice Number is missing`);
  }

  if (!invoice.invoiceDate) {
    throw new Error(`Row ${rowNum}: Invoice Date is missing`);
  }

  // ── Type conversions ────────────────────────────────────

  // Parse date — FBR usually sends DD/MM/YYYY or YYYY-MM-DD
  invoice.invoiceDate = parseDate(invoice.invoiceDate);

  // Convert string numbers to actual numbers
  const numericFields = ['saleValue', 'taxAmount', 'furtherTax', 'discount', 'totalAmount'];
  for (const field of numericFields) {
    if (invoice[field]) {
      // Remove commas (e.g. "1,50,000" → "150000") then parse
      invoice[field] = parseFloat(String(invoice[field]).replace(/,/g, '')) || 0;
    } else {
      invoice[field] = 0;
    }
  }

  // Default invoice type
  if (!invoice.invoiceType) invoice.invoiceType = 'SI';

  return invoice;
}

/**
 * parseDate
 * Handles multiple date formats FBR might use
 */
function parseDate(dateStr) {
  if (dateStr instanceof Date) return dateStr;

  const str = String(dateStr).trim();

  // Try DD/MM/YYYY
  const ddmmyyyy = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) {
    return new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`);
  }

  // Try DD-MM-YYYY
  const ddmmyyyy2 = str.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy2) {
    return new Date(`${ddmmyyyy2[3]}-${ddmmyyyy2[2]}-${ddmmyyyy2[1]}`);
  }

  // Try YYYY-MM-DD (ISO)
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;

  throw new Error(`Cannot parse date: "${str}"`);
}

module.exports = { parseExcelFile };
