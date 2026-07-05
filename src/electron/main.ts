import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import type { OpenDialogOptions } from 'electron';
import path from 'node:path';
import { analyzeAffiliateOpportunity, testOpenAIConnection } from '@/server/ai/affiliateAnalysisService';
import { discoverAffiliateKeywords } from '@/server/ai/keywordIntelligenceService';
import {
  addKeywordExclusion,
  addKeyword,
  checkDailyQuota,
  deleteKeywordExclusion,
  deleteKeyword,
  deleteProduct,
  deleteUploadLog,
  getAnalysis,
  getAppSettings,
  getAsset,
  getDb,
  getProduct,
  getUsageSummary,
  listKeywords,
  listKeywordExclusions,
  listKeywordInsights,
  listAnalyses,
  listPosts,
  listProducts,
  listSavedPosts,
  listUploadLogs,
  markAssetUsed,
  savePost,
  saveProduct,
  saveUploadLog,
  unsavePost,
  setOpenAiApiKey,
  setReadinessThresholds,
  setSetting,
  setKeywordEnabled,
  setTtsInstructions,
  updateKeyword,
  updatePricing,
} from '@/server/db/client';
import { exportSavedIdeas } from '@/server/services/exportService';
import { createVideoFromLink } from '@/server/services/createFromLinkService';
import { fetchAndStoreThreads, importAndStoreThreadsPost, refreshPostReplies } from '@/server/services/fetchService';
import { scanOpportunityInbox } from '@/server/services/opportunityScanService';
import { getThreadsLoginStatus, openThreadsLoginSession } from '@/server/scraper/threadsScraper';
import { renderVideoDraft } from '@/server/video/videoDraftService';
import { deleteRegisteredAsset, listAssetsWithThumbnails, registerAsset } from '@/server/services/assetLibraryService';
import type { AssetType, ContentGoal, FetchRequest, KeywordDiscoveryRequest, Product, QuotaBlockedResult, ThreadsPost, UpdateSettingsRequest, UploadLogEntry, VideoDraftRequest } from '@/lib/types';

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
  ipcMain.handle('threads:import-post', async (_event, url: string) => importAndStoreThreadsPost(url));
  ipcMain.handle('threads:fetch-post-replies', async (_event, post: ThreadsPost) => refreshPostReplies(post));
  ipcMain.handle('opportunities:scan', async (_event, goal?: ContentGoal, options?: { confirmOverQuota?: boolean }) => {
    const blocked = quotaBlock(options);
    if (blocked) return blocked;
    return scanOpportunityInbox((progress) => _event.sender.send('opportunities:scan-progress', progress), goal === 'engagement' ? 'engagement' : 'affiliate');
  });
  ipcMain.handle('workflow:create-from-link', async (_event, url: string, options?: { confirmOverQuota?: boolean }) => {
    const blocked = quotaBlock(options);
    if (blocked) return blocked;
    return createVideoFromLink(url, (progress) => _event.sender.send('workflow:create-from-link-progress', progress));
  });
  ipcMain.handle('threads:login', async () => openThreadsLoginSession());
  ipcMain.handle('ai:analyze-post', async (_event, post: ThreadsPost, goal?: ContentGoal, options?: { confirmOverQuota?: boolean }) => {
    const blocked = quotaBlock(options);
    if (blocked) return blocked;
    return analyzeAffiliateOpportunity(post, goal === 'engagement' ? 'engagement' : 'affiliate');
  });
  ipcMain.handle('posts:list', async () => listPosts());
  ipcMain.handle('analysis:get', async (_event, postId: string) => getAnalysis(postId));
  ipcMain.handle('analysis:list', async () => listAnalyses());
  ipcMain.handle('posts:save', async (_event, postId: string, collection: string, tags: string[]) => savePost(postId, collection, tags));
  ipcMain.handle('posts:unsave', async (_event, postId: string, collection: string) => unsavePost(postId, collection));
  ipcMain.handle('posts:saved', async () => listSavedPosts());
  ipcMain.handle('keywords:add', async (_event, request: { phrase: string; source?: 'manual' | 'default' | 'ai_audience' | 'ai_expansion'; seedAudience?: string }) => addKeyword(request));
  ipcMain.handle('keywords:list', async () => listKeywords());
  ipcMain.handle('keywords:insights', async () => listKeywordInsights());
  ipcMain.handle('keywords:set-enabled', async (_event, id: string, enabled: boolean) => setKeywordEnabled(id, enabled));
  ipcMain.handle('keywords:update', async (_event, id: string, phrase: string) => updateKeyword(id, phrase));
  ipcMain.handle('keywords:delete', async (_event, id: string) => deleteKeyword(id));
  ipcMain.handle('keywords:discover', async (_event, request: KeywordDiscoveryRequest) => discoverAffiliateKeywords(request));
  ipcMain.handle('keywords:exclusions', async () => listKeywordExclusions());
  ipcMain.handle('keywords:exclusions-add', async (_event, phrase: string) => addKeywordExclusion(phrase));
  ipcMain.handle('keywords:exclusions-delete', async (_event, id: string) => deleteKeywordExclusion(id));
  ipcMain.handle('ideas:export', async () => exportSavedIdeas());
  ipcMain.handle('settings:get', async () => getAppSettings());
  ipcMain.handle('settings:update', async (_event, settings: UpdateSettingsRequest) => {
    const apiKey = normalizeOpenAiApiKey(settings.openAiApiKey);
    if (apiKey) setOpenAiApiKey(apiKey);
    if (typeof settings.openAiModel === 'string' && settings.openAiModel.trim()) setSetting('openai.model', settings.openAiModel.trim());
    if (settings.language === 'en' || settings.language === 'vi') setSetting('app.language', settings.language);
    if (typeof settings.autoScanEnabled === 'boolean') setSetting('app.auto_scan_enabled', String(settings.autoScanEnabled));
    if (typeof settings.autoScanMinutes === 'number' && settings.autoScanMinutes >= 15) setSetting('app.auto_scan_minutes', String(Math.round(settings.autoScanMinutes)));
    if (typeof settings.scanOnLaunch === 'boolean') setSetting('app.scan_on_launch', String(settings.scanOnLaunch));
    if (typeof settings.tiktokChannelName === 'string') setSetting('video.tiktok_channel_name', settings.tiktokChannelName.trim());
    if (settings.defaultVoice === 'onyx' || settings.defaultVoice === 'nova' || settings.defaultVoice === 'shimmer') setSetting('video.default_voice', settings.defaultVoice);
    if (typeof settings.defaultSpeed === 'number' && settings.defaultSpeed >= 0.9 && settings.defaultSpeed <= 1.3) setSetting('video.default_speed', String(settings.defaultSpeed));
    if (typeof settings.transitionSoundEnabled === 'boolean') setSetting('video.transition_sound_enabled', String(settings.transitionSoundEnabled));
    if (typeof settings.postAgeHours === 'number' && settings.postAgeHours >= 1) setSetting('scraper.post_age_hours', String(Math.round(settings.postAgeHours)));
    if (settings.ttsInstructions && typeof settings.ttsInstructions === 'object') setTtsInstructions(settings.ttsInstructions);
    if (typeof settings.segmentSilenceMs === 'number' && Number.isFinite(settings.segmentSilenceMs)) setSetting('video.segment_silence_ms', String(Math.round(Math.min(Math.max(settings.segmentSilenceMs, 0), 1500))));
    if (typeof settings.karaokeCaptionsEnabled === 'boolean') setSetting('video.karaoke_captions_enabled', String(settings.karaokeCaptionsEnabled));
    if (settings.scanGoal === 'engagement' || settings.scanGoal === 'affiliate') setSetting('app.scan_goal', settings.scanGoal);
    if (settings.readinessThresholds && typeof settings.readinessThresholds === 'object') setReadinessThresholds(settings.readinessThresholds);
    if (typeof settings.dailyCostLimitUsd === 'number' && Number.isFinite(settings.dailyCostLimitUsd) && settings.dailyCostLimitUsd >= 0) setSetting('costs.daily_limit_usd', String(settings.dailyCostLimitUsd));
    if (settings.pricing && typeof settings.pricing === 'object') updatePricing(settings.pricing);
    return getAppSettings();
  });
  ipcMain.handle('ai:test', async () => testOpenAIConnection());
  ipcMain.handle('shell:open-openai-billing', async () => {
    await shell.openExternal('https://platform.openai.com/settings/organization/billing/overview');
    return { ok: true, message: 'Opening OpenAI Billing dashboard.' };
  });
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
    const backgroundPath = request.backgroundPath || await pickVideoFile('Select an authorized retention background clip');
    if (!backgroundPath) return { ok: false, message: 'Video draft cancelled before selecting the background clip.' };
    sendProgress(12, 'Chuẩn bị clip demo sản phẩm nếu có...');
    const matchedProduct = request.analysis.matchedProductId ? getProduct(request.analysis.matchedProductId) : null;
    let demoPath = request.productClipPath;
    if (!demoPath && matchedProduct?.demoAssetId) {
      const demoAsset = getAsset(matchedProduct.demoAssetId);
      if (demoAsset) demoPath = demoAsset.filePath;
    }

    const result = await renderVideoDraft({ ...request, backgroundPath, demoPath, product: matchedProduct ?? undefined }, (progress) => _event.sender.send('video:render-progress', progress));
    markAssetUsed(backgroundPath);
    markAssetUsed(demoPath);
    return result;
  });
  ipcMain.handle('video:open-output-folder', async (_event, filePath: string) => {
    if (!filePath || !path.isAbsolute(filePath)) return { ok: false, message: 'Video output path is invalid.' };
    const exportsDir = path.resolve(process.cwd(), 'data', 'video-exports');
    if (!path.resolve(filePath).startsWith(exportsDir)) return { ok: false, message: 'Video output must be inside the local exports folder.' };
    shell.showItemInFolder(filePath);
    return { ok: true, message: 'Opening video output folder.' };
  });
  ipcMain.handle('assets:list', async () => listAssetsWithThumbnails());
  ipcMain.handle('assets:add', async (_event, type: AssetType) => {
    const filePath = await pickVideoFile(type === 'background' ? 'Select background clip' : 'Select product demo clip');
    return filePath ? registerAsset(type, filePath) : null;
  });
  ipcMain.handle('assets:delete', async (_event, id: string) => deleteRegisteredAsset(id));
  ipcMain.handle('assets:open-preview', async (_event, id: string) => {
    const asset = getAsset(id);
    if (!asset || !path.isAbsolute(asset.filePath)) return { ok: false, message: 'Clip không tồn tại.' };
    const error = await shell.openPath(asset.filePath);
    return error ? { ok: false, message: error } : { ok: true, message: 'Đang mở preview clip.' };
  });
  ipcMain.handle('upload-log:list', async () => listUploadLogs());
  ipcMain.handle('upload-log:save', async (_event, entry: UploadLogEntry) => saveUploadLog(entry));
  ipcMain.handle('upload-log:delete', async (_event, id: string) => deleteUploadLog(id));
  ipcMain.handle('products:list', async () => listProducts());
  ipcMain.handle('products:save', async (_event, product: Product) => saveProduct(product));
  ipcMain.handle('products:delete', async (_event, id: string) => deleteProduct(id));
  ipcMain.handle('usage:summary', async () => getUsageSummary());
}

function quotaBlock(options?: { confirmOverQuota?: boolean }): QuotaBlockedResult | null {
  if (options?.confirmOverQuota) return null;
  const quota = checkDailyQuota();
  return quota.exceeded ? { quotaExceeded: true, todayUsd: quota.todayUsd, limitUsd: quota.limitUsd } : null;
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
