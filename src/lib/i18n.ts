export type Language = 'en' | 'vi';

type TranslationKey =
  | 'appName'
  | 'appSubtitle'
  | 'home'
  | 'opportunityInbox'
  | 'trendingFeed'
  | 'keywords'
  | 'savedPosts'
  | 'settings'
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
  | 'manualImportTitle'
  | 'manualImportHelp'
  | 'manualImportPlaceholder'
  | 'manualImport'
  | 'manualImporting'
  | 'manualImportComplete'
  | 'analyze'
  | 'savePost'
  | 'saved'
  | 'postSaved'
  | 'postRemovedFromSaved'
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
  | 'addKeywordPlaceholder'
  | 'editKeyword'
  | 'deleteKeyword'
  | 'saveChanges'
  | 'cancel'
  | 'confirmDeleteKeyword'
  | 'keywordAdded'
  | 'export'
  | 'openAi'
  | 'openAiBillingDashboard'
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
  | 'autoScan'
  | 'autoScanHelp'
  | 'autoScanInterval'
  | 'scanOnLaunch'
  | 'language'
  | 'english'
  | 'vietnamese'
  | 'readyToCreate'
  | 'trackedResults'
  | 'todayShortlist'
  | 'todayShortlistHelp'
  | 'newPosts'
  | 'seenPosts'
  | 'whyWorthMaking'
  | 'productToPromote'
  | 'suggestedHook'
  | 'pendingAiShortlist'
  | 'createContent'
  | 'inspectPost'
  | 'noShortlistYet'
  | 'noShortlistHelp'
  | 'keywordIntelligence'
  | 'keywordIntelligenceHelp'
  | 'keywordSeedPlaceholder'
  | 'suggestingKeywords'
  | 'addSuggestion'
  | 'excludedKeywords'
  | 'excludedKeywordsHelp'
  | 'excludedKeywordPlaceholder'
  | 'results'
  | 'resultsHelp'
  | 'totalViews'
  | 'clickRate'
  | 'orderConversion'
  | 'totalCommission'
  | 'addResult'
  | 'editResult'
  | 'resultFormHelp'
  | 'chooseSourcePost'
  | 'productName'
  | 'hookUsed'
  | 'formatUsed'
  | 'views'
  | 'clicks'
  | 'orders'
  | 'revenue'
  | 'commission'
  | 'published'
  | 'tracking'
  | 'winner'
  | 'stopped'
  | 'note'
  | 'learnedSignals'
  | 'unknownProduct'
  | 'noHookRecorded'
  | 'noResultsYet'
  | 'contentVariants'
  | 'variant'
  | 'hookOpening'
  | 'aiDiscovery'
  | 'manualKeyword'
  | 'chooseAudience'
  | 'chooseAudienceHelp'
  | 'refineAudiencePlaceholder'
  | 'discoverPainPoints'
  | 'discoveringKeywords'
  | 'expandFromWinners'
  | 'keywordSuggestions'
  | 'discoveryEvidence'
  | 'strongPostsUsed'
  | 'winnersUsed'
  | 'addAllSuggestions'
  | 'noNewKeywordSuggestions'
  | 'manualKeywordHelp'
  | 'addKeyword'
  | 'keywordPortfolio'
  | 'keywordPortfolioHelp'
  | 'potential'
  | 'testing'
  | 'poor'
  | 'audienceSource'
  | 'keywordScore'
  | 'disableSuggested'
  | 'scans'
  | 'postsFound'
  | 'productFitRate'
  | 'noKeywordsYet'
  | 'sourceManual'
  | 'sourceDefault'
  | 'sourceAiAudience'
  | 'sourceAiExpansion';

export type TranslationCopy = Record<TranslationKey, string>;

export const translations: Record<Language, TranslationCopy> = {
  en: {
    appName: 'Trend Finder',
    appSubtitle: 'Threads affiliate research',
    home: 'Home',
    opportunityInbox: "Today's Opportunities",
    trendingFeed: 'Explore Posts',
    keywords: 'Keywords',
    savedPosts: 'Saved Posts',
    settings: 'Settings',
    searchPlaceholder: 'Search posts or fetch keyword...',
    fetch: 'Fetch',
    postsSorted: 'posts sorted by affiliate opportunity score',
    replies: 'Replies',
    noMatchingPosts: 'No matching posts.',
    noPostsFound: 'Threads did not return posts for this keyword. Try a broader keyword.',
    keywordMonitoring: 'Keyword Monitoring',
    keywordMonitoringHelp: 'Saved keywords for quick fetch and future scheduled monitoring. Click a keyword to fetch it now; toggle controls background monitoring.',
    quickActions: 'Quick Actions',
    topOpportunities: 'Featured Posts',
    latestScanPosts: 'Latest Scan',
    latestScanPostsHelp: 'Posts fetched in the most recent scan. Open a post to inspect it in Trending Feed.',
    researchOverview: 'Research Overview',
    totalPosts: 'Tracked Posts',
    analyzedPosts: 'Analyzed Posts',
    savedIdeas: 'Saved Ideas',
    activeKeywords: 'Active Keywords',
    fetchTrending: 'Fetch Trending',
    scanOpportunities: 'Scan Opportunities',
    scanningOpportunities: 'Scanning keywords...',
    scanOpportunitiesHelp: 'Scan enabled keywords, measure engagement growth, and let AI shortlist posts that can become affiliate content.',
    scanComplete: 'Post scan complete.',
    makeNow: 'Make Now',
    watch: 'Watch',
    skip: 'Skip',
    confidence: 'Confidence',
    growth: 'Growth',
    recentSaved: 'Recent Saved',
    feedResearch: 'Manual research: search or fetch one keyword deeply on Threads.',
    manualImportTitle: 'Analyze a Threads link',
    manualImportHelp: 'Paste a post you found while browsing. The app imports the exact post and runs the same affiliate analysis workflow.',
    manualImportPlaceholder: 'https://www.threads.com/@account/post/...',
    manualImport: 'Import & Analyze',
    manualImporting: 'Importing...',
    manualImportComplete: 'Threads post imported and analyzed.',
    analyze: 'Analyze',
    savePost: 'Save',
    saved: 'Saved',
    postSaved: 'Post saved.',
    postRemovedFromSaved: 'Post removed from Saved Posts.',
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
    keywordManagerHelp: 'Manage keyword watchlists. Click Fetch to pull posts for a keyword, and use toggles to include or exclude it from background monitoring.',
    enabled: 'Enabled',
    disabled: 'Disabled',
    addKeywordPlaceholder: 'Add keyword...',
    editKeyword: 'Edit keyword',
    deleteKeyword: 'Delete keyword',
    saveChanges: 'Save changes',
    cancel: 'Cancel',
    confirmDeleteKeyword: 'Delete this keyword from monitoring?',
    keywordAdded: 'Keyword added.',
    export: 'Export',
    openAi: 'OpenAI',
    openAiBillingDashboard: 'Open OpenAI Billing',
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
    autoScan: 'Auto Scan While App Is Open',
    autoScanHelp: 'Optional. Auto scan only runs while this local app is open.',
    autoScanInterval: 'Auto Scan Interval',
    scanOnLaunch: 'Scan When App Opens',
    language: 'Language',
    english: 'English',
    vietnamese: 'Vietnamese',
    readyToCreate: 'Ready to Create',
    trackedResults: 'Tracked Results',
    todayShortlist: "Today's AI Shortlist",
    todayShortlistHelp: 'Only the strongest posts are shown here. Create content now, watch the signal, or inspect the source.',
    newPosts: 'new posts',
    seenPosts: 'posts refreshed',
    whyWorthMaking: 'Why it is worth making',
    productToPromote: 'Product direction',
    suggestedHook: 'Suggested hook',
    pendingAiShortlist: 'Run the AI scan to complete this recommendation.',
    createContent: 'Create Content',
    inspectPost: 'Inspect',
    noShortlistYet: 'No qualified opportunities yet',
    noShortlistHelp: 'Run a scan. AI will filter the raw Threads results into a short action list.',
    keywordIntelligence: 'AI Pain-point Discovery',
    keywordIntelligenceHelp: 'Start from a niche or audience. AI expands it into natural phrases people use when describing problems and buying intent.',
    keywordSeedPlaceholder: 'Example: office women, oily skin, small apartment...',
    suggestingKeywords: 'Generating...',
    addSuggestion: 'Add suggestion',
    excludedKeywords: 'Excluded Terms',
    excludedKeywordsHelp: 'Posts containing these terms are kept out of the AI opportunity shortlist.',
    excludedKeywordPlaceholder: 'Example: politics, recruitment, giveaway...',
    results: 'Results',
    resultsHelp: 'Record real performance after publishing so future AI recommendations can learn from your channel.',
    totalViews: 'Total Views',
    clickRate: 'Click Rate',
    orderConversion: 'Click to Order',
    totalCommission: 'Commission',
    addResult: 'Add Result',
    editResult: 'Edit Result',
    resultFormHelp: 'Update views, clicks, orders, and commission as the video collects data.',
    chooseSourcePost: 'Choose source post',
    productName: 'Product',
    hookUsed: 'Hook used',
    formatUsed: 'Content format',
    views: 'Views',
    clicks: 'Clicks',
    orders: 'Orders',
    revenue: 'Revenue (VND)',
    commission: 'Commission (VND)',
    published: 'Published',
    tracking: 'Tracking',
    winner: 'Winner',
    stopped: 'Stopped',
    note: 'Notes',
    learnedSignals: 'Signals learned from your winners',
    unknownProduct: 'Product not recorded',
    noHookRecorded: 'No hook or format recorded.',
    noResultsYet: 'No performance data yet. Add the first published video above.',
    contentVariants: '3 Content Variants',
    variant: 'Variant',
    hookOpening: 'Opening hook',
    aiDiscovery: 'AI Discovery',
    manualKeyword: 'Add Manually',
    chooseAudience: 'Choose a target audience',
    chooseAudienceHelp: 'Pick a group. AI will mine natural pain-point phrases instead of asking you to guess keywords.',
    refineAudiencePlaceholder: 'Optional: add a narrower situation or product direction...',
    discoverPainPoints: 'Discover Pain Points',
    discoveringKeywords: 'Discovering...',
    expandFromWinners: 'Expand from Winners',
    keywordSuggestions: 'Keyword candidates',
    discoveryEvidence: 'Signals used',
    strongPostsUsed: 'strong posts',
    winnersUsed: 'winning videos',
    addAllSuggestions: 'Add All',
    noNewKeywordSuggestions: 'No new phrases were found outside your current keyword list.',
    manualKeywordHelp: 'Use this only when you already know a specific trend or phrase worth monitoring.',
    addKeyword: 'Add Keyword',
    keywordPortfolio: 'Keyword Portfolio',
    keywordPortfolioHelp: 'Keywords are ranked using fetch yield, AI-qualified posts, product fit and actual affiliate results.',
    potential: 'Potential',
    testing: 'Testing',
    poor: 'Poor',
    audienceSource: 'Audience',
    keywordScore: 'Score',
    disableSuggested: 'Disable',
    scans: 'Scans',
    postsFound: 'Posts found',
    productFitRate: 'Product fit',
    noKeywordsYet: 'No keywords yet. Use AI Discovery or add one manually.',
    sourceManual: 'Manual',
    sourceDefault: 'Starter',
    sourceAiAudience: 'AI Audience',
    sourceAiExpansion: 'AI Expansion'
  },
  vi: {
    opportunityInbox: 'Cơ hội hôm nay',
    scanOpportunities: 'Quét cơ hội mới',
    scanningOpportunities: 'Đang quét các từ khóa...',
    scanOpportunitiesHelp: 'Quét các từ khóa đang bật, đo tốc độ tăng tương tác và dùng AI shortlist bài phù hợp để làm affiliate.',
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
    trendingFeed: 'Khám phá bài viết',
    keywords: 'Từ khóa',
    savedPosts: 'Bài đã lưu',
    settings: 'Cài đặt',
    searchPlaceholder: 'Tìm bài hoặc fetch từ khóa...',
    fetch: 'Fetch',
    postsSorted: 'bài được sắp xếp theo điểm đề xuất affiliate',
    replies: 'Replies',
    noMatchingPosts: 'Không có bài phù hợp.',
    noPostsFound: 'Threads không trả về bài viết cho từ khóa này. Hãy thử từ khóa rộng hơn.',
    keywordMonitoring: 'Theo dõi từ khóa',
    keywordMonitoringHelp: 'Danh sách từ khóa đã lưu để fetch nhanh và dùng cho monitoring tự động sau này. Click từ khóa để fetch ngay; toggle để bật/tắt theo dõi nền.',
    quickActions: 'Thao tác nhanh',
    topOpportunities: 'Bài viết nổi bật',
    latestScanPosts: 'Bài vừa quét',
    latestScanPostsHelp: 'Các bài được fetch trong lần quét gần nhất. Click một bài để mở trong Bài đang hot.',
    researchOverview: 'Tổng quan nghiên cứu',
    totalPosts: 'Bài đang theo dõi',
    analyzedPosts: 'Đã phân tích',
    savedIdeas: 'Idea đã lưu',
    activeKeywords: 'Từ khóa đang bật',
    fetchTrending: 'Fetch bài hot',
    recentSaved: 'Đã lưu gần đây',
    feedResearch: 'Nghiên cứu thủ công: tìm hoặc fetch sâu một từ khóa cụ thể trên Threads.',
    manualImportTitle: 'Phân tích nhanh từ link Threads',
    manualImportHelp: 'Paste bài bạn tự thấy hay khi lướt Threads. Tool sẽ lấy đúng bài viết và chạy cùng luồng phân tích affiliate hiện tại.',
    manualImportPlaceholder: 'https://www.threads.com/@account/post/...',
    manualImport: 'Nhập link & phân tích',
    manualImporting: 'Đang lấy bài...',
    manualImportComplete: 'Đã nhập và phân tích bài Threads.',
    analyze: 'Phân tích',
    savePost: 'Lưu',
    saved: 'Đã lưu',
    postSaved: 'Đã lưu bài viết.',
    postRemovedFromSaved: 'Đã bỏ bài viết khỏi danh sách lưu.',
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
    keywordManagerHelp: 'Quản lý danh sách từ khóa. Bấm Fetch để kéo bài theo từ khóa, toggle để bật/tắt theo dõi nền.',
    enabled: 'Đang bật',
    disabled: 'Đang tắt',
    addKeywordPlaceholder: 'Thêm từ khóa...',
    editKeyword: 'Sửa từ khóa',
    deleteKeyword: 'Xóa từ khóa',
    saveChanges: 'Lưu thay đổi',
    cancel: 'Hủy',
    confirmDeleteKeyword: 'Xóa từ khóa này khỏi danh sách theo dõi?',
    keywordAdded: 'Đã thêm từ khóa.',
    export: 'Export',
    openAi: 'OpenAI',
    openAiBillingDashboard: 'Mở Billing OpenAI',
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
    language: 'Ngôn ngữ',
    english: 'Tiếng Anh',
    vietnamese: 'Tiếng Việt',
    readyToCreate: 'Sẵn sàng làm',
    trackedResults: 'Video có kết quả',
    todayShortlist: 'AI shortlist hôm nay',
    todayShortlistHelp: 'Chỉ giữ các bài đáng hành động. Bạn có thể làm nội dung ngay, theo dõi thêm hoặc mở bài gốc để kiểm tra.',
    newPosts: 'bài mới',
    seenPosts: 'bài được cập nhật',
    whyWorthMaking: 'Vì sao đáng làm',
    productToPromote: 'Hướng sản phẩm',
    suggestedHook: 'Hook đề xuất',
    pendingAiShortlist: 'Quét bằng AI để hoàn thiện đề xuất này.',
    createContent: 'Tạo nội dung',
    inspectPost: 'Xem chi tiết',
    noShortlistYet: 'Chưa có cơ hội đủ tốt',
    noShortlistHelp: 'Bấm quét bài mới. AI sẽ lọc kết quả Threads thô thành một danh sách ngắn có thể hành động.',
    keywordIntelligence: 'AI tìm pain point',
    keywordIntelligenceHelp: 'Nhập một nhóm người hoặc chủ đề. AI sẽ mở rộng thành những cụm từ tự nhiên người Việt dùng khi than phiền, hỏi kinh nghiệm hoặc có ý định mua.',
    keywordSeedPlaceholder: 'Ví dụ: dân công sở nữ, da dầu, phòng trọ nhỏ...',
    suggestingKeywords: 'Đang gợi ý...',
    addSuggestion: 'Thêm từ khóa này',
    excludedKeywords: 'Từ khóa loại trừ',
    excludedKeywordsHelp: 'Bài chứa các cụm từ này sẽ không được đưa vào shortlist cơ hội affiliate.',
    excludedKeywordPlaceholder: 'Ví dụ: chính trị, tuyển dụng, giveaway...',
    results: 'Kết quả',
    resultsHelp: 'Ghi lại hiệu suất thật sau khi đăng để những lần phân tích sau học từ chính kênh của bạn.',
    totalViews: 'Tổng lượt xem',
    clickRate: 'Tỷ lệ click',
    orderConversion: 'Click thành đơn',
    totalCommission: 'Hoa hồng',
    addResult: 'Thêm kết quả',
    editResult: 'Sửa kết quả',
    resultFormHelp: 'Cập nhật lượt xem, click, đơn và hoa hồng khi video có thêm dữ liệu.',
    chooseSourcePost: 'Chọn bài nguồn',
    productName: 'Tên sản phẩm',
    hookUsed: 'Hook đã dùng',
    formatUsed: 'Format nội dung',
    views: 'Lượt xem',
    clicks: 'Lượt click',
    orders: 'Đơn hàng',
    revenue: 'Doanh thu (VND)',
    commission: 'Hoa hồng (VND)',
    published: 'Đã đăng',
    tracking: 'Đang theo dõi',
    winner: 'Video thắng',
    stopped: 'Đã dừng',
    note: 'Ghi chú',
    learnedSignals: 'Tín hiệu học được từ video thắng',
    unknownProduct: 'Chưa ghi sản phẩm',
    noHookRecorded: 'Chưa ghi hook hoặc format.',
    noResultsYet: 'Chưa có dữ liệu hiệu suất. Hãy thêm video đầu tiên sau khi đăng.',
    contentVariants: '3 biến thể nội dung',
    variant: 'Biến thể',
    hookOpening: 'Hook mở đầu',
    aiDiscovery: 'AI tự khám phá',
    manualKeyword: 'Thêm thủ công',
    chooseAudience: 'Chọn nhóm khách hàng',
    chooseAudienceHelp: 'Chọn một nhóm người. AI sẽ đào các cụm pain point tự nhiên thay vì bắt bạn tự đoán từ khóa.',
    refineAudiencePlaceholder: 'Tùy chọn: thêm tình huống hoặc hướng sản phẩm cụ thể...',
    discoverPainPoints: 'Khám phá pain point',
    discoveringKeywords: 'Đang khám phá...',
    expandFromWinners: 'Mở rộng từ dữ liệu thắng',
    keywordSuggestions: 'Từ khóa tiềm năng',
    discoveryEvidence: 'Tín hiệu đã dùng',
    strongPostsUsed: 'bài tốt',
    winnersUsed: 'video có kết quả',
    addAllSuggestions: 'Thêm tất cả',
    noNewKeywordSuggestions: 'AI chưa tìm được cụm mới ngoài danh sách hiện tại.',
    manualKeywordHelp: 'Chỉ dùng khi bạn đã biết một trend hoặc cụm từ cụ thể cần theo dõi.',
    addKeyword: 'Thêm từ khóa',
    keywordPortfolio: 'Danh mục từ khóa',
    keywordPortfolioHelp: 'Từ khóa được đánh giá bằng hiệu suất fetch, bài AI chọn, độ phù hợp sản phẩm và kết quả affiliate thật.',
    potential: 'Tiềm năng',
    testing: 'Đang thử',
    poor: 'Kém hiệu quả',
    audienceSource: 'Nhóm khách hàng',
    keywordScore: 'Điểm',
    disableSuggested: 'Tắt đề xuất',
    scans: 'Lần quét',
    postsFound: 'Bài tìm được',
    productFitRate: 'Có sản phẩm',
    noKeywordsYet: 'Chưa có từ khóa. Hãy dùng AI tự khám phá hoặc thêm thủ công.',
    sourceManual: 'Thủ công',
    sourceDefault: 'Khởi tạo',
    sourceAiAudience: 'AI theo audience',
    sourceAiExpansion: 'AI mở rộng'
  }
};
