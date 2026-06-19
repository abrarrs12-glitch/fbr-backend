// ============================================================
//  services/fbrApi.js — UPDATED
//  Digital Invoicing ke liye sirf SECURITY TOKEN chahiye
//  POSID/Username/Password ki zaroorat NAHI hai!
// ============================================================

const axios = require('axios');

// Sandbox testing ke liye:
const FBR_SANDBOX_URL    = 'https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb';
// Production (live) ke liye:
const FBR_PRODUCTION_URL = 'https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata';

/**
 * Single invoice FBR ko bhejo — sirf token chahiye!
 * @param {Object} invoice
 * @param {Object} customer - customer.fbrToken hona chahiye
 * @param {Boolean} isSandbox - true = test mode, false = live
 */
async function submitInvoice(invoice, customer, isSandbox = true) {
  const token = customer.fbrCredentials?.token || process.env.FBR_SECURITY_TOKEN;

  if (!token) {
    return {
      success: false,
      irn: null,
      error: 'FBR Security Token nahi mila — Customer mein add karo',
      fbrResponse: null,
    };
  }

  const url = isSandbox ? FBR_SANDBOX_URL : FBR_PRODUCTION_URL;

  // FBR ka exact JSON format
  const payload = {
    invoiceType:          invoice.invoiceType      || 'Sale Invoice',
    invoiceDate:          invoice.invoiceDate,
    invoiceRefNo:         invoice.invoiceRefNo     || '',
    scenarioId:           invoice.scenarioId       || 'SN000',

    sellerNTNCNIC:        customer.ntn             || '',
    sellerBusinessName:   customer.businessName    || '',
    sellerProvince:       customer.province        || '',
    sellerAddress:        customer.address         || '',

    buyerNTNCNIC:             invoice.buyerNTNCNIC          || '',
    buyerBusinessName:        invoice.buyerBusinessName     || '',
    buyerProvince:            invoice.buyerProvince         || '',
    buyerAddress:             invoice.buyerAddress          || '',
    buyerRegistrationType:    invoice.buyerRegistrationType || 'Un-Registered',

    items: invoice.items || [],
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // FBR response mein invoiceNumber hi IRN hota hai
    return {
      success:     true,
      irn:         response.data?.invoiceNumber || response.data?.InvoiceNumber,
      fbrResponse: response.data,
    };
  } catch (err) {
    return {
      success:     false,
      irn:         null,
      fbrResponse: err.response?.data || { error: err.message },
      error:       err.response?.data?.message || err.response?.data?.error || err.message,
    };
  }
}

/**
 * Batch submit — sab pending invoices
 */
async function submitBatch(invoices, customer, isSandbox = true, onProgress = null) {
  const results = [];

  for (let i = 0; i < invoices.length; i++) {
    if (i > 0) await sleep(500);

    const result = await submitInvoice(invoices[i], customer, isSandbox);
    results.push({
      invoiceId:     invoices[i]._id,
      invoiceNumber: invoices[i].invoiceNumber,
      ...result,
    });

    if (onProgress) onProgress(i + 1, invoices.length, result);
  }

  return results;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { submitInvoice, submitBatch };
