/**
 * LOT 마다 라벨 출력과 함께 보낸 불량 줄(유형 이름 · 수량) — **단말이 기억한다**(사용자 결정 2026-11-16).
 *
 * 단말은 서버에서 불량 기록을 읽을 수 없어, 화면을 다시 열면 「입력한 실적」에서 불량이 사라졌다. 보낸 줄을
 * 이 단말의 저장소에 LOT 번호(id)별로 남겨 다시 열어도 보인다. 다른 단말에서 보낸 불량은 모른다.
 *
 * ⚠ 저장소 읽기·쓰기를 감싼다 — 저장이 막힌 환경에서 닿는 것만으로 던지는 브라우저가 있다
 *   (`pop-material-lot-label/printer-choice` 와 같은 사정). 못 읽으면 종전처럼 양품만 보인다.
 */
export const SENT_DEFECTS_STORAGE_KEY = 'omf-mes.production-result.sent-defects';

/** 기억하는 LOT 수 — 마감한 LOT 은 지우지만, 마감하지 않고 떠난 LOT 이 쌓이지 않게 오래된 것부터 버린다. */
const MAX_LOTS = 30;

export interface SentDefect {
  label: string;
  qty: string;
}

type Stored = Record<string, SentDefect[]>;

const readAll = (): Stored => {
  try {
    const raw = globalThis.localStorage.getItem(SENT_DEFECTS_STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);

    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Stored)
      : {};
  } catch {
    return {};
  }
};

const writeAll = (stored: Stored): void => {
  try {
    globalThis.localStorage.setItem(SENT_DEFECTS_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* 저장이 막혔다. 이번 실행 동안은 화면이 기억한다. */
  }
};

const isSentDefect = (value: unknown): value is SentDefect =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as SentDefect).label === 'string' &&
  typeof (value as SentDefect).qty === 'string';

/** 이 LOT 에 보낸 불량 줄. 기억이 없으면 `null`(모른다). */
export const storedSentDefects = (lotId: number): SentDefect[] | null => {
  const rows = readAll()[String(lotId)];

  return Array.isArray(rows) && rows.every(isSentDefect) ? rows : null;
};

export const rememberSentDefects = (lotId: number, rows: SentDefect[]): void => {
  const stored = readAll();
  stored[String(lotId)] = rows;
  /* 숫자 열쇠는 작은 순으로 나온다 — LOT id 는 늘기만 하므로 앞쪽이 오래된 LOT 이다. */
  const keys = Object.keys(stored);
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_LOTS))) delete stored[key];
  writeAll(stored);
};

/** LOT 을 마감했다 — 더 보일 일이 없다. */
export const forgetSentDefects = (lotId: number): void => {
  const stored = readAll();
  if (!(String(lotId) in stored)) return;
  delete stored[String(lotId)];
  writeAll(stored);
};
