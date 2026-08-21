// Tests for Phase 1-3 code: checkout, invites, referrals, notifications, error boundary
// Pure-logic tests (no DOM/Supabase needed) — same harness style as test_app.js
if (typeof document === 'undefined') {
  global.document = {
    createElement: function() {
      return { textContent: '', get innerHTML() { return this.textContent; }, set innerHTML(v) { this.textContent = v; } };
    }
  };
}

// ---- extract functions from source (no eval of whole app) ----
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');
var utilsSrc = fs.readFileSync(path.join(ROOT, 'js', 'utils.js'), 'utf8');
var appSrc = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');

function extractFn(src, name) {
  var start = src.indexOf('function ' + name + '(');
  if (start === -1) return null;
  var depth = 0, i = src.indexOf('{', start);
  var open = i;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return null;
}

var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  PASS', name); }
  catch (e) { failed++; console.error('  FAIL', name, '-', e.message); }
}

// ---- buildInviteLink ----
var makeBuildInviteLink = new Function('getReferralCode', 'window', extractFn(utilsSrc, 'buildInviteLink') + '; return buildInviteLink;');
test('buildInviteLink embeds ?ref= code', function() {
  var build = makeBuildInviteLink(function() { return 'GG-ABC123'; }, { location: { origin: 'https://x.io', pathname: '/geogive/' } });
  var link = build();
  if (link !== 'https://x.io/geogive/?ref=GG-ABC123') throw new Error('got: ' + link);
});
test('buildInviteLink URL-encodes special chars', function() {
  var build = makeBuildInviteLink(function() { return 'GG-A B&C'; }, { location: { origin: 'https://x.io', pathname: '/' } });
  var link = build();
  if (link.indexOf('GG-A%20B%26C') === -1) throw new Error('not encoded: ' + link);
});

// ---- captureReferralFromUrl ----
var makeCapture = new Function('window', 'localStorage', 'history', extractFn(utilsSrc, 'captureReferralFromUrl') + '; return captureReferralFromUrl;');
test('captureReferralFromUrl stores ?ref= and strips URL', function() {
  var store = {};
  var fakeLS = { getItem: function(k) { return store[k] || null; }, setItem: function(k, v) { store[k] = v; } };
  var fakeWin = { location: { search: '?ref=GG-XYZ' } };
  var fakeHist = { replaceState: function(u) { fakeWin.location.search = ''; } };
  makeCapture(fakeWin, fakeLS, fakeHist)();
  if (store['geogive_pending_ref'] !== 'GG-XYZ') throw new Error('not stored');
  if (fakeWin.location.search !== '') throw new Error('url not cleaned');
});
test('captureReferralFromUrl skips when already referred', function() {
  var store = { 'geogive_referred_by': 'GG-OLD' };
  var fakeLS = { getItem: function(k) { return store[k] || null; }, setItem: function(k, v) { store[k] = v; } };
  var fakeWin = { location: { search: '?ref=GG-NEW' } };
  makeCapture(fakeWin, fakeLS, { replaceState: function() {} })();
  if (store['geogive_pending_ref']) throw new Error('overwrote existing referral');
});

// ---- stripe price catalog (from Edge Function source) ----
test('Edge Function price catalog valid', function() {
  var fn = fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'create-checkout', 'index.ts'), 'utf8');
  if (fn.indexOf("'promote_24h'") === -1) throw new Error('missing promote_24h');
  if (fn.indexOf("'pro_monthly'") === -1) throw new Error('missing pro_monthly');
  if (fn.indexOf('amount: 99') === -1 || fn.indexOf('amount: 299') === -1) throw new Error('prices wrong');
  if (fn.indexOf("currency]'") === -1 || fn.indexOf("'eur'") === -1) throw new Error('currency not eur');
});

// ---- webhook signature verification present ----
test('webhook verifies HMAC signature', function() {
  var fn = fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'stripe-webhook', 'index.ts'), 'utf8');
  if (fn.indexOf('verifyStripeSignature') === -1) throw new Error('no verifier');
  if (fn.indexOf("event.type !== 'checkout.session.completed'") === -1) throw new Error('no event filter');
});

// ---- error boundary present in app.js ----
test('global error boundary wired', function() {
  if (appSrc.indexOf('window.onerror') === -1) throw new Error('no onerror');
  if (appSrc.indexOf('unhandledrejection') === -1) throw new Error('no rejection handler');
});

// ---- focus traps ----
test('modal focus trap function exists', function() {
  if (appSrc.indexOf('trapModalFocus') === -1) throw new Error('missing');
});

// ---- migration idempotency ----
test('migration ALTERs idempotent', function() {
  var sql = fs.readFileSync(path.join(ROOT, 'supabase-migration.sql'), 'utf8');
  var alters = sql.match(/ALTER TABLE/g) || [];
  if (sql.indexOf('ADD COLUMN IF NOT EXISTS') === -1) throw new Error('not idempotent');
  if (sql.indexOf('DROP TABLE') !== -1 && sql.indexOf('-- DROP TABLE') === -1 && sql.indexOf('DO $$') === -1) {
    // bare DROP TABLE outside comments is dangerous on re-run — flag
    throw new Error('bare DROP TABLE found');
  }
});

// ---- VAPID key format ----
test('VAPID public key is valid base64url P-256 (65 bytes)', function() {
  var cfg = fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8');
  var m = cfg.match(/'([A-Za-z0-9_-]{80,})'/);
  if (!m) throw new Error('no long base64url key in config.js');
  var buf = Buffer.from(m[1], 'base64url');
  if (buf.length !== 65) throw new Error('wrong length: ' + buf.length);
  if (buf[0] !== 0x04) throw new Error('not uncompressed point');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
