export const maximumBatchSize = 50;

export function parseThreadsBatchInput(value: string) {
  const urls: string[] = [];
  const seenPostIds = new Set<string>();
  const invalidLines: string[] = [];
  let duplicateCount = 0;
  let overflowCount = 0;

  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const matches = line.match(/https?:\/\/(?:www\.)?threads\.(?:com|net)\/@[A-Za-z0-9._]+\/post\/[A-Za-z0-9_-]+[^\s]*/gi) ?? [];
    if (!matches.length) {
      invalidLines.push(line);
      continue;
    }
    for (const candidate of matches) {
      const match = candidate.match(/\/(@[A-Za-z0-9._]+\/post\/([A-Za-z0-9_-]+))/i);
      if (!match) continue;
      const postId = match[2].toLowerCase();
      if (seenPostIds.has(postId)) {
        duplicateCount += 1;
        continue;
      }
      seenPostIds.add(postId);
      if (urls.length >= maximumBatchSize) {
        overflowCount += 1;
        continue;
      }
      urls.push(`https://www.threads.com/${match[1]}`);
    }
  }
  return { urls, duplicateCount, invalidLines, overflowCount };
}
