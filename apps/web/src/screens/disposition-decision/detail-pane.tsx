import { Button, Chip, type Column, EmptyState, Icon, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { lookupDisplayLabel } from '../../patterns/lookup-display';
import { iqcResultLabel, IqcMatchChips } from './iqc-match';
import type { DispositionLookup } from './lookups';
import { SeverityBadge } from './severity-badge';
import type { NonconformanceDetailView, NonconformanceLotRow } from './types';

export interface DetailPaneProps {
  view: NonconformanceDetailView;
  items: DispositionLookup;
  uoms: DispositionLookup;
  /** 심각도의 표시명(G-32) — 목록 열과 같은 조회를 받는다. 모르는 코드는 코드 그대로(G-9). 상태는 구획 머리 배지가 말한다. */
  severity: DispositionLookup;
  /** LOT 의 지금 상태(LOT 번호 → 상태 코드). 못 읽은 LOT 은 부적합 등록 때 상태로 보인다(#223). */
  lotStatuses?: Record<number, string>;
  /** 005 — 남은 수량(단위 포함 글). 입하 LOT 부적합의 기본 정보에 보인다. */
  remainingText?: string | undefined;
  /** 005 — 「선별로 생김 ← NC-…」 의 원래 부적합으로 간다. */
  onOpenNonconformance?: ((nonconformanceId: number) => void) | undefined;
}

/**
 * 부적합 기본 정보 · 설명 · 대상 LOT(사용자 시안 · omf-all-around#223) — 세 칸 두 줄로 줄이고, 설명은 그 아래 한 줄,
 * LOT 표는 LOT · 수량 · 품질 상태만. 품질 상태는 LOT 을 따로 읽은 «지금» 값이다 — 부적합에 남은 값은 등록 때 값이라
 * 판정 · 특채로 바뀐 상태를 보이지 못한다(#223).
 */
export const DetailPane = ({
  view,
  items,
  uoms,
  severity,
  lotStatuses = {},
  remainingText,
  onOpenNonconformance,
}: DetailPaneProps) => {
  const t = messages.dispositionDecision;
  const unitOf = (uomId: number | undefined): string =>
    uomId === undefined ? '' : ` ${lookupDisplayLabel(uoms, uomId)}`;
  /* 005 — 입하 LOT 이 있으면 자재 입하 IQC 부적합: 처분은 입하 LOT 단위, 자재 관리 LOT 마다 IQC 결과 매칭(참고용). */
  const inboundLotNo = view.inboundLotNo ?? null;
  const isInbound = inboundLotNo !== null;
  const unmatched = view.unmatchedResults ?? [];
  const columns: Column<NonconformanceLotRow>[] = [
    { key: 'lotNo', align: 'center', header: t.fields.lotNo, render: (row) => row.lotNoText },
    {
      key: 'qty',
      align: 'center',
      header: t.fields.qty,
      render: (row) => `${row.affectedQtyText}${unitOf(row.uomId)}`,
    },
    {
      key: 'qualityStatus',
      align: 'center',
      header: t.fields.qualityStatus,
      /* 품질 상태는 배지로 — 불량 · 폐기는 붉게, 정상은 초록, 그 밖은 회색(사용자 시안 · #223). */
      render: (row) => {
        const code = lotStatuses[row.lotId] ?? row.qualityStatusCode;
        return (
          <Chip
            size="sm"
            status={
              code === 'DEFECTIVE' || code === 'SCRAPPED'
                ? 'error'
                : code === 'NORMAL'
                  ? 'success'
                  : 'idle'
            }
          >
            {t.values.qualityStatus[code] ?? code}
          </Chip>
        );
      },
    },
    ...(isInbound
      ? [
          {
            key: 'iqcMatch',
            align: 'center',
            header: t.inboundLot.matching,
            render: (row) => (
              <IqcMatchChips
                results={row.matchedResults}
                rejectedCount={row.rejectedResultCount}
                emptyText={t.inboundLot.noMatch}
              />
            ),
          } satisfies Column<NonconformanceLotRow>,
        ]
      : []),
  ];
  const inboundFacts: [string, ReactNode][] = isInbound
    ? [
        [t.inboundLot.inboundLotNo, inboundLotNo],
        [
          t.inboundLot.inspectionRequestNo,
          <>
            {view.inspectionRequestNo ?? messages.common.reference.empty}
            {view.sortedFrom !== null && view.sortedFrom !== undefined && (
              <Chip size="sm" status="error">
                {t.inboundLot.rejectedConfirmed}
              </Chip>
            )}
          </>,
        ],
        ...(view.supplierName === null || view.supplierName === undefined
          ? []
          : [[t.inboundLot.supplier, view.supplierName] as [string, ReactNode]]),
        ...(remainingText === undefined
          ? []
          : [[t.fields.remainingQty, remainingText] as [string, ReactNode]]),
      ]
    : [];

  return (
    <div className="disposition-detail">
      {/*
       * 기본 정보 한 줄 다섯 칸, 구분선 아래 설명 — 한 상자(사용자 시안 · #223). 상태는 구획 머리의 배지가 말한다.
       */}
      <div className="disposition-detail-box">
        <dl className="disposition-detail-facts">
          {(
            [
              [t.fields.nonconformanceNo, view.nonconformanceNo],
              [t.fields.item, lookupDisplayLabel(items, view.itemId)],
              [
                t.fields.severityCode,
                <SeverityBadge severity={severity} code={view.severityCode} />,
              ],
              [t.fields.openedAt, view.openedAtText],
              [t.detail.affectedQty, `${view.affectedQtyText}${unitOf(view.lots[0]?.uomId)}`],
              ...inboundFacts,
            ] as [string, ReactNode][]
          ).map(([label, value], index, all) => (
            /* 부적합번호 · 대상 수량은 굵게(사용자 시안 · #223). */
            <div
              className={
                index === 0 || index === all.length - 1 - inboundFacts.length
                  ? 'field-cell is-strong'
                  : 'field-cell'
              }
              key={label}
            >
              <dt className="field-label">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {view.sortedFrom !== null && view.sortedFrom !== undefined && (
          <p className="field-note disposition-sorted-from">
            {t.inboundLot.sortedFrom}{' '}
            {onOpenNonconformance === undefined ? (
              view.sortedFrom.nonconformanceNo
            ) : (
              <Button
                variant="text"
                size="sm"
                onClick={() => {
                  if (view.sortedFrom) onOpenNonconformance(view.sortedFrom.nonconformanceId);
                }}
              >
                {view.sortedFrom.nonconformanceNo}
              </Button>
            )}
          </p>
        )}
        <p className="disposition-detail-description" aria-label={t.fields.description}>
          {view.description}
        </p>
      </div>
      {isInbound && (
        <p className="disposition-inbound-banner" role="note">
          <Icon name="inventory" size={18} aria-hidden />
          <span>
            <strong>{t.inboundLot.bannerTitle}</strong> {t.inboundLot.bannerBody(view.lots.length)}
          </span>
        </p>
      )}

      <section className="disposition-subsection" aria-label={t.panes.lots}>
        <h3 className="disposition-subtitle">
          {t.panes.lots}
          <span className="disposition-count-badge">{t.decisions.count(view.lots.length)}</span>
          {isInbound && (
            <span className="field-note disposition-subtitle-note">
              {t.inboundLot.matchingNote}
            </span>
          )}
        </h3>
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
        {isInbound && unmatched.length > 0 && (
          <p className="field-note">
            {t.inboundLot.unmatched(unmatched.map((result) => iqcResultLabel(result)).join(', '))}
          </p>
        )}
      </section>
    </div>
  );
};
