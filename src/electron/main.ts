import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import type { OpenDialogOptions } from 'electron';
import path from 'node:path';
import { analyzeAffiliateOpportunity, testOpenAIConnection } from '@/server/ai/affiliateAnalysisService';
import {
  addKeyword,
  deleteKeyword,
  getAnalysis,
  getAppSettings,
  getDb,
  listKeywords,
  listPosts,
  listSavedPosts,
  savePost,
  setElevenLabsApiKey,
  unsavePost,
  setAllowDemoMode,
  setOpenAiApiKey,
  setSetting,
  setKeywordEnabled,
  updateKeyword
} from '@/server/db/client';
import { exportSavedIdeas } from '@/server/services/exportService';
import { fetchAndStoreThreads } from '@/server/services/fetchService';
import { scanOpportunityInbox } from '@/server/services/opportunityScanService';
import { getThreadsLoginStatus, openThreadsLoginSession } from '@/server/scraper/threadsScraper';
import { renderVideoDraft } from '@/server/video/videoDraftService';
import type { FetchRequest, ThreadsPost, UpdateSettingsRequest, VideoDraftRequest } from '@/lib/types';

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
  ipcMain.handle('opportunities:scan', async () => scanOpportunityInbox());
  ipcMain.handle('threads:login', async () => openThreadsLoginSession());
  ipcMain.handle('ai:analyze-post', async (_event, post: ThreadsPost) => analyzeAffiliateOpportunity(post));
  ipcMain.handle('posts:list', async () => listPosts());
  ipcMain.handle('analysis:get', async (_event, postId: string) => getAnalysis(postId));
  ipcMain.handle('posts:save', async (_event, postId: string, collection: string, tags: string[]) => savePost(postId, collection, tags));
  ipcMain.handle('posts:unsave', async (_event, postId: string, collection: string) => unsavePost(postId, collection));
  ipcMain.handle('posts:saved', async () => listSavedPosts());
  ipcMain.handle('keywords:add', async (_event, phrase: string) => addKeyword(phrase));
  ipcMain.handle('keywords:list', async () => listKeywords());
  ipcMain.handle('keywords:set-enabled', async (_event, id: string, enabled: boolean) => setKeywordEnabled(id, enabled));
  ipcMain.handle('keywords:update', async (_event, id: string, phrase: string) => updateKeyword(id, phrase));
  ipcMain.handle('keywords:delete', async (_event, id: string) => deleteKeyword(id));
  ipcMain.handle('ideas:export', async () => exportSavedIdeas());
  ipcMain.handle('settings:get', async () => getAppSettings());
  ipcMain.handle('settings:update', async (_event, settings: UpdateSettingsRequest) => {
    const apiKey = normalizeOpenAiApiKey(settings.openAiApiKey);
    if (apiKey) setOpenAiApiKey(apiKey);
    if (typeof settings.openAiModel === 'string' && settings.openAiModel.trim()) setSetting('openai.model', settings.openAiModel.trim());
    if (typeof settings.elevenLabsApiKey === 'string' && settings.elevenLabsApiKey.trim()) setElevenLabsApiKey(settings.elevenLabsApiKey.trim());
    if (typeof settings.elevenLabsVoiceId === 'string' && settings.elevenLabsVoiceId.trim()) setSetting('elevenlabs.voice_id', settings.elevenLabsVoiceId.trim());
    if (settings.language === 'en' || settings.language === 'vi') setSetting('app.language', settings.language);
    if (typeof settings.allowDemoMode === 'boolean') setAllowDemoMode(settings.allowDemoMode);
    if (typeof settings.autoScanEnabled === 'boolean') setSetting('app.auto_scan_enabled', String(settings.autoScanEnabled));
    if (typeof settings.autoScanMinutes === 'number' && settings.autoScanMinutes >= 15) setSetting('app.auto_scan_minutes', String(Math.round(settings.autoScanMinutes)));
    if (typeof settings.scanOnLaunch === 'boolean') setSetting('app.scan_on_launch', String(settings.scanOnLaunch));
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
  ipcMain.handle('video:render-draft', async (_event, request: VideoDraftRequest) => {
    const sendProgress = (percent: number, message: string) => _event.sender.send('video:render-progress', { percent, message });
    sendProgress(5, 'Chọn clip nền retention...');
    const backgroundPath = await pickVideoFile('Select an authorized retention background clip');
    if (!backgroundPath) return { ok: false, message: 'Video draft cancelled before selecting the background clip.' };
    sendProgress(12, 'Chọn clip demo sản phẩm...');
    const demoPath = await pickVideoFile('Select an authorized product demo clip');
    if (!demoPath) return { ok: false, message: 'Video draft cancelled before selecting the product demo clip.' };

    const result = await renderVideoDraft({ ...request, backgroundPath, demoPath }, (progress) => _event.sender.send('video:render-progress', progress));
    return result;
  });
  ipcMain.handle('video:open-output-folder', async (_event, filePath: string) => {
    if (!filePath || !path.isAbsolute(filePath)) return { ok: false, message: 'Video output path is invalid.' };
    shell.showItemInFolder(filePath);
    return { ok: true, message: 'Opening video output folder.' };
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

async function pickVideoFile(title: string) {
  const options: OpenDialogOptions = {
    title,
    properties: ['openFile'],
    filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'm4v', 'webm'] }]
  };
  const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);
  return result.canceled ? undefined : result.filePaths[0];
}
