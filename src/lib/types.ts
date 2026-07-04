export type FetchMode = 'home' | 'keyword' | 'hashtag' | 'profile' | 'trending' | 'manual';
export type TrendState = 'EMERGING' | 'GROWING' | 'PEAK' | 'DECLINING' | 'DEAD';

export type ThreadsReply = {
  id: string;
  author: string;
  content: string;
  likes: number;
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
  likes?: number;
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

export type AppSettings = {
  openAiApiKeySet: boolean;
  maskedOpenAiApiKey?: string;
  openAiModel: string;
  threadsSessionExists: boolean;
  threadsAccountName?: string;
  language: 'en' | 'vi';
  autoScanEnabled: boolean;
  autoScanMinutes: number;
  scanOnLaunch: boolean;
  tiktokChannelName: string;
  defaultVoice: 'onyx' | 'nova' | 'shimmer';
  defaultSpeed: number;
  transitionSoundEnabled: boolean;
  postAgeHours: number;
};

export type UpdateSettingsRequest = {
  openAiApiKey?: string;
  openAiModel?: string;
  language?: 'en' | 'vi';
  autoScanEnabled?: boolean;
  autoScanMinutes?: number;
  scanOnLaunch?: boolean;
  tiktokChannelName?: string;
  defaultVoice?: 'onyx' | 'nova' | 'shimmer';
  defaultSpeed?: number;
  transitionSoundEnabled?: boolean;
  postAgeHours?: number;
};

export type ServiceHealth = {
  ok: boolean;
  message: string;
};

export type VideoDraftRequest = {
  post: ThreadsPost;
  analysis: AIAnalysis;
  selectedReplies?: SelectedReply[];
  hookText?: string;
  postReadVersion?: string;
  transitionLine?: string;
  solutionText?: string;
  ctaText?: string;
  backgroundPath?: string;
  productClipPath?: string;
};

export type VideoDraftResult = ServiceHealth & {
  filePath?: string;
};

export type VideoDraftProgress = {
  percent: number;
  message: string;
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

export type UploadLogEntry = {
  id: string;
  postId: string;
  tiktokUrl: string;
  productName: string;
  hook: string;
  contentFormat: string;
  uploadedAt: string;
  views: number;
  clicks: number;
  orders: number;
  revenue: number;
  commission: number;
  status: 'published' | 'tracking' | 'winner' | 'stopped';
  note: string;
};

export type DesktopAPI = {
  fetchThreads: (request: FetchRequest) => Promise<FetchResult>;
  importThreadsPost: (url: string) => Promise<ThreadsPost>;
  fetchPostReplies: (post: ThreadsPost) => Promise<ThreadsPost>;
  scanOpportunities: () => Promise<OpportunityScanResult>;
  onOpportunityScanProgress: (listener: (progress: OpportunityScanProgress) => void) => () => void;
  analyzePost: (post: ThreadsPost) => Promise<AIAnalysis>;
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
  openOpenAiBilling: () => Promise<ServiceHealth>;
  getThreadsLoginStatus: () => Promise<ServiceHealth>;
  openPostExternal: (post: ThreadsPost) => Promise<ServiceHealth>;
  renderVideoDraft: (request: VideoDraftRequest) => Promise<VideoDraftResult>;
  onVideoDraftProgress: (listener: (progress: VideoDraftProgress) => void) => () => void;
  openVideoOutputFolder: (filePath: string) => Promise<ServiceHealth>;
  getAssets: () => Promise<AssetLibraryItem[]>;
  addAsset: (type: AssetType) => Promise<AssetLibraryItem | null>;
  deleteAsset: (id: string) => Promise<void>;
  openAssetPreview: (id: string) => Promise<ServiceHealth>;
  getUploadLogs: () => Promise<UploadLogEntry[]>;
  saveUploadLog: (entry: UploadLogEntry) => Promise<UploadLogEntry>;
  deleteUploadLog: (id: string) => Promise<void>;
};

declare global {
  interface Window {
    desktopAPI?: DesktopAPI;
  }
}
