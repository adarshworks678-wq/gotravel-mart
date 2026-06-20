'use strict';
/*
 * Reminder scheduler — runs in-process, checks every 60s for any queued
 * WhatsApp messages whose send_at time has passed, and sends them.
 * This is how "send a reminder before the appointment" works.
 */
const db = require('./db');
const wa = require('./whatsapp');

let timer = null;

function start() {
  if (timer) return;
  tick().catch(e => console.error('scheduler tick error', e));
  timer = setInterval(() => tick().catch(e => console.error('scheduler tick error', e)), 60 * 1000);
  console.log('  Reminder scheduler started (checks every 60s)');
}

async function tick() {
  const now = new Date().toISOString();
  const due = db.prepare(`SELECT * FROM messages WHERE status = 'queued' AND send_at <= ?`).all(now);
  for (const m of due) {
    const enq = db.prepare('SELECT * FROM enquiries WHERE id = ?').get(m.enquiry_id) || {};
    const appt = db.prepare('SELECT * FROM appointments WHERE enquiry_id = ? ORDER BY id DESC').get(m.enquiry_id) || {};
    const template = m.type === 'reminder'
      ? (process.env.WHATSAPP_REMINDER_TEMPLATE || 'appointment_reminder')
      : (process.env.WHATSAPP_CONFIRM_TEMPLATE || 'appointment_confirmation');
    const params = [
      enq.name || 'traveller',
      enq.package_name || 'your trip',
      `${appt.date || ''} ${appt.slot || ''}`.trim(),
      appt.mode || 'call',
    ];
    const r = await wa.sendTemplate(m.phone, template, params);
    db.prepare('UPDATE messages SET status = ?, detail = ?, sent_at = ? WHERE id = ?')
      .run(r.ok ? 'sent' : 'failed', JSON.stringify(r).slice(0, 500), new Date().toISOString(), m.id);
    console.log(`  [scheduler] ${m.type} for ${enq.ref || m.enquiry_id} → ${r.ok ? 'sent' : 'FAILED'}`);
  }
}

module.exports = { start, tick };
