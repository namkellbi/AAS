export const MAX_TIKTOK_CAPTION_LENGTH = 2200;
const LEGACY_FORCED_HASHTAGS = '#threadsvietnam #threads #commentdao #fyp #xuhuong';

export function normalizeTikTokCaption(caption: string) {
  const withoutLegacyBlock = removeLegacyForcedHashtags(caption);
  const limited = withoutLegacyBlock.slice(0, MAX_TIKTOK_CAPTION_LENGTH);
  return /[\uD800-\uDBFF]$/.test(limited) ? limited.slice(0, -1) : limited;
}

function removeLegacyForcedHashtags(caption: string) {
  const suffixPattern = new RegExp(`(?:\\r?\\n){0,2}${escapeRegExp(LEGACY_FORCED_HASHTAGS)}\\s*$`);
  if (!suffixPattern.test(caption)) return caption;
  return caption
    .replace(suffixPattern, '')
    // Several legacy captions had the first tag glued to the title before
    // the fixed block was appended (for example "title#threadsvietnam").
    .replace(/#threadsvietnam\s*$/i, '')
    .trimEnd();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
