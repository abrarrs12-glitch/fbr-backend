// ============================================================
//  services/fbrApi.js
//  Handles all communication with FBR's e-Invoice API.
//
//  FBR API Docs: https://e.fbr.gov.pk (PRAL portal)
//  You need to register your business there to get credentials.
//
//  Flow:
//  1. Get auth token from FBR
//  2. Send invoice data as JSON
//  3. FBR returns an IRN (Invoice Registration Number)
//  4. Store IRN in our database
// ============================================================

const axios = require('axios');

const FBR_BASE_URL = process.env.FBR_BASE_URL || 'https://esp.fbr.gov.pk:8446/api';

// Cache the FBR token so we don't request a new one every time
let cachedToken = null;
let tokenExpiry = null;

/**
 * getFbrToken
 * Logs into FBR API and returns an auth token.
 * Uses customer-specific credentials if provided, otherwise uses default from .env
 */
async function getFbrToken(credentials = null) {
  // Use fresh token if still valid (tokens last ~1 hour)
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
    // Set expiry to 55 minutes from now (token usually lasts 60 min)
    tokenExpiry = new Date(Date.now() + 55 * 60 * 1000);

    return cachedToken;
  } catch (err) {
    throw new Error(`FBR login failed: ${err.response?.data?.message || err.message}`);
  }
}

/**
 * submitInvoice
 * Sends a single invoice to FBR and returns the IRN.
 *
 * @param {Object} invoice - Invoice document from database
 * @param {Object} customer - Customer document (for NTN, STRN, credentials)
 * @returns {{ irn: string, fbrResponse: Object }}
 */
async function submitInvoice(invoice, customer) {
  // Step 1: Get auth token
  const token = await getFbrToken(customer.fbrCredentials);

  // Step 2: Build the FBR JSON payload
  // This format is based on FBR's documented API spec
  const payload = {
    InvoiceNumber: invoice.invoiceNumber,
    InvoiceDate:   formatDateForFbr(invoice.invoiceDate),
    POSID:         customer.fbrCredentials?.posId || process.env.FBR_POSID,
    USIN:          invoice.invoiceNumber, // Unique Sales Invoice Number
    DateTime:      new Date().toISOString(),

    // Seller info (your customer's business)
    SellerSTRN:    customer.strn,
    SellerNTN:     customer.ntn,
    SellerName:    customer.businessName,
    SellerAddress: customer.address,

    // Buyer info
    BuyerName:     invoice.buyerName || '',
    BuyerNTN:      invoice.buyerNtn  || '',
    BuyerCNIC:     invoice.buyerCnic || '',
    BuyerAddress:  invoice.buyerAddress || '',

    // Amounts
    TotalBillAmount:  invoice.totalAmount,
    TotalTaxCharged:  invoice.taxAmount,
    FurtherTax:       invoice.furtherTax || 0,
    Discount:         invoice.discount || 0,
    TotalSaleValue:   invoice.saleValue,

    InvoiceType: invoice.invoiceType || 'SI',

    // Items array — FBR requires at least one line item
    // Since FBR Excel doesn't always have item-level detail,
    // we create one summary item per invoice
    Items: [
      {
        ItemCode:        '00001',
        ItemName:        'Goods/Services',
        Quantity:        1,
        PCTCode:         '99999999',      // Product classification code
        TaxRate:         calculateTaxRate(invoice),
        SaleValue:       invoice.saleValue,
        Discount:        invoice.discount || 0,
        FurtherTax:      invoice.furtherTax || 0,
        TaxCharged:      invoice.taxAmount,
        TotalAmount:     invoice.totalAmount,
        InvoiceType:     invoice.invoiceType || 'SI',
      },
    ],
  };

  // Step 3: POST to FBR
  try {
    const response = await axios.post(
      `${FBR_BASE_URL}/invoice`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout
      }
    );

    const irn = response.data?.InvoiceNumber || response.data?.IRN || response.data?.irn;

    return {
      irn,
      fbrResponse: response.data,
      success: true,
    };
  } catch (err) {
    // FBR sends error details in the response body
    const fbrError = err.response?.data?.message || err.response?.data?.error || err.message;
    return {
      irn: null,
      fbrResponse: err.response?.data || { error: err.message },
      success: false,
      error: fbrError,
    };
  }
}

/**
 * submitBatch
 * Submits multiple invoices one by one and returns results.
 * FBR doesn't support true batch submission, so we loop.
 *
 * @param {Array} invoices - Array of invoice documents
 * @param {Object} customer - Customer document
 * @param {Function} onProgress - Optional callback(current, total, result)
 * @returns {Array} results - One result object per invoice
 */
async function submitBatch(invoices, customer, onProgress = null) {
  const results = [];

  for (let i = 0; i < invoices.length; i++) {
    const invoice = invoices[i];

    // Small delay between requests to avoid hitting FBR rate limits
    if (i > 0) await sleep(500);

    const result = await submitInvoice(invoice, customer);
    results.push({ invoiceId: invoice._id, invoiceNumber: invoice.invoiceNumber, ...result });

    if (onProgress) onProgress(i + 1, invoices.length, result);
  }

  return results;
}

// ── Helpers ───────────────────────────────────────────────────

function formatDateForFbr(date) {
  const d = new Date(date);
  // FBR expects: YYYY-MM-DD
  return d.toISOString().split('T')[0];
}

function calculateTaxRate(invoice) {
  if (!invoice.saleValue || invoice.saleValue === 0) return 0;
  return Math.round((invoice.taxAmount / invoice.saleValue) * 100 * 100) / 100;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { getFbrToken, submitInvoice, submitBatch };
