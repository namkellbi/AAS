import { fetchThreadsPosts } from '@/server/scraper/threadsScraper';

async function main() {
  const query = process.argv[2] ?? 'glasses';
  const posts = await fetchThreadsPosts({ mode: 'keyword', query, maxPosts: 8 });
  console.log(
    JSON.stringify(
      posts.map((post) => ({
        author: post.author,
        url: post.url,
        score: post.trendingScore,
        likes: post.likes,
        replies: post.replies,
        content: post.content.slice(0, 140)
      })),
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
