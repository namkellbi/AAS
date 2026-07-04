import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopAPI, FetchRequest, ThreadsPost } from '@/lib/types';

const api: DesktopAPI = {
  fetchThreads: (request: FetchRequest) => ipcRenderer.invoke('threads:fetch', request),
  importThreadsPost: (url: string) => ipcRenderer.invoke('threads:import-post', url),
  fetchPostReplies: (post: ThreadsPost) => ipcRenderer.invoke('threads:fetch-post-replies', post),
  scanOpportunities: () => ipcRenderer.invoke('opportunities:scan'),
  onOpportunityScanProgress: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: Parameters<typeof listener>[0]) => listener(progress);
    ipcRenderer.on('opportunities:scan-progress', handler);
    return () => ipcRenderer.removeListener('opportunities:scan-progress', handler);
  },
  analyzePost: (post: ThreadsPost) => ipcRenderer.invoke('ai:analyze-post', post),
  getPosts: () => ipcRenderer.invoke('posts:list'),
  getAnalysis: (postId: string) => ipcRenderer.invoke('analysis:get', postId),
  getAnalyses: () => ipcRenderer.invoke('analysis:list'),
  savePost: (postId: string, collection: string, tags: string[]) => ipcRenderer.invoke('posts:save', postId, collection, tags),
  unsavePost: (postId: string, collection: string) => ipcRenderer.invoke('posts:unsave', postId, collection),
  getSavedPosts: () => ipcRenderer.invoke('posts:saved'),
  addKeyword: (request) => ipcRenderer.invoke('keywords:add', request),
  getKeywords: () => ipcRenderer.invoke('keywords:list'),
  getKeywordInsights: () => ipcRenderer.invoke('keywords:insights'),
  setKeywordEnabled: (id: string, enabled: boolean) => ipcRenderer.invoke('keywords:set-enabled', id, enabled),
  updateKeyword: (id: string, phrase: string) => ipcRenderer.invoke('keywords:update', id, phrase),
  deleteKeyword: (id: string) => ipcRenderer.invoke('keywords:delete', id),
  discoverKeywords: (request) => ipcRenderer.invoke('keywords:discover', request),
  getKeywordExclusions: () => ipcRenderer.invoke('keywords:exclusions'),
  addKeywordExclusion: (phrase: string) => ipcRenderer.invoke('keywords:exclusions-add', phrase),
  deleteKeywordExclusion: (id: string) => ipcRenderer.invoke('keywords:exclusions-delete', id),
  exportIdeas: () => ipcRenderer.invoke('ideas:export'),
  openThreadsLogin: () => ipcRenderer.invoke('threads:login'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  testOpenAI: () => ipcRenderer.invoke('ai:test'),
  openOpenAiBilling: () => ipcRenderer.invoke('shell:open-openai-billing'),
  getThreadsLoginStatus: () => ipcRenderer.invoke('threads:login-status'),
  openPostExternal: (post: ThreadsPost) => ipcRenderer.invoke('shell:open-post-external', post),
  renderVideoDraft: (request) => ipcRenderer.invoke('video:render-draft', request),
  onVideoDraftProgress: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: Parameters<typeof listener>[0]) => listener(progress);
    ipcRenderer.on('video:render-progress', handler);
    return () => ipcRenderer.removeListener('video:render-progress', handler);
  },
  openVideoOutputFolder: (filePath) => ipcRenderer.invoke('video:open-output-folder', filePath),
  getAssets: () => ipcRenderer.invoke('assets:list'),
  addAsset: (type) => ipcRenderer.invoke('assets:add', type),
  deleteAsset: (id) => ipcRenderer.invoke('assets:delete', id),
  openAssetPreview: (id) => ipcRenderer.invoke('assets:open-preview', id),
  getUploadLogs: () => ipcRenderer.invoke('upload-log:list'),
  saveUploadLog: (entry) => ipcRenderer.invoke('upload-log:save', entry),
  deleteUploadLog: (id) => ipcRenderer.invoke('upload-log:delete', id)
};

contextBridge.exposeInMainWorld('desktopAPI', api);
