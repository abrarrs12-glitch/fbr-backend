// ============================================================
//  services/fbrApi.js
//  FBR ko submit karta hai - sirf Security Token chahiye
//  Decimal-safety aur proper FBR response parsing ke saath
// ============================================================

const axios = require('axios');

const FBR_SANDBOX_URL    = 'https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb';
const FBR_PRODUCTION_URL = 'https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata';

function r2(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}
function r4(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : Math.round(n * 10000) / 10000;
}

async function submitInvoice(invoice, customer, isSandbox = true) {
  const token = (customer.fbrCredentials && customer.fbrCredentials.token || process.env.FBR_SECURITY_TOKEN || '').trim();

  if (!token) {
    return {
      success: false,
      irn: null,
      error: 'FBR Security Token nahi mila - Customer mein add karo',
      fbrResponse: null,
    };
  }

  const url = isSandbox ? FBR_SANDBOX_URL : FBR_PRODUCTION_URL;

  const safeItems = (invoice.items || []).map(function(item) {
    return {
      hsCode: item.hsCode || '',
      productDescription: item.productDescription || '',
      rate: item.rate || '0%',
      uoM: item.uoM || '',
      quantity: r4(item.quantity),
      totalValues: r2(item.totalValues),
      valueSalesExcludingST: r2(item.valueSalesExcludingST),
      fixedNotifiedValueOrRetailPrice: r2(item.fixedNotifiedValueOrRetailPrice),
      salesTaxApplicable: r2(item.salesTaxApplicable),
      salesTaxWithheldAtSource: r2(item.salesTaxWithheldAtSource),
      extraTax: typeof item.extraTax === 'number' ? r2(item.extraTax) : 0,
      furtherTax: r2(item.furtherTax),
      sroScheduleNo: item.sroScheduleNo || '',
      fedPayable: r2(item.fedPayable),
      discount: r2(item.discount),
      saleType: item.saleType || '',
      sroItemSerialNo: item.sroItemSerialNo || '',
    };
  });

  const payload = {
    invoiceType: invoice.invoiceType || 'Sale Invoice',
    invoiceDate: invoice.invoiceDate,
    invoiceRefNo: invoice.invoiceRefNo || '',
    scenarioId: invoice.scenarioId || 'SN001',

    sellerNTNCNIC: customer.ntn || '',
    sellerBusinessName: customer.businessName || '',
    sellerProvince: customer.province || '',
    sellerAddress: customer.address || '',

    buyerNTNCNIC: invoice.buyerNTNCNIC || '',
    buyerBusinessName: invoice.buyerBusinessName || '',
    buyerProvince: invoice.buyerProvince || '',
    buyerAddress: invoice.buyerAddress || '',
    buyerRegistrationType: invoice.buyerRegistrationType || 'Unregistered',

    items: safeItems,
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    const data = response.data;
    const validation = data && data.validationResponse;

    // FBR statusCode "00" = valid; "01" = invalid
    const headerValid = validation && (validation.statusCode === '00');
    const allItemsValid = validation && validation.invoiceStatuses
      ? validation.invoiceStatuses.every(function(s) { return s.statusCode === '00'; })
      : true;

    const isValid = headerValid && allItemsValid;

    if (!isValid) {
      let itemError = '';
      if (validation && validation.invoiceStatuses && validation.invoiceStatuses.length) {
        itemError = validation.invoiceStatuses
          .filter(function(s) { return s.statusCode !== '00'; })
          .map(function(s) { return s.error; })
          .join(' | ');
      }
      if (!itemError) itemError = (validation && validation.error) || 'FBR ne invoice reject kiya';

      return {
        success: false,
        irn: null,
        fbrResponse: data,
        error: itemError,
      };
    }

    return {
      success: true,
      irn: data.invoiceNumber || (validation.invoiceStatuses && validation.invoiceStatuses[0] && validation.invoiceStatuses[0].invoiceNo) || '',
      fbrResponse: data,
    };
  } catch (err) {
    return {
      success: false,
      irn: null,
      fbrResponse: (err.response && err.response.data) || { error: err.message },
      error: (err.response && err.response.data && (err.response.data.message || err.response.data.error)) || err.message,
    };
  }
}

async function submitBatch(invoices, customer, isSandbox, onProgress) {
  if (isSandbox === undefined) isSandbox = true;
  const results = [];

  for (let i = 0; i < invoices.length; i++) {
    if (i > 0) await sleep(500);

    const result = await submitInvoice(invoices[i], customer, isSandbox);
    results.push(Object.assign({
      invoiceId: invoices[i]._id,
      invoiceNumber: invoices[i].invoiceNumber,
    }, result));

    if (onProgress) onProgress(i + 1, invoices.length, result);
  }

  return results;
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

module.exports = { submitInvoice, submitBatch };
