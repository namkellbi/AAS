import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import path from 'node:path';
import { analyzeAffiliateOpportunity, testOpenAIConnection } from '@/server/ai/affiliateAnalysisService';
import {
  addKeyword,
  getAnalysis,
  getAppSettings,
  getDb,
  listKeywords,
  listPosts,
  listSavedPosts,
  savePost,
  setAllowDemoMode,
  setOpenAiApiKey,
  setSetting,
  setKeywordEnabled
} from '@/server/db/client';
import { exportSavedIdeas } from '@/server/services/exportService';
import { fetchAndStoreThreads } from '@/server/services/fetchService';
import { getThreadsLoginStatus, openThreadsLoginSession } from '@/server/scraper/threadsScraper';
import type { FetchRequest, ThreadsPost, UpdateSettingsRequest } from '@/lib/types';

const isDev = !app.isPackaged;
const shouldOpenDevTools = process.env.OPEN_DEVTOOLS === '1';
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#0b0d10',
    titleBarStyle: 'hiddenInset',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    if (shouldOpenDevTools) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'out', 'index.html'));
  }
}

function registerIpc() {
  ipcMain.handle('threads:fetch', async (_event, request: FetchRequest) => fetchAndStoreThreads(request));
  ipcMain.handle('threads:login', async () => openThreadsLoginSession());
  ipcMain.handle('ai:analyze-post', async (_event, post: ThreadsPost) => analyzeAffiliateOpportunity(post));
  ipcMain.handle('posts:list', async () => listPosts());
  ipcMain.handle('analysis:get', async (_event, postId: string) => getAnalysis(postId));
  ipcMain.handle('posts:save', async (_event, postId: string, collection: string, tags: string[]) => savePost(postId, collection, tags));
  ipcMain.handle('posts:saved', async () => listSavedPosts());
  ipcMain.handle('keywords:add', async (_event, phrase: string) => addKeyword(phrase));
  ipcMain.handle('keywords:list', async () => listKeywords());
  ipcMain.handle('keywords:set-enabled', async (_event, id: string, enabled: boolean) => setKeywordEnabled(id, enabled));
  ipcMain.handle('ideas:export', async () => exportSavedIdeas());
  ipcMain.handle('settings:get', async () => getAppSettings());
  ipcMain.handle('settings:update', async (_event, settings: UpdateSettingsRequest) => {
    const apiKey = normalizeOpenAiApiKey(settings.openAiApiKey);
    if (apiKey) setOpenAiApiKey(apiKey);
    if (typeof settings.openAiModel === 'string' && settings.openAiModel.trim()) setSetting('openai.model', settings.openAiModel.trim());
    if (settings.language === 'en' || settings.language === 'vi') setSetting('app.language', settings.language);
    if (typeof settings.allowDemoMode === 'boolean') setAllowDemoMode(settings.allowDemoMode);
    return getAppSettings();
  });
  ipcMain.handle('ai:test', async () => testOpenAIConnection());
  ipcMain.handle('threads:login-status', async () => getThreadsLoginStatus());
  ipcMain.handle('shell:open-post-external', async (_event, post: ThreadsPost) => {
    if (!/^https:\/\/(www\.)?threads\.(com|net)\/@[A-Za-z0-9._]+\/post\/[A-Za-z0-9_-]+/.test(post.url)) {
      return { ok: false, message: 'This saved post does not have a permalink. Fetch the keyword again to refresh it.' };
    }

    await shell.openExternal(post.url);
    return { ok: true, message: 'Opening Threads post.' };
  });
}

app.whenReady().then(() => {
  getDb();
  registerIpc();
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function normalizeOpenAiApiKey(value: unknown) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().replace(/^["']|["']$/g, '');
  if (!trimmed) return '';

  const assignment = trimmed.match(/OPENAI_API_KEY\s*=\s*["']?([^"'\s]+)["']?/i);
  if (assignment?.[1]) return assignment[1].trim();

  const key = trimmed.match(/(?:sk|sess)-[A-Za-z0-9_\-]+/);
  return key?.[0] ?? trimmed;
}
