import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopAPI, FetchRequest, ThreadsPost } from '@/lib/types';

const api: DesktopAPI = {
  fetchThreads: (request: FetchRequest) => ipcRenderer.invoke('threads:fetch', request),
  scanOpportunities: () => ipcRenderer.invoke('opportunities:scan'),
  analyzePost: (post: ThreadsPost) => ipcRenderer.invoke('ai:analyze-post', post),
  getPosts: () => ipcRenderer.invoke('posts:list'),
  getAnalysis: (postId: string) => ipcRenderer.invoke('analysis:get', postId),
  savePost: (postId: string, collection: string, tags: string[]) => ipcRenderer.invoke('posts:save', postId, collection, tags),
  unsavePost: (postId: string, collection: string) => ipcRenderer.invoke('posts:unsave', postId, collection),
  getSavedPosts: () => ipcRenderer.invoke('posts:saved'),
  addKeyword: (phrase: string) => ipcRenderer.invoke('keywords:add', phrase),
  getKeywords: () => ipcRenderer.invoke('keywords:list'),
  setKeywordEnabled: (id: string, enabled: boolean) => ipcRenderer.invoke('keywords:set-enabled', id, enabled),
  updateKeyword: (id: string, phrase: string) => ipcRenderer.invoke('keywords:update', id, phrase),
  deleteKeyword: (id: string) => ipcRenderer.invoke('keywords:delete', id),
  exportIdeas: () => ipcRenderer.invoke('ideas:export'),
  openThreadsLogin: () => ipcRenderer.invoke('threads:login'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  testOpenAI: () => ipcRenderer.invoke('ai:test'),
  getThreadsLoginStatus: () => ipcRenderer.invoke('threads:login-status'),
  openPostExternal: (post: ThreadsPost) => ipcRenderer.invoke('shell:open-post-external', post),
  renderVideoDraft: (request) => ipcRenderer.invoke('video:render-draft', request),
  onVideoDraftProgress: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: Parameters<typeof listener>[0]) => listener(progress);
    ipcRenderer.on('video:render-progress', handler);
    return () => ipcRenderer.removeListener('video:render-progress', handler);
  },
  openVideoOutputFolder: (filePath) => ipcRenderer.invoke('video:open-output-folder', filePath)
};

contextBridge.exposeInMainWorld('desktopAPI', api);
