'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Filter, FolderOpen, Link2, LoaderCircle, LogIn, Play, RefreshCcw, Search, SlidersHorizontal, Sparkles, Trash2, Upload, Volume2, X } from 'lucide-react';
import { AnalysisPanel } from '@/components/analysis/analysis-panel';
import { TikTokBriefModal } from '@/components/analysis/tiktok-brief-modal';
import { CreateVideoHome } from '@/components/create-video/create-video-home';
import { FeedCard } from '@/components/feed/feed-card';
import { KeywordManager } from '@/components/keywords/keyword-manager';
import { Sidebar } from '@/components/layout/sidebar';
import { OpportunityInbox } from '@/components/opportunities/opportunity-inbox';
import { ProductsView } from '@/components/products/products-view';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { defaultFeatureVisibility } from '@/lib/content-mode';
import { translations, type Language, type TranslationCopy } from '@/lib/i18n';
import { filterUsefulReplies } from '@/lib/replies';
import { getTtsVoiceOptions, isTtsVoiceForProvider } from '@/lib/tts';
import type { AIAnalysis, AppSettings, AssetLibraryItem, AssetType, BatchCreateFromLinksItem, BatchCreateFromLinksProgress, BatchCreateFromLinksResult, CreateFromLinkProgress, FetchMode, GeneratedVideoItem, Keyword, KeywordDiscoveryRequest, KeywordDiscoveryResult, KeywordExclusion, KeywordInsight, LocalTtsStatus, NormalizationBackendStatus, OpportunityScanProgress, Product, QuotaBlockedResult, SavedPost, ServiceHealth, SpeechNormalizationResult, SpeechNormalizationState, ThreadsPost, TtsVoice, UpdateSettingsRequest, UploadLogEntry, VideoDraftProgress, VideoDraftRequest, VideoDraftResult } from '@/lib/types';
import { cn } from '@/lib/utils';

type VideoRenderSession = {
  postId: string;
  renderSessionId: string | null;
  rendering: boolean;
  progress: VideoDraftProgress | null;
  renderedVideoPath: string | null;
};

type ReviewedBatchDraft = {
  request: VideoDraftRequest;
  reviewed: boolean;
};

type BatchRenderState = {
  running: boolean;
  completed: number;
  total: number;
  currentPostId?: string;
  failedPostIds: string[];
};

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
  const [normalizationBackendStatus, setNormalizationBackendStatus] = useState<NormalizationBackendStatus | null>(null);
  const [health, setHealth] = useState<ServiceHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [fetchMode, setFetchMode] = useState<FetchMode>('keyword');
  const [isFetching, setIsFetching] = useState(false);
  const [manualPostUrl, setManualPostUrl] = useState('');
  const [isImportingPost, setIsImportingPost] = useState(false);
  const [createLinkUrl, setCreateLinkUrl] = useState('');
  const [isCreatingFromLink, setIsCreatingFromLink] = useState(false);
  const [createLinkProgress, setCreateLinkProgress] = useState<CreateFromLinkProgress | null>(null);
  const [batchInput, setBatchInput] = useState('');
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<Record<number, BatchCreateFromLinksProgress>>({});
  const [batchResult, setBatchResult] = useState<BatchCreateFromLinksResult | null>(null);
  const [speechNormalizations, setSpeechNormalizations] = useState<Record<string, SpeechNormalizationState>>({});
  const [isNormalizingBatch, setIsNormalizingBatch] = useState(false);
  const [batchDrafts, setBatchDrafts] = useState<Record<string, ReviewedBatchDraft>>({});
  const [batchRenderState, setBatchRenderState] = useState<BatchRenderState>({
    running: false,
    completed: 0,
    total: 0,
    failedPostIds: []
  });
  const [briefInitialBackground, setBriefInitialBackground] = useState<string | undefined>(undefined);
  const [isScanning, setIsScanning] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [briefPostId, setBriefPostId] = useState<string | null>(null);
  const [videoRenderSession, setVideoRenderSession] = useState<VideoRenderSession | null>(null);
  const [assets, setAssets] = useState<AssetLibraryItem[]>([]);
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideoItem[]>([]);
  const [uploadLogs, setUploadLogs] = useState<UploadLogEntry[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [replyPost, setReplyPost] = useState<ThreadsPost | null>(null);
  const [loadingRepliesId, setLoadingRepliesId] = useState<string | null>(null);
  const [scanSummary, setScanSummary] = useState<{ newPosts: number; seenPosts: number } | null>(null);
  const [scanProgress, setScanProgress] = useState<OpportunityScanProgress | null>(null);
  const [newKeyword, setNewKeyword] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const scannedOnLaunch = useRef(false);
  const activeVideoRenderSessionId = useRef<string | null>(null);
  const videoRenderSequence = useRef(0);
  const language = settings?.language ?? 'en';
  const copy = translations[language];
  const featureVisibility = settings?.featureVisibility ?? defaultFeatureVisibility;

  const showHealth = useCallback((message: ServiceHealth | null) => {
    setHealth(message);
  }, []);

  const refreshSettings = useCallback(async () => {
    const api = window.desktopAPI;
    if (api) setSettings(await api.getSettings());
  }, []);

  const refreshNormalizationBackendStatus = useCallback(async () => {
    const api = window.desktopAPI;
    if (!api) return null;
    const status = await api.getNormalizationStatus();
    setNormalizationBackendStatus(status);
    return status;
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
  const briefVideoRenderSession = briefPost && videoRenderSession?.postId === briefPost.id ? videoRenderSession : null;
  const generatedVideoByPostId = useMemo(() => {
    const videos = new Map<string, GeneratedVideoItem>();
    generatedVideos.forEach((video) => {
      if (!videos.has(video.postId)) videos.set(video.postId, video);
    });
    return videos;
  }, [generatedVideos]);
  const briefGeneratedVideo = briefPost ? generatedVideoByPostId.get(briefPost.id) : undefined;
  const briefRenderedVideoPath = briefVideoRenderSession?.renderedVideoPath ?? briefGeneratedVideo?.filePath ?? null;
  const briefRenderProgress = briefVideoRenderSession?.progress
    ?? (briefGeneratedVideo ? { percent: 100, message: 'Đã tạo xong video.' } : null);
  const savedIds = useMemo(() => new Set(savedPosts.map((item) => item.postId)), [savedPosts]);
  const activeKeywords = keywords.filter((keyword) => keyword.enabled);
  const shouldShowFeedTools = featureVisibility.opportunityDiscovery && (activeView === 'trending' || activeView === 'saved');
  const shouldShowAnalysisPanel = featureVisibility.opportunityDiscovery && (activeView === 'trending' || activeView === 'saved');

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
      let result = await api.analyzePost(post, settings?.scanGoal ?? 'affiliate');
      if (isQuotaBlocked(result)) {
        if (!window.confirm(quotaMessage(copy.quotaConfirm, result))) return null;
        const retried = await api.analyzePost(post, settings?.scanGoal ?? 'affiliate', { confirmOverQuota: true });
        if (isQuotaBlocked(retried)) return null;
        result = retried;
      }
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
  }, [copy.quotaConfirm, refreshKeywordWorkspace, refreshSettings, settings?.scanGoal, showHealth]);

  const runOpportunityScan = useCallback(async () => {
    const api = window.desktopAPI;
    if (!api || isScanning) return;

    setIsScanning(true);
    setScanProgress({ phase: 'fetching', current: 0, total: activeKeywords.length, percent: 2, message: 'Đang chuẩn bị quét từ khóa...' });
    setError(null);
    showHealth(null);
    try {
      let result = await api.scanOpportunities(settings?.scanGoal ?? 'affiliate');
      if (isQuotaBlocked(result)) {
        if (!window.confirm(quotaMessage(copy.quotaConfirm, result))) return;
        const retried = await api.scanOpportunities(settings?.scanGoal ?? 'affiliate', { confirmOverQuota: true });
        if (isQuotaBlocked(retried)) return;
        result = retried;
      }
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
  }, [activeKeywords.length, copy.quotaConfirm, copy.scanComplete, isScanning, refreshKeywordWorkspace, settings?.scanGoal, showHealth]);

  useEffect(() => {
    const api = window.desktopAPI;
    if (!api) return;

    Promise.all([api.getPosts(), api.getAnalyses(), api.getKeywords(), api.getKeywordExclusions(), api.getKeywordInsights(), api.getSavedPosts(), api.getAssets(), api.getProducts(), api.getGeneratedVideos()]).then(([storedPosts, storedAnalyses, storedKeywords, storedExclusions, storedInsights, storedSaved, storedAssets, storedProducts, storedGeneratedVideos]) => {
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
      setProducts(storedProducts);
      setGeneratedVideos(storedGeneratedVideos);
    });
    api.getSettings().then(setSettings);
    api.getNormalizationStatus().then(setNormalizationBackendStatus);
  }, []);

  useEffect(() => {
    const api = window.desktopAPI;
    if (!api || activeView !== 'assets') return;
    void api.getGeneratedVideos().then(setGeneratedVideos);
  }, [activeView]);

  useEffect(() => {
    const api = window.desktopAPI;
    if (!api || activeView !== 'opportunities') return;
    void api.getUploadLogs().then(setUploadLogs);
  }, [activeView]);

  useEffect(() => {
    const api = window.desktopAPI;
    if (!api) return;
    return api.onVideoDraftProgress((progress) => {
      const renderSessionId = progress.renderSessionId;
      if (!renderSessionId || renderSessionId !== activeVideoRenderSessionId.current) return;
      setVideoRenderSession((current) => current?.renderSessionId === renderSessionId
        ? { ...current, progress }
        : current);
    });
  }, []);

  useEffect(() => {
    const api = window.desktopAPI;
    if (!api) return;
    return api.onOpportunityScanProgress(setScanProgress);
  }, []);

  useEffect(() => {
    const api = window.desktopAPI;
    if (!api) return;
    return api.onCreateFromLinkProgress(setCreateLinkProgress);
  }, []);

  useEffect(() => {
    const api = window.desktopAPI;
    if (!api) return;
    return api.onCreateBatchFromLinksProgress((progress) => {
      setBatchProgress((current) => ({ ...current, [progress.index]: progress }));
    });
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
    if (!featureVisibility.opportunityDiscovery || !settings?.autoScanEnabled) return;
    const timer = window.setInterval(() => void runOpportunityScan(), settings.autoScanMinutes * 60_000);
    return () => window.clearInterval(timer);
  }, [featureVisibility.opportunityDiscovery, runOpportunityScan, settings?.autoScanEnabled, settings?.autoScanMinutes]);

  useEffect(() => {
    if (!featureVisibility.opportunityDiscovery || !settings?.scanOnLaunch || scannedOnLaunch.current) return;
    scannedOnLaunch.current = true;
    void runOpportunityScan();
  }, [featureVisibility.opportunityDiscovery, runOpportunityScan, settings?.scanOnLaunch]);

  useEffect(() => {
    if (isViewEnabled(activeView, featureVisibility)) return;
    setActiveView('home');
  }, [activeView, featureVisibility]);

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
    const api = window.desktopAPI;
    if (!api) {
      setError('Desktop API is unavailable. Run this inside Electron.');
      return;
    }

    setLoadingRepliesId(post.id);
    setError(null);
    let postWithFreshReplies = post;
    try {
      postWithFreshReplies = await api.fetchPostReplies(post);
      setPosts((currentPosts) => mergePosts([postWithFreshReplies], currentPosts));
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : String(replyError));
      return;
    } finally {
      setLoadingRepliesId(null);
    }

    const current = analysis[post.id];
    const result = current?.scriptOutline.length && current.productSearchKeywords.length ? current : await handleAnalyze(postWithFreshReplies);
    if (result) openVideoBrief(post.id);
  }

  function openVideoBrief(postId: string, initialBackgroundPath?: string) {
    activeVideoRenderSessionId.current = null;
    setVideoRenderSession({
      postId,
      renderSessionId: null,
      rendering: false,
      progress: null,
      renderedVideoPath: null
    });
    setBriefInitialBackground(initialBackgroundPath);
    setBriefPostId(postId);
  }

  function dismissVideoBrief() {
    activeVideoRenderSessionId.current = null;
    setVideoRenderSession(null);
    setBriefPostId(null);
    setBriefInitialBackground(undefined);
  }

  function closeVideoBrief(request?: VideoDraftRequest) {
    if (request && isReadyBatchPost(request.post.id)) {
      setBatchDrafts((current) => {
        const saved = current[request.post.id];
        const unchanged = Boolean(saved && JSON.stringify(saved.request) === JSON.stringify(request));
        return {
          ...current,
          [request.post.id]: {
            request,
            reviewed: Boolean(saved?.reviewed && unchanged)
          }
        };
      });
    }
    dismissVideoBrief();
  }

  function reviewBatchDraft(request: VideoDraftRequest) {
    setBatchDrafts((current) => ({
      ...current,
      [request.post.id]: { request, reviewed: true }
    }));
    dismissVideoBrief();
  }

  function isReadyBatchPost(postId: string) {
    return Boolean(batchResult?.items.some((item) => item.status === 'ready' && item.post?.id === postId));
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

  async function createFromLink() {
    const url = createLinkUrl.trim();
    if (!url || isCreatingFromLink) return;
    const api = window.desktopAPI;
    if (!api) {
      setError('Desktop API is unavailable. Run this inside Electron.');
      return;
    }

    setIsCreatingFromLink(true);
    setCreateLinkProgress({ phase: 'importing', percent: 5, message: copy.createFromLinkWorking });
    setError(null);
    showHealth(null);
    try {
      let result = await api.createFromLink(url);
      if (isQuotaBlocked(result)) {
        if (!window.confirm(quotaMessage(copy.quotaConfirm, result))) return;
        const retried = await api.createFromLink(url, { confirmOverQuota: true });
        if (isQuotaBlocked(retried)) return;
        result = retried;
      }
      setPosts(mergePosts([result.post], await api.getPosts()));
      setAnalysis((current) => ({ ...current, [result.post.id]: result.analysis }));
      setSelectedId(result.post.id);
      setCreateLinkUrl('');
      openVideoBrief(result.post.id, result.backgroundPath);
      showHealth({ ok: true, message: copy.createFromLinkReady });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError));
    } finally {
      setIsCreatingFromLink(false);
      setCreateLinkProgress(null);
    }
  }

  async function createBatchFromLinks(urls: string[]) {
    if (!urls.length || isCreatingBatch) return;
    const api = window.desktopAPI;
    if (!api) {
      setError('Desktop API is unavailable. Run this inside Electron.');
      return;
    }

    setIsCreatingBatch(true);
    setBatchProgress({});
    setBatchResult(null);
    setBatchDrafts({});
    setBatchRenderState({ running: false, completed: 0, total: 0, failedPostIds: [] });
    setError(null);
    showHealth(null);
    try {
      const result = await api.createBatchFromLinks({
        urls,
        minCommentLikes: 20,
        minQualifiedComments: 3
      });
      const resultPosts = result.items.flatMap((item) => item.post ? [item.post] : []);
      setPosts(mergePosts(resultPosts, await api.getPosts()));
      setAnalysis((current) => ({
        ...current,
        ...Object.fromEntries(result.items.flatMap((item) => item.analysis ? [[item.analysis.postId, item.analysis]] : []))
      }));
      setBatchResult(result);
      showHealth({
        ok: result.readyCount > 0,
        message: `Batch hoàn tất: ${result.readyCount} sẵn sàng · ${result.rejectedCount} bị loại · ${result.failedCount} lỗi.`
      });
      if (normalizationBackendStatus?.ok && result.readyCount > 0) {
        await normalizeBatchItems(result.items);
      }
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : String(batchError));
    } finally {
      setIsCreatingBatch(false);
    }
  }

  async function normalizeBatchItems(items: BatchCreateFromLinksItem[]) {
    const api = window.desktopAPI;
    const readyItems = items.filter((item) => item.status === 'ready' && item.post);
    if (!api || !readyItems.length || isNormalizingBatch) return;
    if (!normalizationBackendStatus?.ok) {
      showHealth({ ok: false, message: 'Đăng nhập ChatGPT bằng Codex hoặc thêm OpenAI API key dự phòng trong Cài đặt.' });
      return;
    }

    setIsNormalizingBatch(true);
    setSpeechNormalizations((current) => ({
      ...current,
      ...Object.fromEntries(readyItems.map((item) => [
        item.post!.id,
        current[item.post!.id]?.status === 'ready'
          ? current[item.post!.id]
          : { status: 'queued' as const }
      ]))
    }));

    let cursor = 0;
    let completed = 0;
    let failed = 0;
    const workerCount = Math.min(3, readyItems.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (cursor < readyItems.length) {
        const item = readyItems[cursor++];
        const post = item.post!;
        if (speechNormalizations[post.id]?.status === 'ready') {
          completed += 1;
          continue;
        }
        setSpeechNormalizations((current) => ({
          ...current,
          [post.id]: { status: 'normalizing' }
        }));
        try {
          const result = await api.normalizeSpeech({
            relatedPostId: post.id,
            segments: buildInitialSpeechSegments(post)
          });
          completed += 1;
          setSpeechNormalizations((current) => ({
            ...current,
            [post.id]: { status: 'ready', result }
          }));
        } catch (normalizationError) {
          failed += 1;
          setSpeechNormalizations((current) => ({
            ...current,
            [post.id]: {
              status: 'failed',
              error: normalizationError instanceof Error ? normalizationError.message : String(normalizationError)
            }
          }));
        }
      }
    });

    await Promise.all(workers);
    setIsNormalizingBatch(false);
    showHealth({
      ok: completed > 0,
      message: 'Chuẩn hóa hoàn tất: ' + completed + ' bài sẵn sàng' + (failed ? ' · ' + failed + ' bài lỗi.' : '.')
    });
  }

  function openBatchBrief(item: BatchCreateFromLinksItem) {
    if (item.status !== 'ready' || !item.post || !item.analysis) return;
    setPosts((current) => mergePosts([item.post!], current));
    setAnalysis((current) => ({ ...current, [item.post!.id]: item.analysis! }));
    setSelectedId(item.post.id);
    openVideoBrief(item.post.id, item.backgroundPath);
  }

  function resetBatchWorkspace() {
    setBatchInput('');
    setBatchProgress({});
    setBatchResult(null);
    setSpeechNormalizations({});
    setBatchDrafts({});
    setBatchRenderState({ running: false, completed: 0, total: 0, failedPostIds: [] });
  }

  async function renderVideoRequest(request: VideoDraftRequest, notify = true): Promise<VideoDraftResult> {
    const api = window.desktopAPI;
    if (!api) throw new Error('Desktop API is unavailable. Run this inside Electron.');

    const renderPost = request.post;
    const renderSessionId = `${renderPost.id}:${++videoRenderSequence.current}`;
    activeVideoRenderSessionId.current = renderSessionId;
    setVideoRenderSession({
      postId: renderPost.id,
      renderSessionId,
      rendering: true,
      progress: { percent: 1, message: copy.videoDraftFilePickerHelp, renderSessionId },
      renderedVideoPath: null
    });
    setError(null);
    try {
      const result = await api.renderVideoDraft({ ...request, renderSessionId });
      if (!result.ok || !result.filePath) throw new Error(result.message || 'Không tạo được video.');
      setVideoRenderSession((current) => current?.renderSessionId === renderSessionId
        ? { ...current, renderedVideoPath: result.filePath ?? null }
        : current);
      setGeneratedVideos(await api.getGeneratedVideos());
      if (notify && activeVideoRenderSessionId.current === renderSessionId) {
        showHealth({ ok: result.ok, message: result.ok ? copy.videoDraftReady : result.message });
      }
      return result;
    } catch (renderError) {
      if (notify && activeVideoRenderSessionId.current === renderSessionId) {
        setError(renderError instanceof Error ? renderError.message : String(renderError));
      }
      throw renderError;
    } finally {
      if (activeVideoRenderSessionId.current === renderSessionId) activeVideoRenderSessionId.current = null;
      setVideoRenderSession((current) => current?.renderSessionId === renderSessionId
        ? { ...current, rendering: false }
        : current);
    }
  }

  async function handleRenderVideoDraft(request: VideoDraftRequest) {
    try {
      const result = await renderVideoRequest(request);
      if (result.filePath) {
        const sendToLocalSend = window.desktopAPI?.sendGeneratedVideosToLocalSend;
        const localSend = typeof sendToLocalSend === 'function'
          ? await sendToLocalSend([result.filePath])
          : { ok: false, message: 'Hãy đóng hoàn toàn Electron rồi mở lại để nạp tích hợp LocalSend mới.' };
        if (!localSend.ok) showHealth(localSend);
      }
    } catch {
      // renderVideoRequest already reports the actionable error for a single draft.
    } finally {
      await refreshSettings();
    }
  }

  async function renderReviewedBatch() {
    const api = window.desktopAPI;
    if (!api || !batchResult || batchRenderState.running) return;

    const readyItems = batchResult.items.filter((item) => item.status === 'ready' && item.post && item.analysis);
    const pendingItems = readyItems.filter((item) => !generatedVideoByPostId.has(item.post!.id));
    const unreviewedItems = pendingItems.filter((item) => !batchDrafts[item.post!.id]?.reviewed);
    if (unreviewedItems.length) {
      showHealth({
        ok: false,
        message: `Còn ${unreviewedItems.length} brief chưa được duyệt nội dung.`
      });
      return;
    }
    if (!pendingItems.length) {
      showHealth({ ok: true, message: 'Tất cả video trong batch này đã được tạo.' });
      return;
    }

    setError(null);
    showHealth(null);
    setBatchRenderState({ running: true, completed: 0, total: pendingItems.length, failedPostIds: [] });
    const outputPaths: string[] = [];
    const failedPostIds: string[] = [];

    for (let index = 0; index < pendingItems.length; index += 1) {
      const item = pendingItems[index];
      const postId = item.post!.id;
      setBatchRenderState((current) => ({ ...current, currentPostId: postId }));
      try {
        const result = await renderVideoRequest(batchDrafts[postId].request, false);
        if (result.filePath) outputPaths.push(result.filePath);
      } catch {
        failedPostIds.push(postId);
      } finally {
        setBatchRenderState((current) => ({
          ...current,
          completed: index + 1,
          failedPostIds: [...failedPostIds]
        }));
      }
    }

    setBatchRenderState((current) => ({ ...current, running: false, currentPostId: undefined }));
    await refreshSettings();

    const sendToLocalSend = api.sendGeneratedVideosToLocalSend;
    const localSend = outputPaths.length
      ? typeof sendToLocalSend === 'function'
        ? await sendToLocalSend(outputPaths)
        : { ok: false, message: 'Hãy đóng hoàn toàn Electron rồi mở lại để nạp tích hợp LocalSend mới.' }
      : null;
    if (failedPostIds.length) {
      showHealth({
        ok: false,
        message: `Đã tạo ${outputPaths.length}/${pendingItems.length} video · ${failedPostIds.length} video lỗi.${localSend?.ok ? ' Các video thành công đã được đưa vào LocalSend.' : ''}`
      });
    } else {
      showHealth(localSend ?? {
        ok: true,
        message: `Đã tạo xong ${outputPaths.length} video.`
      });
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
    if (!briefRenderedVideoPath) return;
    const result = await window.desktopAPI?.openVideoOutputFolder(briefRenderedVideoPath);
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
    const usefulReplies = filterUsefulReplies(post.topReplies, post);
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
      const filteredReplies = filterUsefulReplies(updated.topReplies, updated);
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

  async function checkThreadsSession() {
    const result = await window.desktopAPI?.getThreadsLoginStatus();
    if (result) showHealth(result);
    if (window.desktopAPI) setSettings(await window.desktopAPI.getSettings());
  }

  async function loginThreads() {
    try {
      await window.desktopAPI?.openThreadsLogin();
      await checkThreadsSession();
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : String(loginError);
      setError(message);
      showHealth({ ok: false, message });
    }
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
      <Sidebar active={activeView} features={featureVisibility} language={language} onChange={changeView} copy={copy} />

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
            <CreateVideoHome
              batchInput={batchInput}
              batchProgress={batchProgress}
              batchResult={batchResult}
              isCreatingBatch={isCreatingBatch}
              isNormalizingBatch={isNormalizingBatch}
              language={language}
              normalizationReady={Boolean(normalizationBackendStatus?.ok)}
              normalizations={speechNormalizations}
              reviewedDrafts={batchDrafts}
              generatedVideos={generatedVideos}
              batchRenderState={batchRenderState}
              threadsReady={Boolean(settings?.threadsSessionExists)}
              onBatchInput={setBatchInput}
              onCreateBatch={(urls) => void createBatchFromLinks(urls)}
              onNavigateSettings={() => changeView('settings')}
              onNormalizeBatch={() => batchResult ? void normalizeBatchItems(batchResult.items) : undefined}
              onOpenBrief={openBatchBrief}
              onOpenGenerated={(filePath) => void window.desktopAPI?.openGeneratedVideo(filePath)}
              onRenderReviewed={() => void renderReviewedBatch()}
              onResetBatch={resetBatchWorkspace}
            />
          ) : activeView === 'opportunities' ? (
            <OpportunityInbox
              copy={copy}
              posts={posts}
              analyses={analysis}
              logs={uploadLogs}
              savedIds={savedIds}
              isScanning={isScanning}
              scanSummary={scanSummary}
              scanProgress={scanProgress}
              createLinkUrl={createLinkUrl}
              isCreatingFromLink={isCreatingFromLink}
              createLinkProgress={createLinkProgress}
              scanGoal={settings?.scanGoal ?? 'affiliate'}
              setup={{
                apiKey: Boolean(settings?.openAiApiKeySet),
                threadsLogin: Boolean(settings?.threadsSessionExists),
                background: assets.some((asset) => asset.type === 'background'),
                keywords: keywords.some((keyword) => keyword.enabled)
              }}
              onNavigate={changeView}
              onScanGoal={(goal) => void saveSettings({ scanGoal: goal })}
              onCreateLinkUrl={setCreateLinkUrl}
              onCreateFromLink={createFromLink}
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
            <SettingsView
              settings={settings}
              normalizationStatus={normalizationBackendStatus}
              copy={copy}
              assetCount={assets.filter((asset) => asset.type === 'background').length}
              onSave={saveSettings}
              onLoginThreads={loginThreads}
              onCheckThreads={checkThreadsSession}
              onRefreshNormalizationStatus={refreshNormalizationBackendStatus}
            />
          ) : activeView === 'products' ? (
            <ProductsView
              assets={assets}
              copy={copy}
              products={products}
              onDelete={async (id): Promise<void> => {
                await window.desktopAPI?.deleteProduct(id);
                if (window.desktopAPI) setProducts(await window.desktopAPI.getProducts());
              }}
              onSave={async (product): Promise<void> => {
                await window.desktopAPI?.saveProduct(product);
                if (window.desktopAPI) setProducts(await window.desktopAPI.getProducts());
              }}
            />
          ) : activeView === 'assets' ? (
            <AssetLibraryView
              assets={assets}
              generatedVideos={generatedVideos}
              showProductClips={false}
              onAdd={addAsset}
              onDelete={deleteAsset}
              onDeleteGenerated={async (filePath) => {
                await window.desktopAPI?.deleteGeneratedVideo(filePath);
                if (window.desktopAPI) setGeneratedVideos(await window.desktopAPI.getGeneratedVideos());
              }}
              onOpenGenerated={(filePath) => window.desktopAPI?.openGeneratedVideo(filePath)}
              onPreview={(id) => window.desktopAPI?.openAssetPreview(id)}
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

      {shouldShowAnalysisPanel ? <AnalysisPanel post={selectedPost} analysis={selectedAnalysis} copy={copy} creativeAiEnabled={settings?.creativeAiEnabled ?? false} /> : null}

      {briefPost && briefAnalysis ? (
        <TikTokBriefModal
          key={briefPost.id}
          analysis={briefAnalysis}
          assets={assets}
          copy={copy}
          creativeAiEnabled={settings?.creativeAiEnabled ?? false}
          contentReviewed={Boolean(batchDrafts[briefPost.id]?.reviewed)}
          initialDraft={batchDrafts[briefPost.id]?.request}
          initialSpeechSegments={speechNormalizations[briefPost.id]?.result?.segments}
          initialBackgroundPath={briefInitialBackground}
          matchedProduct={briefAnalysis.matchedProductId ? products.find((product) => product.id === briefAnalysis.matchedProductId) : undefined}
          post={briefPost}
          segmentSilenceMs={settings?.segmentSilenceMs ?? 400}
          ttsProvider={settings?.ttsProvider ?? 'openai'}
          ttsSpeed={settings?.defaultSpeed ?? 1.1}
          ttsVoice={settings?.defaultVoice ?? 'nova'}
          renderProgress={briefRenderProgress}
          renderedVideoPath={briefRenderedVideoPath}
          videoApproved={Boolean(briefGeneratedVideo?.reviewStatus === 'approved')}
          renderingVideo={briefVideoRenderSession?.rendering ?? false}
          onClose={closeVideoBrief}
          onOpenLink={() => openPostLink(briefPost)}
          onOpenOutputFolder={handleOpenVideoOutputFolder}
          onSetApproved={async (approved) => {
            if (!briefRenderedVideoPath) return;
            const updated = await window.desktopAPI?.setGeneratedVideoApproved(briefRenderedVideoPath, approved);
            if (updated) setGeneratedVideos(updated);
          }}
          onReviewDraft={isReadyBatchPost(briefPost.id) ? reviewBatchDraft : undefined}
          onSpeechNormalized={(result: SpeechNormalizationResult) => {
            setSpeechNormalizations((current) => ({
              ...current,
              [briefPost.id]: { status: 'ready', result }
            }));
          }}
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
        <option value="trending">Threads</option>
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
        <FilterToggle active={growingOnly} label="Đà tương tác đang tăng" onClick={() => setGrowingOnly(!growingOnly)} />
        <FilterToggle active={videoPotentialOnly} label="Tiềm năng làm video ≥ 70" onClick={() => setVideoPotentialOnly(!videoPotentialOnly)} />
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
  normalizationStatus,
  copy,
  assetCount,
  onSave,
  onLoginThreads,
  onCheckThreads,
  onRefreshNormalizationStatus
}: {
  settings: AppSettings | null;
  normalizationStatus: NormalizationBackendStatus | null;
  copy: TranslationCopy;
  assetCount: number;
  onSave: (settings: UpdateSettingsRequest) => Promise<AppSettings | null>;
  onLoginThreads: () => void;
  onCheckThreads: () => void;
  onRefreshNormalizationStatus: () => Promise<NormalizationBackendStatus | null>;
}) {
  const [silenceDraft, setSilenceDraft] = useState(400);
  const [voiceDraft, setVoiceDraft] = useState<TtsVoice>(
    settings?.defaultVoice && isTtsVoiceForProvider('vieneu', settings.defaultVoice)
      ? settings.defaultVoice
      : 'Ngoc-Huyen-Clone'
  );
  const [speedDraft, setSpeedDraft] = useState(settings?.defaultSpeed ?? 1.1);
  const [previewText, setPreviewText] = useState('Some stories only need a slower pace to keep people listening until the end.');
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);
  const [openAiKeyDraft, setOpenAiKeyDraft] = useState('');
  const [normalizationSetupStatus, setNormalizationSetupStatus] = useState<ServiceHealth | null>(null);
  const [savingNormalizationSetup, setSavingNormalizationSetup] = useState(false);
  const [localTtsStatus, setLocalTtsStatus] = useState<LocalTtsStatus | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingLocalSettingsRef = useRef<{ defaultVoice?: TtsVoice; defaultSpeed?: number; segmentSilenceMs?: number }>({});
  const localSettingsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof settings?.segmentSilenceMs === 'number') setSilenceDraft(settings.segmentSilenceMs);
    if (settings?.defaultVoice && isTtsVoiceForProvider('vieneu', settings.defaultVoice)) setVoiceDraft(settings.defaultVoice);
    if (typeof settings?.defaultSpeed === 'number') setSpeedDraft(settings.defaultSpeed);
  }, [settings?.defaultSpeed, settings?.defaultVoice, settings?.segmentSilenceMs]);

  useEffect(() => () => {
    if (localSettingsSaveTimerRef.current) clearTimeout(localSettingsSaveTimerRef.current);
  }, []);

  useEffect(() => {
    void window.desktopAPI?.getLocalTtsStatus().then(setLocalTtsStatus);
  }, []);

  useEffect(() => {
    setPreviewText(
      settings?.language === 'vi'
        ? 'Có những câu chuyện chỉ cần đọc chậm lại một chút là đã đủ khiến người ta muốn nghe đến cuối.'
        : 'Some stories only need a slower pace to keep people listening until the end.'
    );
  }, [settings?.language]);

  const vi = settings?.language === 'vi';
  const features = settings?.featureVisibility ?? defaultFeatureVisibility;
  const activeVoiceOptions = getTtsVoiceOptions('vieneu');

  function queueLocalVideoSettings(next: { defaultVoice?: TtsVoice; defaultSpeed?: number; segmentSilenceMs?: number }) {
    pendingLocalSettingsRef.current = { ...pendingLocalSettingsRef.current, ...next };
    if (localSettingsSaveTimerRef.current) clearTimeout(localSettingsSaveTimerRef.current);
    localSettingsSaveTimerRef.current = setTimeout(() => {
      localSettingsSaveTimerRef.current = null;
      const pending = pendingLocalSettingsRef.current;
      pendingLocalSettingsRef.current = {};
      void onSave({
        ttsProvider: 'vieneu',
        defaultVoice: pending.defaultVoice ?? voiceDraft,
        defaultSpeed: pending.defaultSpeed ?? speedDraft,
        segmentSilenceMs: pending.segmentSilenceMs ?? silenceDraft,
        creativeAiEnabled: false
      });
    }, 300);
  }

  function updateSpeed(nextSpeed: number) {
    const normalizedSpeed = Math.round(Math.min(Math.max(nextSpeed, 0.9), 1.3) * 100) / 100;
    setSpeedDraft(normalizedSpeed);
    queueLocalVideoSettings({ defaultSpeed: normalizedSpeed });
  }

  async function previewVoice() {
    const api = window.desktopAPI;
    if (!api || previewingVoice) return;
    setPreviewingVoice(true);
    setPreviewStatus(null);
    try {
      previewAudioRef.current?.pause();
      previewAudioRef.current = null;
      const result = await api.previewTts({
        text: previewText,
        provider: 'vieneu',
        voice: voiceDraft,
        speed: speedDraft,
        instructions: ''
      });
      void api.getLocalTtsStatus().then(setLocalTtsStatus);
      if (!result.ok || !result.audioDataUrl) {
        setPreviewStatus(result.message);
        return;
      }
      const audio = new Audio(result.audioDataUrl);
      previewAudioRef.current = audio;
      audio.onended = () => setPreviewingVoice(false);
      audio.onerror = () => {
        setPreviewStatus(vi ? 'Không thể phát bản nghe thử.' : 'Unable to play the preview.');
        setPreviewingVoice(false);
      };
      setPreviewStatus(
        result.cached
          ? (vi ? 'Đang phát từ cache VieNeu trên máy.' : 'Playing from the local VieNeu cache.')
          : (vi ? 'Giọng được tạo hoàn toàn trên máy bằng VieNeu.' : 'Voice generated entirely on-device with VieNeu.')
      );
      await audio.play();
    } catch (previewError) {
      setPreviewStatus(previewError instanceof Error ? previewError.message : String(previewError));
    } finally {
      if (!previewAudioRef.current || previewAudioRef.current.ended) setPreviewingVoice(false);
    }
  }

  async function saveNormalizationSetup() {
    const api = window.desktopAPI;
    if (!api || savingNormalizationSetup) return;
    if (!openAiKeyDraft.trim() && !settings?.openAiApiKeySet) {
      setNormalizationSetupStatus({ ok: false, message: vi ? 'Hãy nhập OpenAI API key.' : 'Enter an OpenAI API key.' });
      return;
    }

    setSavingNormalizationSetup(true);
    setNormalizationSetupStatus(null);
    try {
      if (openAiKeyDraft.trim()) {
        const saved = await onSave({
          openAiApiKey: openAiKeyDraft,
          openAiModel: 'gpt-4o-mini'
        });
        if (!saved?.openAiApiKeySet) throw new Error(vi ? 'Không lưu được API key.' : 'Unable to save the API key.');
        setOpenAiKeyDraft('');
      }
      const result = await api.testOpenAI();
      setNormalizationSetupStatus(result);
      await onRefreshNormalizationStatus();
    } catch (setupError) {
      setNormalizationSetupStatus({
        ok: false,
        message: setupError instanceof Error ? setupError.message : String(setupError)
      });
    } finally {
      setSavingNormalizationSetup(false);
    }
  }

  async function checkNormalizationStatus() {
    if (savingNormalizationSetup) return;
    setSavingNormalizationSetup(true);
    setNormalizationSetupStatus(null);
    try {
      const status = await onRefreshNormalizationStatus();
      if (status) setNormalizationSetupStatus({ ok: status.ok, message: status.message });
    } catch (statusError) {
      setNormalizationSetupStatus({ ok: false, message: statusError instanceof Error ? statusError.message : String(statusError) });
    } finally {
      setSavingNormalizationSetup(false);
    }
  }

  async function loginCodex() {
    const api = window.desktopAPI;
    if (!api || savingNormalizationSetup) return;
    setSavingNormalizationSetup(true);
    setNormalizationSetupStatus(null);
    try {
      const started = await api.startCodexLogin();
      setNormalizationSetupStatus(started);
      if (!started.ok) return;
      for (let attempt = 0; attempt < 45; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        const status = await onRefreshNormalizationStatus();
        if (status?.codexLoggedIn) {
          setNormalizationSetupStatus({ ok: true, message: vi ? 'Đã kết nối ChatGPT qua Codex.' : 'ChatGPT connected through Codex.' });
          return;
        }
      }
      setNormalizationSetupStatus({ ok: false, message: vi ? 'Chưa thấy phiên đăng nhập mới. Hoàn tất trong trình duyệt rồi bấm Kiểm tra lại.' : 'Login not detected yet. Finish in the browser, then check again.' });
    } catch (loginError) {
      setNormalizationSetupStatus({ ok: false, message: loginError instanceof Error ? loginError.message : String(loginError) });
    } finally {
      setSavingNormalizationSetup(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <details className="rounded-lg border border-border bg-panel p-5">
        <summary className="cursor-pointer list-none">
          <div className="flex items-center gap-2 text-base font-semibold text-text">
            <SlidersHorizontal className="size-4 text-accent" />
            {vi ? 'Module mở rộng' : 'Optional modules'}
          </div>
          <div className="mt-1 text-sm text-muted">
            {vi ? 'Các công cụ lấy nguồn Threads được giữ lại nhưng tắt mặc định.' : 'Threads source tools remain available but are disabled by default.'}
          </div>
        </summary>
        <div className="mt-4 divide-y divide-border border-t border-border pt-2">
          <SettingsToggle
            checked={features.opportunityDiscovery}
            label={vi ? 'Nguồn Threads nâng cao' : 'Advanced Threads sources'}
            description={vi ? 'Quét từ khóa, lưu bài và quản lý nguồn nội dung Threads.' : 'Scan keywords, save posts, and manage Threads content sources.'}
            onChange={(checked) => onSave({ featureVisibility: { opportunityDiscovery: checked } })}
          />
        </div>
      </details>

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

      {false && features.opportunityDiscovery ? <div className="rounded-lg border border-border bg-panel p-5">
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
      </div> : null}

      <div className="rounded-lg border border-border bg-panel p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-text">{vi ? 'Chuẩn hóa nội dung tự động' : 'Automatic content normalization'}</div>
            <div className="mt-1 text-sm text-muted">
              {vi ? 'Ưu tiên tài khoản ChatGPT; API chỉ dùng dự phòng.' : 'Uses ChatGPT first; API is only the fallback.'}
            </div>
          </div>
          <div className={cn('shrink-0 text-xs font-medium', normalizationStatus?.ok ? 'text-emerald-300' : 'text-amber-300')}>
            {normalizationStatus?.activeProvider === 'codex'
              ? 'ChatGPT'
              : normalizationStatus?.activeProvider === 'openai'
                ? 'OpenAI API'
                : (vi ? 'Chưa cấu hình' : 'Not configured')}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-[#0f1217] px-3 py-3">
          <div>
            <div className="text-sm font-medium text-text">ChatGPT qua Codex</div>
            <div className="mt-1 text-xs text-muted">
              {normalizationStatus?.codexLoggedIn
                ? (vi ? 'Đã đăng nhập · không dùng API key.' : 'Signed in · no API key used.')
                : normalizationStatus?.codexInstalled
                  ? (vi ? 'Đã cài Codex, cần đăng nhập.' : 'Codex installed; sign-in required.')
                  : (vi ? 'Chưa tìm thấy Codex CLI.' : 'Codex CLI was not found.')}
            </div>
          </div>
          <Button
            variant="primary"
            icon={savingNormalizationSetup ? <LoaderCircle className="size-4 animate-spin" /> : normalizationStatus?.codexLoggedIn ? <RefreshCcw className="size-4" /> : <LogIn className="size-4" />}
            disabled={savingNormalizationSetup}
            onClick={() => void (normalizationStatus?.codexLoggedIn ? checkNormalizationStatus() : loginCodex())}
          >
            {savingNormalizationSetup
              ? (vi ? 'Đang kiểm tra...' : 'Checking...')
              : normalizationStatus?.codexLoggedIn
                ? (vi ? 'Kiểm tra lại' : 'Check again')
                : (vi ? 'Đăng nhập ChatGPT' : 'Sign in to ChatGPT')}
          </Button>
        </div>
        {normalizationSetupStatus ? (
          <div className={cn('mt-2 text-xs', normalizationSetupStatus.ok ? 'text-emerald-300' : 'text-rose-300')}>
            {normalizationSetupStatus.message}
          </div>
        ) : null}
        <details className="mt-3 text-xs text-muted" open={!normalizationStatus?.codexLoggedIn && !settings?.openAiApiKeySet}>
          <summary className="cursor-pointer select-none hover:text-text">{vi ? 'OpenAI API dự phòng' : 'OpenAI API fallback'}</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
            <Input
              type="password"
              autoComplete="off"
              value={openAiKeyDraft}
              placeholder={settings?.maskedOpenAiApiKey ?? 'sk-...'}
              onChange={(event) => setOpenAiKeyDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void saveNormalizationSetup();
              }}
            />
            <Button
              icon={savingNormalizationSetup ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              disabled={savingNormalizationSetup}
              onClick={() => void saveNormalizationSetup()}
            >
              {openAiKeyDraft.trim() ? (vi ? 'Lưu & kiểm tra' : 'Save & check') : (vi ? 'Kiểm tra API' : 'Check API')}
            </Button>
          </div>
          <div className="mt-2">gpt-4o-mini · cache theo nội dung · tự dùng khi Codex không khả dụng.</div>
        </details>
      </div>

      <div className="rounded-lg border border-border bg-panel p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="text-base font-semibold text-text">VieNeu Local</div>
          <div className={cn('flex items-center gap-2 text-xs font-medium', localTtsStatus?.ok ? 'text-emerald-200' : 'text-amber-200')}>
            <span className={cn('size-2 rounded-full', localTtsStatus?.ok ? 'bg-emerald-400' : 'bg-amber-400')} />
            {localTtsStatus?.ok ? (vi ? 'Sẵn sàng' : 'Ready') : (vi ? 'Đang kiểm tra' : 'Checking')}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_210px]">
          <label className="grid gap-2 text-xs font-medium text-muted">
            {vi ? 'Giọng đọc' : 'Voice'}
            <select
              value={voiceDraft}
              onChange={(event) => {
                const nextVoice = event.target.value as TtsVoice;
                setVoiceDraft(nextVoice);
                queueLocalVideoSettings({ defaultVoice: nextVoice });
              }}
              className="h-10 w-full rounded-md border border-border bg-[#0f1217] px-3 text-sm font-normal text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              {activeVoiceOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {compactVoiceLabel(option.id, option.label, option.description[vi ? 'vi' : 'en'])}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-xs font-medium text-muted">
            <span className="flex items-center justify-between gap-2">
              <span>{vi ? 'Tốc độ' : 'Speed'}</span>
              <span className="text-text">{speedDraft.toFixed(2)}×</span>
            </span>
            <span className="flex h-10 items-center">
              <input
                type="range"
                min={0.9}
                max={1.3}
                step={0.05}
                value={speedDraft}
                onChange={(event) => updateSpeed(Number(event.target.value))}
                className="h-2 w-full cursor-pointer accent-sky-300"
              />
            </span>
          </label>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_150px] md:items-end">
          <label className="grid gap-2 text-xs font-medium text-muted">
            {vi ? 'Nghe thử' : 'Preview'}
            <textarea
              value={previewText}
              maxLength={500}
              rows={2}
              className="min-h-16 w-full resize-y rounded-md border border-border bg-[#0f1217] px-3 py-2 text-sm font-normal leading-6 text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              onChange={(event) => setPreviewText(event.target.value)}
            />
          </label>
          <Button
            className="h-10"
            icon={previewingVoice ? <LoaderCircle className="size-4 animate-spin" /> : <Volume2 className="size-4" />}
            disabled={previewingVoice || !previewText.trim()}
            onClick={previewVoice}
          >
            {previewingVoice ? (vi ? 'Đang tạo...' : 'Generating...') : (vi ? 'Nghe thử' : 'Preview')}
          </Button>
        </div>

        {previewStatus ? <div className="mt-2 text-xs text-sky-200">{previewStatus}</div> : null}

        <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-4">
          <div className="text-sm text-text">{vi ? 'Khoảng nghỉ' : 'Pause between segments'}</div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <Input
              type="number"
              min={0}
              max={1500}
              step={50}
              value={silenceDraft}
              onChange={(event) => {
                const nextSilence = Math.round(Math.min(Math.max(Number(event.target.value) || 0, 0), 1500));
                setSilenceDraft(nextSilence);
                queueLocalVideoSettings({ segmentSilenceMs: nextSilence });
              }}
              className="w-24 text-right"
            />
            ms
          </label>
        </div>

        <details className="mt-4 border-t border-border pt-3 text-xs text-muted">
          <summary className="cursor-pointer select-none font-medium hover:text-text">
            {vi ? 'Chi tiết kỹ thuật' : 'Technical details'}
          </summary>
          <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-[110px_1fr]">
            <dt>Model</dt><dd className="text-slate-300">vieneu-v3-turbo-onnx-int8</dd>
            <dt>Runtime</dt><dd className="text-slate-300">{localTtsStatus?.backend ?? 'ONNX int8 / CPU'}</dd>
            <dt>Version</dt><dd className="text-slate-300">{localTtsStatus?.version ?? '—'}</dd>
            <dt>Cache</dt><dd className="text-emerald-200">{vi ? 'Đang bật' : 'Enabled'}</dd>
          </dl>
        </details>
      </div>

      <div className="rounded-lg border border-border bg-panel p-5">
        <div className="mb-1 text-base font-semibold text-text">{vi ? 'Ứng dụng & dữ liệu' : 'Application & data'}</div>
        <div className="mb-4 text-sm text-muted">
          {vi ? 'Kiểm tra nhanh các thành phần quan trọng và mở thư mục dữ liệu.' : 'Check essential components and open the application data folder.'}
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-md border border-border bg-[#0f1217] p-3">
            <div className="text-xs text-muted">Database</div>
            <div className="mt-1 font-medium text-emerald-200">{settings ? (vi ? 'Đang hoạt động' : 'Available') : (vi ? 'Đang tải' : 'Loading')}</div>
          </div>
          <div className="rounded-md border border-border bg-[#0f1217] p-3">
            <div className="text-xs text-muted">{vi ? 'Clip nền' : 'Background clips'}</div>
            <div className="mt-1 font-medium text-text">{assetCount}</div>
          </div>
          <div className="rounded-md border border-border bg-[#0f1217] p-3">
            <div className="text-xs text-muted">VieNeu</div>
            <div className={cn('mt-1 font-medium', localTtsStatus?.ok ? 'text-emerald-200' : 'text-amber-200')}>
              {localTtsStatus?.ok ? (vi ? 'Sẵn sàng' : 'Ready') : (vi ? 'Cần kiểm tra' : 'Check required')}
            </div>
          </div>
        </div>
        <Button className="mt-4" icon={<FolderOpen className="size-4" />} onClick={() => void window.desktopAPI?.openDataFolder()}>
          {vi ? 'Mở thư mục data' : 'Open data folder'}
        </Button>
      </div>

    </div>
  );
}

function compactVoiceLabel(id: TtsVoice, label: string, description: string) {
  const displayName = id === 'Ngoc-Huyen-Clone' ? 'Ngọc Huyền' : label;
  const parts = description.split(' · ').map((part) => part.trim()).filter(Boolean);
  const qualifier = id === 'Ngoc-Huyen-Clone' ? parts.at(-1) : parts[0];
  return qualifier ? `${displayName} — ${qualifier}` : displayName;
}

function SettingsToggle({
  checked,
  description,
  label,
  onChange
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-5 py-4 first:pt-1 last:pb-1">
      <div className="min-w-0">
        <div className="text-sm font-medium text-text">{label}</div>
        <div className="mt-1 text-xs leading-5 text-muted">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn('h-6 w-11 shrink-0 rounded-full p-0.5 transition', checked ? 'bg-accent' : 'bg-border')}
      >
        <span className={cn('block size-5 rounded-full bg-white transition', checked ? 'translate-x-5' : 'translate-x-0')} />
      </button>
    </div>
  );
}

function AssetLibraryView({
  assets,
  generatedVideos,
  showProductClips,
  onAdd,
  onDelete,
  onDeleteGenerated,
  onOpenGenerated,
  onPreview
}: {
  assets: AssetLibraryItem[];
  generatedVideos: GeneratedVideoItem[];
  showProductClips: boolean;
  onAdd: (type: AssetType) => void;
  onDelete: (id: string) => void;
  onDeleteGenerated: (filePath: string) => void;
  onOpenGenerated: (filePath: string) => void;
  onPreview: (id: string) => void;
}) {
  const [type, setType] = useState<AssetType | 'created'>('background');
  const visible = type === 'created' ? [] : assets.filter((asset) => asset.type === type);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text">Kho clip</h2>
          <p className="mt-1 text-sm text-muted">Quản lý clip nền và các video đã tạo.</p>
        </div>
        {type !== 'created' ? (
          <Button variant="primary" icon={<Upload className="size-4" />} onClick={() => onAdd(type)}>
            Thêm clip
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterToggle active={type === 'background'} label="Clip nền" onClick={() => setType('background')} />
        <FilterToggle active={type === 'created'} label={`Video đã tạo (${generatedVideos.length})`} onClick={() => setType('created')} />
        {showProductClips ? <FilterToggle active={type === 'product'} label="Clip sản phẩm" onClick={() => setType('product')} /> : null}
      </div>

      {type === 'created' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
          {generatedVideos.map((video) => (
            <article key={video.id} className="overflow-hidden rounded-lg border border-border bg-panel">
              <button className="group relative block aspect-video w-full overflow-hidden bg-background" title={`Mở ${video.label}`} onClick={() => onOpenGenerated(video.filePath)}>
                {video.thumbnailDataUrl ? (
                  <img src={video.thumbnailDataUrl} alt="" className="size-full object-cover transition duration-200 group-hover:scale-105" />
                ) : (
                  <div className="grid size-full place-items-center text-[11px] text-muted">Chưa có thumbnail</div>
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/35">
                  <Play className="size-7 fill-white text-white opacity-0 transition group-hover:opacity-100" />
                </span>
              </button>
              <div className="p-3">
                <div className="truncate text-xs font-semibold text-text" title={video.label}>{video.label}</div>
                <div className="mt-1.5 text-[11px] text-muted">{formatFileSize(video.sizeBytes)} · {formatGeneratedDate(video.createdAt)}</div>
                <div className="mt-3 flex justify-end gap-1.5">
                  <Button className="h-8 px-2" title="Mở video" icon={<Play className="size-3.5" />} onClick={() => onOpenGenerated(video.filePath)} />
                  <Button
                    className="h-8 px-2"
                    title="Xóa video"
                    icon={<Trash2 className="size-3.5" />}
                    onClick={() => {
                      if (window.confirm(`Xóa video "${video.label}" khỏi máy?`)) onDeleteGenerated(video.filePath);
                    }}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
          {visible.map((asset) => (
            <article key={asset.id} className="overflow-hidden rounded-lg border border-border bg-panel">
              <button className="group relative block aspect-video w-full overflow-hidden bg-background" title={`Preview ${asset.label}`} onClick={() => onPreview(asset.id)}>
                {asset.thumbnailDataUrl ? <img src={asset.thumbnailDataUrl} alt="" className="size-full object-cover transition duration-200 group-hover:scale-105" /> : <div className="grid size-full place-items-center text-[11px] text-muted">Chưa có thumbnail</div>}
                <span className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/35"><Play className="size-6 fill-white text-white opacity-0 transition group-hover:opacity-100" /></span>
              </button>
              <div className="p-2.5">
                <div className="truncate text-xs font-semibold text-text" title={asset.label}>{asset.label}</div>
                <div className="mt-1.5 text-[11px] text-muted">{asset.durationSecs.toFixed(1)}s · đã dùng {asset.timesUsed} lần</div>
                <div className="mt-2 flex justify-end gap-1.5">
                  <Button className="h-8 px-2" title="Preview clip" icon={<Play className="size-3.5" />} onClick={() => onPreview(asset.id)} />
                  <Button className="h-8 px-2" title="Xóa clip khỏi Kho clip" icon={<Trash2 className="size-3.5" />} onClick={() => onDelete(asset.id)} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {type === 'created' && !generatedVideos.length ? <div className="rounded-lg border border-border bg-panel p-6 text-sm text-muted">Chưa có video nào được tạo.</div> : null}
      {type !== 'created' && !visible.length ? <div className="rounded-lg border border-border bg-panel p-6 text-sm text-muted">Chưa có clip trong nhóm này. Bạn vẫn có thể chọn file MP4 trực tiếp khi tạo video.</div> : null}
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatGeneratedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function RepliesDrawer({ post, loading, onClose, onReload }: { post: ThreadsPost; loading: boolean; onClose: () => void; onReload: () => void }) {
  const replies = filterUsefulReplies(post.topReplies, post);
  return <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-x-hidden overflow-y-auto border-l border-border bg-[#0c0f13] p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between gap-3"><div className="min-w-0"><div className="text-xs uppercase tracking-[0.14em] text-muted">Top replies ({replies.length})</div><div className="mt-1 truncate text-base font-semibold text-text">{post.author}</div></div><Button className="shrink-0 px-2" icon={<X className="size-4" />} onClick={onClose} /></div><div className="mb-4"><Button disabled={loading} icon={<RefreshCcw className={cn('size-4', loading && 'animate-spin')} />} onClick={onReload}>{loading ? 'Đang tải replies...' : 'Tải lại replies'}</Button></div><div className="space-y-3">{replies.map((reply) => <div key={reply.id} className="min-w-0 overflow-hidden rounded-lg border border-border bg-panel p-3"><div className="break-all text-xs font-semibold text-sky-200">@{reply.author}</div><div className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300 [overflow-wrap:anywhere]">{reply.content}</div>{reply.mediaUrls?.[0] ? <img src={reply.mediaUrls[0]} alt="Media reply" className="mt-2 max-h-56 w-full rounded-md object-cover" /> : null}<div className="mt-2 text-xs text-muted">{reply.likes} likes</div></div>)}{!replies.length ? <div className="text-sm text-muted">Chưa tải được nội dung replies cho bài này.</div> : null}</div></aside>;
}

function isQuotaBlocked(result: unknown): result is QuotaBlockedResult {
  return typeof result === 'object' && result !== null && 'quotaExceeded' in result;
}

function quotaMessage(template: string, quota: QuotaBlockedResult) {
  return `${template} ($${quota.todayUsd.toFixed(2)} / $${quota.limitUsd.toFixed(2)})`;
}

function buildInitialSpeechSegments(post: ThreadsPost) {
  const replies = filterUsefulReplies(post.topReplies, post).slice(0, 10);
  return [
    { id: 'post', text: post.content },
    ...replies.map((reply, index) => ({
      id: 'reply-' + (index + 1),
      text: reply.content
    }))
  ];
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
      return copy.createFromLinkTitle;
    case 'opportunities':
      return copy.opportunityInbox;
    case 'trending':
      return copy.trendingFeed;
    case 'keywords':
      return copy.keywords;
    case 'saved':
      return copy.savedPosts;
    case 'products':
      return copy.products;
    case 'assets':
      return 'Kho clip';
    case 'settings':
      return copy.settings;
    default:
      return copy.appName;
  }
}

function sectionLabelForView(view: string) {
  return {
    home: 'Threads video workspace',
    opportunities: 'Content suggestions',
    trending: 'Threads sources',
    keywords: 'Sources',
    saved: 'Library',
    products: 'Catalog',
    assets: 'Assets',
    settings: 'Settings'
  }[view] ?? 'Threads Video Studio';
}

function isViewEnabled(view: string, features: AppSettings['featureVisibility']) {
  if (view === 'reviews' || view === 'uploads') return false;
  if (['opportunities', 'trending', 'keywords', 'saved'].includes(view)) return features.opportunityDiscovery;
  if (view === 'products') return false;
  if (view === 'assets') return true;
  return true;
}
