'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ChevronDown, ExternalLink, Filter, FolderOpen, Link2, LogIn, Play, RefreshCcw, Search, SlidersHorizontal, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { AnalysisPanel } from '@/components/analysis/analysis-panel';
import { TikTokBriefModal } from '@/components/analysis/tiktok-brief-modal';
import { FeedCard } from '@/components/feed/feed-card';
import { KeywordManager } from '@/components/keywords/keyword-manager';
import { Sidebar } from '@/components/layout/sidebar';
import { OpportunityInbox } from '@/components/opportunities/opportunity-inbox';
import { ResultsView } from '@/components/results/results-view';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { translations, type Language, type TranslationCopy } from '@/lib/i18n';
import { formatModelPrice, openAIModelOptions, recommendedOpenAIModel } from '@/lib/openai-models';
import { filterUsefulReplies } from '@/lib/replies';
import type { AIAnalysis, AppSettings, AssetLibraryItem, AssetType, FetchMode, Keyword, KeywordDiscoveryRequest, KeywordDiscoveryResult, KeywordExclusion, KeywordInsight, OpportunityScanProgress, SavedPost, ServiceHealth, ThreadsPost, UpdateSettingsRequest, UploadLogEntry, VideoDraftProgress, VideoDraftRequest } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const [activeView, setActiveView] = useState('home');
  const [posts, setPosts] = useState<ThreadsPost[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [analysis, setAnalysis] = useState<Record<string, AIAnalysis>>({});
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [keywordInsights, setKeywordInsights] = useState<KeywordInsight[]>([]);
  const [keywordExclusions, setKeywordExclusions] = useState<KeywordExclusion[]>([]);
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [health, setHealth] = useState<ServiceHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [fetchMode, setFetchMode] = useState<FetchMode>('keyword');
  const [isFetching, setIsFetching] = useState(false);
  const [manualPostUrl, setManualPostUrl] = useState('');
  const [isImportingPost, setIsImportingPost] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [briefPostId, setBriefPostId] = useState<string | null>(null);
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [videoRenderProgress, setVideoRenderProgress] = useState<VideoDraftProgress | null>(null);
  const [renderedVideoPath, setRenderedVideoPath] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetLibraryItem[]>([]);
  const [uploadLogs, setUploadLogs] = useState<UploadLogEntry[]>([]);
  const [replyPost, setReplyPost] = useState<ThreadsPost | null>(null);
  const [loadingRepliesId, setLoadingRepliesId] = useState<string | null>(null);
  const [scanSummary, setScanSummary] = useState<{ newPosts: number; seenPosts: number } | null>(null);
  const [scanProgress, setScanProgress] = useState<OpportunityScanProgress | null>(null);
  const [newKeyword, setNewKeyword] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const scannedOnLaunch = useRef(false);
  const language = settings?.language ?? 'en';
  const copy = translations[language];

  const showHealth = useCallback((message: ServiceHealth | null) => {
    setHealth(message);
  }, []);

  const refreshSettings = useCallback(async () => {
    const api = window.desktopAPI;
    if (api) setSettings(await api.getSettings());
  }, []);

  const refreshKeywordWorkspace = useCallback(async () => {
    const api = window.desktopAPI;
    if (!api) return;
    const [storedKeywords, storedExclusions, storedInsights] = await Promise.all([
      api.getKeywords(),
      api.getKeywordExclusions(),
      api.getKeywordInsights()
    ]);
    setKeywords(storedKeywords);
    setKeywordExclusions(storedExclusions);
    setKeywordInsights(storedInsights);
  }, []);

  const selectedPost = posts.find((post) => post.id === selectedId) ?? posts[0];
  const selectedAnalysis = selectedPost ? analysis[selectedPost.id] : null;
  const briefPost = briefPostId ? posts.find((post) => post.id === briefPostId) : undefined;
  const briefAnalysis = briefPost ? analysis[briefPost.id] : undefined;
  const savedIds = useMemo(() => new Set(savedPosts.map((item) => item.postId)), [savedPosts]);
  const activeKeywords = keywords.filter((keyword) => keyword.enabled);
  const shouldShowFeedTools = activeView === 'trending' || activeView === 'saved';
  const shouldShowAnalysisPanel = activeView === 'trending' || activeView === 'saved';

  const visiblePosts = useMemo(() => {
    const filtered =
      activeView === 'saved'
        ? posts.filter((post) => savedIds.has(post.id))
        : posts;

    return filtered
      .filter((post) => (query.trim() ? `${post.content} ${post.keyword ?? ''} ${post.author}`.toLowerCase().includes(query.toLowerCase()) : true))
      .sort((a, b) => b.opportunityScore - a.opportunityScore);
  }, [activeView, posts, query, savedIds]);

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
        setPosts(mergePosts(result.posts, await api.getPosts()));
        if (mode === 'keyword') await refreshKeywordWorkspace();
        if (result.posts[0]) setSelectedId(result.posts[0].id);
        if (result.warning === 'no_posts_found') showHealth({ ok: false, message: copy.noPostsFound });
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
      } finally {
        setIsFetching(false);
      }
    },
    [copy.noPostsFound, fetchMode, query, refreshKeywordWorkspace, showHealth]
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
        if (post.keyword) await refreshKeywordWorkspace();
        await refreshSettings();
      }
      return result ?? null;
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : String(analyzeError));
      return null;
    } finally {
      setAnalyzingId(null);
    }
  }, [refreshKeywordWorkspace, refreshSettings, showHealth]);

  const runOpportunityScan = useCallback(async () => {
    const api = window.desktopAPI;
    if (!api || isScanning) return;

    setIsScanning(true);
    setScanProgress({ phase: 'fetching', current: 0, total: activeKeywords.length, percent: 2, message: 'Đang chuẩn bị quét từ khóa...' });
    setError(null);
    showHealth(null);
    try {
      const result = await api.scanOpportunities();
      setPosts(await api.getPosts());
      setSettings(await api.getSettings());
      setScanSummary({ newPosts: result.newPosts, seenPosts: result.seenPosts });
      setAnalysis((current) => ({ ...current, ...Object.fromEntries(result.analyses.map((item) => [item.postId, item])) }));
      await refreshKeywordWorkspace();
      if (result.posts[0]) setSelectedId(result.posts[0].id);
      showHealth({ ok: true, message: `${copy.scanComplete} ${result.newPosts} bài mới · ${result.seenPosts} bài đã thấy · ${result.analyzedPosts} AI brief · dọn ${result.prunedPosts} bài cũ.` });
      if (result.errors.length) setError(result.errors.join('\n'));
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : String(scanError));
    } finally {
      setIsScanning(false);
    }
  }, [activeKeywords.length, copy.scanComplete, isScanning, refreshKeywordWorkspace, showHealth]);

  useEffect(() => {
    const api = window.desktopAPI;
    if (!api) return;

    Promise.all([api.getPosts(), api.getAnalyses(), api.getKeywords(), api.getKeywordExclusions(), api.getKeywordInsights(), api.getSavedPosts(), api.getAssets(), api.getUploadLogs()]).then(([storedPosts, storedAnalyses, storedKeywords, storedExclusions, storedInsights, storedSaved, storedAssets, storedUploadLogs]) => {
      if (storedPosts.length) {
        setPosts(storedPosts);
        setSelectedId(storedPosts[0].id);
      }
      setAnalysis(Object.fromEntries(storedAnalyses.map((item) => [item.postId, item])));
      setKeywords(storedKeywords);
      setKeywordExclusions(storedExclusions);
      setKeywordInsights(storedInsights);
      setSavedPosts(storedSaved);
      setAssets(storedAssets);
      setUploadLogs(storedUploadLogs);
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
    if (!api) return;
    return api.onOpportunityScanProgress(setScanProgress);
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

  async function handleGenerateTikTokIdea(post: ThreadsPost) {
    setSelectedId(post.id);
    const current = analysis[post.id];
    const result = current?.scriptOutline.length && current.productSearchKeywords.length ? current : await handleAnalyze(post);
    if (result) setBriefPostId(post.id);
  }

  async function importPostFromLink() {
    const url = manualPostUrl.trim();
    if (!url || isImportingPost) return;
    const api = window.desktopAPI;
    if (!api) {
      setError('Desktop API is unavailable. Run this inside Electron.');
      return;
    }

    setIsImportingPost(true);
    setError(null);
    showHealth(null);
    try {
      const post = await api.importThreadsPost(url);
      setPosts(mergePosts([post], await api.getPosts()));
      setSelectedId(post.id);
      setManualPostUrl('');

      const storedAnalysis = analysis[post.id] ?? await api.getAnalysis(post.id);
      if (storedAnalysis) {
        setAnalysis((current) => ({ ...current, [post.id]: storedAnalysis }));
        showHealth({ ok: true, message: copy.manualImportComplete });
        return;
      }

      const result = await handleAnalyze(post);
      if (result) showHealth({ ok: true, message: copy.manualImportComplete });
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    } finally {
      setIsImportingPost(false);
    }
  }

  async function handleRenderVideoDraft(overrides?: Partial<VideoDraftRequest>) {
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
      const result = await api.renderVideoDraft({ post: briefPost, analysis: briefAnalysis, ...overrides });
      if (result.filePath) setRenderedVideoPath(result.filePath);
      showHealth({ ok: result.ok, message: result.ok ? copy.videoDraftReady : result.message });
    } catch (renderError) {
      setError(renderError instanceof Error ? renderError.message : String(renderError));
    } finally {
      await refreshSettings();
      setIsRenderingVideo(false);
    }
  }

  async function addAsset(type: AssetType) {
    const item = await window.desktopAPI?.addAsset(type);
    if (item && window.desktopAPI) setAssets(await window.desktopAPI.getAssets());
  }

  async function deleteAsset(id: string) {
    await window.desktopAPI?.deleteAsset(id);
    if (window.desktopAPI) setAssets(await window.desktopAPI.getAssets());
  }

  async function handleOpenVideoOutputFolder() {
    if (!renderedVideoPath) return;
    const result = await window.desktopAPI?.openVideoOutputFolder(renderedVideoPath);
    if (result && !result.ok) showHealth(result);
  }

  async function handleAddKeyword(suggestedPhrase?: string, source: Keyword['source'] = 'manual', seedAudience?: string) {
    const phrase = (suggestedPhrase ?? newKeyword).trim();
    if (!phrase) return;

    const api = window.desktopAPI;
    if (!api) {
      setError('Desktop API is unavailable. Run this inside Electron.');
      return;
    }

    try {
      setError(null);
      await api.addKeyword({ phrase, source, seedAudience });
      await refreshKeywordWorkspace();
      if (!suggestedPhrase) setNewKeyword('');
      showHealth({ ok: true, message: copy.keywordAdded });
    } catch (keywordError) {
      setError(keywordError instanceof Error ? keywordError.message : String(keywordError));
    }
  }

  async function discoverKeywords(request: Omit<KeywordDiscoveryRequest, 'existingKeywords'>): Promise<KeywordDiscoveryResult> {
    const api = window.desktopAPI;
    if (!api) return { suggestions: [], postsUsed: 0, winnersUsed: 0 };
    try {
      setError(null);
      return await api.discoverKeywords({ ...request, existingKeywords: keywords.map((keyword) => keyword.phrase) });
    } catch (suggestionError) {
      setError(suggestionError instanceof Error ? suggestionError.message : String(suggestionError));
      return { suggestions: [], postsUsed: 0, winnersUsed: 0 };
    }
  }

  async function addKeywordExclusion(phrase: string) {
    const api = window.desktopAPI;
    if (!api) return;
    await api.addKeywordExclusion(phrase);
    await refreshKeywordWorkspace();
  }

  async function deleteKeywordExclusion(id: string) {
    const api = window.desktopAPI;
    if (!api) return;
    await api.deleteKeywordExclusion(id);
    await refreshKeywordWorkspace();
  }

  async function toggleKeyword(keyword: Keyword) {
    const next = !keyword.enabled;
    const api = window.desktopAPI;
    if (api) await api.setKeywordEnabled(keyword.id, next);
    await refreshKeywordWorkspace();
  }

  async function updateKeyword(id: string, phrase: string) {
    const normalized = phrase.trim();
    if (!normalized) return;
    const api = window.desktopAPI;
    if (!api) return;
    try {
      await api.updateKeyword(id, normalized);
      await refreshKeywordWorkspace();
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
      await refreshKeywordWorkspace();
    } catch (keywordError) {
      setError(keywordError instanceof Error ? keywordError.message : String(keywordError));
    }
  }

  async function openPostLink(post: ThreadsPost) {
    const result = await window.desktopAPI?.openPostExternal(post);
    if (result && !result.ok) showHealth({ ok: false, message: copy.fetchAgainForLink });
  }

  async function loadOrShowReplies(post: ThreadsPost) {
    const usefulReplies = filterUsefulReplies(post.topReplies);
    if (usefulReplies.length) {
      setReplyPost({ ...post, topReplies: usefulReplies });
      return;
    }
    const api = window.desktopAPI;
    if (!api) return;
    setLoadingRepliesId(post.id);
    setError(null);
    try {
      const updated = await api.fetchPostReplies(post);
      const filteredReplies = filterUsefulReplies(updated.topReplies);
      const cleaned = { ...updated, topReplies: filteredReplies };
      setPosts((current) => mergePosts([cleaned], current));
      setReplyPost(cleaned);
      showHealth({
        ok: filteredReplies.length > 0,
        message: filteredReplies.length
          ? `Đã tải ${filteredReplies.length} top replies.`
          : 'Threads không trả về nội dung replies cho bài này. Tổng số reply vẫn được giữ nguyên.'
      });
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : String(replyError));
    } finally {
      setLoadingRepliesId(null);
    }
  }

  async function saveSettings(next: UpdateSettingsRequest) {
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
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted">{sectionLabelForView(activeView)}</div>
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
            <OpportunityInbox
              copy={copy}
              posts={posts}
              analyses={analysis}
              logs={uploadLogs}
              savedIds={savedIds}
              isScanning={isScanning}
              scanSummary={scanSummary}
              scanProgress={scanProgress}
              onScan={runOpportunityScan}
              onCreate={handleGenerateTikTokIdea}
              onOpenLink={openPostLink}
              onSave={handleSave}
              onInspect={(post) => {
                setSelectedId(post.id);
                changeView('trending');
              }}
            />
          ) : activeView === 'keywords' ? (
            <KeywordManager
              copy={copy}
              exclusions={keywordExclusions}
              insights={keywordInsights}
              keywords={keywords}
              language={language}
              newKeyword={newKeyword}
              onAddExclusion={addKeywordExclusion}
              onAddKeyword={handleAddKeyword}
              onDeleteExclusion={deleteKeywordExclusion}
              onFetchKeyword={(phrase) => runFetch('keyword', phrase, 24)}
              onNewKeyword={setNewKeyword}
              onDiscover={discoverKeywords}
              onToggleKeyword={toggleKeyword}
              onUpdateKeyword={updateKeyword}
              onDeleteKeyword={deleteKeyword}
            />
          ) : activeView === 'settings' ? (
            <SettingsView settings={settings} copy={copy} onSave={saveSettings} onSaveOpenAI={saveAndVerifyOpenAI} onLoginThreads={loginThreads} onCheckThreads={checkThreadsSession} onOpenBilling={() => window.desktopAPI?.openOpenAiBilling()} />
          ) : activeView === 'assets' ? (
            <AssetLibraryView assets={assets} onAdd={addAsset} onDelete={deleteAsset} onPreview={(id) => window.desktopAPI?.openAssetPreview(id)} />
          ) : activeView === 'uploads' ? (
            <ResultsView
              copy={copy}
              logs={uploadLogs}
              posts={posts}
              onDelete={async (id): Promise<void> => {
                await window.desktopAPI?.deleteUploadLog(id);
                if (window.desktopAPI) {
                  setUploadLogs(await window.desktopAPI.getUploadLogs());
                  await refreshKeywordWorkspace();
                }
              }}
              onSave={async (entry): Promise<void> => {
                await window.desktopAPI?.saveUploadLog(entry);
                if (window.desktopAPI) {
                  setUploadLogs(await window.desktopAPI.getUploadLogs());
                  await refreshKeywordWorkspace();
                }
              }}
            />
          ) : (
            <FeedView
              copy={copy}
              manualPostUrl={manualPostUrl}
              isImportingPost={isImportingPost}
              posts={visiblePosts}
              selectedPostId={selectedPost?.id}
              analyzingId={analyzingId}
              loadingRepliesId={loadingRepliesId}
              savedIds={savedIds}
              onAnalyze={handleAnalyze}
              onGenerateTikTokIdea={handleGenerateTikTokIdea}
              onOpenLink={openPostLink}
              onImportPost={importPostFromLink}
              onManualPostUrl={setManualPostUrl}
              onRepliesSort={() => setPosts((current) => [...current].sort((a, b) => b.replies - a.replies))}
              onShowReplies={loadOrShowReplies}
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
          assets={assets}
          copy={copy}
          post={briefPost}
          renderProgress={videoRenderProgress}
          renderedVideoPath={renderedVideoPath}
          renderingVideo={isRenderingVideo}
          onClose={() => setBriefPostId(null)}
          onOpenLink={() => openPostLink(briefPost)}
          onOpenOutputFolder={handleOpenVideoOutputFolder}
          onRenderVideo={handleRenderVideoDraft}
        />
      ) : null}
      {replyPost ? <RepliesDrawer loading={loadingRepliesId === replyPost.id} post={replyPost} onClose={() => setReplyPost(null)} onReload={() => loadOrShowReplies({ ...replyPost, topReplies: [] })} /> : null}
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

function FeedView({
  copy,
  manualPostUrl,
  isImportingPost,
  posts,
  selectedPostId,
  analyzingId,
  loadingRepliesId,
  savedIds,
  onAnalyze,
  onGenerateTikTokIdea,
  onOpenLink,
  onImportPost,
  onManualPostUrl,
  onRepliesSort,
  onShowReplies,
  onSave,
  onSelect
}: {
  copy: TranslationCopy;
  manualPostUrl: string;
  isImportingPost: boolean;
  posts: ThreadsPost[];
  selectedPostId?: string;
  analyzingId: string | null;
  loadingRepliesId: string | null;
  savedIds: Set<string>;
  onAnalyze: (post: ThreadsPost) => void;
  onGenerateTikTokIdea: (post: ThreadsPost) => void;
  onOpenLink: (post: ThreadsPost) => void;
  onImportPost: () => void;
  onManualPostUrl: (url: string) => void;
  onRepliesSort: () => void;
  onShowReplies: (post: ThreadsPost) => void;
  onSave: (post: ThreadsPost) => void;
  onSelect: (id: string) => void;
}) {
  const [repliesOnly, setRepliesOnly] = useState(false);
  const [growingOnly, setGrowingOnly] = useState(false);
  const [videoPotentialOnly, setVideoPotentialOnly] = useState(false);
  const filteredPosts = posts.filter((post) => (!repliesOnly || post.replies >= 10) && (!growingOnly || post.trendState === 'EMERGING' || post.trendState === 'GROWING') && (!videoPotentialOnly || post.videoPotentialScore >= 70));
  return (
    <>
      <section className="mb-4 rounded-lg border border-border bg-panel p-4">
        <div className="mb-3">
          <div className="text-sm font-semibold text-text">{copy.manualImportTitle}</div>
          <div className="mt-1 text-xs leading-5 text-muted">{copy.manualImportHelp}</div>
        </div>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              value={manualPostUrl}
              onChange={(event) => onManualPostUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onImportPost();
              }}
              className="pl-9"
              placeholder={copy.manualImportPlaceholder}
            />
          </div>
          <Button variant="primary" icon={<Sparkles className={cn('size-4', isImportingPost && 'animate-pulse')} />} disabled={!manualPostUrl.trim() || isImportingPost} onClick={onImportPost}>
            {isImportingPost ? copy.manualImporting : copy.manualImport}
          </Button>
        </div>
      </section>
      <div className="mb-4 rounded-md border border-border bg-panel px-3 py-2 text-sm text-muted">{copy.feedResearch}</div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Filter className="size-4" />
          <span>
            {filteredPosts.length} {copy.postsSorted}
          </span>
        </div>
        <Button icon={<SlidersHorizontal className="size-4" />} onClick={onRepliesSort}>
          {copy.replies}
        </Button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterToggle active={repliesOnly} label="Replies ≥ 10" onClick={() => setRepliesOnly(!repliesOnly)} />
        <FilterToggle active={growingOnly} label="Trend: Emerging / Growing" onClick={() => setGrowingOnly(!growingOnly)} />
        <FilterToggle active={videoPotentialOnly} label="Video Potential ≥ 70" onClick={() => setVideoPotentialOnly(!videoPotentialOnly)} />
      </div>

      <div className="space-y-4">
        {filteredPosts.map((post) => (
          <FeedCard
            key={post.id}
            post={post}
            active={post.id === selectedPostId}
            analyzing={post.id === analyzingId}
            loadingReplies={post.id === loadingRepliesId}
            saved={savedIds.has(post.id)}
            copy={copy}
            onAnalyze={() => onAnalyze(post)}
            onGenerateTikTokIdea={() => onGenerateTikTokIdea(post)}
            onOpenLink={() => onOpenLink(post)}
            onShowReplies={() => onShowReplies(post)}
            onSave={() => onSave(post)}
            onSelect={() => onSelect(post.id)}
          />
        ))}
        {!filteredPosts.length ? <div className="rounded-lg border border-border bg-panel p-6 text-sm text-muted">{copy.noMatchingPosts}</div> : null}
      </div>
    </>
  );
}

function FilterToggle({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button className={cn('rounded-md border px-3 py-2 text-xs transition', active ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-panel text-muted hover:text-text')} onClick={onClick}>{label}</button>;
}

function SettingsView({
  settings,
  copy,
  onSave,
  onSaveOpenAI,
  onLoginThreads,
  onCheckThreads,
  onOpenBilling
}: {
  settings: AppSettings | null;
  copy: TranslationCopy;
  onSave: (settings: UpdateSettingsRequest) => Promise<AppSettings | null>;
  onSaveOpenAI: (settings: { openAiApiKey?: string; openAiModel?: string }) => Promise<void>;
  onLoginThreads: () => void;
  onCheckThreads: () => void;
  onOpenBilling: () => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(settings?.openAiModel ?? recommendedOpenAIModel);
  const [saving, setSaving] = useState(false);

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
          <ModelSelect value={model} onChange={setModel} />
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
            <Button icon={<ExternalLink className="size-4" />} onClick={onOpenBilling}>
              {copy.openAiBillingDashboard}
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

    </div>
  );
}

function ModelSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = openAIModelOptions.find((option) => option.id === value) ?? openAIModelOptions[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 w-full items-center justify-between gap-3 rounded-md border border-border bg-[#0f1217] px-3 text-left text-sm text-text outline-none transition hover:border-accent/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{selected.label} - {formatModelPrice(selected)}</span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted transition', open && 'rotate-180')} />
      </button>
      {open ? (
        <div role="listbox" className="absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-md border border-border bg-[#0f1217] p-1 shadow-2xl">
          {openAIModelOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.id === value}
              className={cn('flex w-full items-center justify-between gap-3 rounded px-2.5 py-2 text-left text-sm transition hover:bg-panelSoft', option.id === value ? 'bg-panelSoft text-text' : 'text-muted')}
              onClick={() => {
                onChange(option.id);
                setOpen(false);
              }}
            >
              <span className="min-w-0 truncate">{option.label} - {formatModelPrice(option)}</span>
              {option.badge ? <span className="inline-flex h-5 shrink-0 items-center rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 text-[11px] font-medium text-emerald-200">🔥 Recommended</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AssetLibraryView({ assets, onAdd, onDelete, onPreview }: { assets: AssetLibraryItem[]; onAdd: (type: AssetType) => void; onDelete: (id: string) => void; onPreview: (id: string) => void }) {
  const [type, setType] = useState<AssetType>('background');
  const visible = assets.filter((asset) => asset.type === type);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold text-text">Kho clip</h2><p className="mt-1 text-sm text-muted">Lưu clip nền retention và clip demo sản phẩm để tái sử dụng khi tạo video nháp.</p></div>
        <Button variant="primary" icon={<Upload className="size-4" />} onClick={() => onAdd(type)}>Thêm clip</Button>
      </div>
      <div className="flex gap-2"><FilterToggle active={type === 'background'} label="Background" onClick={() => setType('background')} /><FilterToggle active={type === 'product'} label="Product" onClick={() => setType('product')} /></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
        {visible.map((asset) => <div key={asset.id} className="overflow-hidden rounded-lg border border-border bg-panel"><button className="group relative block aspect-video w-full overflow-hidden bg-background" title={`Preview ${asset.label}`} onClick={() => onPreview(asset.id)}>{asset.thumbnailDataUrl ? <img src={asset.thumbnailDataUrl} alt="" className="size-full object-cover transition duration-200 group-hover:scale-105" /> : <div className="grid size-full place-items-center text-[11px] text-muted">Chưa có thumbnail</div>}<span className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/35"><Play className="size-6 fill-white text-white opacity-0 transition group-hover:opacity-100" /></span></button><div className="p-2.5"><div className="truncate text-xs font-semibold text-text" title={asset.label}>{asset.label}</div><div className="mt-1.5 text-[11px] text-muted">{asset.durationSecs.toFixed(1)}s · đã dùng {asset.timesUsed} lần</div><div className="mt-2 flex justify-end gap-1.5"><Button className="h-8 px-2" title="Preview clip" icon={<Play className="size-3.5" />} onClick={() => onPreview(asset.id)} /><Button className="h-8 px-2" title="Xóa clip khỏi Kho clip" icon={<Trash2 className="size-3.5" />} onClick={() => onDelete(asset.id)} /></div></div></div>)}
      </div>
      {!visible.length ? <div className="rounded-lg border border-border bg-panel p-6 text-sm text-muted">Chưa có clip trong nhóm này. Bạn vẫn có thể chọn file MP4 trực tiếp khi tạo video.</div> : null}
    </div>
  );
}

function RepliesDrawer({ post, loading, onClose, onReload }: { post: ThreadsPost; loading: boolean; onClose: () => void; onReload: () => void }) {
  const replies = filterUsefulReplies(post.topReplies);
  return <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-x-hidden overflow-y-auto border-l border-border bg-[#0c0f13] p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between gap-3"><div className="min-w-0"><div className="text-xs uppercase tracking-[0.14em] text-muted">Top replies ({replies.length})</div><div className="mt-1 truncate text-base font-semibold text-text">{post.author}</div></div><Button className="shrink-0 px-2" icon={<X className="size-4" />} onClick={onClose} /></div><div className="mb-4"><Button disabled={loading} icon={<RefreshCcw className={cn('size-4', loading && 'animate-spin')} />} onClick={onReload}>{loading ? 'Đang tải replies...' : 'Tải lại replies'}</Button></div><div className="space-y-3">{replies.map((reply) => <div key={reply.id} className="min-w-0 overflow-hidden rounded-lg border border-border bg-panel p-3"><div className="break-all text-xs font-semibold text-sky-200">@{reply.author}</div><div className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300 [overflow-wrap:anywhere]">{reply.content}</div><div className="mt-2 text-xs text-muted">{reply.likes} likes</div></div>)}{!replies.length ? <div className="text-sm text-muted">Chưa tải được nội dung replies cho bài này.</div> : null}</div></aside>;
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
    case 'assets':
      return 'Kho clip';
    case 'uploads':
      return copy.results;
    case 'settings':
      return copy.settings;
    default:
      return copy.appName;
  }
}

function sectionLabelForView(view: string) {
  return {
    home: 'Smart Inbox',
    trending: 'Research',
    keywords: 'Sources',
    saved: 'Library',
    assets: 'Assets',
    uploads: 'Performance',
    settings: 'Settings'
  }[view] ?? 'Trend Finder';
}
