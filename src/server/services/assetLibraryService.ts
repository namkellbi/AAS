import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { addAsset, deleteAsset, listAssets } from '@/server/db/client';
import type { AssetLibraryItem, AssetType, GeneratedVideoItem } from '@/lib/types';

const videoExtensions = new Set(['.mp4', '.mov', '.m4v', '.webm']);

export async function registerAsset(type: AssetType, filePath: string, label?: string) {
  const asset = addAsset(type, filePath, await probeDuration(filePath), label);
  return withThumbnail(asset);
}

export async function syncBackgroundAssetsFromResources() {
  const resourcesDir = path.resolve(process.cwd(), 'data', 'video-resources');
  fs.mkdirSync(resourcesDir, { recursive: true });
  const files = fs
    .readdirSync(resourcesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && videoExtensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(resourcesDir, entry.name))
    .sort((left, right) => left.localeCompare(right));
  await Promise.all(
    files.map(async (filePath) => {
      // A stable, recognizable label prevents the displayed name from moving
      // to another clip when files are added or renamed.
      const label = path.basename(filePath);
      try {
        await registerAsset('background', filePath, label);
      } catch {
        addAsset('background', filePath, 0, label);
      }
    })
  );
}

export async function listAssetsWithThumbnails() {
  await syncBackgroundAssetsFromResources();
  return Promise.all(listAssets().map(withThumbnail));
}

export function deleteRegisteredAsset(id: string) {
  deleteAsset(id);
  fs.rmSync(thumbnailPath(id), { force: true });
}

export function listGeneratedVideos(): GeneratedVideoItem[] {
  const exportsDir = path.resolve(process.cwd(), 'data', 'video-exports');
  if (!fs.existsSync(exportsDir)) return [];

  return findFinalVideos(exportsDir)
    .map((filePath) => {
      const stats = fs.statSync(filePath);
      const relativeDir = path.dirname(path.relative(exportsDir, filePath));
      const label = relativeDir.split(path.sep).filter(Boolean).join(' · ') || path.basename(filePath);
      const info = readExportInfo(filePath);
      const postId = info.postId ?? relativeDir.split(path.sep).filter(Boolean)[0] ?? '';
      const previewPath = isLegacyFinalVideo(filePath)
        ? path.join(path.dirname(filePath), 'thumbnails', 'thumb_002.jpg')
        : path.join(path.dirname(filePath), '_work', 'thumbnails', 'thumb_002.jpg');
      const review = readVideoReview(filePath);
      const publish = readVideoPublish(filePath);
      return {
        id: crypto.createHash('sha1').update(filePath).digest('hex'),
        postId,
        label,
        filePath,
        createdAt: stats.mtime.toISOString(),
        sizeBytes: stats.size,
        reviewStatus: review.approvedAt ? 'approved' as const : 'pending' as const,
        approvedAt: review.approvedAt,
        publishStatus: publish.status ?? 'not_published',
        publishedUrl: publish.publishedUrl,
        publishCaption: publish.caption ?? readDefaultCaption(filePath),
        publishError: publish.error,
        thumbnailDataUrl: fs.existsSync(previewPath) ? `data:image/jpeg;base64,${fs.readFileSync(previewPath).toString('base64')}` : undefined
      };
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function setGeneratedVideoPublishState(filePath: string, state: { status: GeneratedVideoItem['publishStatus']; caption?: string; publishedUrl?: string; error?: string }) {
  const resolved = assertGeneratedVideoPath(filePath);
  const metadataPath = publishPath(resolved);
  fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
  fs.writeFileSync(metadataPath, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
}

export function deleteGeneratedVideo(filePath: string) {
  const resolved = assertGeneratedVideoPath(filePath);
  fs.rmSync(resolved, { force: true });
  fs.rmSync(reviewPath(resolved), { force: true });
}

export function setGeneratedVideoApproved(filePath: string, approved: boolean) {
  const resolved = assertGeneratedVideoPath(filePath);
  if (approved) fs.writeFileSync(reviewPath(resolved), JSON.stringify({ approvedAt: new Date().toISOString() }, null, 2), 'utf8');
  else fs.rmSync(reviewPath(resolved), { force: true });
  return listGeneratedVideos();
}

function reviewPath(filePath: string) {
  return isLegacyFinalVideo(filePath)
    ? path.join(path.dirname(filePath), 'review-status.json')
    : path.join(path.dirname(filePath), '_work', `${path.basename(filePath, path.extname(filePath))}.review.json`);
}

function publishPath(filePath: string) {
  return isLegacyFinalVideo(filePath)
    ? path.join(path.dirname(filePath), 'publish-status.json')
    : path.join(path.dirname(filePath), '_work', `${path.basename(filePath, path.extname(filePath))}.publish.json`);
}

function readVideoPublish(filePath: string): { status?: GeneratedVideoItem['publishStatus']; caption?: string; publishedUrl?: string; error?: string } {
  try {
    return JSON.parse(fs.readFileSync(publishPath(filePath), 'utf8'));
  } catch {
    return {};
  }
}

function readDefaultCaption(filePath: string) {
  try {
    const metadataPath = isLegacyFinalVideo(filePath)
      ? path.join(path.dirname(filePath), 'tiktok-metadata.json')
      : path.join(path.dirname(filePath), '_work', 'tiktok-metadata.json');
    const value = JSON.parse(fs.readFileSync(metadataPath, 'utf8')) as { caption_variants?: unknown };
    const caption = Array.isArray(value.caption_variants) && typeof value.caption_variants[0] === 'string' ? value.caption_variants[0].trim() : '';
    return caption;
  } catch {
    return '';
  }
}

function isLegacyFinalVideo(filePath: string) {
  return path.basename(filePath) === 'affiliate-video-final.mp4';
}

function readExportInfo(filePath: string): { postId?: string } {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(path.dirname(filePath), '_work', 'export-info.json'), 'utf8')) as { postId?: unknown };
    return typeof value.postId === 'string' ? { postId: value.postId } : {};
  } catch {
    return {};
  }
}

function readVideoReview(filePath: string): { approvedAt?: string } {
  try {
    const value = JSON.parse(fs.readFileSync(reviewPath(filePath), 'utf8')) as { approvedAt?: unknown };
    return typeof value.approvedAt === 'string' ? { approvedAt: value.approvedAt } : {};
  } catch {
    return {};
  }
}

export function assertGeneratedVideoPath(filePath: string) {
  const exportsDir = path.resolve(process.cwd(), 'data', 'video-exports');
  const resolved = path.resolve(filePath);
  const relative = path.relative(exportsDir, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || path.extname(resolved).toLowerCase() !== '.mp4' || relative.split(path.sep).includes('_work')) {
    throw new Error('Video path is outside the generated video library.');
  }
  return resolved;
}

async function withThumbnail(asset: AssetLibraryItem): Promise<AssetLibraryItem> {
  const filePath = thumbnailPath(asset.id);
  if (!fs.existsSync(filePath)) {
    try {
      await generateThumbnail(asset.filePath, filePath);
    } catch {
      return asset;
    }
  }
  return { ...asset, thumbnailDataUrl: `data:image/jpeg;base64,${fs.readFileSync(filePath).toString('base64')}` };
}

function generateThumbnail(inputPath: string, outputPath: string) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  return runProcess('ffmpeg', ['-y', '-ss', '00:00:01', '-i', inputPath, '-frames:v', '1', '-vf', 'scale=480:-1', outputPath]);
}

function probeDuration(filePath: string) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath], { windowsHide: true });
    let output = '';
    let errorOutput = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (errorOutput += chunk.toString()));
    child.on('error', (error) => reject(new Error(`ffprobe could not start. Install FFmpeg and add it to PATH. ${error.message}`)));
    child.on('close', (code) => {
      const duration = Number(output.trim());
      if (code !== 0 || !Number.isFinite(duration)) reject(new Error(`Unable to inspect clip duration. ${errorOutput.slice(-500)}`));
      else resolve(duration);
    });
  });
}

function runProcess(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let errorOutput = '';
    child.stderr.on('data', (chunk: Buffer) => (errorOutput += chunk.toString()));
    child.on('error', (error) => reject(new Error(`${command} could not start. ${error.message}`)));
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} failed. ${errorOutput.slice(-500)}`)));
  });
}

function thumbnailPath(id: string) {
  return path.resolve(process.cwd(), 'data', 'video-thumbnails', `${id}.jpg`);
}

function findFinalVideos(root: string) {
  const files: string[] = [];
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory() && entry.name !== '_work') pending.push(fullPath);
      else if (entry.isFile() && (
        entry.name === 'affiliate-video-final.mp4'
        || (/^\d{8}(?:-\d+)?$/.test(path.basename(current)) && entry.name.startsWith(`${path.basename(current)}`) && entry.name.toLowerCase().endsWith('.mp4'))
      )) files.push(fullPath);
    }
  }
  return files;
}
