/**
 * Electron 메인 진입점 — 배선만 한다.
 *
 * 판단이 들어가는 로직은 전부 옆 모듈에 있고 거기서 감지기로 잰다:
 * `window-options` · `renderer-path` · `file-blob-store` · `secure-store` · `local-db` · `print`.
 * 이 파일이 얇아야 「Electron을 띄워야만 확인 가능한 부분」이 작아진다.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { BrowserWindow, app, dialog, ipcMain, net, protocol, safeStorage } from 'electron';
import initSqlJs from 'sql.js';

import { createFileBlobStore } from './file-blob-store';
import { LocalDb, type SqlDatabase } from './local-db';
import {
  type FileWriter,
  LabelPrinter,
  type LabelImage,
  type PdfRenderer,
  toPdfFileName,
} from './print';
import { resolveRendererPath } from './renderer-path';
import { SecureStore } from './secure-store';
import { createKioskWindowOptions } from './window-options';

// ⚠ `import.meta.url`을 쓰지 않는다 — 이 파일은 CJS로 번들되고(Electron preload가 ESM을
// 안정적으로 받지 않는다) CJS 출력에서 `import.meta`는 비어 있다. 비면 preload·renderer
// 경로가 조용히 어긋나 창이 빈 화면으로 뜬다.
const RENDERER_DIR = join(__dirname, '../renderer');
const PRELOAD_PATH = join(__dirname, '../preload/index.cjs');
const DEV_SERVER_URL = process.env.POP_DEV_SERVER_URL;
const IS_DEV = DEV_SERVER_URL !== undefined;

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

// 스킴 특권은 앱이 준비되기 **전에** 등록해야 한다. 늦으면 fetch·모듈 로딩이 막힌다.
protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function registerRendererProtocol(): void {
  protocol.handle(APP_SCHEME, async (request) => {
    try {
      const { pathname } = new URL(request.url);
      const resolved = resolveRendererPath({ rendererDir: RENDERER_DIR, pathname, existsSync });

      if (resolved.kind === 'forbidden') return new Response('forbidden', { status: 403 });
      if (resolved.kind === 'not-found') return new Response('not found', { status: 404 });
      return await net.fetch(pathToFileURL(resolved.path).toString());
    } catch (error) {
      // 핸들러가 rejection으로 끝나면 렌더러에는 정체 불명의 로드 실패로만 보인다.
      return new Response(`renderer protocol error: ${String(error)}`, { status: 500 });
    }
  });
}

const fileWriter: FileWriter = {
  write: async (filePath, bytes) => {
    mkdirSync(join(filePath, '..'), { recursive: true });
    writeFileSync(filePath, bytes);
  },
};

/**
 * 서버가 준 라벨 이미지를 실제 PDF로 감싼다.
 *
 * 이미지 바이트를 그대로 `.pdf`로 쓰면 PDF 리더가 열지 못한다(실측). 오프스크린 창에
 * 이미지를 띄우고 Electron 내장 `printToPDF`로 감싼다 — 프린터 제어 언어를 만드는 것이
 * 아니므로 #441의 금지 조항에 걸리지 않는다.
 */
const pdfRenderer: PdfRenderer = {
  render: async (image: LabelImage) => {
    const offscreen = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    try {
      const base64 = Buffer.from(image.bytes).toString('base64');
      const html =
        `<html><body style="margin:0">` +
        `<img src="data:image/png;base64,${base64}" style="width:100%">` +
        `</body></html>`;
      await offscreen.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`);
      return new Uint8Array(await offscreen.webContents.printToPDF({ printBackground: true }));
    } finally {
      offscreen.destroy();
    }
  },
};

async function openLocalDb(dbPath: string): Promise<LocalDb> {
  const SQL = await initSqlJs();
  const existing = existsSync(dbPath) ? readFileSync(dbPath) : undefined;
  try {
    const db = existing ? new SQL.Database(existing) : new SQL.Database();
    return new LocalDb(db as unknown as SqlDatabase);
  } catch (error) {
    // 쓰다 만 파일이면 열기가 던진다. 여기서 멈추면 창이 아예 뜨지 않아 현장에서 복구할
    // 방법이 없다 — 손상본을 옆에 남기고 빈 DB로 계속 간다.
    if (existing !== undefined) renameSync(dbPath, `${dbPath}.corrupt-${process.pid}`);
    console.error('로컬 저장소를 열 수 없어 새로 만든다:', error);
    return new LocalDb(new SQL.Database() as unknown as SqlDatabase);
  }
}

/** 원자적으로 내린다 — 쓰는 도중 전원이 끊겨도 이전 파일이 남는다. */
function persist(db: LocalDb, dbPath: string): void {
  const temporary = `${dbPath}.tmp`;
  writeFileSync(temporary, db.export());
  renameSync(temporary, dbPath);
}

async function main(): Promise<void> {
  await app.whenReady();
  registerRendererProtocol();

  // 현장 단말은 켜면 바로 이 앱이어야 한다(#441 「OS 부팅 시 자동 실행」).
  // 개발 중에는 걸지 않는다 — 개발 PC의 로그인 항목을 건드리지 않기 위해서다.
  if (!IS_DEV) app.setLoginItemSettings({ openAtLogin: true });

  const userData = app.getPath('userData');
  const secureStore = new SecureStore(safeStorage, createFileBlobStore(join(userData, 'secure')));
  const dbPath = join(userData, 'pop.sqlite');
  const localDb = await openLocalDb(dbPath);
  const labelDir = join(userData, 'labels');
  const printer = new LabelPrinter(pdfRenderer, fileWriter);

  // 대기열이 사라지면 현장 실적이 사라진다. 창을 만들기 **전에** 등록한다 —
  // 창 생성이나 로드가 실패해도 이미 걸려 있어야 그 세션의 기록이 남는다.
  app.on('before-quit', () => persist(localDb, dbPath));

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
  ipcMain.handle('outbox:dequeue', (_e, id: number) => localDb.dequeue(id));

  // ⛔ 출력 경로는 **메인이 소유한다.** 렌더러가 준 경로에 그대로 쓰면 임의 위치에
  //    파일을 만들 수 있다. 렌더러는 라벨 이름만 넘긴다.
  ipcMain.handle('label:print-pdf', async (_e, bytes: Uint8Array, label: string, now: string) => {
    const filePath = join(labelDir, toPdfFileName(label, now));
    await printer.print({ bytes, label }, { kind: 'pdf', filePath });
    return filePath;
  });

  const window = new BrowserWindow(
    createKioskWindowOptions({ preloadPath: PRELOAD_PATH, isDev: IS_DEV }),
  );

  // 새 창은 키오스크 옵션을 물려받지 않는다 — 프레임 있는 일반 창에 개발자도구가 열린 채
  // 뜬다. 작업자가 셸 밖으로 빠져나갈 통로라 아예 막는다.
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    const allowed = DEV_SERVER_URL ?? RENDERER_ORIGIN;
    if (!url.startsWith(allowed)) event.preventDefault();
  });

  await window.loadURL(DEV_SERVER_URL ?? RENDERER_ORIGIN);
}

app.on('window-all-closed', () => app.quit());

// 기동 실패를 조용히 삼키지 않는다. 프레임 없는 키오스크 창에 개발자도구도 없어,
// 여기서 알리지 않으면 현장에서 무슨 일이 났는지 판별할 수단이 없다.
main().catch((error: unknown) => {
  const detail =
    error instanceof Error ? `${error.message}\n\n${error.stack ?? ''}` : String(error);
  console.error('POP 셸 기동 실패:', error);
  if (app.isReady()) dialog.showErrorBox('POP 셸을 시작할 수 없습니다', detail);
  app.exit(1);
});
