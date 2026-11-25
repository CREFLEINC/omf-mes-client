import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { lotStatusTone } from './cells';
import type { TraceLot } from './types';

const t = messages.traceTree;

export interface SummaryFact {
  key: string;
  label: string;
  value: ReactNode;
}

export interface TraceSummaryCardProps {
  lot: TraceLot;
  /** LOT 종류 이름(「자재 관리 LOT」·「제품 LOT」 등). */
  kindLabel: string;
  statusName: string;
  /** 시리얼로 들어온 줄이면 그 시리얼. */
  serialNo: string | null;
  /** 위 줄 — 입하·공급사·IQC(정방향) 또는 품목·출하(역방향). */
  facts: readonly SummaryFact[];
  /** 아래 줄 — 건수. */
  counts: readonly SummaryFact[];
  partial: boolean;
}

/** 고른 LOT 요약(오른쪽 맨 위) — 조회 기준 번호 · 종류 · 상태, 그 LOT 의 사실, 계보의 건수. */
export const TraceSummaryCard = ({
  lot,
  kindLabel,
  statusName,
  serialNo,
  facts,
  counts,
  partial,
}: TraceSummaryCardProps) => (
  <section className="trace-tree-summary" aria-label={t.detail.base}>
    <div className="trace-tree-summary-head">
      <span className="field-label">{t.detail.base}</span>
      <h3 className="subsection-title mono-cell">{lot.lotNo}</h3>
      <Chip variant="status" size="sm" status="info">
        {kindLabel}
      </Chip>
      <Chip variant="status" size="sm" status={lotStatusTone(lot.statusCode)}>
        {statusName}
      </Chip>
      {serialNo !== null && (
        <Chip variant="status" size="sm" status="idle">
          {t.detail.serial(serialNo)}
        </Chip>
      )}
      {partial && (
        <Chip variant="status" size="sm" status="warning">
          {t.detail.partialChip}
        </Chip>
      )}
    </div>
    {facts.length > 0 && (
      <dl className="trace-tree-summary-facts">
        {facts.map((fact) => (
          <div key={fact.key}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    )}
    <dl className="trace-tree-summary-facts">
      {counts.map((fact) => (
        <div key={fact.key}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  </section>
);
