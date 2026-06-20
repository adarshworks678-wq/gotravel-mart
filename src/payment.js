'use strict';
/*
 * Payment adapter — Razorpay.
 * Configure RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env (test keys are instant
 * from the Razorpay dashboard). With no keys it runs in MOCK mode: an order is
 * created locally and verification always succeeds, so the booking flow is fully
 * testable without a payment account.
 */
const crypto = require('node:crypto');

function live() { return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET); }
function keyId() { return process.env.RAZORPAY_KEY_ID || 'mock'; }

/* Create a payment order. amount is in major units (₹), converted to paise. */
async function createOrder(amountInr, receipt) {
  const amount = Math.round(Number(amountInr) * 100); // paise
  if (!live()) {
    return { mode: 'mock', id: 'order_mock_' + crypto.randomBytes(6).toString('hex'), amount, currency: 'INR', key_id: keyId() };
  }
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const r = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { authorization: 'Basic ' + auth, 'content-type': 'application/json' },
    body: JSON.stringify({ amount, currency: 'INR', receipt: receipt || undefined }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error('Razorpay order failed: ' + (d.error?.description || r.status));
  return { mode: 'live', id: d.id, amount: d.amount, currency: d.currency, key_id: keyId() };
}

/* Verify the signature Razorpay Checkout returns after a successful payment. */
function verify({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!live()) return true; // mock mode: always succeeds
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  return expected === razorpay_signature;
}

module.exports = { live, createOrder, verify, keyId };
