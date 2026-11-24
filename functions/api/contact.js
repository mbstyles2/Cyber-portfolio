// POST /api/contact handler, called from src/index.js (Cloudflare Worker)
// Secrets (Cloudflare dashboard > your Worker > Settings > Variables and Secrets):
//   RESEND_API_KEY   (required, encrypted secret)
//   TURNSTILE_SECRET (recommended, encrypted secret)

const FROM = 'NexFortified Website <notifications@nexfortified.com>';
const TO = 'info@nexfortified.com';

const SERVICES = [
  'Vulnerability Assessment',
  'Penetration Testing',
  'Cybersecurity Consulting',
  'Security Awareness & Training',
  'Surveillance & Access Control',
  'Not sure yet',
];

// Best-effort rate limit (per Cloudflare isolate). For a hard limit, also add a
// Cloudflare WAF rate limiting rule on /api/contact (see setup notes).
const hits = new Map();
const LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;

function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 500) {
    for (const [k, v] of hits) {
      if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
    }
  }
  return false;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const oneLine = (s) => String(s || '').replace(/[\r\n\t]+/g, ' ').trim();

function formatDate() {
  const d = new Date().toLocaleString('en-GB', {
    timeZone: 'Africa/Lagos',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${d} (WAT)`;
}

async function verifyTurnstile(secret, token, ip) {
  if (!token) return false;
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (ip && ip !== 'unknown') form.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const data = await res.json();
    return data.success === true;
  } catch (e) {
    console.error('Turnstile verification failed', e);
    return false;
  }
}

export async function onRequestPost({ request, env }) {
  // Same-origin only
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json({ ok: false, error: 'Request not allowed.' }, 403);
  }

  if (!env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set');
    return json({ ok: false, error: 'The contact form is not set up yet. Please email us directly at info@nexfortified.com.' }, 500);
  }

  if (Number(request.headers.get('Content-Length') || 0) > 20000) {
    return json({ ok: false, error: 'Your message is too large.' }, 413);
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (limited(ip)) {
    return json({ ok: false, error: 'Too many messages in a short time. Please try again in a few minutes.' }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid request.' }, 400);
  }
  if (!body || typeof body !== 'object') {
    return json({ ok: false, error: 'Invalid request.' }, 400);
  }

  // Honeypot: real visitors never fill this. Pretend success so bots move on.
  if (body.website) return json({ ok: true });

  const name = oneLine(body.name);
  const email = oneLine(body.email);
  const phone = oneLine(body.phone);
  const message = String(body.message || '').trim();
  const services = Array.isArray(body.services) ? body.services : [];

  if (!name || name.length > 100) {
    return json({ ok: false, error: 'Please enter your name.' }, 400);
  }
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json({ ok: false, error: 'Please enter a valid email address.' }, 400);
  }
  if (phone && !/^[0-9+()\-.\s]{6,30}$/.test(phone)) {
    return json({ ok: false, error: 'Please enter a valid phone number, or leave it blank.' }, 400);
  }
  if (services.length < 1 || services.length > SERVICES.length || !services.every((s) => SERVICES.includes(s))) {
    return json({ ok: false, error: 'Please select at least one service.' }, 400);
  }
  if (!message || message.length > 5000) {
    return json({ ok: false, error: 'Please enter a message (up to 5000 characters).' }, 400);
  }

  if (env.TURNSTILE_SECRET) {
    const ok = await verifyTurnstile(env.TURNSTILE_SECRET, body.token, ip);
    if (!ok) {
      return json({ ok: false, error: 'Spam check failed. Please refresh the page and try again.' }, 400);
    }
  }

  const serviceText = [...new Set(services)].join(', ');
  const submitted = formatDate();
  const subject = oneLine(`New Website Enquiry – ${serviceText}`).slice(0, 200);

  const text = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone || 'Not provided'}`,
    `Service: ${serviceText}`,
    `Message: ${message}`,
    `Submitted: ${submitted}`,
  ].join('\n');

  const row = (label, value) =>
    `<tr><td style="padding:4px 12px 4px 0;vertical-align:top"><strong>${label}</strong></td><td style="padding:4px 0">${value}</td></tr>`;
  const html =
    `<table style="font-family:Arial,sans-serif;font-size:15px;border-collapse:collapse">` +
    row('Name', esc(name)) +
    row('Email', esc(email)) +
    row('Phone', esc(phone || 'Not provided')) +
    row('Service', esc(serviceText)) +
    row('Message', esc(message).replace(/\r?\n/g, '<br>')) +
    row('Submitted', esc(submitted)) +
    `</table>`;

  let res;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM, // verified sender, never the visitor's address
        to: [TO],
        reply_to: email, // staff clicking Reply write to the visitor
        subject,
        text,
        html,
      }),
    });
  } catch (e) {
    console.error('Resend request failed', e);
    return json({ ok: false, error: 'We could not send your message right now. Please try again, or email us at info@nexfortified.com.' }, 502);
  }

  if (!res.ok) {
    console.error('Resend error', res.status, await res.text());
    return json({ ok: false, error: 'We could not send your message right now. Please try again, or email us at info@nexfortified.com.' }, 502);
  }

  return json({ ok: true });
}

// Any other method
export async function onRequest() {
  return json({ ok: false, error: 'Method not allowed.' }, 405);
}
