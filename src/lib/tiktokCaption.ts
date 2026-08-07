export const TIKTOK_REQUIRED_HASHTAGS = '#threadsvietnam #threads #commentdao #fyp #xuhuong';

const MAX_TIKTOK_CAPTION_LENGTH = 2200;

export function normalizeTikTokCaption(caption: string) {
  const body = caption
    // AI-generated/product hashtags are not part of the publishing policy.
    // Remove every hashtag here, then append the single approved fixed set.
    .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, '$1')
    .trim()
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
  const separator = body ? '\n\n' : '';
  const maximumBodyLength = MAX_TIKTOK_CAPTION_LENGTH - separator.length - TIKTOK_REQUIRED_HASHTAGS.length;
  const trimmedBody = body.slice(0, maximumBodyLength)
    .trimEnd();
  return `${trimmedBody}${trimmedBody ? separator : ''}${TIKTOK_REQUIRED_HASHTAGS}`;
}
