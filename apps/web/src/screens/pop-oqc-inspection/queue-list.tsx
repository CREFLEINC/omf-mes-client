import { messages } from '@omf-mes/i18n';
import type { Ref } from 'react';

import { PuChip, puCx, type PuChipTone } from '../../patterns/pop-uniform';
import { toStatusBadge, type StatusTone } from '../oqc-inspection/status-badge';
import type { InspectionQueueRow } from '../oqc-inspection/types';
import { withUom, type UomLookup } from '../oqc-inspection/uom-lookup';

const t = messages.popOqcInspection.queue;
const detail = messages.popOqcInspection.detail;

const CHIP_TONE: Record<StatusTone, PuChipTone> = {
  idle: 'idle',
  info: 'info',
  success: 'ok',
  warning: 'warn',
  error: 'bad',
};

export interface PopQueueListProps {
  rows: InspectionQueueRow[];
  selectedId: number | null;
  onSelect: (inspectionRequestId: number) => void;
  /** 한 쪽 건수를 재는 칸(구획 높이에 들어가는 만큼 · #295). */
  listRef: Ref<HTMLDivElement>;
  /** 수량 옆 단위 코드 — 모르면 숫자만. */
  uomOf: UomLookup['codeOf'];
}

/**
 * 판정 목록(#295) — 항목마다 의뢰번호 · 상태 · 품목 · 검사 수량. 고른 의뢰는 빨간 선택 표시.
 *
 * ⚠ 관리웹 W-04-03 의 `QueueTable` 을 쓰지 않는다 — 그쪽은 밑줄 링크 한 칸만 눌리는 관리웹 관용구다.
 */
export const PopQueueList = ({ rows, selectedId, onSelect, listRef, uomOf }: PopQueueListProps) => (
  <div ref={listRef} className="pu-list pu-fit" role="group" aria-label={t.caption}>
    {rows.map((row) => {
      const selected = row.inspectionRequestId === selectedId;
      const badge = toStatusBadge(row.statusCode);

      return (
        <button
          key={row.inspectionRequestId}
          type="button"
          className={puCx('pu-item', selected && 'is-selected')}
          aria-pressed={selected}
          aria-label={t.selectRow(row.inspectionRequestNo)}
          onClick={() => {
            onSelect(row.inspectionRequestId);
          }}
        >
          <span className="pu-item-top">
            <span className="no">{row.inspectionRequestNo}</span>
            <span className="chips">
              <PuChip tone={CHIP_TONE[badge.tone]}>{badge.label}</PuChip>
            </span>
          </span>
          <span className="pu-item-sub">
            <span>
              {t.columns.item} <b>{detail.idValue(row.itemId)}</b>
            </span>
            <span>
              {t.columns.qty} <b>{withUom(String(row.targetQty), uomOf(row.uomId))}</b>
            </span>
          </span>
        </button>
      );
    })}
  </div>
);
