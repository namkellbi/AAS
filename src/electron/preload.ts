import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopAPI, FetchRequest, ThreadsPost } from '@/lib/types';

const api: DesktopAPI = {
  fetchThreads: (request: FetchRequest) => ipcRenderer.invoke('threads:fetch', request),
  analyzePost: (post: ThreadsPost) => ipcRenderer.invoke('ai:analyze-post', post),
  getPosts: () => ipcRenderer.invoke('posts:list'),
  getAnalysis: (postId: string) => ipcRenderer.invoke('analysis:get', postId),
  savePost: (postId: string, collection: string, tags: string[]) => ipcRenderer.invoke('posts:save', postId, collection, tags),
  getSavedPosts: () => ipcRenderer.invoke('posts:saved'),
  addKeyword: (phrase: string) => ipcRenderer.invoke('keywords:add', phrase),
  getKeywords: () => ipcRenderer.invoke('keywords:list'),
  setKeywordEnabled: (id: string, enabled: boolean) => ipcRenderer.invoke('keywords:set-enabled', id, enabled),
  exportIdeas: () => ipcRenderer.invoke('ideas:export'),
  openThreadsLogin: () => ipcRenderer.invoke('threads:login'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  testOpenAI: () => ipcRenderer.invoke('ai:test'),
  getThreadsLoginStatus: () => ipcRenderer.invoke('threads:login-status'),
  openPostExternal: (post: ThreadsPost) => ipcRenderer.invoke('shell:open-post-external', post)
};

contextBridge.exposeInMainWorld('desktopAPI', api);
