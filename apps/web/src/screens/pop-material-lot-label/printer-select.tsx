import { messages } from '@omf-mes/i18n';

import { PopSelect } from '../../patterns/pop-select';
import type { PrinterView } from './types';

const t = messages.popMaterialLotLabel.printer;

export interface PrinterSelectProps {
  printers: readonly PrinterView[];
  selected: PrinterView | null;
  /** 셸이 고른 프린터를 받는가. 아니면(브라우저·옛 설치본) 칸을 막고 까닭을 말한다. */
  isSelectable: boolean;
  disabled: boolean;
  onSelect: (printerName: string) => void;
}

/**
 * 머리줄의 프린터 선택(2단계 검증 2026-10-16 · 이 화면 전용). 처음에는 셸의 출력 대상(OS 기본)이 골라져 있다.
 *
 * ⛔ 고를 수 없는 환경에서도 감추지 않는다 — 지금 어느 프린터로 나가는지를 보이고, 막힌 까닭을 옆에 적는다.
 */
export const PrinterSelect = ({
  printers,
  selected,
  isSelectable,
  disabled,
  onSelect,
}: PrinterSelectProps) => (
  <div className="pop-lot-printer-select">
    <PopSelect
      aria-label={t.select}
      options={printers.map((printer) => ({
        value: printer.printerName,
        label: printer.displayName,
      }))}
      value={selected?.printerName ?? null}
      disabled={disabled || !isSelectable}
      onChange={onSelect}
    />
    {isSelectable ? null : <span className="field-note">{t.shellOnly}</span>}
  </div>
);
