import assert from 'node:assert/strict';
import test from 'node:test';
import { validateInputSegments, validateOutputSegments } from './speechNormalizationService';
import { TTS_NORMALIZATION_INSTRUCTIONS, TTS_NORMALIZATION_PROMPT_VERSION } from './ttsNormalizationPrompt';

test('prompt requires contextual shorthand expansion and VieNeu-safe phonetic spacing', () => {
  assert.equal(TTS_NORMALIZATION_PROMPT_VERSION, 'aas-tts-vi-v2');
  assert.match(TTS_NORMALIZATION_INSTRUCTIONS, /Tính tui nó vậy chứ cũng không làm gì ai/);
  assert.match(TTS_NORMALIZATION_INSTRUCTIONS, /grab → gờ rab/);
  assert.match(TTS_NORMALIZATION_INSTRUCTIONS, /date → đết/);
  assert.match(TTS_NORMALIZATION_INSTRUCTIONS, /không viết “gờrab”/);
});

test('accepts normalized segments only when ids and order are unchanged', () => {
  const source = [
    { id: 'post', text: 'AI này tốt' },
    { id: 'reply-1', text: '30k thôi' }
  ];
  const output = validateOutputSegments({
    segments: [
      { id: 'post', text: 'Ây ai này tốt.' },
      { id: 'reply-1', text: 'Ba mươi nghìn thôi.' }
    ]
  }, source);
  assert.equal(output[1].text, 'Ba mươi nghìn thôi.');
});

test('rejects dropped or reordered normalized segments', () => {
  const source = validateInputSegments([
    { id: 'post', text: 'Bài viết' },
    { id: 'reply-1', text: 'Bình luận' }
  ]);
  assert.throws(
    () => validateOutputSegments({ segments: [{ id: 'reply-1', text: 'Bình luận' }] }, source),
    /thiếu hoặc thừa|đổi ID/
  );
  assert.throws(
    () => validateOutputSegments({
      segments: [
        { id: 'reply-1', text: 'Bình luận' },
        { id: 'post', text: 'Bài viết' }
      ]
    }, source),
    /đổi ID/
  );
});
