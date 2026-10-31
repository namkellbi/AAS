import assert from 'node:assert/strict';
import test from 'node:test';
import { parseThreadsBatchInput } from './batch-links';

test('normalizes Threads links from newline input and removes duplicate post IDs', () => {
  const result = parseThreadsBatchInput([
    'https://threads.net/@creator/post/ABC123?x=1',
    'https://www.threads.com/@creator/post/ABC123',
    'https://threads.com/@other/post/XYZ_9'
  ].join('\n'));
  assert.deepEqual(result.urls, [
    'https://www.threads.com/@creator/post/ABC123',
    'https://www.threads.com/@other/post/XYZ_9'
  ]);
  assert.equal(result.duplicateCount, 1);
});

test('reports non-link lines without discarding valid lines', () => {
  const result = parseThreadsBatchInput('not a link\nhttps://threads.com/@creator/post/OK_1');
  assert.equal(result.urls.length, 1);
  assert.deepEqual(result.invalidLines, ['not a link']);
});
