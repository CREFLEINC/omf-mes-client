import { afterEach, describe, expect, it } from 'vitest';

import {
  choosePrinter,
  PRINTER_STORAGE_KEY,
  rememberPrinterName,
  storedPrinterName,
} from './printer-choice';
import type { PrinterView } from './types';

const printer = (printerName: string, isDefault = false): PrinterView => ({
  printerName,
  displayName: printerName,
  status: 'READY',
  statusMessage: null,
  isDefault,
});

const printers = [printer('PDF'), printer('HT800', true), printer('HT800 #2')];

afterEach(() => {
  localStorage.clear();
});

describe('choosePrinter', () => {
  it('고른 것도 기억도 없으면 셸의 출력 대상(OS 기본)을 고른다', () => {
    expect(choosePrinter(printers, null, null)).toEqual({
      printer: printers[1],
      missingStoredName: null,
    });
  });

  it('기억해 둔 프린터가 있으면 그것을, 이번에 고른 것이 있으면 그것을 먼저 쓴다', () => {
    expect(choosePrinter(printers, null, 'HT800 #2').printer?.printerName).toBe('HT800 #2');
    expect(choosePrinter(printers, 'PDF', 'HT800 #2').printer?.printerName).toBe('PDF');
  });

  it('⛔ 기억해 둔 프린터가 목록에서 사라졌으면 기본으로 돌아가고 그 이름을 알린다', () => {
    expect(choosePrinter(printers, null, '사라진 프린터')).toEqual({
      printer: printers[1],
      missingStoredName: '사라진 프린터',
    });
  });

  it('목록이 비었으면 고를 것이 없다', () => {
    expect(choosePrinter([], null, 'HT800')).toEqual({ printer: null, missingStoredName: null });
  });
});

describe('단말 기억', () => {
  it('고른 이름을 이 화면 전용 키에 남기고 다시 읽는다', () => {
    expect(storedPrinterName()).toBeNull();
    rememberPrinterName('HT800 #2');
    expect(localStorage.getItem(PRINTER_STORAGE_KEY)).toBe('HT800 #2');
    expect(storedPrinterName()).toBe('HT800 #2');
  });
});
