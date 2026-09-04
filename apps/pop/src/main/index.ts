/**
 * Electron 메인 진입점 — 배선만 한다.
 *
 * 판단이 들어가는 로직은 전부 옆 모듈에 있고 거기서 감지기로 잰다:
 * `window-options` · `renderer-path` · `file-blob-store` · `secure-store` · `local-db` · `print`.
 * 이 파일이 얇아야 「Electron을 띄워야만 확인 가능한 부분」이 작아진다.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { BrowserWindow, app, dialog, ipcMain, net, protocol, safeStorage } from 'electron';
import initSqlJs from 'sql.js';

import { createFileBlobStore } from './file-blob-store';
import { LocalDb, type SqlDatabase } from './local-db';
import {
  type FileWriter,
  PrinterUnavailableError,
  RenditionPrinter,
  UnknownFormatError,
  isRenditionFormat,
  toRenditionFileName,
} from './print';
import { type LoggedPrinter, formatPrintLog, reasonOf } from './print-log';
import { PRINT_PAGE_FILE, labelFileName, renderPrintPage } from './print-page';
import { resolveRendererPath } from './renderer-path';
import {
  type PrintPage,
  type PrinterChoice,
  createSilentPrinter,
  selectPrinter,
} from './silent-print';
import { SecureStore } from './secure-store';
import { createKioskWindowOptions } from './window-options';

// ⚠ `import.meta.url`을 쓰지 않는다 — 이 파일은 CJS로 번들되고(Electron preload가 ESM을
// 안정적으로 받지 않는다) CJS 출력에서 `import.meta`는 비어 있다. 비면 preload·renderer
// 경로가 조용히 어긋나 창이 빈 화면으로 뜬다.
const RENDERER_DIR = join(__dirname, '../renderer');
const PRELOAD_PATH = join(__dirname, '../preload/index.cjs');
/** 어디를 띄울지. 주면 개발 서버를 물고, 없으면 번들된 렌더러를 띄운다. */
const DEV_SERVER_URL = process.env.POP_DEV_SERVER_URL;

/**
 * 어떤 빌드인지. **「개발 서버를 물었는가」와 축이 다르다.**
 *
 * 한 값에 묶었더니 `pnpm dev`(개발 서버 없이 번들을 띄우는 정상 사용법)가 배포본으로
 * 판정돼, 개발 PC에 자동 실행 항목을 등록하고 개발자도구는 잠갔다 — 의도와 정반대였다.
 *
 * ⚠ `app.isPackaged`는 **실행 파일 이름**이 `electron`/`electron.exe`인지로 판정한다.
 *   `package.json`의 `productName`·`executableName`을 `electron`으로 두면 **배포본이
 *   개발본으로 판정돼 현장 단말의 개발자도구가 열린다.** 배포본을 띄워야만 드러나는
 *   축이라 감지기로 잡히지 않는다 — 그 이름을 바꿀 때 이 주석을 함께 본다.
 */
const IS_DEV = !app.isPackaged;

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
 * 인쇄용 숨은 창. **작업마다 새로 열고 끝나면 닫는다** — 하나를 계속 쓰면 앞 출력물이 남아
 * 다음 인쇄에 섞인다.
 *
 * ⛔ 키오스크 창의 옵션을 물려받지 않는다. 이 창은 사람에게 보이지 않고 우리가 방금 떨어뜨린
 *    임시 파일 하나만 띄운다 — 통로를 더 열 이유가 없다.
 */
/**
 * 인쇄용 창을 놓는 자리 — **화면 밖.**
 *
 * ⛔ **`show: false` 로만 두지 않는다.** 창을 한 번도 보여 주지 않으면 Windows 에서 인쇄 결과가
 *    **백지로 나간다** — 파일로 뜨는 경로(`printToPDF`)는 멀쩡한데 인쇄 경로만 빈다. 둘이 쓰는
 *    그림이 다르기 때문이다(실측 — 라벨이 급지는 되는데 아무것도 찍히지 않았고, 앱은 인쇄를
 *    성공으로 끝냈다).
 *
 * ⚠ 그래서 **보여 주되 화면 밖에 둔다.** 작업자 눈에는 아무것도 보이지 않고, 엔진에는
 *   「보이는 창」이라 제대로 그린다. 키오스크 창을 가리지 않도록 초점도 가져가지 않는다.
 */
const PRINT_WINDOW_OFFSCREEN = -20000;

function openPrintPage(): PrintPage {
  const page = new BrowserWindow({
    show: false,
    x: PRINT_WINDOW_OFFSCREEN,
    y: PRINT_WINDOW_OFFSCREEN,
    width: 1000,
    height: 700,
    frame: false,
    skipTaskbar: true,
    focusable: false,
    /*
     * ⛔ **숨은 창도 그리게 둔다.** 이 값을 끄면 창은 뜨는데 화면을 한 번도 그리지 않는다.
     *    사람에게 안 보이는 것과 그리지 않는 것은 다른 축이다.
     */
    paintWhenInitiallyHidden: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false,
      /* 보이지 않는 창은 기본으로 그리기를 늦춘다 — 인쇄 직전에 그것이 백지가 된다. */
      backgroundThrottling: false,
    },
  });

  /*
   * ⛔ 이 창은 우리가 방금 떨어뜨린 파일 하나만 띄운다. 서버가 보낸 바이트를 그리는 자리라,
   *    키오스크 창과 같은 두 빗장을 여기에도 건다 — 새 창을 열지 못하게 하고 다른 곳으로
   *    옮겨 가지 못하게 한다.
   */
  page.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  return {
    load: async (url) => {
      page.webContents.on('will-navigate', (event, target) => {
        if (target !== url) event.preventDefault();
      });
      await page.loadURL(url);

      /*
       * ⭐ **인쇄 전에 창을 화면에 올린다.** 초점은 가져가지 않는다(`showInactive`) — 작업자가
       *    보던 화면이 뺏기면 안 된다. 자리는 화면 밖이라 보이지 않는다.
       */
      page.showInactive();

      /*
       * ⭐ **다 그려진 것을 확인하고 나서 인쇄한다.** 문서 로딩이 끝난 것과 그림이 화면에
       *    올라간 것은 다르다 — 로딩만 보고 인쇄하면 종이가 백지로 나온다. 그림의 디코딩이
       *    끝나기를 기다리고, 화면 갱신을 두 번 넘긴 뒤에 넘어간다.
       */
      await page.webContents.executeJavaScript(
        `new Promise((done) => {
           const images = Array.from(document.images ?? []);
           Promise.all(images.map((image) => image.decode().catch(() => undefined)))
             .then(() => requestAnimationFrame(() => requestAnimationFrame(() => { done(true); })));
         })`,
      );
    },
    print: async (deviceName, jobName) =>
      new Promise((resolve, reject) => {
        page.webContents.print(
          {
            silent: true,
            /* ⭐ 지정이 없으면 **항목 자체를 싣지 않는다** — 그래야 OS 기본으로 간다. */
            ...(deviceName === undefined ? {} : { deviceName }),
            /*
             * ⚠ **여백을 두지 않는다.** 라벨은 대지 크기가 곧 인쇄 영역이라, 기본 여백이
             *   들어가면 그림이 줄어 바코드 폭이 규격을 벗어난다.
             * ⛔ 배경은 찍지 않는다 — 브라우저 엔진이 이미지 문서에 깔아 주는 바탕색이
             *   라벨 전면을 덮는다.
             */
            margins: { marginType: 'none' },
            printBackground: false,
          },
          (success, reason) => {
            /* 취소도 실패로 다룬다 — 종이가 안 나온 것을 성공으로 두지 않는다(공유계약 F-6). */
            if (success) resolve();
            else reject(new Error(reason === '' ? '인쇄가 완료되지 않았다' : reason));
          },
        );
      }),
    close: () => page.destroy(),
  };
}

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
  const renditionDir = join(userData, 'renditions');
  /** 인쇄 진단 기록이 앉는 자리. 사람이 파일로 읽는다. */
  const logDir = join(userData, 'logs');
  const stagingDir = join(app.getPath('temp'), 'omf-pop-print');
  const printer = new RenditionPrinter(
    fileWriter,
    createSilentPrinter({
      openPage: openPrintPage,
      stage: async (bytes, format) => {
        /*
         * 작업마다 **폴더 하나**를 쓴다 — 감싸는 문서와 그림이 같은 자리에 있어야 상대 경로로
         * 이어진다. 이름은 겹치지 않기만 하면 된다(사람이 읽는 이름은 `renditions/` 쪽이 갖는다).
         */
        const jobDir = join(stagingDir, `${String(Date.now())}-${String(process.hrtime.bigint())}`);
        mkdirSync(jobDir, { recursive: true });
        writeFileSync(join(jobDir, labelFileName(format)), bytes);

        /*
         * ⚠ **PDF 는 감싸지 않는다.** 성적서·보고서는 이미 쪽이 나뉜 문서이고, 그것을 이미지처럼
         *   대지에 채우면 첫 쪽만 늘어난다. 그 형식은 엔진의 문서 보기에 그대로 맡긴다.
         */
        if (format === 'pdf') {
          return {
            path: jobDir,
            url: pathToFileURL(join(jobDir, labelFileName(format))).toString(),
          };
        }

        const pagePath = join(jobDir, PRINT_PAGE_FILE);
        writeFileSync(pagePath, renderPrintPage(labelFileName(format)), 'utf8');

        return { path: jobDir, url: pathToFileURL(pagePath).toString() };
      },
      discard: async (path) => rmSync(path, { force: true, recursive: true }),
    }),
  );

  /**
   * 어느 프린터로 보내는가. **창이 선 뒤에야 물어볼 수 있다** — 프린터 목록은 `webContents`
   * 가 준다. 인쇄는 사람이 화면을 조작한 뒤에 일어나므로 그때는 이미 서 있다.
   *
   * ⚠ 매번 다시 묻는다. 현장에서 프린터를 갈아 끼우거나 껐다 켜는 일이 있어, 기동 시점의
   *   목록을 들고 있으면 사라진 장치로 계속 보낸다.
   */
  let printHost: BrowserWindow | null = null;
  const resolvePrinter = async (): Promise<{
    choice: PrinterChoice;
    available: LoggedPrinter[];
  }> => {
    if (printHost === null) return { choice: { kind: 'none' }, available: [] };

    const printers = await printHost.webContents.getPrintersAsync();

    return {
      choice: selectPrinter(printers, process.env.POP_PRINTER_NAME),
      /* 고르지 못했을 때 **무엇이 있었는지**를 기록에 남기려고 함께 들고 나간다. */
      available: printers.map(({ name, displayName }) => ({ name, displayName })),
    };
  };

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
  // 대기열은 쓰는 시점마다 내린다. 현장의 현실적 실패는 정상 종료가 아니라 전원 차단이고,
  // `before-quit` 하나에만 걸어 두면 그 순간의 실적이 통째로 사라진다.
  ipcMain.handle('outbox:enqueue', (_e, endpoint: string, payload: string, at: string) => {
    localDb.enqueue(endpoint, payload, at);
    persist(localDb, dbPath);
  });
  ipcMain.handle('outbox:peek', (_e, limit?: number) => localDb.peekQueue(limit));
  ipcMain.handle('outbox:size', () => localDb.queueSize());
  ipcMain.handle('outbox:dequeue', (_e, id: number) => {
    localDb.dequeue(id);
    persist(localDb, dbPath);
  });

  // ⛔ 출력 경로는 **메인이 소유한다.** 렌더러가 준 경로에 그대로 쓰면 임의 위치에
  //    파일을 만들 수 있다. 렌더러는 이름과 형식만 넘긴다.
  //
  // ⛔ **형식은 서버가 정한다** — `rendition?format=png|pdf`(라벨은 이미지, 성적서는 문서).
  //    셸은 받은 것을 그대로 쓰고 확장자만 맞춘다. 내용을 다시 만들지 않는다(설계 결정 18 —
  //    클라이언트가 레이아웃을 그리면 단말마다 출력물이 달라진다).
  ipcMain.handle(
    'rendition:save',
    async (_e, bytes: Uint8Array, label: string, now: string, format: unknown) => {
      // 형식은 파일 경로 계산에 들어간다 — 아는 값인지 경계에서 막는다.
      if (!isRenditionFormat(format)) throw new UnknownFormatError(format);

      const rendition = { bytes, label, format };
      const filePath = join(renditionDir, toRenditionFileName(label, now, format));

      /*
       * ⛔ 화면에는 기술 사유를 보이지 않는다(사용자 지시). 그래도 사유를 버리지는 않는다 —
       *    키오스크에는 개발자도구가 없어 이 파일이 무슨 일이 났는지 아는 유일한 자리다.
       */
      const noteFailure = (
        available: readonly LoggedPrinter[],
        deviceName: string | null,
        cause: unknown,
      ) => {
        try {
          mkdirSync(logDir, { recursive: true });
          appendFileSync(
            join(logDir, 'print.log'),
            formatPrintLog({
              at: new Date().toISOString(),
              label,
              available,
              deviceName,
              preferred: process.env.POP_PRINTER_NAME,
              reason: reasonOf(cause),
            }),
          );
        } catch {
          /* 기록을 남기지 못한 것이 인쇄 실패를 덮지 않는다 — 원인은 아래에서 그대로 던진다. */
        }
      };

      /*
       * ⭐ **기록을 먼저 남기고 인쇄한다.** 인쇄가 실패해도 서버가 그려 준 것은 단말에 남아,
       *    현장에서 무엇이 나왔어야 하는지 확인할 수 있다. 순서를 뒤집으면 프린터가 죽은 날의
       *    출력물이 아무 데도 남지 않는다.
       */
      await printer.print(rendition, { kind: 'file', filePath });

      const { choice, available } = await resolvePrinter();

      /* ⛔ 보낼 곳이 없는 것을 성공으로 두지 않는다(공유계약 F-6) — 화면이 인쇄 실패로 낸다. */
      if (choice.kind === 'none') {
        const error = new PrinterUnavailableError(
          available.map((printer) => printer.displayName ?? printer.name),
        );
        noteFailure(available, null, error);
        throw error;
      }

      /* 지정이 없으면 장치를 싣지 않는다 — 받는 쪽이 OS 기본으로 보낸다. */
      const deviceName = choice.kind === 'named' ? choice.deviceName : undefined;

      try {
        await printer.print(rendition, { kind: 'printer', deviceName });
      } catch (cause) {
        noteFailure(available, deviceName ?? '(OS 기본)', cause);
        throw cause;
      }

      return filePath;
    },
  );

  const window = new BrowserWindow(
    createKioskWindowOptions({ preloadPath: PRELOAD_PATH, isDev: IS_DEV }),
  );
  printHost = window;

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
