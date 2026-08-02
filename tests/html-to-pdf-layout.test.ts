import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractHtmlBlocks,
  validateHtmlForPdf,
  wrapTextForPdf,
} from '../src/lib/engines/html-to-pdf-layout';

test('extractHtmlBlocks preserves readable block order and decodes entities', () => {
  assert.deepEqual(
    extractHtmlBlocks('<h1>Hello &amp; welcome</h1><p>First <strong>paragraph</strong>.</p><ul><li>One</li><li>Two</li></ul>'),
    ['Hello & welcome', 'First paragraph.', '• One', '• Two'],
  );
});

test('extractHtmlBlocks excludes executable and non-content markup', () => {
  const blocks = extractHtmlBlocks('<style>body { color: red }</style><script>throw new Error("never run")</script><p>Safe</p><iframe src="https://evil.example"></iframe>');
  assert.deepEqual(blocks, ['Safe']);
});

test('extractHtmlBlocks tolerates malformed markup and preserves literal comparison text', () => {
  assert.deepEqual(extractHtmlBlocks('<div>1 < 2 and 3 > 2<p>still readable'), ['1 < 2 and 3 > 2', 'still readable']);
});

test('wrapTextForPdf wraps unbroken values without losing characters', () => {
  const token = 'a'.repeat(180);
  const lines = wrapTextForPdf(token, 40, (value) => value.length);
  assert.ok(lines.length > 1);
  assert.equal(lines.join(''), token);
  assert.ok(lines.every((line) => line.length <= 40));
});

test('validateHtmlForPdf rejects blank and oversized documents with actionable messages', () => {
  assert.throws(() => validateHtmlForPdf('   '), /Enter HTML content/i);
  assert.throws(() => validateHtmlForPdf('x'.repeat(1_000_001)), /1 MB/i);
});
