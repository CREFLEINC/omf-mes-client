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

import { ROW_PICK_CLASS, rowPickHandlers } from '../../patterns/row-pick';
import { describeReference, toReference, type ReferenceSource } from './lookups';
import { CONTRACT_SORT_KEYS, toSortState, type SortKey } from './sort';
import { progressLabel } from './status-options';
import {
  completionMarkOf,
  localToday,
  type LineQtyTotals,
  type ShipmentRequestView,
} from './types';

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
  onFirstPage: () => void;
  onRetryReferences: () => void;
  /** 피처 010 — 지시서 번호를 누르면 상세 창을 연다. */
  onOpenDetail: (shipmentRequestId: number) => void;
  /** 상세 창을 연 지시서 — 그 줄을 파랗게 칠한다(#360). */
  openedId?: number | null;
  /** 피처 012 — ERP 송신 칩으로 거른 중이면 빈 문구가 그 거르기를 풀라고 말한다(시안 W0402-After 빈 상태). */
  erpFiltered?: boolean;
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

/**
 * 피처 010 — 「목표 / 피킹 / 출하」(목표 = 배정, FR-002). 요청은 상세에만. 피킹이 목표를 넘으면
 * 아래에 「초과 n」(서버가 라인마다 계산한 `overQty` 합).
 */
const renderQty = (totals: LineQtyTotals | null, overQty: number): ReactNode => {
  if (totals === null) return t.values.empty;

  const text = `${qtyText(totals.allocatedQty)} / ${qtyText(totals.pickedQty)} / ${qtyText(totals.shippedQty)}`;
  if (overQty <= 0) return text;

  return (
    <span className="shipment-schedule-stack">
      <span>{text}</span>
      <Chip variant="status" status="warning" size="sm">
        {t.values.over(overQty)}
      </Chip>
    </span>
  );
};

/**
 * 피처 010 — 검사 칸은 가장 나쁜 LOT 판정 하나와 그 수(불합격 > 보류 > 미검사 > 합격).
 * 살아 있는 피킹 LOT 이 없으면 「—」다(서버 롤업의 「대기」를 쓰지 않는다).
 */
const renderJudgment = (summary: ShipmentRequestView['lotJudgmentSummary']): ReactNode => {
  if (summary === null) return t.values.empty;
  if (summary.rejected > 0) {
    return (
      <Chip variant="status" status="error" size="sm">
        {t.values.judgmentRejected(summary.rejected)}
      </Chip>
    );
  }
  if (summary.held > 0) {
    return (
      <Chip variant="status" status="warning" size="sm">
        {t.values.judgmentHeld(summary.held)}
      </Chip>
    );
  }
  if (summary.notInspected > 0) {
    return (
      <Chip variant="status" size="sm">
        {t.values.judgmentNotInspected(summary.notInspected)}
      </Chip>
    );
  }
  if (summary.accepted > 0) {
    return (
      <Chip variant="status" status="success" size="sm">
        {t.values.judgmentAccepted}
      </Chip>
    );
  }
  return t.values.empty;
};

/**
 * 피처 010 — 진행 칩 아래 칩. 고르는 규칙은 `completionMarkOf`(#342): 진짜 이슈는 붉은 「막힘 n」,
 * 출하일이 지난 피킹 부족은 주황 「지연」, 막는 이유가 없으면 초록 「완료 대기」, 정상 진행만이면 없음.
 */
const renderCompletion = (row: ShipmentRequestView, today: string): ReactNode => {
  const mark = completionMarkOf(row, today);
  if (mark === null) return null;
  if (mark.kind === 'blocked') {
    return (
      <Chip variant="status" status="error" size="sm">
        {t.values.blocked(mark.count)}
      </Chip>
    );
  }
  if (mark.kind === 'delayed') {
    return (
      <Chip variant="status" status="warning" size="sm">
        {t.values.delayed}
      </Chip>
    );
  }
  return (
    <Chip variant="status" status="success" size="sm">
      {t.values.completionReady}
    </Chip>
  );
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
  onFirstPage,
  onRetryReferences,
  onOpenDetail,
  openedId = null,
  erpFiltered = false,
}: ShipmentTableProps) => {
  /* 「지연」 판단의 오늘 — 화면을 연 기기의 날짜(#342). */
  const today = localToday();
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
      width: '11%',
      sortable: SORTABLE_KEYS.has('shipmentRequestNo'),
      /* 피처 010 — 번호를 누르면 오른쪽 상세 창(피킹 LOT · 교체 이력 · 막는 이유 · 인쇄). */
      render: (row) => (
        <Button
          variant="text"
          size="sm"
          className={ROW_PICK_CLASS}
          aria-label={t.table.openDetail(row.shipmentRequestNo)}
          aria-current={row.shipmentRequestId === openedId ? 'true' : undefined}
          onClick={() => {
            onOpenDetail(row.shipmentRequestId);
          }}
        >
          {row.shipmentRequestNo}
        </Button>
      ),
    },
    {
      key: 'customerId',
      align: 'center',
      width: '14%',
      header: t.table.customer,
      sortable: SORTABLE_KEYS.has('customerId'),
      /* 계약 정렬 키는 번호(customerId)지만 표시는 이름이다 — #44와 같은 이유로 번호를 칸에 담지 않는다. */
      render: (row) => describeReference(toReference(customerLookup, row.customerId)),
    },
    {
      key: 'shipToPartnerId',
      align: 'center',
      width: '14%',
      header: t.table.shipToPartner,
      render: (row) => describeReference(toReference(shipToPartnerLookup, row.shipToPartnerId)),
    },
    {
      key: 'qty',
      header: t.table.qty,
      width: '12%',
      align: 'center',
      render: (row) => renderQty(row.lineTotals, row.overQty),
    },
    {
      key: 'inspection',
      align: 'center',
      header: t.table.inspection,
      width: '7%',
      render: (row) => renderJudgment(row.lotJudgmentSummary),
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
        <span className="shipment-schedule-stack">
          <Chip variant="status" status={progressTone(row.shipmentProgressCode)} size="sm">
            {orEmptyMark(progressLabel(row.shipmentProgressCode))}
          </Chip>
          {renderCompletion(row, today)}
        </span>
      ),
    },
    {
      /*
       * 피처 012 — 「피킹 창고」 자리에 지시서 줄의 출고 창고 요약(시안 W0402-After ②). 아래 줄에 공장.
       * 옛 지시서(줄 창고 없음)는 「창고 미지정」(US6-1).
       */
      key: 'lineWarehouses',
      align: 'center',
      header: t.bu012.lineWarehouse,
      width: '11%',
      render: (row) =>
        row.lineWarehouses.length === 0 ? (
          <Chip variant="status" status="idle" size="sm">
            {t.bu012.warehouseUnassigned}
          </Chip>
        ) : (
          <span
            className="shipment-schedule-warehouses"
            title={row.lineWarehouses
              .map((warehouse) => t.bu012.warehouse(warehouse.warehouseName, warehouse.plantName))
              .join(', ')}
          >
            <span>{row.lineWarehouses.map((warehouse) => warehouse.warehouseName).join(', ')}</span>
            <span className="field-note">
              {[...new Set(row.lineWarehouses.map((warehouse) => warehouse.plantName))].join(', ')}
            </span>
          </span>
        ),
    },
    {
      key: 'marks',
      align: 'center',
      header: t.table.marks,
      width: '7%',
      render: (row) =>
        row.replacementCount > 0 ? (
          <Chip variant="status" status="warning" size="sm">
            {t.values.replacement(row.replacementCount)}
          </Chip>
        ) : (
          t.values.empty
        ),
    },
    {
      /* 피처 012 FR-018 — 대표 ERP 송신 상태(완료 출하가 있을 때만). 완료 전 지시서는 「—」. */
      key: 'erpSendStatus',
      align: 'center',
      width: '8%',
      header: t.bu012.erpSend,
      render: (row) =>
        row.erpSendStatus === null || row.erpSendStatus === undefined
          ? t.values.empty
          : t.bu012.erpStatus[row.erpSendStatus],
    },
    {
      /* 피처 012 FR-007 — 「출하 담당 공장」 → 「사업부」. 사업부 없는 공장의 옛 지시서는 배지(빈 곳 ⑨). */
      key: 'businessUnit',
      align: 'center',
      width: '9%',
      header: t.bu012.businessUnit,
      render: (row) =>
        row.businessUnitName === null ? (
          <Chip variant="status" status="warning" size="sm">
            {t.bu012.noBusinessUnit}
          </Chip>
        ) : (
          row.businessUnitName
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
        description={erpFiltered ? t.bu012.erpEmptyHint : t.empty.noResultDescription}
      />
    );
  };

  return (
    <>
      {/* 폭 규칙은 래퍼에 건다 — 디자인 시스템이 className 을 <table> 자신에 붙인다. */}
      <div className="wide-table shipment-schedule-table" {...rowPickHandlers}>
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
