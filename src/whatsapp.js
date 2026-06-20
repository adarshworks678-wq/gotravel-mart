'use strict';
/*
 * WhatsApp adapter — Meta WhatsApp Cloud API.
 * Configure WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID in .env to go live.
 * With no token set, it runs in "log-only" mode and prints the message.
 *
 * Both confirmation and reminder use approved message *templates* (required
 * by WhatsApp for business-initiated messages). Template body parameters are
 * passed positionally: {{1}} name, {{2}} package, {{3}} date+time, {{4}} mode.
 */
function normalizePhone(p) {
  if (!p) return '';
  let d = String(p).replace(/\D/g, '');
  const cc = process.env.DEFAULT_COUNTRY_CODE || '91';
  if (d.length === 10) d = cc + d;          // bare 10-digit -> add country code
  return d;
}

async function sendTemplate(phone, template, params) {
  const to = normalizePhone(phone);
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.log(`  [WhatsApp log-only] → ${to} | template="${template}" | ${JSON.stringify(params)}`);
    return { ok: true, mode: 'log-only' };
  }

  const version = process.env.WHATSAPP_API_VERSION || 'v21.0';
  const lang = process.env.WHATSAPP_TEMPLATE_LANG || 'en';
  const url = `https://graph.facebook.com/${version}/${phoneId}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: template,
      language: { code: lang },
      components: [{ type: 'body', parameters: (params || []).map(t => ({ type: 'text', text: String(t) })) }],
    },
  };

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    return { ok: r.ok, status: r.status, detail: text.slice(0, 500) };
  } catch (e) {
    return { ok: false, detail: e.message };
  }
}

module.exports = { sendTemplate, normalizePhone };
