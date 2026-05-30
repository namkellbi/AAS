'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { BarChart3, Bookmark, Download, Filter, Flame, KeyRound, LogIn, Plus, RefreshCcw, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { AnalysisPanel } from '@/components/analysis/analysis-panel';
import { FeedCard } from '@/components/feed/feed-card';
import { Sidebar } from '@/components/layout/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { translations, type Language, type TranslationCopy } from '@/lib/i18n';
import { defaultKeywords } from '@/lib/mock-data';
import { formatModelPrice, openAIModelOptions, recommendedOpenAIModel } from '@/lib/openai-models';
import type { AIAnalysis, AppSettings, FetchMode, Keyword, SavedPost, ServiceHealth, ThreadsPost } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const [activeView, setActiveView] = useState('trending');
  const [posts, setPosts] = useState<ThreadsPost[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [analysis, setAnalysis] = useState<Record<string, AIAnalysis>>({});
  const [keywords, setKeywords] = useState<Keyword[]>(defaultKeywords);
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [health, setHealth] = useState<ServiceHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('glasses');
  const [fetchMode, setFetchMode] = useState<FetchMode>('keyword');
  const [isFetching, setIsFetching] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const language = settings?.language ?? 'en';
  const copy = translations[language];

  const showHealth = useCallback((message: ServiceHealth | null) => {
    setHealth(message);
  }, []);

  const selectedPost = posts.find((post) => post.id === selectedId) ?? posts[0];
  const selectedAnalysis = selectedPost ? analysis[selectedPost.id] : null;
  const savedIds = useMemo(() => new Set(savedPosts.map((item) => item.postId)), [savedPosts]);
  const analyzedCount = Object.keys(analysis).length;
  const activeKeywords = keywords.filter((keyword) => keyword.enabled);
  const topPosts = useMemo(() => [...posts].sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 5), [posts]);
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
      .sort((a, b) => b.trendingScore - a.trendingScore);
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
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
      } finally {
        setIsFetching(false);
      }
    },
    [fetchMode, query, showHealth]
  );

  const handleAnalyze = useCallback(async (post: ThreadsPost) => {
    setAnalyzingId(post.id);
    try {
      const api = window.desktopAPI;
      if (!api) {
        setError('Desktop API is unavailable. Run this inside Electron.');
        return;
      }

      setError(null);
      showHealth(null);
      const result = await api.analyzePost(post);
      if (result) {
        setAnalysis((current) => ({ ...current, [post.id]: result }));
        setSelectedId(post.id);
      }
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : String(analyzeError));
    } finally {
      setAnalyzingId(null);
    }
  }, [showHealth]);

  useEffect(() => {
    const api = window.desktopAPI;
    if (!api) return;

    Promise.all([api.getPosts(), api.getKeywords(), api.getSavedPosts()]).then(([storedPosts, storedKeywords, storedSaved]) => {
      if (storedPosts.length) {
        setPosts(storedPosts);
        setSelectedId(storedPosts[0].id);
      }
      if (storedKeywords.length) setKeywords(storedKeywords);
      setSavedPosts(storedSaved);
    });
    api.getSettings().then(setSettings);
  }, []);

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
    const api = window.desktopAPI;
    if (!api) return;

    const timer = window.setInterval(() => {
      const keyword = keywords.find((item) => item.enabled);
      if (!keyword || isFetching) return;
      void runFetch('keyword', keyword.phrase, 20);
    }, 5 * 60_000);

    return () => window.clearInterval(timer);
  }, [isFetching, keywords, runFetch]);

  async function handleSave(post: ThreadsPost) {
    const api = window.desktopAPI;
    if (api) {
      await api.savePost(post.id, 'Inbox', [post.emotionalCategory, post.keyword ?? post.source].filter(Boolean));
      setSavedPosts(await api.getSavedPosts());
      return;
    }

    setError('Desktop API is unavailable. Run this inside Electron.');
  }

  async function handleAddKeyword() {
    const phrase = newKeyword.trim();
    if (!phrase) return;

    const api = window.desktopAPI;
    const keyword = api
      ? await api.addKeyword(phrase)
      : { id: `kw-${Date.now()}`, phrase, enabled: true, cadenceMinutes: 120 };
    setKeywords((current) => [...current, keyword].sort((a, b) => a.phrase.localeCompare(b.phrase)));
    setNewKeyword('');
  }

  async function toggleKeyword(keyword: Keyword) {
    const next = !keyword.enabled;
    const api = window.desktopAPI;
    if (api) await api.setKeywordEnabled(keyword.id, next);
    setKeywords((current) => current.map((item) => (item.id === keyword.id ? { ...item, enabled: next } : item)));
  }

  async function exportIdeas() {
    const api = window.desktopAPI;
    if (api) await api.exportIdeas();
  }

  async function openPostLink(post: ThreadsPost) {
    const result = await window.desktopAPI?.openPostExternal(post);
    if (result && !result.ok) showHealth({ ok: false, message: copy.fetchAgainForLink });
  }

  async function saveSettings(next: { openAiApiKey?: string; openAiModel?: string; language?: Language; allowDemoMode?: boolean }) {
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
              onAnalyzeTop={() => topPosts[0] && handleAnalyze(topPosts[0])}
              onFetchTrending={() => runFetch('trending', query, 30)}
              onManageKeywords={() => changeView('keywords')}
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
            />
          ) : activeView === 'settings' ? (
            <SettingsView settings={settings} copy={copy} onSave={saveSettings} onSaveOpenAI={saveAndVerifyOpenAI} onLoginThreads={loginThreads} onCheckThreads={checkThreadsSession} />
          ) : (
            <FeedView
              copy={copy}
              posts={visiblePosts}
              selectedPostId={selectedPost?.id}
              onAnalyze={handleAnalyze}
              onCopy={(post) => navigator.clipboard.writeText(post.content)}
              onOpenLink={openPostLink}
              onRepliesSort={() => setPosts((current) => [...current].sort((a, b) => b.replies - a.replies))}
              onSave={handleSave}
              onSelect={setSelectedId}
            />
          )}
        </section>
      </section>

      {shouldShowAnalysisPanel ? <AnalysisPanel post={selectedPost} analysis={selectedAnalysis} loading={analyzingId === selectedPost?.id} onAnalyze={() => selectedPost && handleAnalyze(selectedPost)} copy={copy} /> : null}
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
  analyzedCount,
  copy,
  posts,
  savedCount,
  topPosts,
  onAnalyzeTop,
  onFetchTrending,
  onManageKeywords,
  onSelectPost
}: {
  activeKeywords: number;
  analyzedCount: number;
  copy: TranslationCopy;
  posts: ThreadsPost[];
  savedCount: number;
  topPosts: ThreadsPost[];
  onAnalyzeTop: () => void;
  onFetchTrending: () => void;
  onManageKeywords: () => void;
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

      <section className="rounded-lg border border-border bg-panel p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-text">{copy.quickActions}</div>
            <div className="mt-1 text-sm text-muted">{copy.researchOverview}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={<Flame className="size-4" />} onClick={onFetchTrending}>
              {copy.fetchTrending}
            </Button>
            <Button icon={<Sparkles className="size-4" />} disabled={!topPosts.length} onClick={onAnalyzeTop}>
              {copy.analyzeTopPost}
            </Button>
            <Button icon={<KeyRound className="size-4" />} onClick={onManageKeywords}>
              {copy.manageKeywords}
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
                  <div className="truncate text-sm font-semibold text-text">{post.author}</div>
                  <div className="mt-1 line-clamp-2 text-sm text-muted">{post.content}</div>
                </div>
                <div className="shrink-0 rounded-md bg-background px-2 py-1 text-sm font-semibold text-accent">{post.trendingScore}</div>
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

function FeedView({
  copy,
  posts,
  selectedPostId,
  onAnalyze,
  onCopy,
  onOpenLink,
  onRepliesSort,
  onSave,
  onSelect
}: {
  copy: TranslationCopy;
  posts: ThreadsPost[];
  selectedPostId?: string;
  onAnalyze: (post: ThreadsPost) => void;
  onCopy: (post: ThreadsPost) => void;
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
            copy={copy}
            onAnalyze={() => onAnalyze(post)}
            onCopy={() => onCopy(post)}
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
  onToggleKeyword
}: {
  copy: TranslationCopy;
  keywords: Keyword[];
  newKeyword: string;
  onAddKeyword: () => void;
  onExport: () => void;
  onFetchKeyword: (phrase: string) => void;
  onNewKeyword: (value: string) => void;
  onToggleKeyword: (keyword: Keyword) => void;
}) {
  return (
    <div className="max-w-4xl space-y-4">
      <div className="rounded-lg border border-border bg-panel p-5">
        <div className="mb-2 text-base font-semibold text-text">{copy.keywordManager}</div>
        <div className="mb-4 text-sm leading-6 text-muted">{copy.keywordManagerHelp}</div>
        <div className="mb-4 flex max-w-xl gap-2">
          <Input value={newKeyword} onChange={(event) => onNewKeyword(event.target.value)} placeholder={copy.addNiche} />
          <Button aria-label="Add keyword" icon={<Plus className="size-4" />} onClick={onAddKeyword} />
        </div>

        <div className="space-y-2">
          {keywords.map((keyword) => (
            <div key={keyword.id} className="grid grid-cols-[minmax(0,1fr)_120px_100px_80px] items-center gap-3 rounded-md border border-border bg-panelSoft px-3 py-3">
              <button className="truncate text-left text-sm font-medium text-text" onClick={() => onFetchKeyword(keyword.phrase)}>
                {keyword.phrase}
              </button>
              <div className={cn('text-xs font-medium', keyword.enabled ? 'text-emerald-300' : 'text-muted')}>{keyword.enabled ? copy.enabled : copy.disabled}</div>
              <Button className="h-8" onClick={() => onFetchKeyword(keyword.phrase)}>
                {copy.fetch}
              </Button>
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
  onSave: (settings: { openAiApiKey?: string; openAiModel?: string; language?: Language; allowDemoMode?: boolean }) => Promise<AppSettings | null>;
  onSaveOpenAI: (settings: { openAiApiKey?: string; openAiModel?: string }) => Promise<void>;
  onLoginThreads: () => void;
  onCheckThreads: () => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(settings?.openAiModel ?? recommendedOpenAIModel);
  const [saving, setSaving] = useState(false);
  const selectedModel = openAIModelOptions.find((option) => option.id === model) ?? openAIModelOptions[0];

  useEffect(() => {
    if (settings?.openAiModel) setModel(settings.openAiModel);
  }, [settings?.openAiModel]);

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
  for (const post of [...incoming, ...current]) {
    map.set(post.id, post);
  }
  return Array.from(map.values()).sort((a, b) => b.trendingScore - a.trendingScore);
}

function titleForView(view: string, copy: TranslationCopy) {
  switch (view) {
    case 'home':
      return copy.home;
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
