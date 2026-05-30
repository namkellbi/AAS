import fs from 'node:fs';
import path from 'node:path';
import { getAnalysis, listPosts, listSavedPosts } from '@/server/db/client';

export function exportSavedIdeas() {
  const saved = listSavedPosts();
  const posts = new Map(listPosts(1000).map((post) => [post.id, post]));

  const lines = saved.map((item) => {
    const post = posts.get(item.postId);
    const analysis = getAnalysis(item.postId);
    return [
      `# ${post?.content.slice(0, 72) ?? item.postId}`,
      '',
      `Collection: ${item.collection}`,
      `Tags: ${item.tags.join(', ') || 'none'}`,
      post ? `URL: ${post.url}` : '',
      '',
      post ? `Post: ${post.content}` : '',
      analysis ? `Emotion: ${analysis.emotion}` : '',
      analysis ? `Pain point: ${analysis.painPoint}` : '',
      analysis ? `Products: ${analysis.affiliateProducts.join(', ')}` : '',
      analysis ? `Hooks: ${analysis.hooks.join(' | ')}` : '',
      analysis ? `CTAs: ${analysis.ctas.join(' | ')}` : ''
    ]
      .filter(Boolean)
      .join('\n');
  });

  const exportDir = path.resolve(process.cwd(), 'data', 'exports');
  fs.mkdirSync(exportDir, { recursive: true });
  const filePath = path.join(exportDir, `affiliate-ideas-${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
  fs.writeFileSync(filePath, lines.join('\n\n---\n\n'), 'utf8');
  return filePath;
}
