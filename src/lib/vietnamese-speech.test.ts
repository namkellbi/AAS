import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeVietnameseForSpeech } from './vietnamese-speech';

test('normalizes a long all-caps English word so TTS reads it as a word', () => {
  assert.equal(normalizeVietnameseForSpeech('Học SHADOWING mỗi ngày'), 'Học shadowing mỗi ngày');
});

test('keeps short initialisms available for initialism pronunciation', () => {
  assert.equal(normalizeVietnameseForSpeech('AI và CEO'), 'AI và CEO');
});

test('does not change an already lowercase English word', () => {
  assert.equal(normalizeVietnameseForSpeech('Học shadowing mỗi ngày'), 'Học shadowing mỗi ngày');
});
