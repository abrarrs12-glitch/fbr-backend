// ============================================================
//  services/fbrApi.js — UPDATED with correct FBR JSON format
// ============================================================

const axios = require('axios');

const FBR_BASE_URL = process.env.FBR_BASE_URL || 'https://gw.fbr.gov.pk/di_data/v1/di';

let cachedToken  = null;
let tokenExpiry  = null;

/**
 * FBR se token lo
 */
async function getFbrToken(credentials = null) {
  if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
    return cachedToken;
  }

  const username = credentials?.username || process.env.FBR_USERNAME;
  const password = credentials?.password || process.env.FBR_PASSWORD;

  try {
    const response = await axios.post(
      `${FBR_BASE_URL}/login`,
      { username, password },
      { headers: { 'Content-Type': 'application/json' } }
    );

    cachedToken = response.data.token;
    tokenExpiry = new Date(Date.now() + 55 * 60 * 1000);
    return cachedToken;
  } catch (err) {
    throw new Error(`FBR login failed: ${err.response?.data?.message || err.message}`);
  }
}

/**
 * Single invoice FBR ko bhejo — exact JSON format mein
 */
async function submitInvoice(invoice, customer) {
  const token = await getFbrToken(customer.fbrCredentials);

  // FBR ka exact JSON format
  const payload = {
    invoiceType:          invoice.invoiceType      || 'Sale Invoice',
    invoiceDate:          invoice.invoiceDate,
    invoiceRefNo:         invoice.invoiceRefNo     || '',
    scenarioId:           invoice.scenarioId       || 'SN000',

    // Seller — customer ka data
    sellerNTNCNIC:        customer.ntn             || '',
    sellerBusinessName:   customer.businessName    || '',
    sellerProvince:       customer.province        || '',
    sellerAddress:        customer.address         || '',

    // Buyer — invoice se
    buyerNTNCNIC:             invoice.buyerNTNCNIC          || '',
    buyerBusinessName:        invoice.buyerBusinessName     || '',
    buyerProvince:            invoice.buyerProvince         || '',
    buyerAddress:             invoice.buyerAddress          || '',
    buyerRegistrationType:    invoice.buyerRegistrationType || 'Un-Registered',

    // Items
    items: invoice.items || [],
  };

  try {
    const response = await axios.post(
      `${FBR_BASE_URL}/postinvoicedata`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    return {
      success:     true,
      irn:         response.data?.invoiceNumber || response.data?.IRN || response.data?.irn,
      fbrResponse: response.data,
    };
  } catch (err) {
    return {
      success:     false,
      irn:         null,
      fbrResponse: err.response?.data || { error: err.message },
      error:       err.response?.data?.message || err.message,
    };
  }
}

/**
 * Batch submit — sab pending invoices
 */
async function submitBatch(invoices, customer, onProgress = null) {
  const results = [];

  for (let i = 0; i < invoices.length; i++) {
    if (i > 0) await sleep(500);

    const result = await submitInvoice(invoices[i], customer);
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

module.exports = { getFbrToken, submitInvoice, submitBatch };
