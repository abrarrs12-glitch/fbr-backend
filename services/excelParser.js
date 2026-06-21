// ============================================================
//  services/excelParser.js
//  Naye recommended Excel format ke mutabiq - FBR official
//  Technical Spec V1.12 ke columns se match karta hai
//
//  Excel Columns (exact headers expected):
//  Invoice Type | Invoice Date | Invoice Ref No | Scenario ID |
//  Buyer NTN CNIC | Buyer Business Name | Buyer Province |
//  Buyer Address | Buyer Registration Type | HS Code |
//  Product Description | Rate | UOM | Quantity | Total Values |
//  Value Sales Excl ST | Fixed Notified Value | Sales Tax Applicable |
//  Sales Tax Withheld | Extra Tax | Further Tax | SRO Schedule No |
//  FED Payable | Discount | Sale Type | SRO Item Serial No
// ============================================================

const XLSX = require('xlsx');

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
  const grouped  = new Map();

  rows.forEach((row, index) => {
    const rowNum = index + 2;

    if (!row['Invoice Ref No'] && !row['Buyer Business Name'] && !row['HS Code']) return;

    try {
      processRow(row, seller, rowNum, grouped, errors);
    } catch (err) {
      errors.push({ row: rowNum, error: err.message });
    }
  });

  for (const invoice of grouped.values()) {
    invoices.push(invoice);
  }

  return { invoices, errors, total: invoices.length };
}

function r2(value) {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}
function r4(value) {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : Math.round(num * 10000) / 10000;
}

function processRow(row, seller, rowNum, grouped, errors) {

  if (!row['Buyer Business Name']) throw new Error('Row ' + rowNum + ': Buyer Business Name missing');
  if (!row['Invoice Date'])        throw new Error('Row ' + rowNum + ': Invoice Date missing');
  if (!row['HS Code'])             throw new Error('Row ' + rowNum + ': HS Code missing');

  const invoiceDate = excelDateToString(row['Invoice Date']);

  const invoiceKey = String(row['Invoice Ref No'] || '').trim()
    || (row['Buyer Business Name'] + '__' + invoiceDate + '__' + rowNum);

  const groupKey = invoiceKey + '__' + rowNum;

  const hsCodeRaw = String(row['HS Code'] || '');
  const hsCode    = hsCodeRaw.split(' - ')[0].trim();

  let rate = String(row['Rate'] || '0%').trim();
  if (!rate.includes('%')) {
    const num = parseFloat(rate);
    rate = isNaN(num) ? '0%' : (r2(num) + '%');
  }

  const regTypeRaw = String(row['Buyer Registration Type'] || '').trim().toLowerCase();
  const buyerRegistrationType = regTypeRaw.indexOf('reg') === 0 ? 'Registered' : 'Unregistered';

  const extraTaxRaw = row['Extra Tax'];
  let extraTax = 0;
  if (extraTaxRaw !== undefined && extraTaxRaw !== '') {
    if (typeof extraTaxRaw === 'number') {
      extraTax = r2(extraTaxRaw);
    } else {
      const matched = String(extraTaxRaw).match(/[\d.]+/);
      extraTax = matched ? r2(matched[0]) : 0;
    }
  }

  const item = {
    hsCode: hsCode,
    productDescription: String(row['Product Description'] || ''),
    rate: rate,
    uoM: String(row['UOM'] || ''),
    quantity: r4(row['Quantity'] || 0),
    totalValues: r2(row['Total Values'] || 0),
    valueSalesExcludingST: r2(row['Value Sales Excl ST'] || 0),
    fixedNotifiedValueOrRetailPrice: r2(row['Fixed Notified Value'] || 0),
    salesTaxApplicable: r2(row['Sales Tax Applicable'] || 0),
    salesTaxWithheldAtSource: r2(row['Sales Tax Withheld'] || 0),
    extraTax: extraTax,
    furtherTax: r2(row['Further Tax'] || 0),
    sroScheduleNo: String(row['SRO Schedule No'] || ''),
    fedPayable: r2(row['FED Payable'] || 0),
    discount: r2(row['Discount'] || 0),
    saleType: String(row['Sale Type'] || 'Goods at standard rate (default)'),
    sroItemSerialNo: String(row['SRO Item Serial No'] || ''),
  };

  if (!grouped.has(groupKey)) {
    grouped.set(groupKey, {
      invoiceType: String(row['Invoice Type'] || 'Sale Invoice'),
      invoiceDate: invoiceDate,
      invoiceRefNo: String(row['Invoice Ref No'] || ''),
      scenarioId: String(row['Scenario ID'] || 'SN001'),

      sellerNTNCNIC: seller.ntn || '',
      sellerBusinessName: seller.businessName || '',
      sellerProvince: seller.province || '',
      sellerAddress: seller.address || '',

      buyerNTNCNIC: String(row['Buyer NTN CNIC'] || ''),
      buyerBusinessName: String(row['Buyer Business Name'] || ''),
      buyerProvince: String(row['Buyer Province'] || ''),
      buyerAddress: String(row['Buyer Address'] || ''),
      buyerRegistrationType: buyerRegistrationType,

      invoiceNumber: invoiceKey.length > 40 ? ('INV-' + rowNum + '-' + Date.now()) : invoiceKey,

      items: [],

      totalAmount: 0,
      taxAmount: 0,
      saleValue: 0,
      status: 'pending',
    });
  }

  const invoice = grouped.get(groupKey);
  invoice.items.push(item);

  invoice.totalAmount = r2(invoice.totalAmount + item.totalValues);
  invoice.taxAmount   = r2(invoice.taxAmount   + item.salesTaxApplicable);
  invoice.saleValue   = r2(invoice.saleValue   + item.valueSalesExcludingST);
}

function excelDateToString(excelDate) {
  if (!excelDate) return new Date().toISOString().split('T')[0];

  if (typeof excelDate === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(excelDate)) return excelDate.slice(0, 10);
    if (excelDate.indexOf('/') !== -1) {
      const parts = excelDate.split('/');
      return parts[2] + '-' + parts[1].padStart(2,'0') + '-' + parts[0].padStart(2,'0');
    }
  }

  const num = parseInt(excelDate);
  if (!isNaN(num)) {
    const date = new Date((num - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

module.exports = { parseExcelFile };
