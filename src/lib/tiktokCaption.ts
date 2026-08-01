export const TIKTOK_REQUIRED_HASHTAGS = '#threadsvietnam #threads #commentdao #fyp #xuhuong';

const MAX_TIKTOK_CAPTION_LENGTH = 2200;
const REQUIRED_TAG_NAMES = ['threadsvietnam', 'threads', 'commentdao', 'fyp', 'xuhuong'];

export function ensureTikTokHashtags(caption: string) {
  let body = caption.trim();
  for (const tag of REQUIRED_TAG_NAMES) {
    body = body.replace(new RegExp(`(^|\\s)#${tag}(?=\\s|$)`, 'giu'), '$1');
  }
  body = body.replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').trim();

  const separator = body ? '\n\n' : '';
  const maximumBodyLength = MAX_TIKTOK_CAPTION_LENGTH - separator.length - TIKTOK_REQUIRED_HASHTAGS.length;
  const trimmedBody = body.slice(0, maximumBodyLength).trimEnd();
  return `${trimmedBody}${trimmedBody ? '\n\n' : ''}${TIKTOK_REQUIRED_HASHTAGS}`;
}
