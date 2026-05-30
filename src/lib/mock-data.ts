import type { AIAnalysis, Keyword, ThreadsPost } from '@/lib/types';

export const demoPosts: ThreadsPost[] = [
  {
    id: 'demo-low-bridge-glasses',
    author: 'Mina Le',
    authorHandle: '@minafinds',
    content: 'People with low nose bridges always struggle wearing glasses. Every frame slowly slides down like it has somewhere else to be.',
    likes: 18400,
    replies: 912,
    reposts: 3300,
    timestamp: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    imageUrls: [],
    url: 'https://www.threads.net/@minafinds/post/demo-low-bridge-glasses',
    source: 'trending',
    keyword: 'glasses',
    fetchedAt: new Date().toISOString(),
    trendingScore: 91,
    emotionalCategory: 'insecurity'
  },
  {
    id: 'demo-office-neck',
    author: 'Jon Park',
    authorHandle: '@deskday',
    content: 'No one tells you that office work is mostly neck pain, dry eyes, and pretending the chair is comfortable.',
    likes: 9800,
    replies: 680,
    reposts: 2100,
    timestamp: new Date(Date.now() - 1000 * 60 * 78).toISOString(),
    imageUrls: [],
    url: 'https://www.threads.net/@deskday/post/demo-office-neck',
    source: 'keyword',
    keyword: 'office problems',
    fetchedAt: new Date().toISOString(),
    trendingScore: 84,
    emotionalCategory: 'frustration'
  },
  {
    id: 'demo-skincare',
    author: 'Ava Cho',
    authorHandle: '@skinnotes',
    content: 'The worst part about trying new skincare is not knowing whether it is purging, irritation, or your face filing a complaint.',
    likes: 7200,
    replies: 534,
    reposts: 1450,
    timestamp: new Date(Date.now() - 1000 * 60 * 130).toISOString(),
    imageUrls: [],
    url: 'https://www.threads.net/@skinnotes/post/demo-skincare',
    source: 'keyword',
    keyword: 'skincare',
    fetchedAt: new Date().toISOString(),
    trendingScore: 78,
    emotionalCategory: 'anxiety'
  }
];

export const demoAnalysis: Record<string, AIAnalysis> = {
  'demo-low-bridge-glasses': {
    postId: 'demo-low-bridge-glasses',
    emotion: 'insecurity',
    painPoint: 'glasses slipping and making the wearer feel self-conscious',
    buyingIntent: 'high',
    affiliateCategories: ['eyewear accessories', 'beauty comfort', 'daily carry'],
    affiliateProducts: ['anti-slip glasses hooks', 'adhesive nose pads', 'lightweight acetate frames'],
    contentAngle: 'relatable struggle with a simple fix',
    whyViral: 'The post names a specific physical frustration that many people recognize but rarely see described directly.',
    hooks: ['Low nose bridge? Your glasses are not the problem.', 'This tiny glasses fix saves so much adjusting.'],
    ctas: ['People with low nose bridges need this.', 'Try this before buying another frame.'],
    relatabilityScore: 92,
    controversyScore: 18,
    createdAt: new Date().toISOString()
  },
  'demo-office-neck': {
    postId: 'demo-office-neck',
    emotion: 'fatigue',
    painPoint: 'desk posture discomfort and dry eyes during long workdays',
    buyingIntent: 'medium',
    affiliateCategories: ['ergonomics', 'office wellness', 'productivity'],
    affiliateProducts: ['laptop stand', 'memory foam seat cushion', 'blue light desk lamp'],
    contentAngle: 'workday survival kit',
    whyViral: 'It compresses several common office annoyances into one punchy observation.',
    hooks: ['Your desk setup is why your neck hurts.', 'Three quiet upgrades for anyone sitting all day.'],
    ctas: ['Fix the setup before blaming your schedule.', 'Start with the one desk item you use most.'],
    relatabilityScore: 88,
    controversyScore: 12,
    createdAt: new Date().toISOString()
  }
};

export const defaultKeywords: Keyword[] = [
  { id: 'kw-skincare', phrase: 'skincare', enabled: true, cadenceMinutes: 90 },
  { id: 'kw-office', phrase: 'office problems', enabled: true, cadenceMinutes: 120 },
  { id: 'kw-beauty', phrase: 'beauty insecurity', enabled: true, cadenceMinutes: 120 },
  { id: 'kw-dating', phrase: 'dating', enabled: false, cadenceMinutes: 180 },
  { id: 'kw-glasses', phrase: 'glasses', enabled: true, cadenceMinutes: 90 },
  { id: 'kw-sleep', phrase: 'sleep', enabled: false, cadenceMinutes: 180 },
  { id: 'kw-productivity', phrase: 'productivity', enabled: true, cadenceMinutes: 180 }
];
