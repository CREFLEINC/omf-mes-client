/**
 * Electron 메인 진입점 — 배선만 한다.
 *
 * 판단이 필요한 로직은 전부 옆 모듈(`window-options` · `secure-store` · `local-db` · `print`)에
 * 있고 거기서 감지기로 잰다. 이 파일이 얇아야 「Electron을 띄워야만 확인 가능한 부분」이 작아진다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { BrowserWindow, app, ipcMain, net, protocol, safeStorage } from 'electron';
import initSqlJs from 'sql.js';

import { LocalDb, type SqlDatabase } from './local-db';
import { LabelPrinter, type PdfWriter } from './print';
import { type BlobStore, SecureStore } from './secure-store';
import { createKioskWindowOptions } from './window-options';

// ⚠ `import.meta.url`을 쓰지 않는다 — 이 파일은 CJS로 번들되고(Electron preload가 ESM을
// 안정적으로 받지 않는다) CJS 출력에서 `import.meta`는 비어 있다. 비면 preload·renderer
// 경로가 조용히 어긋나 창이 빈 화면으로 뜬다.
const here = __dirname;

/** 렌더러는 기존 웹 빌드 산출물을 그대로 띄운다 — POP 화면 구현은 이 이슈 범위 밖이다. */
const RENDERER_DIR = join(here, '../renderer');
const DEV_SERVER_URL = process.env.POP_DEV_SERVER_URL;

/**
 * 렌더러를 `file://`이 아니라 자체 스킴으로 띄운다.
 *
 * 웹 빌드의 자산 참조가 `/assets/...` 절대 경로다. `file://`에서 그 경로는 **디스크 루트**를
 * 가리켜 스크립트가 조용히 로드되지 않는다 — 창은 뜨고 `did-fail-load`도 안 나는데 화면만
 * 빈 채로 남는다(실측). 오리진이 있는 스킴으로 띄우면 절대 경로가 렌더러 폴더 기준으로 풀린다.
 *
 * ⛔ 대안이었던 「apps/web의 vite `base`를 상대 경로로 바꾸기」는 쓰지 않는다 — 그 빌드는
 *    관리웹도 함께 쓰므로 POP 사정으로 남의 산출물을 바꾸게 된다.
 */
const APP_SCHEME = 'pop';
const RENDERER_ORIGIN = `${APP_SCHEME}://app`;

function registerRendererProtocol(): void {
  protocol.handle(APP_SCHEME, (request) => {
    const { pathname } = new URL(request.url);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const target = join(RENDERER_DIR, relative);

    // 렌더러 폴더 밖으로 나가는 경로는 거절한다 — `..`가 섞이면 앱 바깥 파일이 새어 나간다.
    if (!target.startsWith(RENDERER_DIR)) return new Response('forbidden', { status: 403 });

    // SPA 라우팅: 자산이 아닌 경로는 index.html로 되돌린다.
    const file = existsSync(target) ? target : join(RENDERER_DIR, 'index.html');
    return net.fetch(pathToFileURL(file).toString());
  });
}

function blobStore(baseDir: string): BlobStore {
  const pathFor = (key: string) => join(baseDir, `${key}.bin`);
  return {
    read: (key) => (existsSync(pathFor(key)) ? readFileSync(pathFor(key)) : undefined),
    write: (key, value) => {
      mkdirSync(baseDir, { recursive: true });
      writeFileSync(pathFor(key), value);
    },
    delete: (key) => {
      if (existsSync(pathFor(key))) writeFileSync(pathFor(key), Buffer.alloc(0));
    },
  };
}

const pdfWriter: PdfWriter = {
  write: async (filePath, bytes) => {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, bytes);
  },
};

async function openLocalDb(dbPath: string): Promise<LocalDb> {
  const SQL = await initSqlJs();
  const existing = existsSync(dbPath) ? readFileSync(dbPath) : undefined;
  const db = existing ? new SQL.Database(existing) : new SQL.Database();
  return new LocalDb(db as unknown as SqlDatabase);
}

// 스킴 특권은 앱이 준비되기 **전에** 등록해야 한다. 늦으면 fetch·모듈 로딩이 막힌다.
protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

async function main(): Promise<void> {
  await app.whenReady();
  registerRendererProtocol();

  const userData = app.getPath('userData');
  const secureStore = new SecureStore(safeStorage, blobStore(join(userData, 'secure')));
  const dbPath = join(userData, 'pop.sqlite');
  const localDb = await openLocalDb(dbPath);
  const printer = new LabelPrinter(pdfWriter);

  // 통로는 contextBridge 하나뿐이다(preload 참조). 여기 등록한 채널 밖으로는 아무것도 열지 않는다.
  ipcMain.handle('device-token:get', () => secureStore.get());
  ipcMain.handle('device-token:set', (_e, value: string) => secureStore.set(value));
  ipcMain.handle('cache:get', (_e, key: string) => localDb.getCache(key));
  ipcMain.handle('cache:put', (_e, key: string, value: string, at: string) =>
    localDb.putCache(key, value, at),
  );
  ipcMain.handle('outbox:enqueue', (_e, endpoint: string, payload: string, at: string) =>
    localDb.enqueue(endpoint, payload, at),
  );
  ipcMain.handle('outbox:peek', (_e, limit?: number) => localDb.peekQueue(limit));
  ipcMain.handle('outbox:size', () => localDb.queueSize());
  ipcMain.handle('label:print-pdf', async (_e, bytes: Uint8Array, label: string, filePath: string) =>
    printer.print({ bytes, label }, { kind: 'pdf', filePath }),
  );

  const window = new BrowserWindow(
    createKioskWindowOptions({ preloadPath: join(here, '../preload/index.cjs') }),
  );

  // 우클릭 메뉴를 막는다 — 작업자가 셸 밖으로 빠져나갈 통로 하나를 더 닫는다.
  window.webContents.on('context-menu', (event) => event.preventDefault());

  await window.loadURL(DEV_SERVER_URL ?? RENDERER_ORIGIN);

  // 종료 시 로컬 저장소를 디스크에 내린다. 대기열이 사라지면 현장 실적이 사라진다.
  app.on('before-quit', () => writeFileSync(dbPath, localDb.export()));
}

app.on('window-all-closed', () => app.quit());

void main();
