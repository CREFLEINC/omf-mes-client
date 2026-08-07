import { Button, Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { isOverdue } from './arrival';
import { describeReference, toReference, type ReferenceSource } from './lookups';
import type { AsnLineView, AsnView } from './types';

const t = messages.inboundSchedule;

export interface AsnLineTableProps {
  /** 고른 건. 제목줄의 자료는 위 표의 행에 이미 있어 상세 경로를 부르지 않는다. */
  asn: AsnView;
  /**
   * 공급사는 **위 구획이 실패 안내와 복구를 소유**하므로 이름만 받는다.
   * 이 부품에 번호를 문자열로 만드는 자리는 어느 쪽에도 없다.
   */
  supplierName: string;
  today: Date;
  rows: AsnLineView[];
  isLoading: boolean;
  /**
   * 공장 — **이름이 이 구획의 제목줄에서만 보인다.** 그래서 실패 안내와 다시 시도도
   * 여기가 소유하고, 그러려면 이름이 아니라 참조 자체를 받아 실패 여부를 알아야 한다.
   */
  plantLookup: ReferenceSource;
  itemLookup: ReferenceSource;
  uomLookup: ReferenceSource;
  onRetryReferences: () => void;
}

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | null): ReactNode => value ?? t.values.empty;

interface SummaryItem {
  key: string;
  label: string;
  value: ReactNode;
}

/**
 * 고른 건의 라인 표와 그 제목줄.
 *
 * **상세 경로를 부르지 않는다.** 제목줄에 필요한 값은 전부 목록 응답의 행에 들어 있어,
 * 상세(`GET /logistics/asns/{asnId}`)를 부르면 같은 값을 한 번 더 받는다.
 *
 * 열 폭의 도출:
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 줄번호 | 64px | 두 자리 수 + 우측정렬 여백 |
 * | 품목 | **미지정** | 「코드 · 이름」을 담고 남는 폭을 흡수한다 |
 * | 예정수량 | 112px | 머리글 4자 + 우측정렬 여백 |
 * | 단위 | 132px | 「코드 · 이름」이되 값이 짧다 |
 * | 공급사 LOT | 176px | `SAMPLE-LOT-0001` 15자 + 셀 여백 |
 * | 지정 폭 합 | 484px | |
 * | 흡수 열 예산 | 200px | 「코드 · 이름」이 접히지 않고 읽히는 하한 |
 * | **합** | **684px** | `.wide-table`의 최소 폭 `58rem`(928px) 안에 들어간다 |
 *
 * **진행 열과 P/O 라인 열을 만들지 않는다**(계획 결정 5·6). 셋이 같은 방향을 가리킨다 —
 * ① 계약에 진행률·발주 수량 필드가 없다 ② `purchaseOrderLineId`를 이름으로 풀 경로가 없어
 * 낼 것이 내부 번호밖에 없는데 #44가 그 형태를 금지한다 ③ 「P/O 라인: —」은 사실상
 * 무발주 표식이고 이슈 #20 §4가 그 표식을 두지 않기로 정했다.
 *
 * **무발주 줄을 목록에서 빼지는 않는다.** 같은 이슈가 「P/O 연결이 빈 행은 그대로 보인다」고 적었다.
 */
export const AsnLineTable = ({
  asn,
  supplierName,
  today,
  rows,
  isLoading,
  plantLookup,
  itemLookup,
  uomLookup,
  onRetryReferences,
}: AsnLineTableProps) => {
  const columns: Column<AsnLineView>[] = [
    { key: 'lineNo', header: t.lineTable.lineNo, align: 'end', width: '64px' },
    {
      key: 'item',
      header: t.lineTable.item,
      render: (row) => describeReference(toReference(itemLookup, row.itemId)),
    },
    { key: 'expectedQty', header: t.lineTable.expectedQty, align: 'end', width: '112px' },
    {
      key: 'uom',
      header: t.lineTable.uom,
      width: '132px',
      render: (row) => describeReference(toReference(uomLookup, row.uomId)),
    },
    {
      key: 'supplierLotNo',
      header: t.lineTable.supplierLotNo,
      width: '176px',
      render: (row) => orEmptyMark(row.supplierLotNo),
    },
  ];

  const summary: SummaryItem[] = [
    { key: 'asnNo', label: t.summary.asnNo, value: asn.asnNo },
    { key: 'supplier', label: t.summary.supplier, value: supplierName },
    {
      key: 'plant',
      label: t.summary.plant,
      value: describeReference(toReference(plantLookup, asn.plantId)),
    },
    {
      key: 'expectedArrivalDate',
      label: t.summary.expectedArrivalDate,
      value: (
        <>
          <span>{asn.expectedArrivalDate}</span>
          {isOverdue(asn.expectedArrivalDate, today) && (
            <Chip variant="status" status="warning" size="sm">
              {t.values.overdue}
            </Chip>
          )}
        </>
      ),
    },
    {
      key: 'deliveryNoteNo',
      label: t.summary.deliveryNoteNo,
      value: orEmptyMark(asn.deliveryNoteNo),
    },
    { key: 'remarks', label: t.summary.remarks, value: orEmptyMark(asn.remarks) },
  ];

  /* 이 구획이 이름을 내는 참조 셋 중 **하나라도** 실패하면 안내와 복구 수단을 낸다. */
  const hasReferenceError = itemLookup.isError || uomLookup.isError || plantLookup.isError;

  return (
    <>
      {/*
       * 값 표기다 — 폼 컨트롤을 잠그지 않는다(배치 규범 3). `role="group"`을 명시해
       * 제목줄 전체가 하나의 이름을 갖게 한다.
       */}
      <div role="group" aria-label={t.summary.label}>
        <dl className="filter-bar">
          {summary.map((item) => (
            <div className="field-cell" key={item.key}>
              <dt className="field-label">{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {isLoading ? (
        <div role="status" aria-label={t.loading.lines}>
          <SkeletonText lines={2} />
        </div>
      ) : (
        <div className="wide-table">
          <Table
            density="compact"
            columns={columns}
            rows={rows}
            getRowId={(row) => String(row.asnLineId)}
            empty={
              <EmptyState
                size="sm"
                live
                title={t.empty.noLinesTitle}
                description={t.empty.noLinesDescription}
              />
            }
          />
        </div>
      )}

      {hasReferenceError && (
        <div className="field-cell">
          <span className="field-note">{t.reasons.lineReferencesFailed}</span>
          <Button variant="outlined" size="sm" onClick={onRetryReferences}>
            {messages.common.retry}
          </Button>
        </div>
      )}
    </>
  );
};
