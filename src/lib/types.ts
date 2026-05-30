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

export type AIAnalysis = {
  postId: string;
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
  threadsSessionExists: boolean;
  threadsAccountName?: string;
  language: 'en' | 'vi';
  allowDemoMode: boolean;
};

export type UpdateSettingsRequest = {
  openAiApiKey?: string;
  openAiModel?: string;
  language?: 'en' | 'vi';
  allowDemoMode?: boolean;
};

export type ServiceHealth = {
  ok: boolean;
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
};

export type DesktopAPI = {
  fetchThreads: (request: FetchRequest) => Promise<FetchResult>;
  analyzePost: (post: ThreadsPost) => Promise<AIAnalysis>;
  getPosts: () => Promise<ThreadsPost[]>;
  getAnalysis: (postId: string) => Promise<AIAnalysis | null>;
  savePost: (postId: string, collection: string, tags: string[]) => Promise<void>;
  getSavedPosts: () => Promise<SavedPost[]>;
  addKeyword: (phrase: string) => Promise<Keyword>;
  getKeywords: () => Promise<Keyword[]>;
  setKeywordEnabled: (id: string, enabled: boolean) => Promise<void>;
  exportIdeas: () => Promise<string>;
  openThreadsLogin: () => Promise<void>;
  getSettings: () => Promise<AppSettings>;
  updateSettings: (settings: UpdateSettingsRequest) => Promise<AppSettings>;
  testOpenAI: () => Promise<ServiceHealth>;
  getThreadsLoginStatus: () => Promise<ServiceHealth>;
  openPostExternal: (post: ThreadsPost) => Promise<ServiceHealth>;
};

declare global {
  interface Window {
    desktopAPI?: DesktopAPI;
  }
}
