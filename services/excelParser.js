// ============================================================
//  services/excelParser.js - v2
//  "Source Invoice No" column se multi-item grouping
//  FBR Technical Spec V1.12 ke mutabiq
// ============================================================

const XLSX = require('xlsx');

function parseExcelFile(fileBuffer, seller) {
  if (!seller) seller = {};
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

  const invoices  = [];
  const errors    = [];
  const grouped   = new Map();
  const orderKeys = []; // sequence preserve karne ke liye

  rows.forEach(function(row, index) {
    const rowNum = index + 2;

    // Bilkul khali rows skip
    if (!row['Source Invoice No'] && !row['Buyer Business Name'] && !row['HS Code']) return;

    try {
      processRow(row, seller, rowNum, grouped, orderKeys, errors);
    } catch (err) {
      errors.push({ row: rowNum, error: err.message });
    }
  });

  // Same order mein invoices return karo jis mein pehli baar mile the
  orderKeys.forEach(function(key) {
    if (grouped.has(key)) invoices.push(grouped.get(key));
  });

  return { invoices: invoices, errors: errors, total: invoices.length };
}

// 2 decimal places - FBR ka strict requirement
function r2(value) {
  var num = parseFloat(value);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

// 4 decimal places - sirf quantity ke liye
function r4(value) {
  var num = parseFloat(value);
  return isNaN(num) ? 0 : Math.round(num * 10000) / 10000;
}

function processRow(row, seller, rowNum, grouped, orderKeys, errors) {

  if (!row['Buyer Business Name']) throw new Error('Row ' + rowNum + ': Buyer Business Name missing');
  if (!row['Invoice Date'])        throw new Error('Row ' + rowNum + ': Invoice Date missing');
  if (!row['HS Code'])             throw new Error('Row ' + rowNum + ': HS Code missing');

  var invoiceDate = excelDateToString(row['Invoice Date']);

  // Source Invoice No = hamare system ka invoice number (VFP se aata hai)
  // Agar nahi diya toh buyer + date se unique banana
  var sourceInvoiceNo = String(row['Source Invoice No'] || '').trim();
  if (!sourceInvoiceNo) {
    sourceInvoiceNo = String(row['Buyer Business Name']).trim() + '-' + invoiceDate;
  }

  // Grouping key = Source Invoice No
  var groupKey = sourceInvoiceNo;

  // HS Code - sirf code part nikalo agar "code - description" format ho
  var hsCodeRaw = String(row['HS Code'] || '');
  var hsCode = hsCodeRaw.split(' - ')[0].trim();

  // Rate - agar sirf number diya toh % add karo
  var rate = String(row['Rate'] || '0%').trim();
  if (rate.indexOf('%') === -1) {
    var rateNum = parseFloat(rate);
    rate = isNaN(rateNum) ? '0%' : (r2(rateNum) + '%');
  }

  // Buyer Registration Type - exact spelling FBR chahta hai
  var regTypeRaw = String(row['Buyer Registration Type'] || '').trim().toLowerCase();
  var buyerRegistrationType = (regTypeRaw.indexOf('reg') === 0) ? 'Registered' : 'Unregistered';

  // Extra Tax - number hona chahiye, default 0
  var extraTaxRaw = row['Extra Tax'];
  var extraTax = 0;
  if (extraTaxRaw !== undefined && extraTaxRaw !== '') {
    if (typeof extraTaxRaw === 'number') {
      extraTax = r2(extraTaxRaw);
    } else {
      var matched = String(extraTaxRaw).match(/[\d.]+/);
      extraTax = matched ? r2(matched[0]) : 0;
    }
  }

  // Further Tax
  var furtherTaxRaw = row['Further Tax'];
  var furtherTax = 0;
  if (furtherTaxRaw !== undefined && furtherTaxRaw !== '' && furtherTaxRaw !== 'NONE') {
    furtherTax = r2(furtherTaxRaw);
  }

  var item = {
    hsCode:                          hsCode,
    productDescription:              String(row['Product Description'] || ''),
    rate:                            rate,
    uoM:                             String(row['UOM'] || ''),
    quantity:                        r4(row['Quantity'] || 0),
    totalValues:                     r2(row['Total Values'] || 0),
    valueSalesExcludingST:           r2(row['Value Sales Excl ST'] || 0),
    fixedNotifiedValueOrRetailPrice: r2(row['Fixed Notified Value'] || 0),
    salesTaxApplicable:              r2(row['Sales Tax Applicable'] || 0),
    salesTaxWithheldAtSource:        r2(row['Sales Tax Withheld'] || 0),
    extraTax:                        extraTax,
    furtherTax:                      furtherTax,
    sroScheduleNo:                   String(row['SRO Schedule No'] || ''),
    fedPayable:                      r2(row['FED Payable'] || 0),
    discount:                        r2(row['Discount'] || 0),
    saleType:                        String(row['Sale Type'] || 'Goods at standard rate (default)'),
    sroItemSerialNo:                 String(row['SRO Item Serial No'] || ''),
  };

  // Naya invoice group banao agar pehli baar mila
  if (!grouped.has(groupKey)) {
    orderKeys.push(groupKey);
    grouped.set(groupKey, {
      invoiceType:    String(row['Invoice Type'] || 'Sale Invoice'),
      invoiceDate:    invoiceDate,
      invoiceRefNo:   String(row['Invoice Ref No'] || ''),
      scenarioId:     String(row['Scenario ID'] || 'SN001'),

      sellerNTNCNIC:       seller.ntn          || '',
      sellerBusinessName:  seller.businessName || '',
      sellerProvince:      seller.province     || '',
      sellerAddress:       seller.address      || '',

      buyerNTNCNIC:            String(row['Buyer NTN CNIC'] || ''),
      buyerBusinessName:       String(row['Buyer Business Name'] || ''),
      buyerProvince:           String(row['Buyer Province'] || ''),
      buyerAddress:            String(row['Buyer Address'] || ''),
      buyerRegistrationType:   buyerRegistrationType,

      invoiceNumber:  sourceInvoiceNo,

      items: [],

      totalAmount: 0,
      taxAmount:   0,
      saleValue:   0,
      status:      'pending',
    });
  }

  var invoice = grouped.get(groupKey);
  invoice.items.push(item);

  // Running totals
  invoice.totalAmount = r2(invoice.totalAmount + item.totalValues);
  invoice.taxAmount   = r2(invoice.taxAmount   + item.salesTaxApplicable);
  invoice.saleValue   = r2(invoice.saleValue   + item.valueSalesExcludingST);
}

function excelDateToString(excelDate) {
  if (!excelDate) return new Date().toISOString().split('T')[0];

  if (typeof excelDate === 'string') {
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(excelDate)) return excelDate.slice(0, 10);
    // DD/MM/YYYY
    if (excelDate.indexOf('/') !== -1) {
      var parts = excelDate.split('/');
      return parts[2] + '-' + parts[1].padStart(2,'0') + '-' + parts[0].padStart(2,'0');
    }
  }

  // Excel serial number
  var num = parseInt(excelDate);
  if (!isNaN(num)) {
    var date = new Date((num - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

module.exports = { parseExcelFile: parseExcelFile };
