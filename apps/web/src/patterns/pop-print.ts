/**
 * 그린 것을 **셸(Electron)에 넘기는 유일한 자리.**
 *
 * ⭐ **왜 한 곳인가.** 이 통로 선언이 화면마다 있었다 — 다섯 곳이었고(`goods-issue-qr` ·
 *    `shipping-packing-label` · `repack-label-issue` · `packing-label-reprint` ·
 *    `production-result`), **그중 둘이 `format` 에서 `'pdf'` 를 빠뜨려** 셸 정본과 어긋나
 *    있었다. 지금은 `'pdf'` 를 넘기는 자리가 없어 드러나지 않았을 뿐이고, 통로의 모양이
 *    화면마다 다르면 셸이 바뀔 때 **어느 화면이 틀렸는지 타입 검사가 말해 주지 못한다.**
 *
 * ⚠ **정본은 셸의 `preload` 다** — `apps/pop/src/preload/index.ts` 의
 *   `save(bytes, label, now, format: 'png' | 'pdf' | 'tspl')`. 여기를 고치면 그쪽을 함께 본다.
 *
 * ⛔ **서버를 부르지 않는다.** 발행 기록과 그리기는 다른 걸음이다(공유계약 K-4). 이 파일은
 *    셸이 있는지 보고, 있으면 넘기고, 결과를 사실대로 돌려준다.
 *
 * ⛔ **셸이 없을 때 성공으로 접지 않는다.** 관리웹 브라우저에는 통로가 없고 그것은 오류가
 *    아니라 「이 폼팩터에는 프린터가 없다」는 사실이다. 그때 인쇄를 「성공」으로 보고하면
 *    **나오지 않은 라벨이 나온 것으로 남는다** — 계약이 인쇄 보고 경로를 따로 둔 까닭이다
 *    (공유계약 F-6).
 *
 * ⭐ **`Window.pop` 전역 선언도 여기가 갖는다.** 자재 LOT 라벨 슬라이스가 「이 화면이 셸
 *    통로를 쓰는 첫 자리라 슬라이스가 소유한다 — **세 번째 화면이 같은 것을 필요로 하면 그때
 *    `patterns/` 로 올린다**」고 적어 두었다. 여섯 번째다.
 *
 * ⚠ **같은 자리를 두 곳에서 선언하지 않는다.** 모양이 갈렸을 때 타입 검사가 알려 주지
 *   못한다. 화면 고유의 전역(진단용 등)은 그 화면이 제 자리에서 덧댄다.
 */

import type { LabelRenditionFormat } from './pop-label-rendition';

/**
 * 셸이 받는 형식. **`'pdf'` 를 포함한다** — 셸 `preload` 가 그렇게 열어 두었다.
 *
 * ⚠ 라벨만 찍는 화면은 `'png' | 'tspl'`(`LabelRenditionFormat`)만 넘기지만, 통로의 «모양»은
 *   셸이 정하지 부르는 쪽이 정하지 않는다.
 */
export type PopRenditionFormat = LabelRenditionFormat | 'pdf';

/** 셸이 여는 통로 중 출력물에 관한 부분. */
export interface RenditionShell {
  /** 바이트를 셸이 저장·인쇄하고 만들어진 경로를 돌려준다. */
  save: (
    bytes: Uint8Array,
    label: string,
    now: string,
    format: PopRenditionFormat,
  ) => Promise<string>;
}

/** 셸이 `contextBridge` 로 심는 것 중 **출력물에 관한 부분**. 브라우저에는 없다. */
export interface PopShellApi {
  rendition: RenditionShell;
}

declare global {
  interface Window {
    /** POP 셸(Electron)이 심는다. 브라우저에서는 `undefined` 다. */
    pop?: PopShellApi;
  }
}

/**
 * 읽을 때는 **반쯤 열린 상태까지 헤아린다** — 전역 선언은 「제대로 심겼을 때의 모양」이고,
 * 실제로는 `pop` 만 있고 `rendition` 이 없는 순간(preload 순서)이 있다.
 */
interface ShellCarrier {
  pop?: { rendition?: RenditionShell };
}

/**
 * 셸 통로를 집는다. 없으면 `null` — **지어내지 않는다.**
 *
 * ⚠ `rendition` 이 있는지가 아니라 **`save` 가 함수인지**를 본다. 통로가 반쯤 열린 상태
 *   (객체는 있는데 함수가 없다)를 「있다」로 받으면 부르는 자리에서 터진다.
 */
export const renditionShell = (): RenditionShell | null => {
  const shell = (globalThis as unknown as ShellCarrier).pop?.rendition;

  return typeof shell?.save === 'function' ? shell : null;
};

/** 셸 위에서 도는가. 화면은 이 값으로 인쇄 안내를 가른다. */
export const hasPrintBridge = (): boolean => renditionShell() !== null;

export type PrintAttempt =
  | { kind: 'printed' }
  /** 통로가 없다 — **시도하지 않았다.** 실패와 다르다. */
  | { kind: 'noBridge' }
  | { kind: 'failed'; reason: string };

/** 실패 사유 길이 상한 — 계약이 보고 본문에서 이 길이를 받는다. */
const FAILURE_REASON_MAX_LENGTH = 500;

const reasonOf = (cause: unknown): string => {
  const text = cause instanceof Error ? cause.message : String(cause);

  return text.slice(0, FAILURE_REASON_MAX_LENGTH);
};

/**
 * 그린 것을 셸에 넘긴다. **던지지 않는다** — 인쇄 실패는 예외 상황이 아니라 정상적으로
 * 일어나는 결과이고, 부르는 쪽은 그 결과를 서버에 보고해야 한다.
 */
export const sendToPrinter = async (
  bytes: Uint8Array,
  label: string,
  format: PopRenditionFormat,
): Promise<PrintAttempt> => {
  const shell = renditionShell();

  if (shell === null) return { kind: 'noBridge' };

  try {
    await shell.save(bytes, label, new Date().toISOString(), format);

    return { kind: 'printed' };
  } catch (cause) {
    return { kind: 'failed', reason: reasonOf(cause) };
  }
};
