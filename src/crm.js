'use strict';
/*
 * CRM adapter — forwards each enquiry to YOUR CRM API.
 * Configure CRM_API_URL (+ optional key/header) in .env.
 * With no URL set, it runs in "log-only" mode and prints the payload.
 */
async function pushLead(enquiry) {
  const url = process.env.CRM_API_URL;
  if (!url) {
    console.log(`  [CRM log-only] ${enquiry.ref} → ${enquiry.name} / ${enquiry.phone} / ${enquiry.package_name || '-'}`);
    return { ok: true, mode: 'log-only' };
  }

  const headers = { 'content-type': 'application/json' };
  if (process.env.CRM_API_KEY) {
    const header = process.env.CRM_AUTH_HEADER || 'Authorization';
    let prefix = process.env.CRM_AUTH_PREFIX || '';
    if (prefix && !prefix.endsWith(' ')) prefix += ' ';
    headers[header] = prefix + process.env.CRM_API_KEY;
  }

  try {
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(enquiry) });
    const text = await r.text();
    return { ok: r.ok, status: r.status, detail: text.slice(0, 500) };
  } catch (e) {
    return { ok: false, detail: e.message };
  }
}

module.exports = { pushLead };
