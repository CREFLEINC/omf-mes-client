import { AlertBanner, type Column, EmptyState, Table } from '@crefle/web-ui';
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

export const DetailPane = ({ view, items, uoms, severity, status }: DetailPaneProps) => {
  const t = messages.dispositionDecision;
  const columns: Column<NonconformanceLotRow>[] = [
    { key: 'lotNo', header: t.fields.lotNo, render: (row) => row.lotNoText },
    { key: 'qty', header: t.fields.qty, align: 'end', render: (row) => row.affectedQtyText },
    { key: 'uom', header: t.fields.uom, render: (row) => lookupDisplayLabel(uoms, row.uomId) },
    {
      key: 'qualityStatus',
      header: t.fields.qualityStatus,
      render: (row) => row.qualityStatusText,
    },
  ];

  return (
    <div className="disposition-detail">
      <dl className="disposition-detail-facts">
        {[
          [t.fields.nonconformanceNo, view.nonconformanceNo],
          [t.fields.item, lookupDisplayLabel(items, view.itemId)],
          [t.fields.severityCode, codeValueLabel(severity, view.severityCode)],
          [t.fields.statusCode, codeValueLabel(status, view.statusCode)],
          [t.fields.openedAt, view.openedAtText],
        ].map(([label, value]) => (
          <div className="field-cell" key={label}>
            <dt className="field-label">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div
        className="field-cell disposition-content-card"
        role="group"
        aria-label={t.fields.description}
      >
        <span className="field-label">{t.fields.description}</span>
        <p>{view.description}</p>
      </div>

      <section className="disposition-subsection" aria-label={t.panes.lots}>
        <h3 className="disposition-subtitle">{t.panes.lots}</h3>
        {/*
         * A-11 — LOT 상태 변경이력 표가 데이터에 없다(omf-mes#64). 판정으로 일어난 전이가
         * 어디에도 남지 않으므로, 그 사실을 결과 표 머리에 적어 「보이지 않는 것」과
         * 「일어나지 않은 것」을 구분하게 한다.
         */}
        <div className="banner-slot">
          <AlertBanner variant="info">{t.detail.transitionHistoryUnavailable}</AlertBanner>
        </div>
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
