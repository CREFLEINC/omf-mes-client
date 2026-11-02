import { type Column, EmptyState, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabel } from '../../patterns/lookup-display';
import { codeValueLabel } from './disposition-codes';
import type { DispositionLookup } from './lookups';
import type { NonconformanceDetailView, NonconformanceLotRow } from './types';

export interface DetailPaneProps {
  view: NonconformanceDetailView;
  items: DispositionLookup;
  uoms: DispositionLookup;
  /** 심각도·상태의 표시명(G-32) — 목록 열과 같은 조회를 받는다. 모르는 코드는 코드 그대로(G-9). */
  severity: DispositionLookup;
  status: DispositionLookup;
}

/**
 * 부적합 기본 정보 · 설명 · 대상 LOT(사용자 시안 · omf-all-around#223) — 세 칸 두 줄로 줄이고, 설명은 그 아래 한 줄,
 * LOT 표는 LOT · 수량 · 품질 상태만. 판정으로 바뀐 상태가 표에 남지 않는다는 상시 안내(A-11)는 걷었다 — 표의 품질
 * 상태는 지금 값이다.
 */
export const DetailPane = ({ view, items, uoms, severity, status }: DetailPaneProps) => {
  const t = messages.dispositionDecision;
  const unitOf = (uomId: number | undefined): string =>
    uomId === undefined ? '' : ` ${lookupDisplayLabel(uoms, uomId)}`;
  const columns: Column<NonconformanceLotRow>[] = [
    { key: 'lotNo', header: t.fields.lotNo, render: (row) => row.lotNoText },
    {
      key: 'qty',
      header: t.fields.qty,
      align: 'end',
      render: (row) => `${row.affectedQtyText}${unitOf(row.uomId)}`,
    },
    {
      key: 'qualityStatus',
      header: t.fields.qualityStatus,
      render: (row) => t.values.qualityStatus[row.qualityStatusCode] ?? row.qualityStatusCode,
    },
  ];

  return (
    <div className="disposition-detail">
      <dl className="disposition-detail-facts">
        {[
          [t.fields.nonconformanceNo, view.nonconformanceNo],
          [t.fields.item, lookupDisplayLabel(items, view.itemId)],
          [t.fields.severityCode, codeValueLabel(severity, view.severityCode)],
          [t.fields.openedAt, view.openedAtText],
          [t.detail.affectedQty, `${view.affectedQtyText}${unitOf(view.lots[0]?.uomId)}`],
          [t.fields.statusCode, codeValueLabel(status, view.statusCode)],
        ].map(([label, value]) => (
          <div className="field-cell" key={label}>
            <dt className="field-label">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <p className="disposition-detail-description" aria-label={t.fields.description}>
        {view.description}
      </p>

      <section className="disposition-subsection" aria-label={t.panes.lots}>
        <h3 className="disposition-subtitle">{t.panes.lots}</h3>
        <div className="disposition-table disposition-lot-table">
          <Table
            density="compact"
            caption={<span className="disposition-table-caption">{t.panes.lots}</span>}
            columns={columns}
            rows={view.lots}
            getRowId={(row) => String(row.nonconformanceLotId)}
            empty={<EmptyState size="sm" title={t.detail.noLots} />}
          />
        </div>
      </section>
    </div>
  );
};
