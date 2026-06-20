'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

/* Minimal .env loader (no dependency). Existing process.env wins. */
function loadEnv() {
  const p = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const body = await readBody(req);
  if (!body) return {};
  try { return JSON.parse(body); } catch { return {}; }
}

function send(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function genRef() { return 'GTM-' + Date.now().toString().slice(-6); }
function genToken() { return crypto.randomBytes(24).toString('hex'); }
function safeParse(s, fallback) { try { return JSON.parse(s); } catch { return fallback; } }

module.exports = { loadEnv, readJson, send, genRef, genToken, safeParse };
