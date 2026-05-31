export type Language = 'en' | 'vi';

type TranslationKey =
  | 'appName'
  | 'appSubtitle'
  | 'home'
  | 'opportunityInbox'
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
  | 'noPostsFound'
  | 'keywordMonitoring'
  | 'keywordMonitoringHelp'
  | 'quickActions'
  | 'topOpportunities'
  | 'latestScanPosts'
  | 'latestScanPostsHelp'
  | 'researchOverview'
  | 'totalPosts'
  | 'analyzedPosts'
  | 'savedIdeas'
  | 'activeKeywords'
  | 'fetchTrending'
  | 'scanOpportunities'
  | 'scanningOpportunities'
  | 'scanOpportunitiesHelp'
  | 'scanComplete'
  | 'makeNow'
  | 'watch'
  | 'skip'
  | 'confidence'
  | 'growth'
  | 'recentSaved'
  | 'feedResearch'
  | 'analyze'
  | 'savePost'
  | 'saved'
  | 'copyContent'
  | 'copied'
  | 'postSaved'
  | 'postRemovedFromSaved'
  | 'contentCopied'
  | 'generateTikTokIdea'
  | 'openLink'
  | 'fetchAgainForLink'
  | 'selectPostPrompt'
  | 'aiAnalysis'
  | 'analyzing'
  | 'whyViral'
  | 'analysisPending'
  | 'opportunityScore'
  | 'viralScore'
  | 'affiliateFit'
  | 'relatability'
  | 'controversy'
  | 'emotionalTrigger'
  | 'painPoint'
  | 'painPointPending'
  | 'affiliateOpportunities'
  | 'noCategories'
  | 'hooks'
  | 'noHooks'
  | 'ctaSuggestions'
  | 'noCtas'
  | 'personas'
  | 'situations'
  | 'demoAngle'
  | 'contentFormat'
  | 'tiktokBrief'
  | 'sourcePost'
  | 'productSearchKeywords'
  | 'scriptOutline'
  | 'copyBrief'
  | 'briefCopied'
  | 'createVideoDraft'
  | 'renderingVideoDraft'
  | 'videoDraftHelp'
  | 'videoDraftReady'
  | 'videoDraftFilePickerHelp'
  | 'openOutputFolder'
  | 'close'
  | 'rejectReason'
  | 'noAffiliateFit'
  | 'intentPending'
  | 'emptyDashboard'
  | 'keywordManager'
  | 'keywordManagerHelp'
  | 'enabled'
  | 'disabled'
  | 'addNiche'
  | 'editKeyword'
  | 'deleteKeyword'
  | 'saveChanges'
  | 'cancel'
  | 'confirmDeleteKeyword'
  | 'keywordAdded'
  | 'export'
  | 'openAi'
  | 'elevenLabs'
  | 'adamVoice'
  | 'elevenLabsApiKeyPlaceholder'
  | 'elevenLabsApiKeyHelpSaved'
  | 'elevenLabsApiKeyHelpEmpty'
  | 'voiceId'
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
  | 'autoScan'
  | 'autoScanHelp'
  | 'autoScanInterval'
  | 'scanOnLaunch'
  | 'language'
  | 'english'
  | 'vietnamese';

export type TranslationCopy = Record<TranslationKey, string>;

export const translations: Record<Language, TranslationCopy> = {
  en: {
    appName: 'Trend Finder',
    appSubtitle: 'Threads affiliate research',
    home: 'Home',
    opportunityInbox: "Today's Posts",
    trendingFeed: 'Trending Feed',
    keywords: 'Keywords',
    savedPosts: 'Saved Posts',
    productSuggestions: 'Product Suggestions',
    settings: 'Settings',
    guardrailsTitle: 'Guardrails',
    guardrailsBody: 'Research only. No auto-posting, fake engagement, or aggressive scraping.',
    searchPlaceholder: 'Search posts or fetch niche...',
    fetch: 'Fetch',
    postsSorted: 'posts sorted by affiliate opportunity score',
    replies: 'Replies',
    noMatchingPosts: 'No matching posts.',
    noPostsFound: 'Threads did not return posts for this niche. Try a broader keyword.',
    keywordMonitoring: 'Keyword Monitoring',
    keywordMonitoringHelp: 'Saved niches for quick fetch and future scheduled monitoring. Click a keyword to fetch it now; toggle controls background monitoring.',
    quickActions: 'Quick Actions',
    topOpportunities: 'Featured Posts',
    latestScanPosts: 'Latest Scan',
    latestScanPostsHelp: 'Posts fetched in the most recent scan. Open a post to inspect it in Trending Feed.',
    researchOverview: 'Research Overview',
    totalPosts: 'Total Posts',
    analyzedPosts: 'Analyzed Posts',
    savedIdeas: 'Saved Ideas',
    activeKeywords: 'Active Keywords',
    fetchTrending: 'Fetch Trending',
    scanOpportunities: 'Scan New Posts',
    scanningOpportunities: 'Scanning niches...',
    scanOpportunitiesHelp: 'Scan enabled niches, measure engagement growth, and let AI shortlist posts that can become affiliate content.',
    scanComplete: 'Post scan complete.',
    makeNow: 'Make Now',
    watch: 'Watch',
    skip: 'Skip',
    confidence: 'Confidence',
    growth: 'Growth',
    recentSaved: 'Recent Saved',
    feedResearch: 'Feed Research',
    analyze: 'Analyze',
    savePost: 'Save',
    saved: 'Saved',
    copyContent: 'Copy Content',
    copied: 'Copied',
    postSaved: 'Post saved.',
    postRemovedFromSaved: 'Post removed from Saved Posts.',
    contentCopied: 'Copied content and source link.',
    generateTikTokIdea: 'Generate TikTok Idea',
    openLink: 'Link',
    fetchAgainForLink: 'Fetch this keyword again to refresh the post permalink.',
    selectPostPrompt: 'Select a post to inspect its viral potential.',
    aiAnalysis: 'AI Analysis',
    analyzing: 'Analyzing...',
    whyViral: 'Why Viral',
    analysisPending: 'Analysis has not been generated yet.',
    opportunityScore: 'Recommendation Score',
    viralScore: 'Viral',
    affiliateFit: 'Affiliate Fit',
    relatability: 'Relatability',
    controversy: 'Controversy',
    emotionalTrigger: 'Emotional Trigger',
    painPoint: 'Pain Point',
    painPointPending: 'Pending pain-point analysis.',
    affiliateOpportunities: 'Affiliate Opportunities',
    noCategories: 'No categories yet.',
    hooks: 'Hooks',
    noHooks: 'No hooks yet.',
    ctaSuggestions: 'CTA Suggestions',
    noCtas: 'No CTAs yet.',
    personas: 'Target Personas',
    situations: 'Pain-point Situations',
    demoAngle: 'Demo Angle',
    contentFormat: 'Content Format',
    tiktokBrief: 'TikTok Affiliate Brief',
    sourcePost: 'Source Post',
    productSearchKeywords: 'Marketplace Search Keywords',
    scriptOutline: 'Video Outline',
    copyBrief: 'Copy Brief',
    briefCopied: 'Brief copied.',
    createVideoDraft: 'Create Video Draft',
    renderingVideoDraft: 'Rendering video...',
    videoDraftHelp: 'AI voice reads the full selected Threads post while its card stays over the retention clip, then the video switches to your authorized product demo.',
    videoDraftReady: 'Video draft rendered. The output folder is open.',
    videoDraftFilePickerHelp: 'You will choose 2 MP4 files: retention background first, then product demo.',
    openOutputFolder: 'Open output folder',
    close: 'Close',
    rejectReason: 'Why Skip This Post',
    noAffiliateFit: 'No strong affiliate opportunity detected yet.',
    intentPending: 'intent pending',
    emptyDashboard: 'Fetch posts to populate the dashboard.',
    keywordManager: 'Keyword Manager',
    keywordManagerHelp: 'Manage niche watchlists. Click Fetch to pull posts for a niche, and use toggles to include or exclude it from background monitoring.',
    enabled: 'Enabled',
    disabled: 'Disabled',
    addNiche: 'Add niche...',
    editKeyword: 'Edit keyword',
    deleteKeyword: 'Delete keyword',
    saveChanges: 'Save changes',
    cancel: 'Cancel',
    confirmDeleteKeyword: 'Delete this keyword from monitoring?',
    keywordAdded: 'Keyword added.',
    export: 'Export',
    openAi: 'OpenAI',
    elevenLabs: 'ElevenLabs Voice',
    adamVoice: 'Adam voice for video drafts',
    elevenLabsApiKeyPlaceholder: 'ElevenLabs API key',
    elevenLabsApiKeyHelpSaved: 'An ElevenLabs API key is saved locally. Paste a new key only if you want to replace it.',
    elevenLabsApiKeyHelpEmpty: 'Paste an ElevenLabs API key to generate video voiceovers with Adam.',
    voiceId: 'Voice ID',
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
    autoScan: 'Auto Scan While App Is Open',
    autoScanHelp: 'Optional. Auto scan only runs while this local app is open.',
    autoScanInterval: 'Auto Scan Interval',
    scanOnLaunch: 'Scan When App Opens',
    language: 'Language',
    english: 'English',
    vietnamese: 'Vietnamese'
  },
  vi: {
    opportunityInbox: 'Bài viết hôm nay',
    scanOpportunities: 'Quét bài viết mới',
    scanningOpportunities: 'Đang quét các niche...',
    scanOpportunitiesHelp: 'Quét các niche đang bật, đo tốc độ tăng tương tác và dùng AI shortlist bài có thể làm affiliate.',
    scanComplete: 'Đã quét xong bài viết affiliate.',
    makeNow: 'Làm ngay',
    watch: 'Theo dõi',
    skip: 'Bỏ qua',
    confidence: 'Độ tin cậy',
    growth: 'Tăng trưởng',
    autoScan: 'Tự quét khi app đang mở',
    autoScanHelp: 'Tùy chọn. Tự quét chỉ chạy khi ứng dụng local đang mở.',
    autoScanInterval: 'Chu kỳ tự quét',
    scanOnLaunch: 'Quét ngay khi mở app',
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
    postsSorted: 'bài được sắp xếp theo điểm đề xuất affiliate',
    replies: 'Replies',
    noMatchingPosts: 'Không có bài phù hợp.',
    noPostsFound: 'Threads không trả về bài viết cho niche này. Hãy thử từ khóa rộng hơn.',
    keywordMonitoring: 'Theo dõi từ khóa',
    keywordMonitoringHelp: 'Danh sách niche đã lưu để fetch nhanh và dùng cho monitoring tự động sau này. Click từ khóa để fetch ngay; toggle để bật/tắt theo dõi nền.',
    quickActions: 'Thao tác nhanh',
    topOpportunities: 'Bài viết nổi bật',
    latestScanPosts: 'Bài vừa quét',
    latestScanPostsHelp: 'Các bài được fetch trong lần quét gần nhất. Click một bài để mở trong Bài đang hot.',
    researchOverview: 'Tổng quan nghiên cứu',
    totalPosts: 'Tổng số bài',
    analyzedPosts: 'Đã phân tích',
    savedIdeas: 'Idea đã lưu',
    activeKeywords: 'Từ khóa đang bật',
    fetchTrending: 'Fetch bài hot',
    recentSaved: 'Đã lưu gần đây',
    feedResearch: 'Nghiên cứu feed',
    analyze: 'Phân tích',
    savePost: 'Lưu',
    saved: 'Đã lưu',
    copyContent: 'Copy nội dung',
    copied: 'Đã copy',
    postSaved: 'Đã lưu bài viết.',
    postRemovedFromSaved: 'Đã bỏ bài viết khỏi danh sách lưu.',
    contentCopied: 'Đã copy nội dung và link nguồn.',
    generateTikTokIdea: 'Tạo ý tưởng TikTok',
    openLink: 'Link',
    selectPostPrompt: 'Chọn một bài để xem tiềm năng viral.',
    aiAnalysis: 'Phân tích AI',
    analyzing: 'Đang phân tích...',
    whyViral: 'Vì sao viral',
    analysisPending: 'Chưa tạo phân tích.',
    opportunityScore: 'Điểm đề xuất',
    viralScore: 'Viral',
    affiliateFit: 'Fit affiliate',
    relatability: 'Độ relatable',
    controversy: 'Độ tranh luận',
    emotionalTrigger: 'Cảm xúc kích hoạt',
    painPoint: 'Pain point',
    painPointPending: 'Chưa có phân tích pain point.',
    affiliateOpportunities: 'Sản phẩm affiliate phù hợp',
    noCategories: 'Chưa có danh mục.',
    hooks: 'Hook',
    noHooks: 'Chưa có hook.',
    ctaSuggestions: 'Gợi ý CTA',
    noCtas: 'Chưa có CTA.',
    personas: 'Nhóm khách hàng',
    situations: 'Tình huống pain point',
    demoAngle: 'Góc quay demo',
    contentFormat: 'Cấu trúc nội dung',
    tiktokBrief: 'Brief TikTok Affiliate',
    sourcePost: 'Bài nguồn',
    productSearchKeywords: 'Từ khóa tìm sản phẩm',
    scriptOutline: 'Outline video',
    copyBrief: 'Copy brief',
    briefCopied: 'Đã copy brief.',
    createVideoDraft: 'Tạo video nháp',
    renderingVideoDraft: 'Đang render video...',
    videoDraftHelp: 'Giọng AI đọc nguyên văn toàn bộ bài Threads trong khi card bài viết giữ trên clip retention, sau đó video chuyển sang clip demo sản phẩm của bạn.',
    videoDraftReady: 'Đã render video nháp. Folder output đã được mở.',
    videoDraftFilePickerHelp: 'Bạn sẽ chọn 2 file MP4: clip nền retention trước, sau đó clip demo sản phẩm.',
    openOutputFolder: 'Mở folder output',
    close: 'Đóng',
    rejectReason: 'Lý do nên bỏ qua',
    noAffiliateFit: 'Chưa xác định sản phẩm affiliate phù hợp.',
    intentPending: 'chưa có intent',
    emptyDashboard: 'Fetch bài viết để có dữ liệu dashboard.',
    keywordManager: 'Quản lý từ khóa',
    keywordManagerHelp: 'Quản lý danh sách niche. Bấm Fetch để kéo bài theo niche, toggle để bật/tắt theo dõi nền.',
    enabled: 'Đang bật',
    disabled: 'Đang tắt',
    addNiche: 'Thêm niche...',
    editKeyword: 'Sửa từ khóa',
    deleteKeyword: 'Xóa từ khóa',
    saveChanges: 'Lưu thay đổi',
    cancel: 'Hủy',
    confirmDeleteKeyword: 'Xóa từ khóa này khỏi danh sách theo dõi?',
    keywordAdded: 'Đã thêm từ khóa.',
    export: 'Export',
    openAi: 'OpenAI',
    elevenLabs: 'Giọng đọc ElevenLabs',
    adamVoice: 'Giọng Adam cho video nháp',
    elevenLabsApiKeyPlaceholder: 'ElevenLabs API key',
    elevenLabsApiKeyHelpSaved: 'ElevenLabs API key đã được lưu cục bộ. Chỉ paste key mới nếu muốn thay thế.',
    elevenLabsApiKeyHelpEmpty: 'Paste ElevenLabs API key để tạo voiceover video bằng giọng Adam.',
    voiceId: 'Voice ID',
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
