import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { PuField, PuNote, PuTiles } from '../../patterns/pop-uniform';
import type { ReissueReasonOption } from './queries';

const t = messages.popMaterialLotLabel.reprint;

export interface ReasonPickerProps {
  reasons: readonly ReissueReasonOption[];
  isLoading: boolean;
  isError: boolean;
  selected: string | null;
  isLocked: boolean;
  onSelect: (code: string) => void;
  /** 칸 이름 — 비우면 「사유」. 분할 LOT 라벨은 「재인쇄 사유」(시안). */
  label?: string;
  /** 이름 줄 오른쪽 한 줄(사유가 왜 필요한지). */
  hint?: ReactNode;
}

/**
 * 재인쇄 사유 — **타일로 한 번에 고른다**(규칙 7 · 개편안 2026-10-24).
 *
 * ⛔ **화면이 값을 지어내지 않는다.** 이름은 코드 사전이 준 그대로다(계약 명시 · 고객이 늘린다).
 * ⚠ 비어 오면 보낼 수 없다 — 사유 없이 보내면 422 다. 감추지 않고 왜 못 하는지 말한다.
 */
export const ReasonPicker = ({
  reasons,
  isLoading,
  isError,
  selected,
  isLocked,
  onSelect,
  label = t.reasonLabel,
  hint,
}: ReasonPickerProps) => (
  <PuField label={label} required aside={hint}>
    {isError ? <PuNote tone="bad">{t.reasonsFailed}</PuNote> : null}
    {!isError && !isLoading && reasons.length === 0 ? (
      <PuNote tone="warn">{t.reasonsEmpty}</PuNote>
    ) : null}
    {reasons.length === 0 ? null : (
      <PuTiles
        label={label}
        cols={Math.min(4, reasons.length)}
        options={reasons.map((reason) => ({ value: reason.code, label: reason.name }))}
        value={selected}
        disabled={isLocked}
        onChange={onSelect}
      />
    )}
  </PuField>
);
