export type Language = 'en' | 'vi';

type TranslationKey =
  | 'appName'
  | 'appSubtitle'
  | 'home'
  | 'trendingFeed'
  | 'keywords'
  | 'savedPosts'
  | 'productSuggestions'
  | 'settings'
  | 'guardrailsTitle'
  | 'guardrailsBody'
  | 'searchPlaceholder'
  | 'fetch'
  | 'postsSorted'
  | 'replies'
  | 'noMatchingPosts'
  | 'keywordMonitoring'
  | 'keywordMonitoringHelp'
  | 'quickActions'
  | 'topOpportunities'
  | 'researchOverview'
  | 'totalPosts'
  | 'analyzedPosts'
  | 'savedIdeas'
  | 'activeKeywords'
  | 'fetchTrending'
  | 'analyzeTopPost'
  | 'manageKeywords'
  | 'recentSaved'
  | 'feedResearch'
  | 'analyze'
  | 'savePost'
  | 'copyContent'
  | 'generateTikTokIdea'
  | 'openLink'
  | 'fetchAgainForLink'
  | 'selectPostPrompt'
  | 'aiAnalysis'
  | 'analyzing'
  | 'analyzePost'
  | 'whyViral'
  | 'analysisPending'
  | 'relatability'
  | 'controversy'
  | 'emotionalTrigger'
  | 'painPointPending'
  | 'affiliateOpportunities'
  | 'noCategories'
  | 'hooks'
  | 'noHooks'
  | 'ctaSuggestions'
  | 'noCtas'
  | 'intentPending'
  | 'emptyDashboard'
  | 'keywordManager'
  | 'keywordManagerHelp'
  | 'enabled'
  | 'disabled'
  | 'addNiche'
  | 'export'
  | 'openAi'
  | 'apiKeySaved'
  | 'apiKeyPlaceholder'
  | 'apiKeyHelpSaved'
  | 'apiKeyHelpEmpty'
  | 'save'
  | 'saving'
  | 'threadsSession'
  | 'threadsLogin'
  | 'checkSession'
  | 'sessionExists'
  | 'noSession'
  | 'loggedInAs'
  | 'accountUnknown'
  | 'demoMode'
  | 'language'
  | 'english'
  | 'vietnamese';

export type TranslationCopy = Record<TranslationKey, string>;

export const translations: Record<Language, TranslationCopy> = {
  en: {
    appName: 'Trend Finder',
    appSubtitle: 'Threads affiliate research',
    home: 'Home',
    trendingFeed: 'Trending Feed',
    keywords: 'Keywords',
    savedPosts: 'Saved Posts',
    productSuggestions: 'Product Suggestions',
    settings: 'Settings',
    guardrailsTitle: 'Guardrails',
    guardrailsBody: 'Research only. No auto-posting, fake engagement, or aggressive scraping.',
    searchPlaceholder: 'Search posts or fetch niche...',
    fetch: 'Fetch',
    postsSorted: 'posts sorted by viral score',
    replies: 'Replies',
    noMatchingPosts: 'No matching posts.',
    keywordMonitoring: 'Keyword Monitoring',
    keywordMonitoringHelp: 'Saved niches for quick fetch and future scheduled monitoring. Click a keyword to fetch it now; toggle controls background monitoring.',
    quickActions: 'Quick Actions',
    topOpportunities: 'Top Opportunities',
    researchOverview: 'Research Overview',
    totalPosts: 'Total Posts',
    analyzedPosts: 'Analyzed Posts',
    savedIdeas: 'Saved Ideas',
    activeKeywords: 'Active Keywords',
    fetchTrending: 'Fetch Trending',
    analyzeTopPost: 'Analyze Top Post',
    manageKeywords: 'Manage Keywords',
    recentSaved: 'Recent Saved',
    feedResearch: 'Feed Research',
    analyze: 'Analyze',
    savePost: 'Save',
    copyContent: 'Copy Content',
    generateTikTokIdea: 'Generate TikTok Idea',
    openLink: 'Link',
    fetchAgainForLink: 'Fetch this keyword again to refresh the post permalink.',
    selectPostPrompt: 'Select a post to inspect its viral potential.',
    aiAnalysis: 'AI Analysis',
    analyzing: 'Analyzing...',
    analyzePost: 'Analyze Post',
    whyViral: 'Why Viral',
    analysisPending: 'Analysis has not been generated yet.',
    relatability: 'Relatability',
    controversy: 'Controversy',
    emotionalTrigger: 'Emotional Trigger',
    painPointPending: 'Pending pain-point analysis.',
    affiliateOpportunities: 'Affiliate Opportunities',
    noCategories: 'No categories yet.',
    hooks: 'Hooks',
    noHooks: 'No hooks yet.',
    ctaSuggestions: 'CTA Suggestions',
    noCtas: 'No CTAs yet.',
    intentPending: 'intent pending',
    emptyDashboard: 'Fetch posts to populate the dashboard.',
    keywordManager: 'Keyword Manager',
    keywordManagerHelp: 'Manage niche watchlists. Click Fetch to pull posts for a niche, and use toggles to include or exclude it from background monitoring.',
    enabled: 'Enabled',
    disabled: 'Disabled',
    addNiche: 'Add niche...',
    export: 'Export',
    openAi: 'OpenAI',
    apiKeySaved: 'API key saved',
    apiKeyPlaceholder: 'OpenAI API key',
    apiKeyHelpSaved: 'An API key is saved locally. Paste a new key only if you want to replace it.',
    apiKeyHelpEmpty: 'Paste the API key from OpenAI Platform, then click Save.',
    save: 'Save',
    saving: 'Saving...',
    threadsSession: 'Threads Session',
    threadsLogin: 'Threads Login',
    checkSession: 'Check Session',
    sessionExists: 'Session exists.',
    noSession: 'No session yet.',
    loggedInAs: 'Logged in as',
    accountUnknown: 'Account not detected yet.',
    demoMode: 'Demo Mode',
    language: 'Language',
    english: 'English',
    vietnamese: 'Vietnamese'
  },
  vi: {
    fetchAgainForLink: 'Fetch lại từ khóa để cập nhật permalink cho bài viết.',
    appName: 'Trend Finder',
    appSubtitle: 'Nghiên cứu affiliate từ Threads',
    home: 'Trang chủ',
    trendingFeed: 'Bài đang hot',
    keywords: 'Từ khóa',
    savedPosts: 'Bài đã lưu',
    productSuggestions: 'Gợi ý sản phẩm',
    settings: 'Cài đặt',
    guardrailsTitle: 'Giới hạn an toàn',
    guardrailsBody: 'Chỉ dùng để nghiên cứu. Không tự động đăng bài, tạo tương tác giả, hoặc scrape quá mức.',
    searchPlaceholder: 'Tìm bài hoặc fetch niche...',
    fetch: 'Fetch',
    postsSorted: 'bài được sắp xếp theo điểm viral',
    replies: 'Replies',
    noMatchingPosts: 'Không có bài phù hợp.',
    keywordMonitoring: 'Theo dõi từ khóa',
    keywordMonitoringHelp: 'Danh sách niche đã lưu để fetch nhanh và dùng cho monitoring tự động sau này. Click từ khóa để fetch ngay; toggle để bật/tắt theo dõi nền.',
    quickActions: 'Thao tác nhanh',
    topOpportunities: 'Cơ hội nổi bật',
    researchOverview: 'Tổng quan nghiên cứu',
    totalPosts: 'Tổng số bài',
    analyzedPosts: 'Đã phân tích',
    savedIdeas: 'Idea đã lưu',
    activeKeywords: 'Từ khóa đang bật',
    fetchTrending: 'Fetch bài hot',
    analyzeTopPost: 'Phân tích bài top',
    manageKeywords: 'Quản lý từ khóa',
    recentSaved: 'Đã lưu gần đây',
    feedResearch: 'Nghiên cứu feed',
    analyze: 'Phân tích',
    savePost: 'Lưu',
    copyContent: 'Copy nội dung',
    generateTikTokIdea: 'Tạo ý tưởng TikTok',
    openLink: 'Link',
    selectPostPrompt: 'Chọn một bài để xem tiềm năng viral.',
    aiAnalysis: 'Phân tích AI',
    analyzing: 'Đang phân tích...',
    analyzePost: 'Phân tích bài',
    whyViral: 'Vì sao viral',
    analysisPending: 'Chưa tạo phân tích.',
    relatability: 'Độ relatable',
    controversy: 'Độ tranh luận',
    emotionalTrigger: 'Cảm xúc kích hoạt',
    painPointPending: 'Chưa có phân tích pain point.',
    affiliateOpportunities: 'Cơ hội affiliate',
    noCategories: 'Chưa có danh mục.',
    hooks: 'Hook',
    noHooks: 'Chưa có hook.',
    ctaSuggestions: 'Gợi ý CTA',
    noCtas: 'Chưa có CTA.',
    intentPending: 'chưa có intent',
    emptyDashboard: 'Fetch bài viết để có dữ liệu dashboard.',
    keywordManager: 'Quản lý từ khóa',
    keywordManagerHelp: 'Quản lý danh sách niche. Bấm Fetch để kéo bài theo niche, toggle để bật/tắt theo dõi nền.',
    enabled: 'Đang bật',
    disabled: 'Đang tắt',
    addNiche: 'Thêm niche...',
    export: 'Export',
    openAi: 'OpenAI',
    apiKeySaved: 'Đã lưu API key',
    apiKeyPlaceholder: 'OpenAI API key',
    apiKeyHelpSaved: 'API key đã được lưu cục bộ. Chỉ paste key mới nếu muốn thay thế.',
    apiKeyHelpEmpty: 'Paste API key từ OpenAI Platform, rồi bấm Save.',
    save: 'Save',
    saving: 'Đang lưu...',
    threadsSession: 'Phiên Threads',
    threadsLogin: 'Đăng nhập Threads',
    checkSession: 'Kiểm tra phiên',
    sessionExists: 'Đã có session.',
    noSession: 'Chưa có session.',
    loggedInAs: 'Đang đăng nhập',
    accountUnknown: 'Chưa nhận diện được tài khoản.',
    demoMode: 'Chế độ demo',
    language: 'Ngôn ngữ',
    english: 'Tiếng Anh',
    vietnamese: 'Tiếng Việt'
  }
};
