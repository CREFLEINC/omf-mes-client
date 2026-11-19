import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  preferPrinter,
  setPrinterTerminal,
  terminalPrinterKey,
  terminalPrinterName,
} from '../../patterns/pop-printer-choice';
import { PrinterChip } from './printer-chip';
import type { PrinterView } from './types';

const picker = messages.popChrome.printerPicker;
const t = messages.popMaterialLotLabel.printer;

const view = (printerName: string, isDefault: boolean): PrinterView => ({
  printerName,
  displayName: `${printerName} 표시`,
  status: 'READY',
  statusMessage: null,
  isDefault,
});

const A = view('PRN-A', true);
const B = view('PRN-B', false);

const renderChip = (printers: PrinterView[], selected: PrinterView | null) => {
  const onSelect = vi.fn();
  render(
    <PrinterChip
      printers={printers}
      selected={selected}
      isLoading={false}
      isError={false}
      isLocked={false}
      onRetry={() => undefined}
      onSelect={onSelect}
      showNone
    />,
  );
  return onSelect;
};

describe('맨 위 줄 프린터 칩 — 「프린터 선택」 창(사용자 지시 2026-11-19)', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    setPrinterTerminal('T-1');
  });

  afterEach(() => {
    setPrinterTerminal(null);
    globalThis.localStorage.clear();
  });

  it('한 대뿐이어도 창이 열리고, 지금 것이 골라져 있으며 기본 표시가 붙는다', async () => {
    const user = userEvent.setup();
    renderChip([A], A);

    await user.click(screen.getByRole('button', { name: `${t.choose}: ${A.displayName}` }));

    const dialog = screen.getByRole('dialog', { name: picker.title });
    const row = within(dialog).getByRole('option', { name: new RegExp(A.displayName, 'u') });
    expect(row).toHaveAttribute('aria-selected', 'true');
    expect(within(row).getByText(picker.defaultMark)).toBeInTheDocument();
    expect(within(row).getByText(picker.status.READY)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: picker.cancel })).toBeInTheDocument();
  });

  it('다른 줄을 누르고 [선택]하면 이 단말 코드로 기억하고 화면에 알린다', async () => {
    const user = userEvent.setup();
    const onSelect = renderChip([A, B], A);

    await user.click(screen.getByRole('button', { name: `${t.choose}: ${A.displayName}` }));
    await user.click(screen.getByRole('option', { name: new RegExp(B.displayName, 'u') }));
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: picker.select }));

    expect(onSelect).toHaveBeenCalledWith('PRN-B');
    expect(globalThis.localStorage.getItem(terminalPrinterKey('T-1'))).toBe('PRN-B');
    expect(terminalPrinterName()).toBe('PRN-B');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('[취소]는 아무것도 바꾸지 않는다', async () => {
    const user = userEvent.setup();
    const onSelect = renderChip([A, B], A);

    await user.click(screen.getByRole('button', { name: `${t.choose}: ${A.displayName}` }));
    await user.click(screen.getByRole('option', { name: new RegExp(B.displayName, 'u') }));
    await user.click(screen.getByRole('button', { name: picker.cancel }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(terminalPrinterName()).toBeNull();
  });

  it('프린터가 없으면 칩은 「없음」 그대로, 누르면 빈 안내가 서고 [선택]은 꺼진다', async () => {
    const user = userEvent.setup();
    renderChip([], null);

    await user.click(screen.getByRole('button', { name: t.choose }));

    expect(screen.getByText(picker.empty)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: picker.select })).toBeDisabled();
  });
});

describe('preferPrinter — 고른 것 → 기본 → 첫 대', () => {
  afterEach(() => {
    setPrinterTerminal(null);
    globalThis.localStorage.clear();
  });

  it('고른 프린터가 목록에 있으면 그것, 없으면(문서 유형 미지원·사라짐) 기본, 기본도 없으면 첫 대', () => {
    expect(preferPrinter([A, B], 'PRN-B')?.printerName).toBe('PRN-B');
    expect(preferPrinter([A, B], 'PRN-GONE')?.printerName).toBe('PRN-A');
    expect(preferPrinter([view('X', false), view('Y', false)], 'PRN-GONE')?.printerName).toBe('X');
    expect(preferPrinter([], 'PRN-B')).toBeNull();
  });

  it('단말 코드마다 따로 기억하고, 단말을 모르면 기억한 것이 없는 것으로 본다', () => {
    globalThis.localStorage.setItem(terminalPrinterKey('T-1'), 'PRN-B');

    setPrinterTerminal('T-1');
    expect(preferPrinter([A, B])?.printerName).toBe('PRN-B');
    setPrinterTerminal('T-2');
    expect(preferPrinter([A, B])?.printerName).toBe('PRN-A');
    setPrinterTerminal(null);
    expect(preferPrinter([A, B])?.printerName).toBe('PRN-A');
  });
});
