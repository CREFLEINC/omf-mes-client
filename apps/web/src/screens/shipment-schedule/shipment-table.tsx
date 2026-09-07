import {
  Button,
  Chip,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
  type SortState,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { describeReference, toReference, type ReferenceSource } from './lookups';
import { CONTRACT_SORT_KEYS, toSortState, type SortKey } from './sort';
import type { LineQtyTotals, ShipmentRequestView } from './types';

const t = messages.shipmentSchedule;

export interface ShipmentTableProps {
  rows: ShipmentRequestView[];
  isLoading: boolean;
  /** 조회가 실제로 나갔는가. 거짓이면 「결과가 없다」로 말하지 않는다 — 출하일 시작이 없으면
   * 요청 자체가 나가지 않는다. */
  hasQuery: boolean;
  isBeyondLast: boolean;
  sortKey: SortKey | null;
  onSortChange: (next: SortState | null) => void;
  customerLookup: ReferenceSource;
  shipToPartnerLookup: ReferenceSource;
  onFirstPage: () => void;
  onRetryReferences: () => void;
}

/** 값이 없는 칸은 비워 두지 않는다. */
const orEmptyMark = (value: string): ReactNode => (value === '' ? t.values.empty : value);

/** 세 수량을 「500 / 500 / 500」 한 칸으로 그린다 — `lines`를 못 받았으면 셋 다 빈 칸이다. */
const renderQty = (totals: LineQtyTotals | null): ReactNode => {
  if (totals === null) return t.values.empty;

  return `${String(totals.requestedQty)} / ${String(totals.allocatedQty)} / ${String(totals.shippedQty)}`;
};

/**
 * 「검사」 열 — 서버 롤업(`ShipmentRequestView.inspectionStatus`)을 그대로 옮긴다.
 * `REJECTED`·`HELD` 전용 배지는 이번 슬라이스에서 두지 않는다 — `PENDING`과 같게 그린다
 * (계약 주석 W-04-02 §5-3 · omf-mes#232 · omf-mes#235, 다음 착수에서 분리). **default 분기가
 * 곧 미지 값 대응이다** — 계약에 값이 늘어도 여기로 떨어져 빈 배지·예외로 이어지지 않는다.
 */
const renderInspectionStatus = (status: ShipmentRequestView['inspectionStatus']): ReactNode => {
  if (status === 'NOT_REQUIRED') return t.values.empty;

  if (status === 'PASSED') {
    return (
      <Chip variant="status" status="success" size="sm">
        {t.values.inspectionPassed}
      </Chip>
    );
  }

  return (
    <Chip variant="status" size="sm">
      {t.values.inspectionPending}
    </Chip>
  );
};

/**
 * 이 화면이 열 수 있는 정렬 열의 집합. 계약 열거값이 곧 전체다(보기가 하나뿐이라
 * W-01-07처럼 보기별로 좁히지 않는다).
 */
const SORTABLE_KEYS = new Set<string>(CONTRACT_SORT_KEYS);

/**
 * 출하 예정 목록 표.
 *
 * **열이 일곱이다**(§4-A 필드 표 그대로): 출하일·작업지시번호·고객·납품처·요청/배정/출하(한
 * 칸)·검사·진행. 편성/출하 확정으로의 행 이동은 이 슬라이스에 없다(계획서 미결) — 선택·액션
 * 열을 두지 않는다.
 *
 * **「검사」는 서버 롤업(`shippingInspectionStatusCode`)을 그대로 옮긴다**(omf-mes#232 ·
 * omf-mes#235). `REJECTED`·`HELD` 전용 배지는 이번 슬라이스에서 두지 않는다 — 「대기」로 같이
 * 표시한다(다음 착수에서 분리). **「진행」은 서버가 계산한 원문 코드를 그대로 낸다.**
 */
export const ShipmentTable = ({
  rows,
  isLoading,
  hasQuery,
  isBeyondLast,
  sortKey,
  onSortChange,
  customerLookup,
  shipToPartnerLookup,
  onFirstPage,
  onRetryReferences,
}: ShipmentTableProps) => {
  const columns: Column<ShipmentRequestView>[] = [
    {
      key: 'requestedShipDate',
      header: t.table.requestedShipDate,
      width: '112px',
      sortable: SORTABLE_KEYS.has('requestedShipDate'),
    },
    {
      key: 'shipmentRequestNo',
      header: t.table.shipmentRequestNo,
      width: '180px',
      sortable: SORTABLE_KEYS.has('shipmentRequestNo'),
    },
    {
      key: 'customerId',
      header: t.table.customer,
      sortable: SORTABLE_KEYS.has('customerId'),
      /* 계약 정렬 키는 번호(customerId)지만 표시는 이름이다 — #44와 같은 이유로 번호를 칸에 담지 않는다. */
      render: (row) => describeReference(toReference(customerLookup, row.customerId)),
    },
    {
      key: 'shipToPartnerId',
      header: t.table.shipToPartner,
      render: (row) => describeReference(toReference(shipToPartnerLookup, row.shipToPartnerId)),
    },
    {
      key: 'qty',
      header: t.table.qty,
      width: '168px',
      align: 'end',
      render: (row) => renderQty(row.lineTotals),
    },
    {
      key: 'inspection',
      header: t.table.inspection,
      width: '96px',
      render: (row) => renderInspectionStatus(row.inspectionStatus),
    },
    {
      key: 'progress',
      header: t.table.progress,
      width: '120px',
      /* 진행과 검사를 섞지 않는다. 서버가 계산한 진행 코드를 손실 없이 그대로 낸다. */
      render: (row) => (
        <Chip variant="status" size="sm">
          {orEmptyMark(row.shipmentProgressCode)}
        </Chip>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.list}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  const emptySlot = (): ReactNode => {
    if (!hasQuery) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.notQueriedTitle}
          description={t.empty.notQueriedDescription}
        />
      );
    }

    if (isBeyondLast) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.beyondLastTitle}
          description={t.empty.beyondLastDescription}
          action={
            <Button variant="outlined" onClick={onFirstPage}>
              {t.actions.goFirstPage}
            </Button>
          }
        />
      );
    }

    return (
      <EmptyState
        size="sm"
        live
        title={t.empty.noResultTitle}
        description={t.empty.noResultDescription}
      />
    );
  };

  return (
    <>
      <div className="wide-table">
        <Table
          density="compact"
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.shipmentRequestId)}
          /*
           * **제어 정렬이다.** 계약의 `sort`가 전체 결과를 정렬해 쪽을 다시 나눠 주므로
           * 표가 현재 쪽 안에서 다시 정렬하면 서버가 준 순서를 덮어써 표시와 내용이 어긋난다.
           * W-01-09는 정반대다(계약에 정렬 파라미터가 없어 `defaultSort`만 준다).
           *
           * 조회하지 않았으면 정렬 표시를 내지 않는다 — 요청이 0회인 표에는 정렬할 결과가 없다.
           */
          sort={hasQuery ? toSortState(sortKey) : null}
          onSortChange={onSortChange}
          empty={emptySlot()}
        />
      </div>

      <p className="field-note">{t.notes.sortScope}</p>

      {(customerLookup.isError || shipToPartnerLookup.isError) && (
        <div className="field-cell">
          <span className="field-note">{t.reasons.referencesFailed}</span>
          <Button variant="outlined" size="sm" onClick={onRetryReferences}>
            {messages.common.retry}
          </Button>
        </div>
      )}
    </>
  );
};
