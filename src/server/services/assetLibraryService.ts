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
  const dateCounts = new Map<string, number>();

  await Promise.all(
    files.map(async (filePath) => {
      const datePart = formatDate(fs.statSync(filePath).mtime);
      const count = (dateCounts.get(datePart) ?? 0) + 1;
      dateCounts.set(datePart, count);
      const label = `rednote_${datePart}${count > 1 ? `_${count}` : ''}`;
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
      const previewPath = path.join(path.dirname(filePath), 'thumbnails', 'thumb_002.jpg');
      return {
        id: crypto.createHash('sha1').update(filePath).digest('hex'),
        label,
        filePath,
        createdAt: stats.mtime.toISOString(),
        sizeBytes: stats.size,
        thumbnailDataUrl: fs.existsSync(previewPath) ? `data:image/jpeg;base64,${fs.readFileSync(previewPath).toString('base64')}` : undefined
      };
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function deleteGeneratedVideo(filePath: string) {
  fs.rmSync(assertGeneratedVideoPath(filePath), { force: true });
}

export function assertGeneratedVideoPath(filePath: string) {
  const exportsDir = path.resolve(process.cwd(), 'data', 'video-exports');
  const resolved = path.resolve(filePath);
  const relative = path.relative(exportsDir, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || path.basename(resolved) !== 'affiliate-video-final.mp4') {
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

function formatDate(value: Date) {
  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${day}${month}${value.getFullYear()}`;
}

function findFinalVideos(root: string) {
  const files: string[] = [];
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(fullPath);
      else if (entry.isFile() && entry.name === 'affiliate-video-final.mp4') files.push(fullPath);
    }
  }
  return files;
}
