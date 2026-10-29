export type FetchMode = 'home' | 'keyword' | 'hashtag' | 'profile' | 'trending' | 'manual';
export type TrendState = 'EMERGING' | 'GROWING' | 'PEAK' | 'DECLINING' | 'DEAD';
export type ContentGoal = 'engagement' | 'affiliate';

export type ThreadsReply = {
  id: string;
  author: string;
  authorAvatarUrl?: string;
  mediaUrls?: string[];
  content: string;
  likes: number;
  segmentIndex?: number;
  segmentTotal?: number;
  replies?: number;
  reposts?: number;
  shares?: number;
};

export type ThreadsPost = {
  id: string;
  author: string;
  authorHandle?: string;
  content: string;
  likes: number;
  replies: number;
  reposts: number;
  timestamp: string;
  imageUrls: string[];
  url: string;
  source: FetchMode;
  keyword?: string;
  fetchedAt: string;
  trendingScore: number;
  affiliateFitScore: number;
  opportunityScore: number;
  velocityScore: number;
  engagementGrowthPercent: number;
  emotionalCategory: string;
  topReplies: ThreadsReply[];
  trendState: TrendState;
  likesPerHour: number;
  repliesPerHour: number;
  videoPotentialScore: number;
  engagementScore: number;
};

export type ViralScoreBreakdown = {
  likesVelocity: number;
  replies: number;
  reposts: number;
  emotionalWording: number;
  controversialWording: number;
  relatability: number;
};

export type AffiliateFitBreakdown = {
  painPointClarity: number;
  productSolvability: number;
  demoPotential: number;
  audienceClarity: number;
  buyingIntent: number;
};

export type CommentClassification = {
  replyId: string;
  content: string;
  type: 'PAIN_POINT' | 'SOCIAL_PROOF' | 'WORKAROUND' | 'OBJECTION' | 'QUESTION' | 'PRODUCT_MENTION';
  score: number;
  whySelected: string;
};

export type SelectedReply = {
  id?: string;
  author?: string;
  authorAvatarUrl?: string;
  mediaUrls?: string[];
  likes?: number;
  replies?: number;
  reposts?: number;
  shares?: number;
  content: string;
  type: string;
  whySelected: string;
};

export type AIAnalysis = {
  postId: string;
  verdict: 'make_now' | 'watch' | 'skip';
  confidenceScore: number;
  emotion: string;
  painPoint: string;
  buyingIntent: 'low' | 'medium' | 'high';
  affiliateCategories: string[];
  affiliateProducts: string[];
  contentAngle: string;
  whyViral: string;
  hooks: string[];
  ctas: string[];
  relatabilityScore: number;
  controversyScore: number;
  affiliateFitScore: number;
  personas: string[];
  situations: string[];
  demoAngle: string;
  contentFormat: string;
  solutionScript: string;
  productSearchKeywords: string[];
  scriptOutline: string[];
  rejectReason?: string;
  commentClassifications: CommentClassification[];
  bestReplies: SelectedReply[];
  videoPotentialScore: number;
  videoPotentialBreakdown: {
    visual: number;
    demo: number;
    emotional: number;
    curiosity: number;
  };
  tiktokCaption: string;
  hashtags: string[];
  marketplaceKeywords: {
    tiktokShop: string;
    shopee: string;
  };
  videoScript: {
    postReadVersion: string;
    transitionLine: string;
    solutionText: string;
    ctaText: string;
    captionVariants: string[];
  };
  contentGoal: ContentGoal;
  matchedProductId?: string;
  createdAt: string;
};

export type Keyword = {
  id: string;
  phrase: string;
  enabled: boolean;
  cadenceMinutes: number;
  lastFetchedAt?: string;
  source: 'manual' | 'default' | 'ai_audience' | 'ai_expansion';
  seedAudience?: string;
  createdAt: string;
};

export type KeywordSuggestion = {
  phrase: string;
  painPoint: string;
  reason: string;
  evidence: string;
};

export type KeywordExclusion = {
  id: string;
  phrase: string;
};

export type KeywordDiscoveryRequest = {
  mode: 'audience' | 'winners';
  audienceId?: string;
  audienceLabel?: string;
  seed?: string;
  existingKeywords: string[];
};

export type KeywordDiscoveryResult = {
  suggestions: KeywordSuggestion[];
  postsUsed: number;
  winnersUsed: number;
};

export type KeywordInsight = {
  keywordId: string;
  scanCount: number;
  fetchedPosts: number;
  currentPosts: number;
  analyzedPosts: number;
  makeNowPosts: number;
  watchPosts: number;
  painPointPosts: number;
  productFitPosts: number;
  averageOpportunityScore: number;
  orders: number;
  commission: number;
  score: number;
  status: 'potential' | 'testing' | 'poor';
  recommendation: 'keep' | 'test' | 'disable';
};

export type SavedPost = {
  postId: string;
  collection: string;
  tags: string[];
  savedAt: string;
};

export type TtsSegmentKind = 'hook' | 'post' | 'reply' | 'transition' | 'solution' | 'cta';
export type TtsProvider = 'openai' | 'gemini' | 'vieneu';
export type OpenAiTtsVoice = 'onyx' | 'nova' | 'shimmer';
export type GeminiTtsVoice =
  | 'Zephyr'
  | 'Puck'
  | 'Charon'
  | 'Kore'
  | 'Fenrir'
  | 'Leda'
  | 'Orus'
  | 'Aoede'
  | 'Callirrhoe'
  | 'Autonoe'
  | 'Enceladus'
  | 'Iapetus'
  | 'Umbriel'
  | 'Algieba'
  | 'Despina'
  | 'Erinome'
  | 'Algenib'
  | 'Rasalgethi'
  | 'Laomedeia'
  | 'Achernar'
  | 'Alnilam'
  | 'Schedar'
  | 'Gacrux'
  | 'Pulcherrima'
  | 'Achird'
  | 'Zubenelgenubi'
  | 'Vindemiatrix'
  | 'Sadachbia'
  | 'Sadaltager'
  | 'Sulafat';
export type VieneuTtsVoice =
  | 'Minh Đức'
  | 'Phạm Tuyên'
  | 'Thái Sơn'
  | 'Xuân Vĩnh'
  | 'Thanh Bình'
  | 'Trúc Ly'
  | 'Ngọc Linh'
  | 'Đoan Trang'
  | 'Mai Anh'
  | 'Thục Đoan'
  | 'Minh Triết'
  | 'Thùy Dung'
  | 'Quang Sơn'
  | 'Ngọc Trân'
  | 'Ngoc-Huyen-Clone';
export type TtsVoice = OpenAiTtsVoice | GeminiTtsVoice | VieneuTtsVoice;

export type FeatureVisibility = {
  opportunityDiscovery: boolean;
  affiliateWorkspace: boolean;
  assetLibrary: boolean;
  resultsTracking: boolean;
};

export type AppSettings = {
  openAiApiKeySet: boolean;
  maskedOpenAiApiKey?: string;
  openAiModel: string;
  geminiApiKeySet: boolean;
  maskedGeminiApiKey?: string;
  ttsProvider: TtsProvider;
  threadsSessionExists: boolean;
  threadsAccountName?: string;
  language: 'en' | 'vi';
  autoScanEnabled: boolean;
  autoScanMinutes: number;
  scanOnLaunch: boolean;
  tiktokChannelName: string;
  defaultVoice: TtsVoice;
  defaultSpeed: number;
  transitionSoundEnabled: boolean;
  postAgeHours: number;
  ttsInstructions: Record<TtsSegmentKind, string>;
  segmentSilenceMs: number;
  karaokeCaptionsEnabled: boolean;
  scanGoal: ContentGoal;
  readinessThresholds: ReadinessThresholds;
  dailyCostLimitUsd: number;
  pricing: {
    chatInPerM: number;
    chatOutPerM: number;
    ttsPerMillionChars: number;
    whisperPerMinute: number;
  };
  creativeAiEnabled: boolean;
  featureVisibility: FeatureVisibility;
};

export type UpdateSettingsRequest = {
  openAiApiKey?: string;
  openAiModel?: string;
  geminiApiKey?: string;
  ttsProvider?: TtsProvider;
  language?: 'en' | 'vi';
  autoScanEnabled?: boolean;
  autoScanMinutes?: number;
  scanOnLaunch?: boolean;
  tiktokChannelName?: string;
  defaultVoice?: TtsVoice;
  defaultSpeed?: number;
  transitionSoundEnabled?: boolean;
  postAgeHours?: number;
  ttsInstructions?: Partial<Record<TtsSegmentKind, string>>;
  segmentSilenceMs?: number;
  karaokeCaptionsEnabled?: boolean;
  scanGoal?: ContentGoal;
  readinessThresholds?: Partial<ReadinessThresholds>;
  dailyCostLimitUsd?: number;
  pricing?: Partial<{
    chatInPerM: number;
    chatOutPerM: number;
    ttsPerMillionChars: number;
    whisperPerMinute: number;
  }>;
  creativeAiEnabled?: boolean;
  featureVisibility?: Partial<FeatureVisibility>;
};

export type ServiceHealth = {
  ok: boolean;
  message: string;
};

export type LocalTtsStatus = ServiceHealth & {
  installed: boolean;
  modelReady: boolean;
  running: boolean;
  loaded?: boolean;
  version?: string;
  backend?: string;
  voices: Array<{ id: string; label: string; description: string }>;
};

export type VideoDraftVariant = {
  label: string;
  hookText: string;
  ctaText: string;
};

export type VideoDraftRequest = {
  renderSessionId?: string;
  post: ThreadsPost;
  analysis: AIAnalysis;
  selectedReplies?: SelectedReply[];
  hookText?: string;
  postReadVersion?: string;
  postTtsText?: string;
  replyTtsTexts?: string[];
  speechTextsFinalized?: boolean;
  transitionLine?: string;
  solutionText?: string;
  ctaText?: string;
  backgroundPath?: string;
  backgroundMusicEnabled?: boolean;
  productClipPath?: string;
  variants?: VideoDraftVariant[];
};

export type VideoDraftResult = ServiceHealth & {
  filePath?: string;
  variantPaths?: string[];
};

export type VideoDraftProgress = {
  percent: number;
  message: string;
  renderSessionId?: string;
};

export type TtsPreviewRequest = {
  text: string;
  provider: TtsProvider;
  voice: TtsVoice;
  speed: number;
  instructions: string;
};

export type TtsPreviewResult = ServiceHealth & {
  audioDataUrl?: string;
  cached?: boolean;
  model: string;
  source: 'openai_api' | 'gemini_api' | 'local_vieneu';
};

export type FetchRequest = {
  mode: FetchMode;
  query?: string;
  maxPosts?: number;
};

export type FetchResult = {
  posts: ThreadsPost[];
  logId: string;
  warning?: 'no_posts_found';
  newPosts?: number;
  seenPosts?: number;
};

export type OpportunityScanResult = {
  posts: ThreadsPost[];
  latestScanPosts: ThreadsPost[];
  analyses: AIAnalysis[];
  keywordsScanned: number;
  fetchedPosts: number;
  analyzedPosts: number;
  newPosts: number;
  seenPosts: number;
  prunedPosts: number;
  errors: string[];
};

export type OpportunityScanProgress = {
  phase: 'fetching' | 'analyzing' | 'cleanup' | 'complete';
  current: number;
  total: number;
  percent: number;
  message: string;
  keyword?: string;
};

export type CreateFromLinkProgress = {
  phase: 'importing' | 'analyzing' | 'ready';
  percent: number;
  message: string;
};

export type CreateFromLinkResult = {
  post: ThreadsPost;
  analysis: AIAnalysis;
  backgroundPath?: string;
};

export type Product = {
  id: string;
  name: string;
  affiliateLink: string;
  price: number;
  commissionPercent: number;
  category: string;
  marketplace: 'tiktok_shop' | 'shopee' | 'other';
  status: 'active' | 'paused';
  demoAssetId?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type AssetType = 'background' | 'product';

export type AssetLibraryItem = {
  id: string;
  type: AssetType;
  label: string;
  filePath: string;
  durationSecs: number;
  timesUsed: number;
  lastUsedAt?: string;
  thumbnailDataUrl?: string;
};

export type GeneratedVideoItem = {
  id: string;
  postId: string;
  label: string;
  filePath: string;
  createdAt: string;
  sizeBytes: number;
  reviewStatus: 'pending' | 'approved';
  approvedAt?: string;
  publishStatus: 'not_published' | 'publishing' | 'published' | 'failed' | 'verification_required';
  publishedUrl?: string;
  publishCaption?: string;
  publishError?: string;
  thumbnailDataUrl?: string;
};

export type TikTokPublishResult = ServiceHealth & {
  publishedUrl?: string;
  videos: GeneratedVideoItem[];
};

export type TikTokUploadPreparationResult = ServiceHealth & {
  caption: string;
  videos: GeneratedVideoItem[];
};

export type ManualPublishRequest = {
  publishedUrl: string;
  caption: string;
  uploadedAt: string;
  publishMethod?: 'tiktok_studio' | 'mobile';
};

export type UploadLogEntry = {
  id: string;
  postId: string;
  tiktokUrl: string;
  productName: string;
  hook: string;
  contentFormat: string;
  uploadedAt: string;
  views: number;
  likes: number;
  clicks: number;
  orders: number;
  revenue: number;
  commission: number;
  status: 'published' | 'tracking' | 'winner' | 'stopped';
  note: string;
  contentGoal: ContentGoal;
  followersGained: number;
  comments: number;
  saves: number;
  shares: number;
  productId?: string;
  variantLabel: string;
  lastSyncedAt?: string;
};

export type ReadinessThresholds = {
  avgViews: number;
  engagementRatePct: number;
  streakDays: number;
  followersGained: number;
};

export type ApiUsageKind = 'analysis' | 'keyword_discovery' | 'tts' | 'transcription';

export type UsageSummary = {
  todayUsd: number;
  last30Usd: number;
  perKind: Record<ApiUsageKind, { units: number; usd: number }>;
  costPerDraft: number;
  draftCount: number;
};

export type QuotaBlockedResult = {
  quotaExceeded: true;
  todayUsd: number;
  limitUsd: number;
};

export type DesktopAPI = {
  fetchThreads: (request: FetchRequest) => Promise<FetchResult>;
  importThreadsPost: (url: string) => Promise<ThreadsPost>;
  fetchPostReplies: (post: ThreadsPost) => Promise<ThreadsPost>;
  scanOpportunities: (goal?: ContentGoal, options?: { confirmOverQuota?: boolean }) => Promise<OpportunityScanResult | QuotaBlockedResult>;
  onOpportunityScanProgress: (listener: (progress: OpportunityScanProgress) => void) => () => void;
  createFromLink: (url: string, options?: { confirmOverQuota?: boolean }) => Promise<CreateFromLinkResult | QuotaBlockedResult>;
  onCreateFromLinkProgress: (listener: (progress: CreateFromLinkProgress) => void) => () => void;
  analyzePost: (post: ThreadsPost, goal?: ContentGoal, options?: { confirmOverQuota?: boolean }) => Promise<AIAnalysis | QuotaBlockedResult>;
  getPosts: () => Promise<ThreadsPost[]>;
  getAnalysis: (postId: string) => Promise<AIAnalysis | null>;
  getAnalyses: () => Promise<AIAnalysis[]>;
  savePost: (postId: string, collection: string, tags: string[]) => Promise<void>;
  unsavePost: (postId: string, collection: string) => Promise<void>;
  getSavedPosts: () => Promise<SavedPost[]>;
  addKeyword: (request: { phrase: string; source?: Keyword['source']; seedAudience?: string }) => Promise<Keyword>;
  getKeywords: () => Promise<Keyword[]>;
  getKeywordInsights: () => Promise<KeywordInsight[]>;
  setKeywordEnabled: (id: string, enabled: boolean) => Promise<void>;
  updateKeyword: (id: string, phrase: string) => Promise<Keyword>;
  deleteKeyword: (id: string) => Promise<void>;
  discoverKeywords: (request: KeywordDiscoveryRequest) => Promise<KeywordDiscoveryResult>;
  getKeywordExclusions: () => Promise<KeywordExclusion[]>;
  addKeywordExclusion: (phrase: string) => Promise<KeywordExclusion>;
  deleteKeywordExclusion: (id: string) => Promise<void>;
  exportIdeas: () => Promise<string>;
  openThreadsLogin: () => Promise<void>;
  getSettings: () => Promise<AppSettings>;
  updateSettings: (settings: UpdateSettingsRequest) => Promise<AppSettings>;
  testOpenAI: () => Promise<ServiceHealth>;
  testGemini: () => Promise<ServiceHealth>;
  getLocalTtsStatus: () => Promise<LocalTtsStatus>;
  previewTts: (request: TtsPreviewRequest) => Promise<TtsPreviewResult>;
  normalizeSpeech: (texts: string[], relatedPostId?: string) => Promise<string[]>;
  openOpenAiBilling: () => Promise<ServiceHealth>;
  openGeminiApiKeys: () => Promise<ServiceHealth>;
  getThreadsLoginStatus: () => Promise<ServiceHealth>;
  openPostExternal: (post: ThreadsPost) => Promise<ServiceHealth>;
  renderVideoDraft: (request: VideoDraftRequest) => Promise<VideoDraftResult>;
  onVideoDraftProgress: (listener: (progress: VideoDraftProgress) => void) => () => void;
  openVideoOutputFolder: (filePath: string) => Promise<ServiceHealth>;
  getAssets: () => Promise<AssetLibraryItem[]>;
  addAsset: (type: AssetType) => Promise<AssetLibraryItem | null>;
  deleteAsset: (id: string) => Promise<void>;
  openAssetPreview: (id: string) => Promise<ServiceHealth>;
  getGeneratedVideos: () => Promise<GeneratedVideoItem[]>;
  openGeneratedVideo: (filePath: string) => Promise<ServiceHealth>;
  deleteGeneratedVideo: (filePath: string) => Promise<void>;
  setGeneratedVideoApproved: (filePath: string, approved: boolean) => Promise<GeneratedVideoItem[]>;
  prepareTikTokUpload: (filePath: string, caption: string) => Promise<TikTokUploadPreparationResult>;
  markGeneratedVideoPublished: (filePath: string, request: ManualPublishRequest) => Promise<TikTokPublishResult>;
  getUploadLogs: () => Promise<UploadLogEntry[]>;
  saveUploadLog: (entry: UploadLogEntry) => Promise<UploadLogEntry>;
  deleteUploadLog: (id: string) => Promise<void>;
  getProducts: () => Promise<Product[]>;
  saveProduct: (product: Product) => Promise<Product>;
  deleteProduct: (id: string) => Promise<void>;
  getUsageSummary: () => Promise<UsageSummary>;
};

declare global {
  interface Window {
    desktopAPI?: DesktopAPI;
  }
}
