'use client';

/* eslint-disable @next/next/no-img-element */

import { Bookmark, ExternalLink, Eye, Lightbulb, MessageCircle, Repeat2, Sparkles, ThumbsUp, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScoreRing } from '@/components/ui/score-ring';
import type { TranslationCopy } from '@/lib/i18n';
import { filterUsefulReplies } from '@/lib/replies';
import type { ThreadsPost } from '@/lib/types';
import { cn, compactNumber } from '@/lib/utils';

export function FeedCard({
  post,
  active,
  analyzing,
  loadingReplies,
  saved,
  onSelect,
  onAnalyze,
  onSave,
  onGenerateTikTokIdea,
  onOpenLink,
  onShowReplies,
  copy
}: {
  post: ThreadsPost;
  active: boolean;
  analyzing: boolean;
  loadingReplies: boolean;
  saved: boolean;
  onSelect: () => void;
  onAnalyze: () => void;
  onSave: () => void;
  onGenerateTikTokIdea: () => void;
  onOpenLink: () => void;
  onShowReplies: () => void;
  copy: TranslationCopy;
}) {
  const hasPermalink = /^https:\/\/(www\.)?threads\.(com|net)\/@[A-Za-z0-9._]+\/post\/[A-Za-z0-9_-]+/.test(post.url);
  const usefulReplyCount = filterUsefulReplies(post.topReplies).length;

  return (
    <article
      className={cn(
        'animate-slide-up rounded-lg border bg-panel p-4 transition hover:border-accent/50',
        active ? 'border-accent/70 shadow-glow' : 'border-border'
      )}
      onClick={onSelect}
    >
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold text-text">{post.author}</div>
            {post.authorHandle ? <div className="truncate text-xs text-muted">{post.authorHandle}</div> : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge>{post.emotionalCategory}</Badge>
            {post.keyword ? <Badge>{post.keyword}</Badge> : null}
            {post.engagementGrowthPercent > 0 ? <Badge className="text-emerald-200"><TrendingUp className="mr-1 size-3" />+{post.engagementGrowthPercent}%</Badge> : null}
            <Badge className={trendBadgeClass(post.trendState)}>{trendBadgeLabel(post.trendState)}</Badge>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <ScoreRing value={post.opportunityScore} label={copy.opportunityScore} />
        </div>
      </div>

      <p className="mb-4 text-sm leading-6 text-slate-200">{post.content}</p>

      {post.imageUrls.length > 0 ? (
        <div className="mb-4 grid grid-cols-3 gap-2">
          {post.imageUrls.map((src) => (
            <img key={src} src={src} alt="" className="aspect-video rounded-md border border-border object-cover" />
          ))}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <ThumbsUp className="size-3.5" />
          {compactNumber(post.likes)}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle className="size-3.5" />
          {compactNumber(post.replies)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Repeat2 className="size-3.5" />
          {compactNumber(post.reposts)}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          icon={<Sparkles className="size-4" />}
          disabled={analyzing}
          onClick={(event) => {
            event.stopPropagation();
            onAnalyze();
          }}
        >
          {analyzing ? copy.analyzing : copy.analyze}
        </Button>
        <Button
          variant={saved ? 'primary' : 'secondary'}
          icon={<Bookmark className={cn('size-4', saved && 'fill-current')} />}
          onClick={(event) => {
            event.stopPropagation();
            onSave();
          }}
        >
          {saved ? copy.saved : copy.savePost}
        </Button>
        <Button
          icon={<Lightbulb className="size-4" />}
          disabled={analyzing}
          onClick={(event) => {
            event.stopPropagation();
            onGenerateTikTokIdea();
          }}
        >
          {copy.generateTikTokIdea}
        </Button>
        <Button
          icon={<ExternalLink className="size-4" />}
          disabled={!hasPermalink}
          title={hasPermalink ? copy.openLink : copy.fetchAgainForLink}
          onClick={(event) => {
            event.stopPropagation();
            onOpenLink();
          }}
        >
          {copy.openLink}
        </Button>
        <Button
          icon={<Eye className="size-4" />}
          disabled={loadingReplies || post.replies === 0}
          title={usefulReplyCount ? 'Xem top replies đã tải' : 'Tải top replies để dùng cho video'}
          onClick={(event) => {
            event.stopPropagation();
            onShowReplies();
          }}
        >
          {loadingReplies ? 'Đang tải replies...' : usefulReplyCount ? `Xem replies (${usefulReplyCount})` : 'Tải replies'}
        </Button>
      </div>
    </article>
  );
}

function trendBadgeLabel(state: ThreadsPost['trendState']) {
  return { EMERGING: '🔥 Emerging', GROWING: '🚀 Growing', PEAK: '👑 Peak', DECLINING: '📉 Declining', DEAD: 'Dead' }[state];
}

function trendBadgeClass(state: ThreadsPost['trendState']) {
  return state === 'EMERGING' || state === 'GROWING' ? 'text-emerald-200' : state === 'PEAK' ? 'text-amber-200' : 'text-muted';
}
