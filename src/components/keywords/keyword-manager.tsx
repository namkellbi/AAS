'use client';

import { Check, FlaskConical, Pencil, Plus, RefreshCcw, Sparkles, Target, Trash2, TrendingUp, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { keywordAudiencePresets } from '@/lib/keyword-audiences';
import type { Language, TranslationCopy } from '@/lib/i18n';
import type { Keyword, KeywordDiscoveryRequest, KeywordDiscoveryResult, KeywordExclusion, KeywordInsight } from '@/lib/types';
import { cn } from '@/lib/utils';

export function KeywordManager({
  copy,
  exclusions,
  insights,
  keywords,
  language,
  newKeyword,
  onAddExclusion,
  onAddKeyword,
  onDeleteExclusion,
  onDeleteKeyword,
  onDiscover,
  onFetchKeyword,
  onNewKeyword,
  onToggleKeyword,
  onUpdateKeyword
}: {
  copy: TranslationCopy;
  exclusions: KeywordExclusion[];
  insights: KeywordInsight[];
  keywords: Keyword[];
  language: Language;
  newKeyword: string;
  onAddExclusion: (phrase: string) => Promise<void>;
  onAddKeyword: (phrase?: string, source?: Keyword['source'], seedAudience?: string) => Promise<void>;
  onDeleteExclusion: (id: string) => Promise<void>;
  onDeleteKeyword: (id: string) => void;
  onDiscover: (request: Omit<KeywordDiscoveryRequest, 'existingKeywords'>) => Promise<KeywordDiscoveryResult>;
  onFetchKeyword: (phrase: string) => void;
  onNewKeyword: (value: string) => void;
  onToggleKeyword: (keyword: Keyword) => void;
  onUpdateKeyword: (id: string, phrase: string) => void;
}) {
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPhrase, setEditingPhrase] = useState('');
  const [selectedAudienceId, setSelectedAudienceId] = useState(keywordAudiencePresets[0].id);
  const [customSeed, setCustomSeed] = useState('');
  const [discovery, setDiscovery] = useState<KeywordDiscoveryResult | null>(null);
  const [discoveryMode, setDiscoveryMode] = useState<KeywordDiscoveryRequest['mode']>('audience');
  const [discovering, setDiscovering] = useState(false);
  const [excludedPhrase, setExcludedPhrase] = useState('');
  const insightByKeyword = useMemo(() => new Map(insights.map((insight) => [insight.keywordId, insight])), [insights]);
  const selectedAudience = keywordAudiencePresets.find((item) => item.id === selectedAudienceId) ?? keywordAudiencePresets[0];
  const counts = {
    potential: insights.filter((item) => item.status === 'potential').length,
    testing: insights.filter((item) => item.status === 'testing').length,
    poor: insights.filter((item) => item.status === 'poor').length
  };
  const sortedKeywords = useMemo(() => {
    const priority = { potential: 0, testing: 1, poor: 2 };
    return [...keywords].sort((a, b) => {
      const aInsight = insightByKeyword.get(a.id) ?? emptyInsight(a.id);
      const bInsight = insightByKeyword.get(b.id) ?? emptyInsight(b.id);
      return priority[aInsight.status] - priority[bInsight.status] || bInsight.score - aInsight.score || a.phrase.localeCompare(b.phrase);
    });
  }, [insightByKeyword, keywords]);

  async function runDiscovery(nextMode: KeywordDiscoveryRequest['mode']) {
    setDiscovering(true);
    setDiscoveryMode(nextMode);
    try {
      const seed = [selectedAudience.seed, customSeed.trim()].filter(Boolean).join(', ');
      setDiscovery(await onDiscover({
        mode: nextMode,
        audienceId: selectedAudience.id,
        audienceLabel: selectedAudience.label[language],
        seed
      }));
    } finally {
      setDiscovering(false);
    }
  }

  async function addSuggestion(phrase: string) {
    await onAddKeyword(
      phrase,
      discoveryMode === 'winners' ? 'ai_expansion' : 'ai_audience',
      selectedAudience.id
    );
    setDiscovery((current) => current ? { ...current, suggestions: current.suggestions.filter((item) => item.phrase !== phrase) } : current);
  }

  return (
    <div className="max-w-6xl space-y-4">
      <div className="inline-flex rounded-md border border-border bg-panel p-1">
        <button className={modeButtonClass(mode === 'ai')} onClick={() => setMode('ai')}><Sparkles className="size-4" />{copy.aiDiscovery}</button>
        <button className={modeButtonClass(mode === 'manual')} onClick={() => setMode('manual')}><Plus className="size-4" />{copy.manualKeyword}</button>
      </div>

      {mode === 'ai' ? (
        <section className="rounded-lg border border-border bg-panel p-5">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-md bg-accent/10 text-accent"><Users className="size-5" /></div>
            <div>
              <h2 className="text-base font-semibold text-text">{copy.chooseAudience}</h2>
              <p className="mt-1 text-sm leading-6 text-muted">{copy.chooseAudienceHelp}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {keywordAudiencePresets.map((audience) => (
              <button
                key={audience.id}
                className={cn('min-h-24 rounded-md border p-3 text-left transition', selectedAudienceId === audience.id ? 'border-accent bg-accent/10' : 'border-border bg-panelSoft hover:border-accent/50')}
                onClick={() => setSelectedAudienceId(audience.id)}
              >
                <div className="text-sm font-semibold text-text">{audience.label[language]}</div>
                <div className="mt-1 text-xs leading-5 text-muted">{audience.description[language]}</div>
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Input className="min-w-64 flex-1" value={customSeed} onChange={(event) => setCustomSeed(event.target.value)} placeholder={copy.refineAudiencePlaceholder} />
            <Button variant="primary" icon={<Target className={cn('size-4', discovering && 'animate-pulse')} />} disabled={discovering} onClick={() => runDiscovery('audience')}>
              {discovering && discoveryMode === 'audience' ? copy.discoveringKeywords : copy.discoverPainPoints}
            </Button>
            <Button icon={<TrendingUp className={cn('size-4', discovering && discoveryMode === 'winners' && 'animate-pulse')} />} disabled={discovering} onClick={() => runDiscovery('winners')}>
              {discovering && discoveryMode === 'winners' ? copy.discoveringKeywords : copy.expandFromWinners}
            </Button>
          </div>

          {discovery ? (
            <div className="mt-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-text">{copy.keywordSuggestions}</div>
                  <div className="mt-1 text-xs text-muted">{copy.discoveryEvidence}: {discovery.postsUsed} {copy.strongPostsUsed} · {discovery.winnersUsed} {copy.winnersUsed}</div>
                </div>
                {discovery.suggestions.length ? (
                  <Button icon={<Plus className="size-4" />} onClick={async () => {
                    for (const suggestion of discovery.suggestions) await addSuggestion(suggestion.phrase);
                  }}>{copy.addAllSuggestions}</Button>
                ) : null}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {discovery.suggestions.map((suggestion) => (
                  <div key={suggestion.phrase} className="rounded-md border border-border bg-panelSoft p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-text">{suggestion.phrase}</div>
                        <div className="mt-1 text-xs text-sky-200">{suggestion.painPoint}</div>
                      </div>
                      <Button className="h-8 shrink-0 px-2" icon={<Plus className="size-4" />} title={copy.addSuggestion} onClick={() => addSuggestion(suggestion.phrase)} />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted">{suggestion.reason}</p>
                    {suggestion.evidence ? <div className="mt-2 rounded bg-background px-2 py-1.5 text-[11px] text-emerald-200">{suggestion.evidence}</div> : null}
                  </div>
                ))}
                {!discovery.suggestions.length ? <div className="text-sm text-muted">{copy.noNewKeywordSuggestions}</div> : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="rounded-lg border border-border bg-panel p-5">
          <h2 className="text-base font-semibold text-text">{copy.manualKeyword}</h2>
          <p className="mt-1 text-sm text-muted">{copy.manualKeywordHelp}</p>
          <div className="mt-4 flex max-w-2xl gap-2">
            <Input value={newKeyword} onChange={(event) => onNewKeyword(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter') void onAddKeyword();
            }} placeholder={copy.addKeywordPlaceholder} />
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => void onAddKeyword()}>{copy.addKeyword}</Button>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-border bg-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-text">{copy.keywordPortfolio}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">{copy.keywordPortfolioHelp}</p>
          </div>
          <div className="flex gap-2 text-xs">
            <StatusSummary label={copy.potential} value={counts.potential} tone="success" />
            <StatusSummary label={copy.testing} value={counts.testing} tone="warning" />
            <StatusSummary label={copy.poor} value={counts.poor} tone="danger" />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {sortedKeywords.map((keyword) => {
            const insight = insightByKeyword.get(keyword.id) ?? emptyInsight(keyword.id);
            const productFitRate = insight.analyzedPosts ? Math.round((insight.productFitPosts / insight.analyzedPosts) * 100) : 0;
            return (
              <div key={keyword.id} className="rounded-md border border-border bg-panelSoft p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {editingId === keyword.id ? (
                      <div className="flex max-w-xl gap-2">
                        <Input value={editingPhrase} onChange={(event) => setEditingPhrase(event.target.value)} />
                        <Button className="px-2" icon={<Check className="size-4" />} disabled={!editingPhrase.trim()} onClick={() => {
                          onUpdateKeyword(keyword.id, editingPhrase);
                          setEditingId(null);
                        }} />
                        <Button className="px-2" icon={<X className="size-4" />} onClick={() => setEditingId(null)} />
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <button className="truncate text-left text-sm font-semibold text-text" onClick={() => onFetchKeyword(keyword.phrase)}>{keyword.phrase}</button>
                          <SourceBadge source={keyword.source} copy={copy} />
                          <InsightBadge insight={insight} copy={copy} />
                          {!keyword.enabled ? <span className="rounded-md bg-background px-2 py-1 text-[11px] text-muted">{copy.disabled}</span> : null}
                        </div>
                        {keyword.seedAudience ? <div className="mt-1 text-[11px] text-muted">{copy.audienceSource}: {audienceName(keyword.seedAudience, language)}</div> : null}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-background px-2.5 py-1.5 text-center">
                      <div className="text-[10px] uppercase text-muted">{copy.keywordScore}</div>
                      <div className={cn('text-sm font-semibold', insight.status === 'potential' ? 'text-emerald-200' : insight.status === 'poor' ? 'text-rose-200' : 'text-amber-200')}>{insight.score}</div>
                    </div>
                    <Button className="h-8" icon={<RefreshCcw className="size-3.5" />} onClick={() => onFetchKeyword(keyword.phrase)}>{copy.fetch}</Button>
                    {insight.recommendation === 'disable' && keyword.enabled ? <Button className="h-8" onClick={() => onToggleKeyword(keyword)}>{copy.disableSuggested}</Button> : null}
                    <Button className="h-8 px-2" icon={<Pencil className="size-3.5" />} onClick={() => {
                      setEditingId(keyword.id);
                      setEditingPhrase(keyword.phrase);
                    }} />
                    <Button className="h-8 px-2" icon={<Trash2 className="size-3.5" />} onClick={() => {
                      if (window.confirm(copy.confirmDeleteKeyword)) onDeleteKeyword(keyword.id);
                    }} />
                    <button aria-label={`${keyword.enabled ? copy.enabled : copy.disabled} ${keyword.phrase}`} onClick={() => onToggleKeyword(keyword)} className={cn('h-5 w-9 rounded-full p-0.5 transition', keyword.enabled ? 'bg-success' : 'bg-border')}>
                      <span className={cn('block size-4 rounded-full bg-white transition', keyword.enabled ? 'translate-x-4' : 'translate-x-0')} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
                  <Metric label={copy.scans} value={insight.scanCount} />
                  <Metric label={copy.postsFound} value={insight.fetchedPosts} />
                  <Metric label={copy.makeNow} value={insight.makeNowPosts} />
                  <Metric label={copy.productFitRate} value={`${productFitRate}%`} />
                  <Metric label={copy.orders} value={insight.orders} />
                </div>
              </div>
            );
          })}
          {!keywords.length ? <div className="rounded-md border border-border bg-background p-5 text-sm text-muted">{copy.noKeywordsYet}</div> : null}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-panel p-5">
        <h2 className="text-base font-semibold text-text">{copy.excludedKeywords}</h2>
        <p className="mt-1 text-sm text-muted">{copy.excludedKeywordsHelp}</p>
        <div className="mt-4 flex max-w-xl gap-2">
          <Input value={excludedPhrase} onChange={(event) => setExcludedPhrase(event.target.value)} placeholder={copy.excludedKeywordPlaceholder} />
          <Button icon={<Plus className="size-4" />} disabled={!excludedPhrase.trim()} onClick={async () => {
            await onAddExclusion(excludedPhrase);
            setExcludedPhrase('');
          }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {exclusions.map((item) => (
            <span key={item.id} className="inline-flex items-center gap-2 rounded-md border border-border bg-panelSoft px-2.5 py-1.5 text-xs text-muted">
              {item.phrase}
              <button aria-label={copy.deleteKeyword} className="text-muted hover:text-text" onClick={() => void onDeleteExclusion(item.id)}><X className="size-3.5" /></button>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

function modeButtonClass(active: boolean) {
  return cn('inline-flex h-8 items-center gap-2 rounded px-3 text-sm transition', active ? 'bg-panelSoft text-text' : 'text-muted hover:text-text');
}

function SourceBadge({ copy, source }: { copy: TranslationCopy; source: Keyword['source'] }) {
  const labels = {
    manual: copy.sourceManual,
    default: copy.sourceDefault,
    ai_audience: copy.sourceAiAudience,
    ai_expansion: copy.sourceAiExpansion
  };
  return <span className="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted">{labels[source]}</span>;
}

function InsightBadge({ copy, insight }: { copy: TranslationCopy; insight: KeywordInsight }) {
  const labels = { potential: copy.potential, testing: copy.testing, poor: copy.poor };
  return <span className={cn('rounded-md px-2 py-1 text-[11px] font-medium', insight.status === 'potential' ? 'bg-success/15 text-emerald-200' : insight.status === 'poor' ? 'bg-danger/15 text-rose-200' : 'bg-warning/15 text-amber-200')}>{labels[insight.status]}</span>;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-md border border-border bg-background px-3 py-2"><div className="text-[10px] uppercase text-muted">{label}</div><div className="mt-1 text-sm font-semibold text-text">{value}</div></div>;
}

function StatusSummary({ label, tone, value }: { label: string; tone: 'success' | 'warning' | 'danger'; value: number }) {
  return <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-1', tone === 'success' ? 'bg-success/10 text-emerald-200' : tone === 'danger' ? 'bg-danger/10 text-rose-200' : 'bg-warning/10 text-amber-200')}><FlaskConical className="size-3" />{label} {value}</span>;
}

function audienceName(id: string, language: Language) {
  return keywordAudiencePresets.find((item) => item.id === id)?.label[language] ?? id;
}

function emptyInsight(keywordId: string): KeywordInsight {
  return {
    keywordId,
    scanCount: 0,
    fetchedPosts: 0,
    currentPosts: 0,
    analyzedPosts: 0,
    makeNowPosts: 0,
    watchPosts: 0,
    painPointPosts: 0,
    productFitPosts: 0,
    averageOpportunityScore: 0,
    orders: 0,
    commission: 0,
    score: 0,
    status: 'testing',
    recommendation: 'test'
  };
}
