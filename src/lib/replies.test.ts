import assert from 'node:assert/strict';
import test from 'node:test';
import { filterUsefulReplies } from './replies';
import type { ThreadsReply } from './types';

function reply(id: string, author: string, content: string, likes: number, segment?: [number, number]): ThreadsReply {
  return {
    id,
    author,
    content,
    likes,
    ...(segment ? { segmentIndex: segment[0], segmentTotal: segment[1] } : {})
  };
}

test('orders a creator multipart continuation before other replies', () => {
  const replies = [
    reply('other', 'reader', 'Bình luận rất nhiều like', 50_000),
    reply('part-4', 'lilycoreofc', 'Đoạn cuối 4/4', 10_200),
    reply('part-2', 'lilycoreofc', 'Đoạn thứ hai 2/4', 8_400),
    reply('part-3', 'lilycoreofc', 'Đoạn thứ ba 3/4', 9_700)
  ];

  const sorted = filterUsefulReplies(replies, {
    author: 'lilycoreofc',
    authorHandle: '@lilycoreofc',
    content: 'Mở đầu câu chuyện 1/4'
  });

  assert.deepEqual(sorted.map(({ id }) => id), ['part-2', 'part-3', 'part-4', 'other']);
});

test('uses explicit segment metadata when a long reply no longer contains its badge', () => {
  const replies = [
    reply('part-3', 'creator', 'Đoạn dài đã bị cắt', 100, [3, 3]),
    reply('part-2', 'creator', 'Đoạn dài khác đã bị cắt', 1, [2, 3])
  ];

  assert.deepEqual(filterUsefulReplies(replies).map(({ id }) => id), ['part-2', 'part-3']);
});

test('trusts scraper segment metadata for a two-part self-thread', () => {
  const replies = [
    reply('popular', 'reader', 'Reply nhiều like', 100),
    reply('part-2', 'creator', 'Phần tiếp theo không có badge trong text', 1, [2, 2])
  ];

  const sorted = filterUsefulReplies(replies, {
    author: 'Creator Name',
    authorHandle: '@creator',
    content: 'Phần mở đầu cũng không có badge trong text'
  });

  assert.deepEqual(sorted.map(({ id }) => id), ['part-2', 'popular']);
});

test('keeps likes-descending order when no multipart series exists', () => {
  const replies = [
    reply('low', 'reader-a', 'Reply thường', 2),
    reply('high', 'reader-b', 'Reply nhiều like', 20),
    reply('middle', 'reader-c', 'Một phân số đơn lẻ 2/4', 10)
  ];

  assert.deepEqual(filterUsefulReplies(replies).map(({ id }) => id), ['high', 'middle', 'low']);
});

test('does not treat another author as the root creator continuation', () => {
  const replies = [
    reply('reader-fraction', 'reader', 'Ý kiến cá nhân 2/4', 1),
    reply('popular', 'someone-else', 'Reply phổ biến', 100)
  ];

  const sorted = filterUsefulReplies(replies, {
    author: 'creator',
    authorHandle: '@creator',
    content: 'Bài gốc 1/4'
  });

  assert.deepEqual(sorted.map(({ id }) => id), ['popular', 'reader-fraction']);
});

test('removes a standalone Threads Author separator from stored reply content', () => {
  const replies = [reply('reply', 'creator', '· Nội dung thật của reply', 10)];

  assert.equal(filterUsefulReplies(replies)[0].content, 'Nội dung thật của reply');
});
