import { type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabel } from '../../patterns/lookup-display';
import { PaneEmptyIcon } from '../../patterns/pane-empty-icon';
import { dispositionTypeLabel } from './disposition-codes';
import type { DispositionLookup } from './lookups';
import type { DecisionRow } from './types';

export interface DecisionHistoryProps {
  rows: DecisionRow[];
  uoms: DispositionLookup;
  isLoading: boolean;
  isError: boolean;
}

export const DecisionHistory = ({ rows, uoms, isLoading, isError }: DecisionHistoryProps) => {
  const t = messages.dispositionDecision;
  const columns: Column<DecisionRow>[] = [
    /* 판정 일시 · 처분 · 수량 · 단위 · 사유 차례(사용자 지시 · #223). */
    {
      key: 'decidedAt',
      align: 'center',
      header: t.fields.decidedAt,
      render: (row) => row.decidedAtText,
    },
    {
      key: 'dispositionTypeCode',
      align: 'center',
      header: t.fields.dispositionTypeCode,
      render: (row) => dispositionTypeLabel(row.dispositionTypeCode),
    },
    {
      key: 'qty',
      align: 'center',
      header: t.fields.decisionQty,
      render: (row) => row.decisionQtyText,
    },
    {
      key: 'uom',
      align: 'center',
      header: t.fields.uom,
      render: (row) => lookupDisplayLabel(uoms, row.uomId),
    },
    { key: 'reason', align: 'center', header: t.fields.reason, render: (row) => row.reason },
  ];

  /*
   * 상세 아래 「판정 이력」 탭의 내용(사용자 지시 · #223) — 이력이 없으면 표 안에 문구 한 줄(omf-all-around#275).
   * 남은 수량은 판정 구역 머리로 옮겼다(조회 시점 참고값인 것은 그대로 — 최종 판정은 저장 때 서버가 낸다).
   */
  return (
    <div className="disposition-decision-history" role="group" aria-label={t.panes.decisions}>
      {isLoading ? (
        <div role="status" aria-label={t.decisions.loading}>
          <SkeletonText lines={2} />
        </div>
      ) : isError ? (
        <p className="field-note">{t.decisions.unavailable}</p>
      ) : (
        <div className="disposition-table disposition-decision-table">
          <Table
            density="compact"
            caption={<span className="disposition-table-caption">{t.panes.decisions}</span>}
            columns={columns}
            rows={rows}
            getRowId={(row) => String(row.dispositionDecisionId)}
            /* 이력이 없어도 표 머리는 두고 표 안에 한 줄(사용자 지시 · #223 · omf-all-around#275). */
            empty={
              /* 다른 빈 목록과 같이 아이콘 + 문구(omf-all-around#275). */
              <EmptyState
                size="sm"
                icon={<PaneEmptyIcon name="assignment" />}
                title={t.decisions.empty}
              />
            }
          />
        </div>
      )}
    </div>
  );
};
