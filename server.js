'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { loadEnv } = require('./src/util');
loadEnv(); // read .env before anything else

require('./src/db'); // initialise DB + seed
const api = require('./src/api');
const scheduler = require('./src/scheduler');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
};

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  if (urlPath.endsWith('/')) urlPath += 'index.html';

  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) return await api.handle(req, res);
    return serveStatic(req, res);
  } catch (e) {
    console.error('Request error:', e);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Server error' }));
  }
});

server.listen(PORT, () => {
  const crmMode = process.env.CRM_API_URL ? `live → ${process.env.CRM_API_URL}` : 'log-only (set CRM_API_URL in .env)';
  const waMode = process.env.WHATSAPP_TOKEN ? 'live' : 'log-only (set WHATSAPP_TOKEN in .env)';
  console.log('\n  ┌─────────────────────────────────────────────');
  console.log('  │  GoTravel Mart');
  console.log(`  │  Website  →  http://localhost:${PORT}`);
  console.log(`  │  Admin    →  http://localhost:${PORT}/admin/`);
  console.log(`  │  CRM      →  ${crmMode}`);
  console.log(`  │  WhatsApp →  ${waMode}`);
  console.log('  └─────────────────────────────────────────────');
  scheduler.start();
});
