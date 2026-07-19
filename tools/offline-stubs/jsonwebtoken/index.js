// Stub FONCTIONNEL — HS256/RS256 réels via crypto natif (validé par les tests IAM eux-mêmes)
const crypto = require('crypto');
const b64u = (b) => Buffer.from(b).toString('base64url');
const enc = (o) => b64u(JSON.stringify(o));
function sign(payload, key, opts = {}) {
  const alg = opts.algorithm || 'HS256';
  const now = Math.floor(Date.now() / 1000);
  const body = { iat: now, ...payload };
  if (opts.expiresIn) {
    const m = String(opts.expiresIn).match(/^(\d+)([smhd]?)$/);
    const mult = { '': 1, s: 1, m: 60, h: 3600, d: 86400 }[m ? m[2] : ''] || 1;
    body.exp = now + (m ? parseInt(m[1]) * mult : parseInt(opts.expiresIn));
  }
  if (opts.keyid) var kid = opts.keyid;
  const header = { alg, typ: 'JWT', ...(kid ? { kid } : {}) };
  const si = enc(header) + '.' + enc(body);
  let sig;
  if (alg === 'HS256') sig = crypto.createHmac('sha256', key).update(si).digest('base64url');
  else if (alg === 'RS256') sig = crypto.createSign('RSA-SHA256').update(si).sign(key, 'base64url');
  else throw new Error('alg non supporté: ' + alg);
  return si + '.' + sig;
}
function decodeParts(token) {
  const [h, p, s] = String(token).split('.');
  return { header: JSON.parse(Buffer.from(h, 'base64url')), payload: JSON.parse(Buffer.from(p, 'base64url')), si: h + '.' + p, sig: s };
}
function verify(token, key, opts = {}) {
  const { header, payload, si, sig } = decodeParts(token);
  const algs = opts.algorithms || [header.alg];
  if (!algs.includes(header.alg)) { const e = new Error('invalid algorithm'); e.name = 'JsonWebTokenError'; throw e; }
  let ok;
  if (header.alg === 'HS256') ok = crypto.timingSafeEqual(Buffer.from(crypto.createHmac('sha256', key).update(si).digest('base64url')), Buffer.from(sig));
  else if (header.alg === 'RS256') ok = crypto.createVerify('RSA-SHA256').update(si).verify(key, sig, 'base64url');
  else ok = false;
  if (!ok) { const e = new Error('invalid signature'); e.name = 'JsonWebTokenError'; throw e; }
  if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) { const e = new Error('jwt expired'); e.name = 'TokenExpiredError'; throw e; }
  return payload;
}
function decode(token, opts = {}) { try { const d = decodeParts(token); return opts.complete ? { header: d.header, payload: d.payload } : d.payload; } catch { return null; } }
module.exports = { sign, verify, decode, JsonWebTokenError: Error, TokenExpiredError: Error };
