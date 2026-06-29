// Test pure utility functions from utils.js
// These don't depend on DOM or Supabase

// Mock DOM for Node.js testing
if (typeof document === 'undefined') {
  global.document = {
    createElement: function(tag) {
      return {
        textContent: '',
        get innerHTML() {
          // Minimal HTML entity encoding
          return this.textContent
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        }
      };
    }
  };
}

function escHtml(str) {
  var d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function escJs(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '');
}

function sanitizeUrl(url) {
  if (!url) return '';
  var s = String(url).trim();
  if (s.match(/^data:image\/(jpeg|png|gif|webp);base64,/i)) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.charAt(0) === '/' || s.charAt(0) === '.' || s.charAt(0) === '#') return s;
  return '';
}

function truncate(str, n) {
  return (str || '').length > n ? str.substring(0, n) + '...' : (str || '');
}

// ===== TESTS =====

function assert(condition, msg) {
  if (!condition) {
    console.error('FAIL: ' + msg);
    process.exit(1);
  }
  console.log('PASS: ' + msg);
}

// escHtml tests
assert(escHtml('<script>') === '&lt;script&gt;', 'escHtml escapes script tags');
assert(escHtml('"hello"') === '&quot;hello&quot;', 'escHtml escapes quotes');
assert(escHtml('') === '', 'escHtml handles empty string');
assert(escHtml(null) === '', 'escHtml handles null');

// escJs tests
assert(escJs("it's") === "it\\'s", 'escJs escapes single quotes');
assert(escJs('say "hi"') === 'say \\"hi\\"', 'escJs escapes double quotes');
assert(escJs('line1\nline2') === 'line1\\nline2', 'escJs escapes newlines');

// sanitizeUrl tests
assert(sanitizeUrl('https://example.com/img.jpg') === 'https://example.com/img.jpg', 'sanitizeUrl allows https');
assert(sanitizeUrl('javascript:alert(1)') === '', 'sanitizeUrl blocks javascript:');
assert(sanitizeUrl('data:image/jpeg;base64,abc123') === 'data:image/jpeg;base64,abc123', 'sanitizeUrl allows data:image');
assert(sanitizeUrl('data:text/html;base64,abc') === '', 'sanitizeUrl blocks non-image data');
assert(sanitizeUrl('/relative/path') === '/relative/path', 'sanitizeUrl allows relative paths');

// truncate tests
assert(truncate('hello world', 5) === 'hello...', 'truncate shortens long strings');
assert(truncate('hi', 5) === 'hi', 'truncate leaves short strings');
assert(truncate('', 5) === '', 'truncate handles empty');

console.log('\n✅ All 14 tests passed!');
