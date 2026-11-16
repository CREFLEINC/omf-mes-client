import { Button, Chip, type Column, EmptyState, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
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
  /** 처리 상태 배지 — 부적합번호 옆에 둔다(omf-all-around#275). */
  status?: ReactNode;
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
  status,
}: DetailPaneProps) => {
  const t = messages.dispositionDecision;
  const unitOf = (uomId: number | undefined): string =>
    uomId === undefined ? '' : ` ${lookupDisplayLabel(uoms, uomId)}`;
  /* 005 — 입하 LOT 이 있으면 자재 입하 IQC 부적합: 처분은 입하 LOT 단위, 자재 관리 LOT 마다 IQC 결과 매칭(참고용). */
  const inboundLotNo = view.inboundLotNo ?? null;
  const isInbound = inboundLotNo !== null;
  const unmatched = view.unmatchedResults ?? [];
  const columns: Column<NonconformanceLotRow>[] = [
    {
      key: 'lotNo',
      align: 'center',
      width: '260px',
      header: t.fields.lotNo,
      render: (row) => row.lotNoText,
    },
    {
      key: 'qty',
      align: 'center',
      width: '110px',
      header: t.fields.qty,
      render: (row) => `${row.affectedQtyText}${unitOf(row.uomId)}`,
    },
    {
      key: 'qualityStatus',
      align: 'center',
      width: '110px',
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
            width: '180px',
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
  /*
   * 표는 열 폭 · 순서를 바꿀 수 있다(목록 표와 같은 조합 · omf-all-around#275).
   */
  const ordered = useColumnOrder('omf-mes:dispositions:columns:lots:order', columns);
  const resizable = useColumnWidths('omf-mes:dispositions:columns:lots', ordered, {
    fitContent: true,
  });
  const fit = useFitColumns(resizable.columns, { scrollX: true });
  const unit = unitOf(view.lots[0]?.uomId);
  /* 원천 칸은 걷었다 — 목록 칸과 아래 입하 LOT · IQC 검사가 같은 것을 말한다(omf-all-around#275). */
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
      ]
    : [];
  /*
   * PQC 검사 기본 정보(W-03-11 · #135)와 같은 짜임 — 상자 하나에 칸을 흘려 놓고, 판정에 바로 쓰는 값(번호 · 품목 · 수량 둘)을
   * 앞에 굵게, 나머지(사유 · 출처)는 보통 글씨로 잇는다(omf-all-around#275).
   */
  /* 품목 표시명 「코드 · 이름」을 PQC 처럼 이름 위 · 코드 아래로 나눠 보인다(글 내용은 그대로). */
  const itemLabel = lookupDisplayLabel(items, view.itemId);
  const ITEM_LABEL_SEPARATOR = ' · '; // ui-check-ignore: C-13 표시명 구분자(lookups.ts 「코드 · 이름」)
  const [itemCode, ...itemNameParts] = itemLabel.split(ITEM_LABEL_SEPARATOR);
  const itemValue: ReactNode =
    itemNameParts.length === 0 ? (
      itemLabel
    ) : (
      <span className="disposition-detail-item">
        <span>{itemNameParts.join(ITEM_LABEL_SEPARATOR)}</span>
        <span className="disposition-detail-item-code">{itemCode}</span>
      </span>
    );
  const facts: [string, ReactNode, boolean?][] = [
    [
      t.fields.nonconformanceNo,
      <span className="disposition-detail-no">
        {view.nonconformanceNo}
        {status}
      </span>,
      true,
    ],
    [t.fields.item, itemValue, true],
    [t.detail.affectedQty, `${view.affectedQtyText}${unit}`, true],
    ...(isInbound && remainingText !== undefined
      ? [[t.fields.remainingQty, remainingText, true] as [string, ReactNode, boolean]]
      : []),
    [
      t.fields.reasonText,
      view.description === '' ? messages.common.reference.empty : view.description,
    ],
    ...(view.supplierName === null || view.supplierName === undefined
      ? []
      : [[t.inboundLot.supplier, view.supplierName] as [string, ReactNode]]),
    [t.fields.openedAt, view.openedAtText],
    ...inboundFacts,
    [t.fields.severityCode, <SeverityBadge severity={severity} code={view.severityCode} />],
  ];

  return (
    <div className="disposition-detail">
      {/*
       * 기본 정보 한 상자 — 칸을 흘려 놓고, 사유도 그 안의 한 칸(omf-all-around#275). 상태는 구획 머리의 배지가 말한다.
       */}
      <div className="disposition-detail-box">
        <dl className="disposition-detail-facts">
          {facts.map(([label, value, isKey]) => (
            <div className="disposition-detail-fact" key={label}>
              <dt className="field-label">{label}</dt>
              <dd className={isKey === true ? 'disposition-detail-fact-key' : undefined}>
                {value}
              </dd>
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
      </div>

      <section className="disposition-subsection" aria-label={t.panes.lots}>
        <h3 className="disposition-subtitle">
          {t.panes.lots}
          <span className="disposition-count-badge">{t.decisions.count(view.lots.length)}</span>
        </h3>
        <div
          ref={fit.ref}
          className="disposition-table disposition-lot-table"
          style={resizable.style}
        >
          <Table
            density="compact"
            caption={<span className="disposition-table-caption">{t.panes.lots}</span>}
            columns={fit.columns}
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
