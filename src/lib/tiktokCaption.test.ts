import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_TIKTOK_CAPTION_LENGTH, normalizeTikTokCaption } from './tiktokCaption';

test('preserves a creator-authored caption, hashtags, mentions, and whitespace', () => {
  const caption = '  Nội dung  tự chọn\n\n\n#chude @ban  ';
  assert.equal(normalizeTikTokCaption(caption), caption);
});

test('removes only the fixed hashtag block added by the retired publisher', () => {
  assert.equal(
    normalizeTikTokCaption('Tiêu đề#threadsvietnam\n\n#threadsvietnam #threads #commentdao #fyp #xuhuong'),
    'Tiêu đề'
  );
});

test('enforces the caption limit without leaving a broken surrogate pair', () => {
  const exact = `${'a'.repeat(MAX_TIKTOK_CAPTION_LENGTH - 2)}😀`;
  const crossing = `${'a'.repeat(MAX_TIKTOK_CAPTION_LENGTH - 1)}😀`;
  assert.equal(normalizeTikTokCaption(exact), exact);
  assert.equal(normalizeTikTokCaption(crossing), 'a'.repeat(MAX_TIKTOK_CAPTION_LENGTH - 1));
});

test('is idempotent', () => {
  const caption = 'Caption #tuchon';
  assert.equal(normalizeTikTokCaption(normalizeTikTokCaption(caption)), normalizeTikTokCaption(caption));
});
