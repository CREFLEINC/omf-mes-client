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
 * 채번 대상 구획 맨 위의 프린터 선택(2단계 검증 2026-10-16 · 이 화면 전용). 처음에는 셸의 출력 대상(OS 기본)이
 * 골라져 있다. 대상 카드의 라벨·값 두 열과 같은 모양으로 선다.
 *
 * ⛔ 고를 수 없는 환경에서도 감추지 않는다 — 지금 어느 프린터로 나가는지를 보이고, 막힌 까닭을 아래에 적는다.
 */
export const PrinterSelect = ({
  printers,
  selected,
  isSelectable,
  disabled,
  onSelect,
}: PrinterSelectProps) => {
  // 프린터가 없다는 사실은 머리줄 상태가 말한다 — 여기서 되풀이하지 않는다.
  const reason = isSelectable ? null : t.shellOnly;
  return (
    <div className="pop-lot-printer-select">
      <span className="pop-lot-printer-select-label">{t.label}</span>
      <PopSelect
        aria-label={t.select}
        options={printers.map((printer) => ({
          value: printer.printerName,
          label: printer.displayName,
        }))}
        value={selected?.printerName ?? null}
        disabled={disabled || !isSelectable || printers.length === 0}
        onChange={onSelect}
      />
      {reason === null ? null : <span className="field-note">{reason}</span>}
    </div>
  );
};
