import assert from 'node:assert/strict';
import test from 'node:test';
import type { ThreadsPost, ThreadsReply } from '@/lib/types';
import { postAnalysisSignature, type AnalysisSourcePost } from './postAnalysisSignature';

function reply(overrides: Partial<ThreadsReply> = {}): ThreadsReply {
  return {
    id: 'reply-1',
    author: 'reader',
    content: 'Useful reply',
    likes: 10,
    ...overrides
  };
}

function post(overrides: Partial<AnalysisSourcePost> = {}): AnalysisSourcePost {
  return {
    author: 'creator',
    authorHandle: '@creator',
    content: 'Original content',
    topReplies: [reply()],
    ...overrides
  };
}

test('normalizes whitespace and ignores volatile reply metrics and embedded URLs', () => {
  const first = post();
  const second = post({
    content: '  Original   content ',
    topReplies: [reply({
      likes: 999,
      replies: 40,
      reposts: 12,
      shares: 8,
      authorAvatarUrl: 'data:image/jpeg;base64,avatar'
    })]
  });
  assert.equal(postAnalysisSignature(first), postAnalysisSignature(second));
  assert.equal(postAnalysisSignature(first), postAnalysisSignature(post({ authorHandle: undefined })));
});

test('changes when the post or reply text changes', () => {
  assert.notEqual(postAnalysisSignature(post()), postAnalysisSignature(post({ content: 'Corrected content' })));
  assert.notEqual(postAnalysisSignature(post()), postAnalysisSignature(post({ author: 'another-creator' })));
  assert.notEqual(
    postAnalysisSignature(post()),
    postAnalysisSignature(post({ topReplies: [reply({ content: 'A different reply' })] }))
  );
});

test('changes for reply identity but ignores the specific media URL', () => {
  assert.notEqual(
    postAnalysisSignature(post()),
    postAnalysisSignature(post({ topReplies: [reply({ id: 'another-reply', author: 'another-reader' })] }))
  );
  assert.equal(
    postAnalysisSignature(post({ topReplies: [reply({ mediaUrls: ['https://cdn.example/one.jpg'] })] })),
    postAnalysisSignature(post({ topReplies: [reply({ mediaUrls: ['data:image/jpeg;base64,two'] })] }))
  );
});

test('changes when a reply is added or its media availability changes', () => {
  assert.notEqual(
    postAnalysisSignature(post()),
    postAnalysisSignature(post({ topReplies: [reply(), reply({ id: 'reply-2' })] }))
  );
  assert.notEqual(
    postAnalysisSignature(post()),
    postAnalysisSignature(post({ topReplies: [reply({ mediaUrls: ['data:image/jpeg;base64,media'] })] }))
  );
});

test('does not change only because reply order changes', () => {
  const replies = [reply({ id: 'reply-a' }), reply({ id: 'reply-b' })];
  assert.equal(
    postAnalysisSignature(post({ topReplies: replies })),
    postAnalysisSignature(post({ topReplies: [...replies].reverse() }))
  );
});
