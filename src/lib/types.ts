export type FetchMode = 'home' | 'keyword' | 'hashtag' | 'profile' | 'trending';

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
  createdAt: string;
};

export type Keyword = {
  id: string;
  phrase: string;
  enabled: boolean;
  cadenceMinutes: number;
  lastFetchedAt?: string;
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
  elevenLabsApiKeySet: boolean;
  maskedElevenLabsApiKey?: string;
  elevenLabsVoiceId: string;
  threadsSessionExists: boolean;
  threadsAccountName?: string;
  language: 'en' | 'vi';
  allowDemoMode: boolean;
  autoScanEnabled: boolean;
  autoScanMinutes: number;
  scanOnLaunch: boolean;
};

export type UpdateSettingsRequest = {
  openAiApiKey?: string;
  openAiModel?: string;
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
  language?: 'en' | 'vi';
  allowDemoMode?: boolean;
  autoScanEnabled?: boolean;
  autoScanMinutes?: number;
  scanOnLaunch?: boolean;
};

export type ServiceHealth = {
  ok: boolean;
  message: string;
};

export type VideoDraftRequest = {
  post: ThreadsPost;
  analysis: AIAnalysis;
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
};

export type OpportunityScanResult = {
  posts: ThreadsPost[];
  latestScanPosts: ThreadsPost[];
  analyses: AIAnalysis[];
  keywordsScanned: number;
  fetchedPosts: number;
  analyzedPosts: number;
  errors: string[];
};

export type DesktopAPI = {
  fetchThreads: (request: FetchRequest) => Promise<FetchResult>;
  scanOpportunities: () => Promise<OpportunityScanResult>;
  analyzePost: (post: ThreadsPost) => Promise<AIAnalysis>;
  getPosts: () => Promise<ThreadsPost[]>;
  getAnalysis: (postId: string) => Promise<AIAnalysis | null>;
  savePost: (postId: string, collection: string, tags: string[]) => Promise<void>;
  unsavePost: (postId: string, collection: string) => Promise<void>;
  getSavedPosts: () => Promise<SavedPost[]>;
  addKeyword: (phrase: string) => Promise<Keyword>;
  getKeywords: () => Promise<Keyword[]>;
  setKeywordEnabled: (id: string, enabled: boolean) => Promise<void>;
  updateKeyword: (id: string, phrase: string) => Promise<Keyword>;
  deleteKeyword: (id: string) => Promise<void>;
  exportIdeas: () => Promise<string>;
  openThreadsLogin: () => Promise<void>;
  getSettings: () => Promise<AppSettings>;
  updateSettings: (settings: UpdateSettingsRequest) => Promise<AppSettings>;
  testOpenAI: () => Promise<ServiceHealth>;
  getThreadsLoginStatus: () => Promise<ServiceHealth>;
  openPostExternal: (post: ThreadsPost) => Promise<ServiceHealth>;
  renderVideoDraft: (request: VideoDraftRequest) => Promise<VideoDraftResult>;
  onVideoDraftProgress: (listener: (progress: VideoDraftProgress) => void) => () => void;
  openVideoOutputFolder: (filePath: string) => Promise<ServiceHealth>;
};

declare global {
  interface Window {
    desktopAPI?: DesktopAPI;
  }
}
