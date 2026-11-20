import { messages } from '@omf-mes/i18n';
import type { Ref } from 'react';

import { formatQty } from '../../patterns/package-qty';
import { PuChip, puCx, type PuChipTone } from '../../patterns/pop-uniform';
import {
  lotOverviewOf,
  OPEN_STATUSES,
  overviewStatus,
  type LotOverview,
} from '../oqc-inspection/shipment-oqc';
import { overviewText } from '../oqc-inspection/shipment-oqc-parts';
import { toStatusBadge, type StatusTone } from '../oqc-inspection/status-badge';
import type { InspectionQueueRow } from '../oqc-inspection/types';
import { withUom, type UomLookup } from '../oqc-inspection/uom-lookup';

const t = messages.popOqcInspection.queue;
const detail = messages.popOqcInspection.detail;
const ps = messages.popOqcInspection.shipment;

const CHIP_TONE: Record<StatusTone, PuChipTone> = {
  idle: 'idle',
  info: 'info',
  success: 'ok',
  warning: 'warn',
  error: 'bad',
};

/**
 * 출하 OQC 새 흐름의 검사 상태 칩 — 판정 대기인데 피킹 LOT 이 없으면 결과를 기록할 수 없으므로 「판정 불가」(주의 색),
 * 그 밖에는 LOT 판정 요약(사용자 지시 2026-11-20). 목록 카드와 상세 정보 띠가 함께 쓴다 — 같은 말을 한 번만 보인다.
 */
export const shipmentStateChip = (
  statusCode: string,
  overview: LotOverview,
): { text: string; tone: PuChipTone } =>
  overview.kind === 'none' && OPEN_STATUSES.includes(statusCode)
    ? { text: ps.cannotJudge, tone: 'warn' }
    : { text: overviewText(overview), tone: CHIP_TONE[overviewStatus(overview)] };

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

      const overview = lotOverviewOf(row);
      const itemLabel = row.itemCode ?? detail.idValue(row.itemId);
      const state = overview === null ? null : shipmentStateChip(row.statusCode, overview);

      return (
        <button
          key={row.inspectionRequestId}
          type="button"
          className={puCx('pu-item', 'oqc-item', selected && 'is-selected')}
          aria-pressed={selected}
          aria-label={t.selectRow(row.inspectionRequestNo)}
          onClick={() => {
            onSelect(row.inspectionRequestId);
          }}
        >
          {/* 출하 OQC 새 흐름은 지시서 번호 · 피킹 LOT 수 · LOT 판정 요약(피처 010 · 시안 P0406 목록). */}
          <span className="pu-item-top">
            <span className="no">{row.shipmentRequestNo ?? row.inspectionRequestNo}</span>
            {/*
             * 새 흐름: 의뢰 상태는 「검사 대기」처럼 뜻을 붙여 무채색으로, 색은 검사 상태 칩 하나만(색 강조 줄임 · 2026-11-20).
             * 옛 흐름 카드는 그대로다.
             */}
            <span className="chips">
              {state === null ? (
                <PuChip tone={CHIP_TONE[badge.tone]}>{badge.label}</PuChip>
              ) : (
                <>
                  <PuChip tone="idle">{ps.cardStatus(badge.label)}</PuChip>
                  <PuChip tone={state.tone}>{state.text}</PuChip>
                </>
              )}
            </span>
          </span>
          {overview === null ? (
            <span className="pu-item-sub">
              <span>
                {t.columns.item} <b>{detail.idValue(row.itemId)}</b>
              </span>
              <span>
                {t.columns.qty} <b>{withUom(String(row.targetQty), uomOf(row.uomId))}</b>
              </span>
            </span>
          ) : (
            <span className="pu-item-sub">
              {/* 품목은 굵게 먼저, LOT 수·수량은 뒤에 작게. LOT 이 없으면 품목만 — 위 칩이 한 번 말한다. */}
              <b className="oqc-item-code">{itemLabel}</b>
              {(row.pickedLotCount ?? 0) > 0 && (
                <span>
                  {ps.cardLots(
                    row.pickedLotCount ?? 0,
                    withUom(formatQty(row.pickedQty ?? 0), row.uomCode || null),
                  )}
                </span>
              )}
            </span>
          )}
        </button>
      );
    })}
  </div>
);
