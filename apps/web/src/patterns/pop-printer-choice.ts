import { useSyncExternalStore } from 'react';

/**
 * 이 단말이 고른 프린터 — 맨 위 줄 프린터 칩에서 고르고, 이 단말의 모든 발행이 따른다
 * (사용자 지시 2026-11-19 「여기서 프린터 변경할 수도 있게」).
 *
 * ⭐ 단말 코드마다 따로 기억한다(`localStorage`). 단말 코드는 공통 메뉴(`PopChrome`)가 알려 준다 —
 *    모르면(화면 시험 · 단독 실행) 기억한 것이 없는 것으로 보고 기본 프린터를 쓴다.
 * ⭐ 고르는 규칙(`preferPrinter`): 고른 프린터가 그 문서 유형 목록에 있으면 그것, 없으면 그 목록의 기본
 *    (`isDefault`) → 첫 대. 목록은 화면마다 문서 유형으로 걸러 오므로, 그 유형을 못 찍는 프린터는 고른
 *    것이라도 쓰지 않는다.
 * ⚠ 저장소는 닿는 것만으로 던지는 브라우저가 있어 감싼다.
 */
const KEY_PREFIX = 'omf-mes.pop.terminal-printer.';

let terminalCode: string | null = null;
const listeners = new Set<() => void>();

export const terminalPrinterKey = (code: string): string => `${KEY_PREFIX}${code}`;

/** 공통 메뉴가 지금 단말 코드를 알린다. */
export const setPrinterTerminal = (code: string | null): void => {
  terminalCode = code;
};

/** 이 단말이 고른 프린터 이름. 고른 적이 없거나 단말을 모르면 `null`. */
export const terminalPrinterName = (): string | null => {
  if (terminalCode === null) return null;

  try {
    const raw = globalThis.localStorage.getItem(terminalPrinterKey(terminalCode));

    return raw === null || raw.trim() === '' ? null : raw;
  } catch {
    return null;
  }
};

/** 고른 프린터를 이 단말에 기억하고, 칩을 다시 그리게 알린다. */
export const chooseTerminalPrinter = (name: string): void => {
  if (terminalCode !== null) {
    try {
      globalThis.localStorage.setItem(terminalPrinterKey(terminalCode), name);
    } catch {
      /* 저장이 막혔다 — 이번 실행 동안은 화면이 받은 값(`onSelect`)으로 나간다. */
    }
  }
  listeners.forEach((listener) => {
    listener();
  });
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** 고른 프린터 이름을 읽고, 바뀌면 다시 그린다. */
export const useTerminalPrinterName = (): string | null =>
  useSyncExternalStore(subscribe, terminalPrinterName, terminalPrinterName);

/** 고른 프린터가 목록에 있으면 그것, 없으면 기본(`isDefault`) → 첫 대. 목록이 비면 `null`. */
export const preferPrinter = <T extends { printerName: string; isDefault: boolean }>(
  printers: readonly T[],
  chosen: string | null = terminalPrinterName(),
): T | null =>
  (chosen === null ? undefined : printers.find((printer) => printer.printerName === chosen)) ??
  printers.find((printer) => printer.isDefault) ??
  printers[0] ??
  null;
