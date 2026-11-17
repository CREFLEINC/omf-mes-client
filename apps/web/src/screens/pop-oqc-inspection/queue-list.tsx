import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { toStatusBadge } from '../oqc-inspection/status-badge';
import type { InspectionQueueRow } from '../oqc-inspection/types';

const t = messages.popOqcInspection.queue;
const detail = messages.popOqcInspection.detail;

export interface PopQueueListProps {
  rows: InspectionQueueRow[];
  selectedId: number | null;
  onSelect: (inspectionRequestId: number) => void;
  /** 줄이 없을 때 목록 자리에 서는 것(불러오는 중·없음·실패). */
  empty: ReactNode;
}

/**
 * 판정 목록 — 자재 관리 LOT 라벨 화면 왼쪽 목록과 같은 카드 모양(사용자 지시 2026-11-17 · #291).
 * 카드 전체가 누르는 자리이고, 고른 카드는 차콜 바탕으로 드러난다(`pop-mlot-supplier`).
 *
 * ⚠ 관리웹 W-04-03 의 `QueueTable` 을 쓰지 않는다 — 그쪽은 밑줄 링크 한 칸만 눌리는 관리웹 관용구다.
 */
export const PopQueueList = ({ rows, selectedId, onSelect, empty }: PopQueueListProps) => {
  if (rows.length === 0) return <div className="pop-mlot-empty">{empty}</div>;

  return (
    <ul className="pop-mlot-suppliers pop-oqc-queue" aria-label={t.caption}>
      {rows.map((row) => {
        const selected = row.inspectionRequestId === selectedId;
        const badge = toStatusBadge(row.statusCode);

        return (
          <li key={row.inspectionRequestId}>
            <button
              type="button"
              className="pop-mlot-supplier"
              aria-pressed={selected}
              aria-label={t.selectRow(row.inspectionRequestNo)}
              onClick={() => {
                onSelect(row.inspectionRequestId);
              }}
            >
              <span className="pop-mlot-supplier-name">{row.inspectionRequestNo}</span>
              <Chip variant="status" size="md" status={badge.tone}>
                {badge.label}
              </Chip>
              <span className="pop-mlot-supplier-sub">
                {`${t.columns.item} ${detail.idValue(row.itemId)} · ${t.columns.qty} ${String(row.targetQty)}`}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};
