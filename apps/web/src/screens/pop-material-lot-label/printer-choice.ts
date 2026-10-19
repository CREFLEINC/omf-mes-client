import { toHeadPrinter, type PrinterView } from './types';

/**
 * 이 화면(P-01-01)이 고른 프린터 — **단말이 기억한다**(2단계 검증 2026-10-16 · 이 화면 전용).
 *
 * ⭐ 처음에는 셸이 알려 준 출력 대상(기동 시 지정값 → OS 기본)을 고른 것으로 본다. 다른 것을 고르면
 *    이 단말의 저장소에 남기고 다음에도 그것을 쓴다. 다른 화면의 인쇄는 이 값을 읽지 않는다.
 *
 * ⚠ 저장소 읽기·쓰기를 감싼다 — 저장이 막힌 환경에서 닿는 것만으로 던지는 브라우저가 있다
 *   (`patterns/locale-preference` 와 같은 사정).
 */
export const PRINTER_STORAGE_KEY = 'omf-mes.pop-material-lot-label.printer';

export const storedPrinterName = (): string | null => {
  try {
    const raw = globalThis.localStorage.getItem(PRINTER_STORAGE_KEY);

    return raw === null || raw.trim() === '' ? null : raw;
  } catch {
    return null;
  }
};

export const rememberPrinterName = (name: string): void => {
  try {
    globalThis.localStorage.setItem(PRINTER_STORAGE_KEY, name);
  } catch {
    /* 저장이 막혔다. 이번 실행 동안은 고른 것이 그대로 쓰인다. */
  }
};

export interface PrinterChoice {
  /** 지금 인쇄가 나갈 프린터. 목록이 비었으면 `null`. */
  printer: PrinterView | null;
  /** 기억해 둔 프린터가 목록에서 사라져 기본으로 돌아갔다 — 그 이름. 아니면 `null`. */
  missingStoredName: string | null;
}

/**
 * 고른 것(이번 실행) → 기억해 둔 것 → 셸의 출력 대상(`isDefault`) → 첫 대 순으로 정한다.
 *
 * ⛔ 기억해 둔 이름이 목록에 없으면 그 이름으로 보내지 않는다 — 셸이 「목록에 없는 이름」을 다른
 *    프린터로 대신 보내지 않으므로 인쇄가 통째로 실패한다. 기본으로 돌아가고 그 사실을 말한다.
 */
export const choosePrinter = (
  printers: readonly PrinterView[],
  picked: string | null,
  stored: string | null,
): PrinterChoice => {
  const byName = (name: string | null) =>
    name === null ? undefined : printers.find((printer) => printer.printerName === name);
  const fallback = toHeadPrinter([...printers]);

  const chosen = byName(picked) ?? byName(stored);
  if (chosen !== undefined) return { printer: chosen, missingStoredName: null };

  return {
    printer: fallback,
    missingStoredName: stored !== null && printers.length > 0 ? stored : null,
  };
};
