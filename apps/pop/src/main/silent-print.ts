/**
 * 무음 인쇄 — **서버가 그린 출력물을 OS 프린터로 그대로 넘긴다**(#798 · #441 이 남겨 둔 자리).
 *
 * ⛔ 프린터 제어 언어(TSPL·ZPL 등)를 만들지 않는다. 앱이 아는 것은 「받은 바이트」와
 *    「어느 장치로 보내는가」뿐이고, 그림과 서식은 서버 소관이다(설계 결정 18).
 *
 * ⭐ **Electron 을 부르지 않는다.** 창 조작과 임시 파일 쓰기는 주입으로 받는다 — 그래야
 *    「어느 프린터를 고르는가」라는 판단을 앱을 띄우지 않고 감지기로 잴 수 있다. 실제 배선은
 *    `index.ts` 가 한다(`window-options` 와 같은 방식).
 *
 * ⚠ **출력물을 파일로 한 번 떨어뜨린 뒤 그 파일을 띄워 인쇄한다.** 바이트를 프린터로 직접
 *    밀지 않는 이유는 서식이 서버에 있기 때문이다 — 브라우저 엔진이 PNG·PDF 를 그려 주고,
 *    그 결과를 드라이버가 받는다. 임시 파일은 작업이 끝나면 지운다.
 */
import type { Rendition, RenditionFormat, SilentPrinter } from './print';

/**
 * OS 가 알려 주는 프린터 한 대. Electron `PrinterInfo` 중 **이 모듈이 쓰는 것만** 적는다 —
 * 전체를 옮기면 Electron 타입에 묶여 감지기에서 만들어 낼 수 없다.
 *
 * ⛔ **「기본 프린터」 표시를 여기서 찾지 않는다.** Electron 의 `PrinterInfo` 에는 그런 항목이
 *    없다(38 기준 — `description`·`displayName`·`name`·`options` 뿐). 종전 판은 있지도 않은
 *    `isDefault` 를 읽어 **언제나 `undefined`** 를 받았고, 그래서 기본 프린터를 제대로 지정한
 *    단말에서도 「기본 프린터가 지정돼 있지 않다」로 막혔다(실측). 기본이 무엇인지는 OS 가
 *    안다 — 우리가 알아내려 하지 않고 **OS 에 맡긴다**.
 */
export interface AvailablePrinter {
  /** 드라이버에 등록된 이름. 인쇄 요청에 그대로 실린다. */
  name: string;
  /** 사람에게 보이는 이름. 설정에 따라 `name` 과 다르다. */
  displayName?: string;
}

/**
 * 어디로 보낼지에 대한 판정.
 *
 * | 값 | 뜻 |
 * | --- | --- |
 * | `named` | 지정값이 가리킨 프린터로 보낸다 |
 * | `systemDefault` | **OS 기본 프린터에 맡긴다** — 장치 이름을 싣지 않는다 |
 * | `none` | 보낼 수 없다. 프린터가 없거나 지정한 이름이 목록에 없다 |
 */
export type PrinterChoice =
  { kind: 'named'; deviceName: string } | { kind: 'systemDefault' } | { kind: 'none' };

/**
 * 어디로 보낼지 정한다.
 *
 * ⛔ **지정한 이름이 목록에 없으면 다른 프린터로 대신 보내지 않는다.** 라벨은 종이가 나오는
 *    순간 자재에 붙는다 — 엉뚱한 장치에서 나온 것을 나중에 되돌릴 방법이 없다.
 *
 * ⭐ **지정이 없으면 OS 기본 프린터에 맡긴다.** 「어느 것이 기본인가」는 사용자가 Windows 에서
 *    정하는 것이고, 인쇄를 받는 쪽이 그것을 안다. 우리가 목록에서 알아내려 했다가 있지도 않은
 *    항목을 읽어 전부 막았다 — 판정을 아는 쪽으로 넘긴다.
 *
 * ⚠ 그래도 **프린터가 하나도 없으면 보내지 않는다.** 그때 인쇄로 넘기면 어디로도 가지 않은
 *   작업이 성공으로 보인다.
 */
export function selectPrinter(
  printers: readonly AvailablePrinter[],
  preferred?: string,
): PrinterChoice {
  const wanted = preferred?.trim();

  if (wanted !== undefined && wanted !== '') {
    const matched = printers.find(
      (printer) => printer.name === wanted || printer.displayName === wanted,
    );

    return matched === undefined ? { kind: 'none' } : { kind: 'named', deviceName: matched.name };
  }

  return printers.length === 0 ? { kind: 'none' } : { kind: 'systemDefault' };
}

/** 임시로 떨어뜨린 출력물. 인쇄가 끝나면 `path` 를 지운다. */
export interface StagedRendition {
  path: string;
  /** 인쇄용 창이 띄울 주소. */
  url: string;
  /** 떨어뜨린 그림 파일 자체. **OS 인쇄 경로가 이 파일을 그대로 찍는다.** */
  filePath: string;
}

/** 그림 파일 하나를 OS 에 맡겨 찍는 길. Windows 단말이 쓴다. */
export interface FilePrinter {
  print(job: { imagePath: string; deviceName?: string; jobName: string }): Promise<void>;
}

/**
 * OS 그림 인쇄가 다룰 수 있는 형식.
 *
 * ⛔ **문서(pdf)를 이 길로 보내지 않는다.** 그림 인쇄는 파일을 이미지로 열고, PDF 는 거기서
 *    던진다 — 성적서·보고서가 단말에서 언제나 실패하게 된다. 그 형식은 쪽이 나뉜 문서라
 *    문서 보기가 있는 창 경로에 맡긴다.
 */
const IMAGE_FORMATS: readonly RenditionFormat[] = ['png'];

/** 출력물을 띄워 인쇄하는 창. 작업마다 새로 열고 끝나면 닫는다. */
export interface PrintPage {
  /** 다 그려진 뒤 resolve 한다 — 그리기 전에 인쇄하면 빈 종이가 나온다. */
  load(url: string): Promise<void>;
  /**
   * 대화상자 없이 인쇄한다. 실패하면 사유와 함께 reject 한다.
   *
   * `deviceName` 이 `undefined` 면 **장치를 싣지 않는다** — 받는 쪽이 OS 기본으로 보낸다.
   */
  print(deviceName: string | undefined, jobName: string): Promise<void>;
  close(): void;
}

export interface SilentPrintDeps {
  openPage: () => PrintPage;
  /**
   * 주면 **창을 띄우지 않고 이 길로 찍는다.**
   *
   * ⭐ 브라우저 엔진의 무음 인쇄는 이 라벨 프린터에서 급지만 되고 백지가 나왔다(실측 · 세 회차).
   *   같은 프린터에서 드라이버 테스트 페이지와 사진 앱 인쇄는 정상이므로 경로 문제다.
   */
  printFile?: FilePrinter;
  stage: (bytes: Uint8Array, format: RenditionFormat) => Promise<StagedRendition>;
  discard: (path: string) => Promise<void>;
  /** 인쇄 한 걸음의 시간 상한. 시험이 짧게 줄여 쓴다. */
  timeoutMs?: number;
}

/**
 * 인쇄가 **끝나지도 실패하지도 않는** 상태를 끊는다.
 *
 * ⚠ 프린터를 껐다 켜는 중이거나 드라이버가 매달리면 인쇄 콜백이 영영 오지 않는다. 상한이
 *   없으면 화면이 「인쇄 중」에 갇혀 **성공도 실패도 보이지 않는다** — 현장에서 가장 먼저
 *   만나는 상황이고, 사용자는 다시 누를 수도 넘어갈 수도 없게 된다.
 */
export class PrintTimeoutError extends Error {
  constructor(step: string, ms: number) {
    super(`${step} — ${String(ms)}ms 안에 끝나지 않았다`);
    this.name = 'PrintTimeoutError';
  }
}

/** 기본 상한. 라벨 한 장이 이보다 오래 걸리면 정상이 아니다. */
export const DEFAULT_PRINT_TIMEOUT_MS = 30_000;

const withLimit = async <T>(task: Promise<T>, ms: number, step: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      task,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new PrintTimeoutError(step, ms)), ms);
      }),
    ]);
  } finally {
    /* 타이머를 남기면 인쇄가 제때 끝난 뒤에도 프로세스가 그만큼 붙잡혀 있다. */
    clearTimeout(timer);
  }
};

/**
 * 무음 인쇄 구현을 만든다.
 *
 * ⚠ **창과 임시 파일은 실패해도 반드시 치운다.** 키오스크는 재시작 없이 며칠씩 돌고,
 *   인쇄가 실패할 때마다 숨은 창이 남으면 그 단말이 서서히 느려진다.
 */
export function createSilentPrinter(deps: SilentPrintDeps): SilentPrinter {
  return {
    print: async (deviceName, rendition) => {
      const limit = deps.timeoutMs ?? DEFAULT_PRINT_TIMEOUT_MS;
      const staged = await deps.stage(rendition.bytes, rendition.format);

      /* OS 인쇄 경로가 있으면 창을 아예 열지 않는다 — 열지 않은 창은 비지도 않는다. */
      if (deps.printFile !== undefined && IMAGE_FORMATS.includes(rendition.format)) {
        try {
          await withLimit(
            deps.printFile.print({
              imagePath: staged.filePath,
              deviceName,
              jobName: rendition.label,
            }),
            limit,
            '프린터가 응답하지 않는다',
          );
        } finally {
          await deps.discard(staged.path).catch(() => undefined);
        }

        return;
      }
      /* ⚠ 창 열기 자체가 던져도 임시 파일은 지워야 한다 — 그래서 `try` 안에서 연다. */
      let page: PrintPage | null = null;

      try {
        page = deps.openPage();
        await withLimit(page.load(staged.url), limit, '출력물을 띄우지 못했다');
        await withLimit(page.print(deviceName, rendition.label), limit, '프린터가 응답하지 않는다');
      } finally {
        page?.close();
        /* 임시 파일 정리가 인쇄 결과를 뒤집지 않는다 — 종이는 이미 나왔거나 안 나왔다. */
        await deps.discard(staged.path).catch(() => undefined);
      }
    },
  };
}
