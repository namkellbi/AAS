import assert from 'node:assert/strict';
import test from 'node:test';
import {
  firstThreadsPostImageUrl,
  sanitizeThreadsMediaCandidates,
  sanitizeThreadsPostImageUrls
} from './threadsMedia';

const defaultThreadsAvatar = 'https://static.cdninstagram.com/rsrc.php/v1/yb/r/5OTfmveiK1K.jpg';
const profileImage = 'https://scontent.example.cdninstagram.com/v/t51.2885-19/avatar.jpg?profile_pic=1';
const postImage = 'https://scontent.example.cdninstagram.com/v/t51.29350-15/post-media.jpg?ccb=7-5';
const videoPoster = 'https://scontent.example.cdninstagram.com/v/t15.5256-10/video-poster.jpg';

test('removes the default avatar from the text-only Threads post Db9chk3D5by', () => {
  assert.deepEqual(sanitizeThreadsMediaCandidates([
    {
      url: defaultThreadsAvatar,
      kind: 'image',
      alt: '',
      renderedWidth: 36,
      renderedHeight: 36
    }
  ]), []);
});

test('uses rendered dimensions and localized alt text to reject profile images', () => {
  assert.deepEqual(sanitizeThreadsMediaCandidates([
    {
      url: 'https://images.example/avatar-large-source.jpg',
      kind: 'image',
      alt: '\u1ea2nh \u0111\u1ea1i di\u1ec7n c\u1ee7a t\u00e1c gi\u1ea3',
      renderedWidth: 320,
      renderedHeight: 320
    },
    {
      url: 'https://images.example/avatar-natural-340.jpg',
      kind: 'image',
      alt: '',
      renderedWidth: 36,
      renderedHeight: 36
    }
  ]), []);
});

test('keeps real post images and video posters while removing profile assets', () => {
  assert.deepEqual(sanitizeThreadsMediaCandidates([
    { url: profileImage, kind: 'image', renderedWidth: 150, renderedHeight: 150 },
    { url: postImage, kind: 'image', alt: 'Photo by the author', renderedWidth: 520, renderedHeight: 680 },
    { url: postImage, kind: 'image', alt: 'Duplicate carousel image', renderedWidth: 520, renderedHeight: 680 },
    { url: videoPoster, kind: 'video-poster' }
  ]), [postImage, videoPoster]);
});

test('filters profile images from metadata and stored rows', () => {
  assert.deepEqual(sanitizeThreadsMediaCandidates([
    { url: profileImage, kind: 'metadata' },
    { url: postImage, kind: 'metadata' }
  ]), [postImage]);
  assert.deepEqual(sanitizeThreadsPostImageUrls([defaultThreadsAvatar, postImage]), [postImage]);
});

test('renderer media selection skips a stale invalid first URL', () => {
  assert.equal(firstThreadsPostImageUrl([defaultThreadsAvatar, postImage]), postImage);
  assert.equal(firstThreadsPostImageUrl([defaultThreadsAvatar]), undefined);
});
