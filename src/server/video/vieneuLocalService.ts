import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { LocalTtsStatus, VieneuTtsVoice } from '@/lib/types';

type SidecarResponse = {
  id?: string;
  event?: string;
  ok?: boolean;
  error?: string;
  installed?: boolean;
  loaded?: boolean;
  version?: string;
  backend?: string;
  voices?: Array<{ id: string; label: string; description: string }>;
};

type PendingRequest = {
  resolve: (response: SidecarResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const localRoot = path.resolve(process.cwd(), 'data', 'local-models');
const vieneuRoot = path.join(localRoot, 'vieneu');
const pythonPath = process.platform === 'win32'
  ? path.join(vieneuRoot, '.venv', 'Scripts', 'python.exe')
  : path.join(vieneuRoot, '.venv', 'bin', 'python');
const sidecarPath = path.resolve(process.cwd(), 'scripts', 'vieneu_sidecar.py');
const huggingFaceHome = path.join(localRoot, 'huggingface');
const vieneuModelCache = path.join(
  huggingFaceHome,
  'hub',
  'models--pnnbao-ump--VieNeu-TTS-v3-Turbo'
);

let child: ChildProcessWithoutNullStreams | null = null;
let stdoutBuffer = '';
let stderrTail = '';
let startupPromise: Promise<void> | null = null;
const pending = new Map<string, PendingRequest>();

export async function getVieneuLocalStatus(): Promise<LocalTtsStatus> {
  const installed = fs.existsSync(pythonPath) && fs.existsSync(sidecarPath);
  const modelReady = fs.existsSync(vieneuModelCache);
  if (!installed) {
    return {
      ok: false,
      message: 'VieNeu Local is not installed.',
      installed,
      modelReady,
      running: false,
      voices: []
    };
  }

  try {
    const response = await sendCommand({ command: 'health' }, 20_000);
    return {
      ok: Boolean(response.ok),
      message: response.loaded
        ? 'VieNeu Local is ready in memory.'
        : 'VieNeu Local is installed. The first preview will warm up the model.',
      installed: Boolean(response.installed),
      modelReady,
      running: Boolean(child && !child.killed),
      loaded: Boolean(response.loaded),
      version: response.version,
      backend: response.backend,
      voices: response.voices ?? []
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      installed,
      modelReady,
      running: false,
      voices: []
    };
  }
}

export async function synthesizeVieneuLocal(request: {
  input: string;
  outputPath: string;
  voice: VieneuTtsVoice;
}) {
  const response = await sendCommand({
    command: 'synthesize',
    text: request.input,
    outputPath: path.resolve(request.outputPath),
    voice: request.voice
  }, 10 * 60_000);
  if (!response.ok) throw new Error(response.error || 'VieNeu Local synthesis failed.');
}

export function stopVieneuLocalService() {
  if (!child) return;
  const running = child;
  child = null;
  startupPromise = null;
  try {
    running.stdin.write(`${JSON.stringify({ id: crypto.randomUUID(), command: 'shutdown' })}\n`);
    running.stdin.end();
  } catch {
    running.kill();
  }
}

async function sendCommand(
  command: Record<string, unknown>,
  timeoutMs: number
): Promise<SidecarResponse> {
  await ensureSidecar();
  if (!child) throw new Error('VieNeu Local worker did not start.');
  const id = crypto.randomUUID();
  return new Promise<SidecarResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`VieNeu Local timed out after ${Math.round(timeoutMs / 1000)} seconds.`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    child?.stdin.write(`${JSON.stringify({ id, ...command })}\n`, 'utf8');
  });
}

async function ensureSidecar() {
  if (child && !child.killed) {
    if (startupPromise) await startupPromise;
    return;
  }
  if (!fs.existsSync(pythonPath)) {
    throw new Error(`VieNeu Python environment is missing: ${pythonPath}`);
  }
  if (!fs.existsSync(sidecarPath)) {
    throw new Error(`VieNeu worker is missing: ${sidecarPath}`);
  }

  fs.mkdirSync(huggingFaceHome, { recursive: true });
  child = spawn(pythonPath, ['-u', sidecarPath], {
    cwd: process.cwd(),
    windowsHide: true,
    env: {
      ...process.env,
      HF_HOME: huggingFaceHome,
      HF_HUB_DISABLE_TELEMETRY: '1',
      HF_HUB_DISABLE_SYMLINKS_WARNING: '1',
      PYTHONIOENCODING: 'utf-8',
      ...(fs.existsSync(vieneuModelCache) ? { HF_HUB_OFFLINE: '1' } : {})
    }
  });

  startupPromise = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('VieNeu Local worker startup timed out.')), 15_000);
    const onReady = (payload: SidecarResponse) => {
      if (payload.event !== 'ready') return;
      clearTimeout(timer);
      sidecarReadyListeners.delete(onReady);
      resolve();
    };
    sidecarReadyListeners.add(onReady);
  });

  child.stdout.on('data', (chunk: Buffer) => {
    stdoutBuffer += chunk.toString('utf8');
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        handleResponse(JSON.parse(line) as SidecarResponse);
      } catch {
        stderrTail = `${stderrTail}\nUnexpected VieNeu output: ${line}`.slice(-2_000);
      }
    }
  });
  child.stderr.on('data', (chunk: Buffer) => {
    stderrTail = `${stderrTail}${chunk.toString('utf8')}`.slice(-2_000);
  });
  child.on('error', failPending);
  child.on('close', (code) => {
    const error = new Error(
      `VieNeu Local worker stopped (${code ?? 'unknown'}). ${stderrTail.slice(-500)}`
    );
    child = null;
    startupPromise = null;
    failPending(error);
  });

  await startupPromise;
}

const sidecarReadyListeners = new Set<(payload: SidecarResponse) => void>();

function handleResponse(response: SidecarResponse) {
  sidecarReadyListeners.forEach((listener) => listener(response));
  if (!response.id) return;
  const request = pending.get(response.id);
  if (!request) return;
  clearTimeout(request.timer);
  pending.delete(response.id);
  if (response.ok) request.resolve(response);
  else request.reject(new Error(response.error || 'VieNeu Local request failed.'));
}

function failPending(error: Error) {
  for (const request of pending.values()) {
    clearTimeout(request.timer);
    request.reject(error);
  }
  pending.clear();
}
