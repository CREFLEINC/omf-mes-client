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
import { progressLabel } from './status-options';
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
  /** 지정이 끝난 줄에 **어느 공장인지**를 적기 위해 받는다(사용자 지시 2026-09-22). */
  fulfillmentPlantLookup: ReferenceSource;
  onFirstPage: () => void;
  onRetryReferences: () => void;
  onAssignPlant: (shipmentRequestId: number) => void;
}

/** 값이 없는 칸은 비워 두지 않는다. */
const orEmptyMark = (value: string): ReactNode => (value === '' ? t.values.empty : value);

/**
 * 세 수량을 「500 / 500 / 500」 한 칸으로 그린다 — `lines` 를 못 받았으면 셋 다 빈 칸이다.
 *
 * ⛔ **받지 못한 축은 0 으로 그리지 않는다**(client#1042). 축 하나만 비어 와도 그 자리에 빈
 * 표기를 두어 「수량이 0」과 구분한다 — 예전에는 `NaN` 이 그대로 나갔다.
 */
const qtyText = (value: number | null): string => (value === null ? t.values.empty : String(value));

const renderQty = (totals: LineQtyTotals | null): ReactNode => {
  if (totals === null) return t.values.empty;

  return `${qtyText(totals.requestedQty)} / ${qtyText(totals.allocatedQty)} / ${qtyText(totals.shippedQty)}`;
};

/**
 * 진행 상태의 시각 강도.
 *
 * ⛔ **모든 상태를 강하게 칠하지 않는다**(사용자 지시 2026-09-22). 끝난 것만 눈에 띄면 되고,
 * 나머지는 지나가는 단계라 같은 무게로 선다 — 다 칠하면 어느 것이 끝인지 읽히지 않는다.
 * 새 색 체계를 만들지 않고 이 화면이 이미 쓰는 두 값(`success`·기본)만 쓴다.
 */
const progressTone = (code: string): 'success' | undefined =>
  code === 'SHIPPED' ? 'success' : undefined;

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
 * ⛔ **정렬 범위 안내를 두지 않는다**(사용자 지시 2026-09-22 — 「전체 조회 결과를 기준으로
 * 정렬됩니다. 문구는 없애줘」). 같은 안내를 두는 형제 화면(W-01-09·재고 현황)과 갈리지만
 * 이 화면의 문구는 사용자가 직접 뺄 것을 정했다.
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
  fulfillmentPlantLookup,
  onFirstPage,
  onRetryReferences,
  onAssignPlant,
}: ShipmentTableProps) => {
  const columns: Column<ShipmentRequestView>[] = [
    {
      key: 'requestedShipDate',
      align: 'center',
      header: t.table.requestedShipDate,
      width: '8%',
      sortable: SORTABLE_KEYS.has('requestedShipDate'),
    },
    {
      key: 'shipmentRequestNo',
      align: 'center',
      header: t.table.shipmentRequestNo,
      width: '13%',
      sortable: SORTABLE_KEYS.has('shipmentRequestNo'),
    },
    {
      key: 'customerId',
      align: 'center',
      width: '18%',
      header: t.table.customer,
      sortable: SORTABLE_KEYS.has('customerId'),
      /* 계약 정렬 키는 번호(customerId)지만 표시는 이름이다 — #44와 같은 이유로 번호를 칸에 담지 않는다. */
      render: (row) => describeReference(toReference(customerLookup, row.customerId)),
    },
    {
      key: 'shipToPartnerId',
      align: 'center',
      width: '18%',
      header: t.table.shipToPartner,
      render: (row) => describeReference(toReference(shipToPartnerLookup, row.shipToPartnerId)),
    },
    {
      key: 'qty',
      header: t.table.qty,
      width: '14%',
      align: 'center',
      render: (row) => renderQty(row.lineTotals),
    },
    {
      key: 'inspection',
      align: 'center',
      header: t.table.inspection,
      width: '7%',
      render: (row) => renderInspectionStatus(row.inspectionStatus),
    },
    {
      key: 'progress',
      align: 'center',
      header: t.table.progress,
      width: '9%',
      /*
       * 진행과 검사를 섞지 않는다. 서버가 계산한 진행 코드를 그대로 받아 «표시명»만 옮긴다.
       * ⛔ 모르는 값은 코드를 그대로 보인다 — 계약에 값이 늘어도 빈 칸이 되지 않는다.
       */
      render: (row) => (
        <Chip variant="status" status={progressTone(row.shipmentProgressCode)} size="sm">
          {orEmptyMark(progressLabel(row.shipmentProgressCode))}
        </Chip>
      ),
    },
    {
      key: 'fulfillmentPlant',
      align: 'center',
      width: '13%',
      header: t.table.fulfillmentPlant,
      render: (row) =>
        row.fulfillmentPlantId == null ? (
          <Button
            variant="outlined"
            onClick={() => {
              onAssignPlant(row.shipmentRequestId);
            }}
          >
            {t.actions.assignPlant}
          </Button>
        ) : (
          /*
           * 「지정됨」이 아니라 **어느 공장인지** 적는다(사용자 지시 2026-09-22) — 지정 여부만
           * 알려서는 다시 눌러 확인해야 한다. 이름을 못 구한 사정은 다른 참조 열과 같게 말한다.
           *
           * 단추가 글자로 바뀌어도 **줄 높이가 달라지지 않게** 한다 — 저장 뒤에 표가 낮아지면
           * 고친 줄이 아니라 표 전체가 움직인 것처럼 보인다.
           */
          /*
           * 지정을 끝낸 뒤에도 **다시 열 수 있다**(사용자 지시 2026-09-22). 서버는 피킹 전이고
           * 이미 나간 출하의 창고 공장이 같으면 몇 번이든 받아 준다 — 막힌 경우는 서버가
           * 사유를 돌려주므로 화면이 미리 잠그지 않는다.
           */
          <span className="shipment-schedule-plant-assigned">
            <span className="shipment-schedule-plant-name">
              {describeReference(toReference(fulfillmentPlantLookup, row.fulfillmentPlantId))}
            </span>
            <Button
              className="shipment-schedule-plant-change"
              variant="outlined"
              /* 지정은 해야 할 일이고 변경은 이미 끝난 일을 되돌리는 보조 액션이라 작다. */
              size="sm"
              onClick={() => {
                onAssignPlant(row.shipmentRequestId);
              }}
            >
              {t.actions.changePlant}
            </Button>
          </span>
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
      {/* 폭 규칙은 래퍼에 건다 — 디자인 시스템이 className 을 <table> 자신에 붙인다. */}
      <div className="wide-table shipment-schedule-table">
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
