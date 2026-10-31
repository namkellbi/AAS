import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { NormalizationBackendStatus, ServiceHealth, SpeechNormalizationSegment } from '@/lib/types';
import { TTS_NORMALIZATION_INSTRUCTIONS } from '@/server/ai/ttsNormalizationPrompt';

const STATUS_TTL_MS = 10_000;
const LOGIN_TIMEOUT_MS = 10 * 60_000;
const NORMALIZATION_TIMEOUT_MS = 3 * 60_000;
const OUTPUT_LIMIT = 4 * 1024 * 1024;

let cachedStatus: { expiresAt: number; value: NormalizationBackendStatus } | null = null;
let activeLogin: ChildProcess | null = null;
let loginTimer: NodeJS.Timeout | null = null;

const outputSchema = {
  type: 'object',
  properties: {
    segments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          text: { type: 'string' }
        },
        required: ['id', 'text'],
        additionalProperties: false
      }
    }
  },
  required: ['segments'],
  additionalProperties: false
} as const;

export async function getCodexNormalizationStatus(force = false): Promise<NormalizationBackendStatus> {
  if (!force && cachedStatus && cachedStatus.expiresAt > Date.now()) return cachedStatus.value;
  const command = resolveCodexExecutable();
  if (!command) {
    return cacheStatus({
      ok: false,
      message: 'Chưa tìm thấy Codex CLI trên máy.',
      codexInstalled: false,
      codexLoggedIn: false,
      codexVersion: null,
      apiFallbackConfigured: false,
      activeProvider: null
    });
  }

  const [versionRun, loginRun] = await Promise.all([
    runCodexCommand(command, ['--version'], 15_000),
    runCodexCommand(command, ['login', 'status'], 20_000)
  ]);
  const combined = `${loginRun.stdout}\n${loginRun.stderr}`;
  const loggedIn = loginRun.code === 0 && /logged in/i.test(combined) && !/not logged in/i.test(combined);
  const version = versionRun.stdout.match(/\d+\.\d+\.\d+(?:[-.][\w.]+)?/)?.[0] ?? null;
  return cacheStatus({
    ok: loggedIn,
    message: loggedIn
      ? 'Codex đã đăng nhập bằng ChatGPT.'
      : 'Codex đã cài nhưng chưa đăng nhập ChatGPT.',
    codexInstalled: true,
    codexLoggedIn: loggedIn,
    codexVersion: version,
    apiFallbackConfigured: false,
    activeProvider: loggedIn ? 'codex' : null
  });
}

export async function startCodexLogin(openUrl?: (url: string) => void | Promise<void>): Promise<ServiceHealth> {
  const command = resolveCodexExecutable();
  if (!command) return { ok: false, message: 'Chưa tìm thấy Codex CLI. Hãy cài Codex rồi thử lại.' };
  if (activeLogin && !activeLogin.killed) {
    return { ok: true, message: 'Đăng nhập ChatGPT đang chờ hoàn tất trong trình duyệt.' };
  }

  cachedStatus = null;
  const child = spawn(command, ['login'], {
    cwd: os.homedir(),
    env: codexEnvironment(),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  activeLogin = child;
  loginTimer = setTimeout(() => stopCodexLogin(), LOGIN_TIMEOUT_MS);
  child.once('close', () => finishLogin());
  child.once('error', () => finishLogin());
  let opened = false;
  let loginOutput = '';
  const inspectOutput = (chunk: Buffer) => {
    if (opened) return;
    loginOutput = (loginOutput + chunk.toString('utf8')).slice(-32 * 1024);
    const url = findOpenAiLoginUrl(loginOutput);
    if (!url) return;
    opened = true;
    void openUrl?.(url);
  };
  child.stdout?.on('data', inspectOutput);
  child.stderr?.on('data', inspectOutput);
  return { ok: true, message: 'Trình duyệt sẽ mở trang đăng nhập ChatGPT. Hoàn tất rồi bấm Kiểm tra lại.' };
}

export function stopCodexLogin(): void {
  if (activeLogin && !activeLogin.killed) activeLogin.kill();
  finishLogin();
}

export async function normalizeWithCodex(segments: SpeechNormalizationSegment[]): Promise<unknown> {
  const status = await getCodexNormalizationStatus();
  if (!status.codexInstalled || !status.codexLoggedIn) {
    throw new Error(status.message);
  }
  const command = resolveCodexExecutable();
  if (!command) throw new Error('Codex CLI không còn khả dụng.');

  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'aas-codex-normalize-'));
  const schemaPath = path.join(temporaryDirectory, 'schema.json');
  await writeFile(schemaPath, JSON.stringify(outputSchema), 'utf8');
  const prompt = [
    TTS_NORMALIZATION_INSTRUCTIONS,
    '',
    'NHIỆM VỤ HIỆN TẠI',
    'Chuẩn hóa từng text cho TTS. Giữ nguyên tuyệt đối id, số lượng và thứ tự segment.',
    'Chỉ trả về JSON đúng schema; không đọc file, không chạy lệnh và không giải thích.',
    JSON.stringify({ segments })
  ].join('\n');

  try {
    const run = await runCodexWithInput(command, [
      'exec',
      '--ephemeral',
      '--ignore-user-config',
      '--ignore-rules',
      '--skip-git-repo-check',
      '--color', 'never',
      '--cd', temporaryDirectory,
      '--sandbox', 'read-only',
      '--output-schema', schemaPath,
      '--', '-'
    ], prompt, NORMALIZATION_TIMEOUT_MS);
    if (run.code !== 0) {
      throw new Error(describeCodexFailure(run.stderr || run.stdout));
    }
    return parseJsonOutput(run.stdout);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}

function resolveCodexExecutable(): string | null {
  const configured = process.env.AAS_CODEX_PATH;
  if (configured && fs.existsSync(configured)) return configured;
  if (process.platform !== 'win32') return 'codex';

  const pathEntries = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  const direct = pathEntries
    .map((entry) => path.join(entry, 'codex.exe'))
    .find((candidate) => fs.existsSync(candidate));
  if (direct) return direct;

  const home = os.homedir();
  const fixedCandidates = [
    path.join(home, '.codex', 'bin', 'codex.exe'),
    path.join(home, '.local', 'bin', 'codex.exe')
  ];
  const fixed = fixedCandidates.find((candidate) => fs.existsSync(candidate));
  if (fixed) return fixed;

  const extensionsDirectory = path.join(home, '.vscode', 'extensions');
  try {
    return fs.readdirSync(extensionsDirectory)
      .filter((name) => name.startsWith('openai.chatgpt-'))
      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
      .map((name) => path.join(extensionsDirectory, name, 'bin', 'windows-x86_64', 'codex.exe'))
      .find((candidate) => fs.existsSync(candidate)) ?? null;
  } catch {
    return null;
  }
}

function codexEnvironment(): NodeJS.ProcessEnv {
  const allowed = [
    'HOME', 'USER', 'LOGNAME', 'LANG', 'TMPDIR', 'TMP', 'TEMP', 'CODEX_HOME',
    'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'https_proxy', 'http_proxy', 'no_proxy',
    'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'PATH',
    'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'USERPROFILE',
    'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA', 'ProgramFiles', 'ProgramFiles(x86)',
    'HOMEDRIVE', 'HOMEPATH', 'COMPUTERNAME', 'USERNAME', 'PROCESSOR_ARCHITECTURE', 'OS'
  ];
  const env: NodeJS.ProcessEnv = { NODE_ENV: process.env.NODE_ENV || 'production' };
  for (const key of allowed) {
    const value = process.env[key];
    if (value) env[key] = value;
  }
  env.HOME ??= os.homedir();
  env.NO_COLOR = '1';
  env.TERM = 'dumb';
  return env;
}

function runCodexCommand(command: string, args: string[], timeout: number) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(command, args, {
      env: codexEnvironment(),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(null);
    }, timeout);
    child.stdout.on('data', (chunk: Buffer) => { stdout = (stdout + chunk.toString('utf8')).slice(-1024 * 1024); });
    child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString('utf8')).slice(-1024 * 1024); });
    child.once('error', () => finish(null));
    child.once('close', (code) => finish(code));
  });
}

function runCodexWithInput(command: string, args: string[], input: string, timeout: number) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      env: codexEnvironment(),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Codex quá thời gian chuẩn hóa.'));
    }, timeout);
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      if (stdout.length > OUTPUT_LIMIT) child.kill();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
      if (stderr.length > OUTPUT_LIMIT) child.kill();
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin.end(input, 'utf8');
  });
}

function parseJsonOutput(value: string): unknown {
  const trimmed = value.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('Codex trả về dữ liệu không đọc được.');
  }
}

function describeCodexFailure(output: string) {
  const normalized = output.toLowerCase();
  if (/not logged in|login required|codex login|not authenticated|401 unauthorized/.test(normalized)) {
    cachedStatus = null;
    return 'Codex chưa đăng nhập ChatGPT hoặc phiên đã hết hạn.';
  }
  if (/rate limit|usage limit|you.ve hit your usage limit/.test(normalized)) {
    return 'Tài khoản ChatGPT đã chạm giới hạn Codex hiện tại.';
  }
  const tail = output.trim().split('\n').filter(Boolean).slice(-3).join(' ').slice(0, 500);
  return tail ? `Codex dừng: ${tail}` : 'Codex dừng trước khi hoàn tất chuẩn hóa.';
}

function findOpenAiLoginUrl(output: string) {
  for (const match of output.matchAll(/https:\/\/[^\s"'<>]+/g)) {
    try {
      const url = new URL(match[0]);
      if (url.protocol === 'https:' && !url.username && !url.password && ['auth.openai.com', 'chatgpt.com'].includes(url.hostname)) {
        return url.toString();
      }
    } catch {
      // Ignore malformed URLs emitted alongside terminal formatting.
    }
  }
  return null;
}

function cacheStatus(value: NormalizationBackendStatus) {
  cachedStatus = { value, expiresAt: Date.now() + STATUS_TTL_MS };
  return value;
}

function finishLogin() {
  if (loginTimer) clearTimeout(loginTimer);
  loginTimer = null;
  activeLogin = null;
  cachedStatus = null;
}
