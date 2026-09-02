/**
 * 셸(Electron)로 출력물을 넘기는 자리.
 *
 * ⭐ **인쇄는 세 걸음의 가운데가 아니라 마지막 앞이다**(스펙 §5-5 · K-4). 서버는 발행 기록을
 * 만들고 그림을 그려 줄 뿐이고, 물리 인쇄는 셸이 한다. 그래서 이 파일은 **서버를 부르지
 * 않는다** — 셸이 있는지 보고, 있으면 넘기고, 결과를 사실대로 돌려준다.
 *
 * ⛔ **셸이 없을 때 성공으로 접지 않는다.** 관리웹 브라우저에서 이 화면을 열면 통로가 없다.
 * 그때 인쇄 결과를 「성공」으로 보고하면 **나오지 않은 라벨이 나온 것으로 남는다** — 계약이
 * 인쇄 보고 경로를 따로 둔 이유가 바로 그것이다.
 */

/** 셸이 여는 통로. `apps/pop/src/preload/index.ts` 가 `window.pop` 으로 노출한다. */
interface PopRenditionBridge {
  save: (bytes: Uint8Array, label: string, now: string, format: 'png' | 'pdf') => Promise<string>;
}

interface PopBridge {
  rendition: PopRenditionBridge;
}

const popBridge = (): PopBridge | null => {
  const candidate = (globalThis as { pop?: PopBridge }).pop;

  return candidate?.rendition === undefined ? null : candidate;
};

/** 셸 위에서 도는가. 화면은 이 값으로 인쇄 안내를 가른다. */
export const hasPrintBridge = (): boolean => popBridge() !== null;

export type PrintAttempt =
  | { kind: 'printed' }
  /** 통로가 없다 — 시도하지 않았다. 실패와 다르다. */
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
  format: 'png' | 'pdf',
): Promise<PrintAttempt> => {
  const bridge = popBridge();

  if (bridge === null) return { kind: 'noBridge' };

  try {
    await bridge.rendition.save(bytes, label, new Date().toISOString(), format);

    return { kind: 'printed' };
  } catch (cause) {
    return { kind: 'failed', reason: reasonOf(cause) };
  }
};
