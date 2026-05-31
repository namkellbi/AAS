'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { BarChart3, Bookmark, Check, Download, Filter, KeyRound, LogIn, Pencil, Plus, Radar, RefreshCcw, Search, SlidersHorizontal, Sparkles, Trash2, TrendingUp, X } from 'lucide-react';
import { AnalysisPanel } from '@/components/analysis/analysis-panel';
import { formatTikTokBrief, TikTokBriefModal } from '@/components/analysis/tiktok-brief-modal';
import { FeedCard } from '@/components/feed/feed-card';
import { Sidebar } from '@/components/layout/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { translations, type Language, type TranslationCopy } from '@/lib/i18n';
import { formatModelPrice, openAIModelOptions, recommendedOpenAIModel } from '@/lib/openai-models';
import type { AIAnalysis, AppSettings, FetchMode, Keyword, SavedPost, ServiceHealth, ThreadsPost, VideoDraftProgress } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const [activeView, setActiveView] = useState('home');
  const [posts, setPosts] = useState<ThreadsPost[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [analysis, setAnalysis] = useState<Record<string, AIAnalysis>>({});
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [health, setHealth] = useState<ServiceHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [fetchMode, setFetchMode] = useState<FetchMode>('keyword');
  const [isFetching, setIsFetching] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [latestScanPosts, setLatestScanPosts] = useState<ThreadsPost[]>([]);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [briefPostId, setBriefPostId] = useState<string | null>(null);
  const [briefCopied, setBriefCopied] = useState(false);
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [videoRenderProgress, setVideoRenderProgress] = useState<VideoDraftProgress | null>(null);
  const [renderedVideoPath, setRenderedVideoPath] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const scannedOnLaunch = useRef(false);
  const language = settings?.language ?? 'en';
  const copy = translations[language];

  const showHealth = useCallback((message: ServiceHealth | null) => {
    setHealth(message);
  }, []);

  const selectedPost = posts.find((post) => post.id === selectedId) ?? posts[0];
  const selectedAnalysis = selectedPost ? analysis[selectedPost.id] : null;
  const briefPost = briefPostId ? posts.find((post) => post.id === briefPostId) : undefined;
  const briefAnalysis = briefPost ? analysis[briefPost.id] : undefined;
  const savedIds = useMemo(() => new Set(savedPosts.map((item) => item.postId)), [savedPosts]);
  const analyzedCount = Object.keys(analysis).length;
  const activeKeywords = keywords.filter((keyword) => keyword.enabled);
  const topPosts = useMemo(() => [...posts].sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 5), [posts]);
  const shouldShowFeedTools = activeView === 'trending' || activeView === 'saved' || activeView === 'products';
  const shouldShowAnalysisPanel = activeView === 'trending' || activeView === 'saved' || activeView === 'products';

  const visiblePosts = useMemo(() => {
    const filtered =
      activeView === 'saved'
        ? posts.filter((post) => savedIds.has(post.id))
        : activeView === 'products'
          ? posts.filter((post) => analysis[post.id])
          : posts;

    return filtered
      .filter((post) => (query.trim() ? `${post.content} ${post.keyword ?? ''} ${post.author}`.toLowerCase().includes(query.toLowerCase()) : true))
      .sort((a, b) => b.opportunityScore - a.opportunityScore);
  }, [activeView, analysis, posts, query, savedIds]);

  const runFetch = useCallback(
    async (mode: FetchMode = fetchMode, phrase = query, maxPosts = 40) => {
      setIsFetching(true);
      try {
        const api = window.desktopAPI;
        if (!api) {
          setError('Desktop API is unavailable. Run this inside Electron with npm.cmd start or npm.cmd run dev.');
          return;
        }

        setError(null);
        showHealth(null);
        const result = await api.fetchThreads({ mode, query: phrase, maxPosts });
        setPosts((current) => mergePosts(result.posts, current));
        if (result.posts[0]) setSelectedId(result.posts[0].id);
        if (result.warning === 'no_posts_found') showHealth({ ok: false, message: copy.noPostsFound });
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
      } finally {
        setIsFetching(false);
      }
    },
    [copy.noPostsFound, fetchMode, query, showHealth]
  );

  const handleAnalyze = useCallback(async (post: ThreadsPost) => {
    setAnalyzingId(post.id);
    try {
      const api = window.desktopAPI;
      if (!api) {
        setError('Desktop API is unavailable. Run this inside Electron.');
        return null;
      }

      setError(null);
      showHealth(null);
      const result = await api.analyzePost(post);
      if (result) {
        setAnalysis((current) => ({ ...current, [post.id]: result }));
        setSelectedId(post.id);
      }
      return result ?? null;
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : String(analyzeError));
      return null;
    } finally {
      setAnalyzingId(null);
    }
  }, [showHealth]);

  const runOpportunityScan = useCallback(async () => {
    const api = window.desktopAPI;
    if (!api || isScanning) return;

    setIsScanning(true);
    setError(null);
    showHealth(null);
    try {
      const result = await api.scanOpportunities();
      setPosts((current) => mergePosts(result.posts, current));
      setLatestScanPosts(result.latestScanPosts);
      setAnalysis((current) => ({ ...current, ...Object.fromEntries(result.analyses.map((item) => [item.postId, item])) }));
      if (result.posts[0]) setSelectedId(result.posts[0].id);
      showHealth({ ok: true, message: `${copy.scanComplete} ${result.keywordsScanned} niche, ${result.fetchedPosts} post, ${result.analyzedPosts} AI brief.` });
      if (result.errors.length) setError(result.errors.join('\n'));
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : String(scanError));
    } finally {
      setIsScanning(false);
    }
  }, [copy.scanComplete, isScanning, showHealth]);

  useEffect(() => {
    const api = window.desktopAPI;
    if (!api) return;

    Promise.all([api.getPosts(), api.getKeywords(), api.getSavedPosts()]).then(([storedPosts, storedKeywords, storedSaved]) => {
      if (storedPosts.length) {
        setPosts(storedPosts);
        setSelectedId(storedPosts[0].id);
      }
      setKeywords(storedKeywords);
      setSavedPosts(storedSaved);
    });
    api.getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    const api = window.desktopAPI;
    if (!api) return;
    return api.onVideoDraftProgress(setVideoRenderProgress);
  }, []);

  useEffect(() => {
    const api = window.desktopAPI;
    if (!api || !selectedPost || analysis[selectedPost.id]) return;
    void api.getAnalysis(selectedPost.id).then((stored) => {
      if (stored) setAnalysis((current) => ({ ...current, [selectedPost.id]: stored }));
    });
  }, [analysis, selectedPost]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key.toLowerCase() === 'a' && selectedPost && document.activeElement?.tagName !== 'INPUT') {
        void handleAnalyze(selectedPost);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleAnalyze, selectedPost]);

  useEffect(() => {
    if (!settings?.autoScanEnabled) return;
    const timer = window.setInterval(() => void runOpportunityScan(), settings.autoScanMinutes * 60_000);
    return () => window.clearInterval(timer);
  }, [runOpportunityScan, settings?.autoScanEnabled, settings?.autoScanMinutes]);

  useEffect(() => {
    if (!settings?.scanOnLaunch || scannedOnLaunch.current) return;
    scannedOnLaunch.current = true;
    void runOpportunityScan();
  }, [runOpportunityScan, settings?.scanOnLaunch]);

  async function handleSave(post: ThreadsPost) {
    const api = window.desktopAPI;
    if (!api) {
      setError('Desktop API is unavailable. Run this inside Electron.');
      return;
    }

    try {
      setError(null);
      if (savedIds.has(post.id)) {
        await api.unsavePost(post.id, 'Inbox');
        showHealth({ ok: true, message: copy.postRemovedFromSaved });
      } else {
        await api.savePost(post.id, 'Inbox', [post.emotionalCategory, post.keyword ?? post.source].filter(Boolean));
        showHealth({ ok: true, message: copy.postSaved });
      }
      setSavedPosts(await api.getSavedPosts());
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    }
  }

  async function handleCopy(post: ThreadsPost) {
    try {
      await navigator.clipboard.writeText(`${post.content}\n\n${copy.sourcePost}: ${post.url}`);
      setCopiedId(post.id);
      showHealth({ ok: true, message: copy.contentCopied });
      window.setTimeout(() => setCopiedId((current) => (current === post.id ? null : current)), 2200);
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : String(copyError));
    }
  }

  async function handleGenerateTikTokIdea(post: ThreadsPost) {
    setSelectedId(post.id);
    setBriefCopied(false);
    const current = analysis[post.id];
    const result = current?.scriptOutline.length && current.productSearchKeywords.length ? current : await handleAnalyze(post);
    if (result) setBriefPostId(post.id);
  }

  async function handleCopyBrief() {
    if (!briefPost || !briefAnalysis) return;
    try {
      await navigator.clipboard.writeText(formatTikTokBrief(briefPost, briefAnalysis, copy));
      setBriefCopied(true);
      showHealth({ ok: true, message: copy.briefCopied });
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : String(copyError));
    }
  }

  async function handleRenderVideoDraft() {
    if (!briefPost || !briefAnalysis) return;
    const api = window.desktopAPI;
    if (!api) {
      setError('Desktop API is unavailable. Run this inside Electron.');
      return;
    }

    setIsRenderingVideo(true);
    setVideoRenderProgress({ percent: 1, message: copy.videoDraftFilePickerHelp });
    setRenderedVideoPath(null);
    setError(null);
    try {
      const result = await api.renderVideoDraft({ post: briefPost, analysis: briefAnalysis });
      if (result.filePath) setRenderedVideoPath(result.filePath);
      showHealth({ ok: result.ok, message: result.ok ? copy.videoDraftReady : result.message });
    } catch (renderError) {
      setError(renderError instanceof Error ? renderError.message : String(renderError));
    } finally {
      setIsRenderingVideo(false);
    }
  }

  async function handleOpenVideoOutputFolder() {
    if (!renderedVideoPath) return;
    const result = await window.desktopAPI?.openVideoOutputFolder(renderedVideoPath);
    if (result && !result.ok) showHealth(result);
  }

  async function handleAddKeyword() {
    const phrase = newKeyword.trim();
    if (!phrase) return;

    const api = window.desktopAPI;
    if (!api) {
      setError('Desktop API is unavailable. Run this inside Electron.');
      return;
    }

    try {
      setError(null);
      await api.addKeyword(phrase);
      setKeywords(await api.getKeywords());
      setNewKeyword('');
      showHealth({ ok: true, message: copy.keywordAdded });
    } catch (keywordError) {
      setError(keywordError instanceof Error ? keywordError.message : String(keywordError));
    }
  }

  async function toggleKeyword(keyword: Keyword) {
    const next = !keyword.enabled;
    const api = window.desktopAPI;
    if (api) await api.setKeywordEnabled(keyword.id, next);
    setKeywords((current) => current.map((item) => (item.id === keyword.id ? { ...item, enabled: next } : item)));
  }

  async function updateKeyword(id: string, phrase: string) {
    const normalized = phrase.trim();
    if (!normalized) return;
    const api = window.desktopAPI;
    if (!api) return;
    try {
      await api.updateKeyword(id, normalized);
      setKeywords(await api.getKeywords());
    } catch (keywordError) {
      setError(keywordError instanceof Error ? keywordError.message : String(keywordError));
    }
  }

  async function deleteKeyword(id: string) {
    const api = window.desktopAPI;
    if (!api) return;
    try {
      setError(null);
      await api.deleteKeyword(id);
      setKeywords(await api.getKeywords());
    } catch (keywordError) {
      setError(keywordError instanceof Error ? keywordError.message : String(keywordError));
    }
  }

  async function exportIdeas() {
    const api = window.desktopAPI;
    if (api) await api.exportIdeas();
  }

  async function openPostLink(post: ThreadsPost) {
    const result = await window.desktopAPI?.openPostExternal(post);
    if (result && !result.ok) showHealth({ ok: false, message: copy.fetchAgainForLink });
  }

  async function saveSettings(next: { openAiApiKey?: string; openAiModel?: string; elevenLabsApiKey?: string; elevenLabsVoiceId?: string; language?: Language; allowDemoMode?: boolean; autoScanEnabled?: boolean; autoScanMinutes?: number; scanOnLaunch?: boolean }) {
    const api = window.desktopAPI;
    if (!api) {
      setError('Desktop API is unavailable. Run this inside Electron.');
      return null;
    }
    const updated = await api.updateSettings(next);
    setSettings(updated);
    showHealth({ ok: true, message: 'Settings saved.' });
    return updated;
  }

  async function saveAndVerifyOpenAI(next: { openAiApiKey?: string; openAiModel?: string }) {
    await saveSettings(next);
    const result = await window.desktopAPI?.testOpenAI();
    if (result) showHealth(result);
    if (window.desktopAPI) setSettings(await window.desktopAPI.getSettings());
  }

  async function checkThreadsSession() {
    const result = await window.desktopAPI?.getThreadsLoginStatus();
    if (result) showHealth(result);
    if (window.desktopAPI) setSettings(await window.desktopAPI.getSettings());
  }

  async function loginThreads() {
    await window.desktopAPI?.openThreadsLogin();
    await checkThreadsSession();
  }

  function changeView(view: string) {
    setActiveView(view);
    setError(null);
    showHealth(null);
  }

  useEffect(() => {
    if (!health) return;
    const timer = window.setTimeout(() => setHealth(null), 4500);
    return () => window.clearTimeout(timer);
  }, [health]);

  return (
    <main className="flex h-screen overflow-hidden bg-background text-text">
      <Sidebar active={activeView} onChange={changeView} copy={copy} />

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-border bg-background/95 px-5">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted">{activeView.replace('-', ' ')}</div>
            <h1 className="truncate text-xl font-semibold text-text">{titleForView(activeView, copy)}</h1>
          </div>

          {shouldShowFeedTools ? (
            <FetchToolbar
              copy={copy}
              fetchMode={fetchMode}
              isFetching={isFetching}
              query={query}
              searchRef={searchRef}
              onFetchMode={setFetchMode}
              onQuery={setQuery}
              onFetch={() => runFetch()}
            />
          ) : null}
        </header>

        <section className="min-h-0 flex-1 overflow-y-auto p-5">
          {error ? <div className="mb-4 rounded-lg border border-danger/50 bg-danger/10 p-3 text-sm text-rose-100">{error}</div> : null}
          {health ? (
            <div className={cn('mb-4 rounded-lg border p-3 text-sm', health.ok ? 'border-success/50 bg-success/10 text-emerald-100' : 'border-warning/50 bg-warning/10 text-amber-100')}>
              {health.message}
            </div>
          ) : null}

          {activeView === 'home' ? (
            <HomeDashboard
              activeKeywords={activeKeywords.length}
              analyzedCount={analyzedCount}
              copy={copy}
              posts={posts}
              savedCount={savedPosts.length}
              topPosts={topPosts}
              analyses={analysis}
              isScanning={isScanning}
              latestScanPosts={latestScanPosts}
              onScan={runOpportunityScan}
              onSelectPost={(id) => {
                setSelectedId(id);
                changeView('trending');
              }}
            />
          ) : activeView === 'keywords' ? (
            <KeywordsView
              copy={copy}
              keywords={keywords}
              newKeyword={newKeyword}
              onAddKeyword={handleAddKeyword}
              onExport={exportIdeas}
              onFetchKeyword={(phrase) => runFetch('keyword', phrase, 24)}
              onNewKeyword={setNewKeyword}
              onToggleKeyword={toggleKeyword}
              onUpdateKeyword={updateKeyword}
              onDeleteKeyword={deleteKeyword}
            />
          ) : activeView === 'settings' ? (
            <SettingsView settings={settings} copy={copy} onSave={saveSettings} onSaveOpenAI={saveAndVerifyOpenAI} onLoginThreads={loginThreads} onCheckThreads={checkThreadsSession} />
          ) : (
            <FeedView
              copy={copy}
              posts={visiblePosts}
              selectedPostId={selectedPost?.id}
              analyzingId={analyzingId}
              copiedId={copiedId}
              savedIds={savedIds}
              onAnalyze={handleAnalyze}
              onCopy={handleCopy}
              onGenerateTikTokIdea={handleGenerateTikTokIdea}
              onOpenLink={openPostLink}
              onRepliesSort={() => setPosts((current) => [...current].sort((a, b) => b.replies - a.replies))}
              onSave={handleSave}
              onSelect={setSelectedId}
            />
          )}
        </section>
      </section>

      {shouldShowAnalysisPanel ? <AnalysisPanel post={selectedPost} analysis={selectedAnalysis} copy={copy} /> : null}

      {briefPost && briefAnalysis ? (
        <TikTokBriefModal
          analysis={briefAnalysis}
          copied={briefCopied}
          copy={copy}
          post={briefPost}
          renderProgress={videoRenderProgress}
          renderedVideoPath={renderedVideoPath}
          renderingVideo={isRenderingVideo}
          onClose={() => setBriefPostId(null)}
          onCopy={handleCopyBrief}
          onOpenLink={() => openPostLink(briefPost)}
          onOpenOutputFolder={handleOpenVideoOutputFolder}
          onRenderVideo={handleRenderVideoDraft}
        />
      ) : null}
    </main>
  );
}

function FetchToolbar({
  copy,
  fetchMode,
  isFetching,
  query,
  searchRef,
  onFetch,
  onFetchMode,
  onQuery
}: {
  copy: TranslationCopy;
  fetchMode: FetchMode;
  isFetching: boolean;
  query: string;
  searchRef: RefObject<HTMLInputElement>;
  onFetch: () => void;
  onFetchMode: (mode: FetchMode) => void;
  onQuery: (query: string) => void;
}) {
  return (
    <div className="flex w-full max-w-3xl items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input ref={searchRef} value={query} onChange={(event) => onQuery(event.target.value)} className="pl-9" placeholder={copy.searchPlaceholder} />
      </div>
      <select value={fetchMode} onChange={(event) => onFetchMode(event.target.value as FetchMode)} className="h-9 rounded-md border border-border bg-[#0f1217] px-3 text-sm text-text outline-none">
        <option value="keyword">Keyword</option>
        <option value="hashtag">Hashtag</option>
        <option value="profile">Profile</option>
        <option value="home">Home</option>
        <option value="trending">Trending</option>
      </select>
      <Button variant="primary" icon={<RefreshCcw className={cn('size-4', isFetching && 'animate-spin')} />} disabled={isFetching} onClick={onFetch}>
        {copy.fetch}
      </Button>
    </div>
  );
}

function HomeDashboard({
  activeKeywords,
  analyses,
  analyzedCount,
  copy,
  isScanning,
  latestScanPosts,
  posts,
  savedCount,
  topPosts,
  onScan,
  onSelectPost
}: {
  activeKeywords: number;
  analyses: Record<string, AIAnalysis>;
  analyzedCount: number;
  copy: TranslationCopy;
  isScanning: boolean;
  latestScanPosts: ThreadsPost[];
  posts: ThreadsPost[];
  savedCount: number;
  topPosts: ThreadsPost[];
  onScan: () => void;
  onSelectPost: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <section className="grid grid-cols-4 gap-3">
        <DashboardMetric icon={<BarChart3 className="size-4" />} label={copy.totalPosts} value={posts.length} />
        <DashboardMetric icon={<Sparkles className="size-4" />} label={copy.analyzedPosts} value={analyzedCount} />
        <DashboardMetric icon={<Bookmark className="size-4" />} label={copy.savedIdeas} value={savedCount} />
        <DashboardMetric icon={<KeyRound className="size-4" />} label={copy.activeKeywords} value={activeKeywords} />
      </section>

      {latestScanPosts.length ? (
        <section className="rounded-lg border border-border bg-panel p-5">
          <div className="mb-1 text-base font-semibold text-text">{copy.latestScanPosts}</div>
          <div className="mb-4 text-sm text-muted">{copy.latestScanPostsHelp}</div>
          <div className="space-y-2">
            {latestScanPosts.slice(0, 10).map((post) => (
              <button key={post.id} className="flex w-full items-center justify-between gap-4 rounded-md border border-border bg-panelSoft px-3 py-3 text-left transition hover:border-accent/60" onClick={() => onSelectPost(post.id)}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-text">{post.author}</span>
                    {post.keyword ? <span className="rounded-md bg-background px-2 py-1 text-[11px] text-muted">{post.keyword}</span> : null}
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm text-muted">{post.content}</div>
                </div>
                <div className="shrink-0 rounded-md bg-background px-2 py-1 text-sm font-semibold text-accent">{post.opportunityScore}</div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-border bg-panel p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-text">{copy.opportunityInbox}</div>
            <div className="mt-1 text-sm text-muted">{copy.scanOpportunitiesHelp}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={<Radar className={cn('size-4', isScanning && 'animate-spin')} />} disabled={isScanning} onClick={onScan}>
              {isScanning ? copy.scanningOpportunities : copy.scanOpportunities}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-panel p-5">
        <div className="mb-4 text-base font-semibold text-text">{copy.topOpportunities}</div>
        {topPosts.length ? (
          <div className="space-y-2">
            {topPosts.map((post) => (
              <button key={post.id} className="flex w-full items-center justify-between gap-4 rounded-md border border-border bg-panelSoft px-3 py-3 text-left transition hover:border-accent/60" onClick={() => onSelectPost(post.id)}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-text">{post.author}</span>
                    <OpportunityVerdict analysis={analyses[post.id]} copy={copy} />
                    {post.engagementGrowthPercent > 0 ? <span className="inline-flex items-center gap-1 text-xs text-emerald-300"><TrendingUp className="size-3.5" />+{post.engagementGrowthPercent}%</span> : null}
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm text-muted">{post.content}</div>
                  {analyses[post.id]?.affiliateProducts[0] ? <div className="mt-2 text-xs text-sky-200">{analyses[post.id].affiliateProducts[0]}</div> : null}
                </div>
                <div className="shrink-0 rounded-md bg-background px-2 py-1 text-sm font-semibold text-accent">{post.opportunityScore}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-border bg-panelSoft p-4 text-sm text-muted">{copy.emptyDashboard}</div>
        )}
      </section>
    </div>
  );
}

function DashboardMetric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="mb-3 flex items-center gap-2 text-xs text-muted">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold text-text">{value}</div>
    </div>
  );
}

function OpportunityVerdict({ analysis, copy }: { analysis?: AIAnalysis; copy: TranslationCopy }) {
  const verdict = analysis?.verdict ?? 'watch';
  const label = verdict === 'make_now' ? copy.makeNow : verdict === 'skip' ? copy.skip : copy.watch;
  return (
    <span className={cn('rounded-md px-2 py-1 text-[11px] font-semibold uppercase', verdict === 'make_now' ? 'bg-success/15 text-emerald-200' : verdict === 'skip' ? 'bg-danger/15 text-rose-200' : 'bg-warning/15 text-amber-200')}>
      {label}
      {analysis ? ` · ${analysis.confidenceScore}` : ''}
    </span>
  );
}

function FeedView({
  copy,
  posts,
  selectedPostId,
  analyzingId,
  copiedId,
  savedIds,
  onAnalyze,
  onCopy,
  onGenerateTikTokIdea,
  onOpenLink,
  onRepliesSort,
  onSave,
  onSelect
}: {
  copy: TranslationCopy;
  posts: ThreadsPost[];
  selectedPostId?: string;
  analyzingId: string | null;
  copiedId: string | null;
  savedIds: Set<string>;
  onAnalyze: (post: ThreadsPost) => void;
  onCopy: (post: ThreadsPost) => void;
  onGenerateTikTokIdea: (post: ThreadsPost) => void;
  onOpenLink: (post: ThreadsPost) => void;
  onRepliesSort: () => void;
  onSave: (post: ThreadsPost) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Filter className="size-4" />
          <span>
            {posts.length} {copy.postsSorted}
          </span>
        </div>
        <Button icon={<SlidersHorizontal className="size-4" />} onClick={onRepliesSort}>
          {copy.replies}
        </Button>
      </div>

      <div className="space-y-4">
        {posts.map((post) => (
          <FeedCard
            key={post.id}
            post={post}
            active={post.id === selectedPostId}
            analyzing={post.id === analyzingId}
            copied={post.id === copiedId}
            saved={savedIds.has(post.id)}
            copy={copy}
            onAnalyze={() => onAnalyze(post)}
            onCopy={() => onCopy(post)}
            onGenerateTikTokIdea={() => onGenerateTikTokIdea(post)}
            onOpenLink={() => onOpenLink(post)}
            onSave={() => onSave(post)}
            onSelect={() => onSelect(post.id)}
          />
        ))}
        {!posts.length ? <div className="rounded-lg border border-border bg-panel p-6 text-sm text-muted">{copy.noMatchingPosts}</div> : null}
      </div>
    </>
  );
}

function KeywordsView({
  copy,
  keywords,
  newKeyword,
  onAddKeyword,
  onExport,
  onFetchKeyword,
  onNewKeyword,
  onToggleKeyword,
  onUpdateKeyword,
  onDeleteKeyword
}: {
  copy: TranslationCopy;
  keywords: Keyword[];
  newKeyword: string;
  onAddKeyword: () => void;
  onExport: () => void;
  onFetchKeyword: (phrase: string) => void;
  onNewKeyword: (value: string) => void;
  onToggleKeyword: (keyword: Keyword) => void;
  onUpdateKeyword: (id: string, phrase: string) => void;
  onDeleteKeyword: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPhrase, setEditingPhrase] = useState('');

  return (
    <div className="max-w-4xl space-y-4">
      <div className="rounded-lg border border-border bg-panel p-5">
        <div className="mb-2 text-base font-semibold text-text">{copy.keywordManager}</div>
        <div className="mb-4 text-sm leading-6 text-muted">{copy.keywordManagerHelp}</div>
        <div className="mb-4 flex max-w-xl gap-2">
          <Input value={newKeyword} onChange={(event) => onNewKeyword(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Enter') onAddKeyword();
          }} placeholder={copy.addNiche} />
          <Button aria-label="Add keyword" icon={<Plus className="size-4" />} onClick={onAddKeyword} />
        </div>

        <div className="space-y-2">
          {keywords.map((keyword) => (
            <div key={keyword.id} className="grid grid-cols-[minmax(0,1fr)_100px_86px_72px_72px] items-center gap-3 rounded-md border border-border bg-panelSoft px-3 py-3">
              {editingId === keyword.id ? (
                <Input value={editingPhrase} onChange={(event) => setEditingPhrase(event.target.value)} onKeyDown={(event) => {
                  if (event.key === 'Enter' && editingPhrase.trim()) {
                    onUpdateKeyword(keyword.id, editingPhrase);
                    setEditingId(null);
                  }
                  if (event.key === 'Escape') setEditingId(null);
                }} />
              ) : (
                <button className="truncate text-left text-sm font-medium text-text" onClick={() => onFetchKeyword(keyword.phrase)}>
                  {keyword.phrase}
                </button>
              )}
              <div className={cn('text-xs font-medium', keyword.enabled ? 'text-emerald-300' : 'text-muted')}>{keyword.enabled ? copy.enabled : copy.disabled}</div>
              <Button className="h-8" onClick={() => onFetchKeyword(keyword.phrase)}>
                {copy.fetch}
              </Button>
              <div className="flex gap-1">
                {editingId === keyword.id ? (
                  <>
                    <Button aria-label={copy.saveChanges} title={copy.saveChanges} className="h-8 px-2" icon={<Check className="size-4" />} disabled={!editingPhrase.trim()} onClick={() => {
                      onUpdateKeyword(keyword.id, editingPhrase);
                      setEditingId(null);
                    }} />
                    <Button aria-label={copy.cancel} title={copy.cancel} className="h-8 px-2" icon={<X className="size-4" />} onClick={() => setEditingId(null)} />
                  </>
                ) : (
                  <>
                    <Button aria-label={copy.editKeyword} title={copy.editKeyword} className="h-8 px-2" icon={<Pencil className="size-4" />} onClick={() => {
                      setEditingId(keyword.id);
                      setEditingPhrase(keyword.phrase);
                    }} />
                    <Button aria-label={copy.deleteKeyword} title={copy.deleteKeyword} className="h-8 px-2" icon={<Trash2 className="size-4" />} onClick={() => {
                      if (window.confirm(copy.confirmDeleteKeyword)) onDeleteKeyword(keyword.id);
                    }} />
                  </>
                )}
              </div>
              <button aria-label={`${keyword.enabled ? 'Disable' : 'Enable'} ${keyword.phrase}`} onClick={() => onToggleKeyword(keyword)} className={cn('h-5 w-9 justify-self-end rounded-full p-0.5 transition', keyword.enabled ? 'bg-success' : 'bg-border')}>
                <span className={cn('block size-4 rounded-full bg-white transition', keyword.enabled ? 'translate-x-4' : 'translate-x-0')} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <Button icon={<Download className="size-4" />} onClick={onExport}>
        {copy.export}
      </Button>
    </div>
  );
}

function KeywordPanel({
  keywords,
  newKeyword,
  onNewKeyword,
  onAddKeyword,
  onToggleKeyword,
  onRunKeyword,
  onExport,
  copy
}: {
  keywords: Keyword[];
  newKeyword: string;
  onNewKeyword: (value: string) => void;
  onAddKeyword: () => void;
  onToggleKeyword: (keyword: Keyword) => void;
  onRunKeyword: (phrase: string) => void;
  onExport: () => void;
  copy: TranslationCopy;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-panel p-4">
        <div className="mb-3 text-sm font-semibold text-text">{copy.keywordMonitoring}</div>
        <div className="mb-3 text-xs leading-5 text-muted">{copy.keywordMonitoringHelp}</div>
        <div className="mb-3 flex gap-2">
          <Input value={newKeyword} onChange={(event) => onNewKeyword(event.target.value)} placeholder={copy.addNiche} />
          <Button aria-label="Add keyword" icon={<Plus className="size-4" />} onClick={onAddKeyword} />
        </div>
        <div className="space-y-2">
          {keywords.map((keyword) => (
            <div key={keyword.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-panelSoft px-3 py-2">
              <button className="min-w-0 flex-1 truncate text-left text-sm text-text" onClick={() => onRunKeyword(keyword.phrase)}>
                {keyword.phrase}
              </button>
              <button
                aria-label={`${keyword.enabled ? 'Disable' : 'Enable'} ${keyword.phrase}`}
                onClick={() => onToggleKeyword(keyword)}
                className={cn('h-5 w-9 rounded-full p-0.5 transition', keyword.enabled ? 'bg-success' : 'bg-border')}
              >
                <span className={cn('block size-4 rounded-full bg-white transition', keyword.enabled ? 'translate-x-4' : 'translate-x-0')} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <Button icon={<Download className="size-4" />} onClick={onExport}>
          {copy.export}
        </Button>
      </div>
    </div>
  );
}

function SettingsView({
  settings,
  copy,
  onSave,
  onSaveOpenAI,
  onLoginThreads,
  onCheckThreads
}: {
  settings: AppSettings | null;
  copy: TranslationCopy;
  onSave: (settings: { openAiApiKey?: string; openAiModel?: string; elevenLabsApiKey?: string; elevenLabsVoiceId?: string; language?: Language; allowDemoMode?: boolean; autoScanEnabled?: boolean; autoScanMinutes?: number; scanOnLaunch?: boolean }) => Promise<AppSettings | null>;
  onSaveOpenAI: (settings: { openAiApiKey?: string; openAiModel?: string }) => Promise<void>;
  onLoginThreads: () => void;
  onCheckThreads: () => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState('');
  const [voiceId, setVoiceId] = useState(settings?.elevenLabsVoiceId ?? 'pNInz6obpgDQGcFmaJgB');
  const [model, setModel] = useState(settings?.openAiModel ?? recommendedOpenAIModel);
  const [saving, setSaving] = useState(false);
  const selectedModel = openAIModelOptions.find((option) => option.id === model) ?? openAIModelOptions[0];

  useEffect(() => {
    if (settings?.openAiModel) setModel(settings.openAiModel);
  }, [settings?.openAiModel]);

  useEffect(() => {
    if (settings?.elevenLabsVoiceId) setVoiceId(settings.elevenLabsVoiceId);
  }, [settings?.elevenLabsVoiceId]);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="rounded-lg border border-border bg-panel p-5">
        <div className="mb-4 text-base font-semibold text-text">{copy.openAi}</div>
        <div className="grid gap-3">
          <Input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={settings?.openAiApiKeySet ? settings.maskedOpenAiApiKey ?? copy.apiKeySaved : copy.apiKeyPlaceholder}
          />
          <div className="text-xs text-muted">
            {settings?.openAiApiKeySet ? `${copy.apiKeySaved}: ${settings.maskedOpenAiApiKey ?? 'sk-••••••••'}. ${copy.apiKeyHelpSaved}` : copy.apiKeyHelpEmpty}
          </div>
          <select
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="h-10 w-full rounded-md border border-border bg-[#0f1217] px-3 text-sm text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            {openAIModelOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} - {formatModelPrice(option)}
              </option>
            ))}
          </select>
          <div className="rounded-md border border-border bg-panelSoft p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-text">{selectedModel.label}</span>
              {selectedModel.badge ? <span className="rounded-md bg-success/15 px-2 py-1 text-xs font-medium text-emerald-200">{selectedModel.badge}</span> : null}
            </div>
            <div className="text-sm leading-5 text-muted">{selectedModel.description}</div>
            <div className="mt-2 text-xs text-slate-300">{formatModelPrice(selectedModel)}</div>
            <div className="mt-1 text-xs text-muted">{selectedModel.recommendedFor}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await onSaveOpenAI({ openAiApiKey: apiKey, openAiModel: model });
                setApiKey('');
                setSaving(false);
              }}
            >
              {saving ? copy.saving : copy.save}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-panel p-5">
        <div className="mb-1 text-base font-semibold text-text">{copy.elevenLabs}</div>
        <div className="mb-4 text-sm text-muted">{copy.adamVoice}</div>
        <div className="grid gap-3">
          <Input
            type="password"
            value={elevenLabsApiKey}
            onChange={(event) => setElevenLabsApiKey(event.target.value)}
            placeholder={settings?.elevenLabsApiKeySet ? settings.maskedElevenLabsApiKey ?? copy.apiKeySaved : copy.elevenLabsApiKeyPlaceholder}
          />
          <div className="text-xs text-muted">
            {settings?.elevenLabsApiKeySet ? `${copy.apiKeySaved}: ${settings.maskedElevenLabsApiKey ?? '••••••••'}. ${copy.elevenLabsApiKeyHelpSaved}` : copy.elevenLabsApiKeyHelpEmpty}
          </div>
          <label className="grid gap-2 text-xs text-muted">
            {copy.voiceId}
            <Input value={voiceId} onChange={(event) => setVoiceId(event.target.value)} />
          </label>
          <Button
            className="w-fit"
            variant="primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSave({ elevenLabsApiKey, elevenLabsVoiceId: voiceId });
              setElevenLabsApiKey('');
              setSaving(false);
            }}
          >
            {saving ? copy.saving : copy.save}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-panel p-5">
        <div className="mb-4 text-base font-semibold text-text">{copy.threadsSession}</div>
        <div className="mb-3 text-sm text-muted">
          {settings?.threadsSessionExists ? copy.sessionExists : copy.noSession}
          {settings?.threadsAccountName ? (
            <span className="ml-2 text-slate-200">
              {copy.loggedInAs} @{settings.threadsAccountName}
            </span>
          ) : settings?.threadsSessionExists ? (
            <span className="ml-2">{copy.accountUnknown}</span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<LogIn className="size-4" />} onClick={onLoginThreads}>
            {copy.threadsLogin}
          </Button>
          <Button onClick={onCheckThreads}>{copy.checkSession}</Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-panel p-5">
        <div className="mb-4 text-base font-semibold text-text">{copy.language}</div>
        <select
          value={settings?.language ?? 'en'}
          onChange={(event) => onSave({ language: event.target.value as Language })}
          className="h-10 w-full rounded-md border border-border bg-[#0f1217] px-3 text-sm text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
        >
          <option value="en">{copy.english}</option>
          <option value="vi">{copy.vietnamese}</option>
        </select>
      </div>

      <div className="rounded-lg border border-border bg-panel p-5">
        <div className="mb-2 text-base font-semibold text-text">{copy.autoScan}</div>
        <div className="mb-4 text-sm text-muted">{copy.autoScanHelp}</div>
        <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
          <span className="text-sm text-text">{copy.autoScan}</span>
          <button
            aria-label={copy.autoScan}
            onClick={() => onSave({ autoScanEnabled: !settings?.autoScanEnabled })}
            className={cn('h-5 w-9 rounded-full p-0.5 transition', settings?.autoScanEnabled ? 'bg-success' : 'bg-border')}
          >
            <span className={cn('block size-4 rounded-full bg-white transition', settings?.autoScanEnabled ? 'translate-x-4' : 'translate-x-0')} />
          </button>
        </div>
        <div className="flex items-center justify-between gap-4 border-b border-border py-4">
          <span className="text-sm text-text">{copy.autoScanInterval}</span>
          <select
            value={settings?.autoScanMinutes ?? 60}
            onChange={(event) => onSave({ autoScanMinutes: Number(event.target.value) })}
            className="h-9 rounded-md border border-border bg-[#0f1217] px-3 text-sm text-text outline-none"
          >
            <option value={30}>30 min</option>
            <option value={60}>1 hour</option>
            <option value={180}>3 hours</option>
          </select>
        </div>
        <div className="flex items-center justify-between gap-4 pt-4">
          <span className="text-sm text-text">{copy.scanOnLaunch}</span>
          <button
            aria-label={copy.scanOnLaunch}
            onClick={() => onSave({ scanOnLaunch: !settings?.scanOnLaunch })}
            className={cn('h-5 w-9 rounded-full p-0.5 transition', settings?.scanOnLaunch ? 'bg-success' : 'bg-border')}
          >
            <span className={cn('block size-4 rounded-full bg-white transition', settings?.scanOnLaunch ? 'translate-x-4' : 'translate-x-0')} />
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-panel p-5">
        <div className="mb-4 text-base font-semibold text-text">{copy.demoMode}</div>
        <button
          onClick={() => onSave({ allowDemoMode: !settings?.allowDemoMode })}
          className={cn('h-5 w-9 rounded-full p-0.5 transition', settings?.allowDemoMode ? 'bg-success' : 'bg-border')}
        >
          <span className={cn('block size-4 rounded-full bg-white transition', settings?.allowDemoMode ? 'translate-x-4' : 'translate-x-0')} />
        </button>
      </div>
    </div>
  );
}

function mergePosts(incoming: ThreadsPost[], current: ThreadsPost[]) {
  const map = new Map<string, ThreadsPost>();
  for (const post of [...current, ...incoming]) {
    map.set(post.id, post);
  }
  return Array.from(map.values()).sort((a, b) => b.opportunityScore - a.opportunityScore);
}

function titleForView(view: string, copy: TranslationCopy) {
  switch (view) {
    case 'home':
      return copy.opportunityInbox;
    case 'trending':
      return copy.trendingFeed;
    case 'keywords':
      return copy.keywords;
    case 'saved':
      return copy.savedPosts;
    case 'products':
      return copy.productSuggestions;
    case 'settings':
      return copy.settings;
    default:
      return copy.appName;
  }
}
