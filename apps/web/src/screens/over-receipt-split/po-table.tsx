import { Button, Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { describeReference, toReference, type ReferenceSource } from './lookups';
import type { PoView } from './types';

const t = messages.overReceiptSplit;

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | null): ReactNode => value ?? t.values.empty;

export interface PoColumnsInput {
  selectedPoId: number | null;
  supplierLookup: ReferenceSource;
  /**
   * 등록을 보내는 중인가. 참이면 **대상을 바꾸는 길을 닫는다** —
   * 보내는 중에 다른 발주로 옮기면 앞 발주의 등록 결과가 지금 보는 발주의 맥락에 나타난다.
   */
  isLocked: boolean;
  onToggleSelect: (purchaseOrderId: number) => void;
}

/**
 * 대상 발주 목록의 열 구성.
 *
 * **열이 여섯이다.** 계약의 발주 헤더에는 필드가 아홉 있으나 사업부·ERP 발주번호·승인 요청은
 * 열로 만들지 않았다 — 앞 둘은 이 화면의 판단에 쓰이지 않고, 승인 요청은 내부 번호뿐이라
 * 낼 것이 번호밖에 없다(#44). 공장은 고른 발주의 제목줄로 보냈다.
 *
 * 열 폭의 도출(`docs/layout-conventions.md`의 방식 — 흡수 열에도 예산을 잡는다):
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 발주번호 | 160px | 14자 ASCII(`--type-body-sm` 14px · 자폭 약 7.5px) 105px + 셀 여백 32px |
 * | **공급사** | **미지정** | 「코드 · 이름」을 담고 남는 폭을 흡수한다 |
 * | 발주일 | 120px | `YYYY-MM-DD` 75px + 셀 여백 32px |
 * | 입고 예정일 | 120px | 같다 |
 * | 상태 | 152px | 코드 13자 98px + 칩 안쪽 여백 24px + 32px |
 * | 선택 | 88px | `sm` 버튼 하나 |
 * | **지정 폭 합** | **640px** | |
 * | 흡수 열 예산 | 200px | 「코드 · 이름」이 접히지 않고 읽히는 하한 |
 * | **합** | **840px** | `58rem`(928px) 안에 들어간다 |
 *
 * **흡수 열이 실제로 받는 폭은 288px**이다(928 − 640) — 예산 200px보다 넓다.
 * 지정 폭 합이 표 하한에 가까우면 흡수 열이 몇십 px밖에 못 받아 「코드 · 이름」이 낱말 단위로
 * 쪼개진다. 그 어긋남은 열 폭 합만 세는 단언을 통과하므로 **남는 폭까지 함께 단언한다**.
 */
export const buildPoColumns = ({
  selectedPoId,
  supplierLookup,
  isLocked,
  onToggleSelect,
}: PoColumnsInput): Column<PoView>[] => [
  { key: 'purchaseOrderNo', header: t.table.purchaseOrderNo, width: '160px' },
  {
    key: 'supplier',
    header: t.table.supplier,
    /*
     * **번호를 문자열로 바꾸는 자리가 없다**(#44). 이름으로 풀 수 없는 세 갈래(미도착·목록에
     * 없음·실패)는 전부 문구로 갈리며, 어느 갈래에도 원시 번호가 담기지 않는다.
     */
    render: (row) => describeReference(toReference(supplierLookup, row.supplierId)),
  },
  { key: 'orderDate', header: t.table.orderDate, width: '120px' },
  {
    key: 'expectedReceiptDate',
    header: t.table.expectedReceiptDate,
    width: '120px',
    render: (row) => orEmptyMark(row.expectedReceiptDate),
  },
  {
    key: 'statusCode',
    header: t.table.status,
    width: '152px',
    /*
     * **값에 따라 변형을 가르지 않는다.** 값 집합이 확정되지 않아(공유계약 G-2) 색을 가르면
     * 뜻을 지어내는 것이 된다. 코드는 번역하지 않고 그대로 낸다.
     */
    render: (row) => (
      <Chip variant="status" size="sm">
        {row.statusCode}
      </Chip>
    ),
  },
  {
    key: 'select',
    header: t.table.select,
    width: '88px',
    render: (row) => {
      const selected = row.purchaseOrderId === selectedPoId;

      return (
        /*
         * 접근 이름에 **발주번호**를 넣는다 — 「선택」이 행마다 되풀이되면 어느 건인지 알 수 없다.
         * 내부 번호를 넣지 않는 이유는 그것이 화면 밖으로 새는 또 하나의 경로이기 때문이다.
         */
        <Button
          variant="outlined"
          size="sm"
          disabled={isLocked}
          aria-label={
            selected
              ? t.actions.deselectRow(row.purchaseOrderNo)
              : t.actions.selectRow(row.purchaseOrderNo)
          }
          onClick={() => {
            onToggleSelect(row.purchaseOrderId);
          }}
        >
          {selected ? t.actions.deselect : t.actions.select}
        </Button>
      );
    },
  },
];

export interface PoTableProps extends PoColumnsInput {
  rows: PoView[];
  isLoading: boolean;
  /** 결과는 있는데 이 쪽에는 없다. 「결과가 없다」와 다른 안내를 낸다. */
  isBeyondLast: boolean;
  onFirstPage: () => void;
  onRetryReferences: () => void;
}

/**
 * 대상 발주 목록 표.
 *
 * **빈 상태가 두 갈래다** — 결과 없음 / 쪽 밖. 사용자가 할 조치가 서로 다르다.
 * 「아직 조회하지 않았다」 갈래는 없다 — 이 화면은 조건 없이도 들어오자마자 조회한다.
 *
 * **정렬을 열지 않는다.** 계약의 발주 목록 조회에 정렬 파라미터가 없어 서버로 보낼 수 없고,
 * 화면 안에서만 정렬하면 「지금 쪽 안에서만 정렬됐다」는 사정을 매번 설명해야 한다.
 * 이 화면에서 대상을 찾는 정상 경로는 발주번호 검색과 공급사 조건이다.
 */
export const PoTable = ({
  rows,
  isLoading,
  isBeyondLast,
  selectedPoId,
  supplierLookup,
  isLocked,
  onFirstPage,
  onToggleSelect,
  onRetryReferences,
}: PoTableProps) => {
  const columns = buildPoColumns({ selectedPoId, supplierLookup, isLocked, onToggleSelect });

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.purchaseOrders}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  const emptySlot = (): ReactNode =>
    isBeyondLast ? (
      <EmptyState
        size="sm"
        live
        title={t.empty.beyondLastTitle}
        description={t.empty.beyondLastDescription}
        action={
          <Button variant="outlined" disabled={isLocked} onClick={onFirstPage}>
            {t.actions.goFirstPage}
          </Button>
        }
      />
    ) : (
      <EmptyState
        size="sm"
        live
        title={t.empty.noResultTitle}
        description={t.empty.noResultDescription}
      />
    );

  return (
    <>
      {/*
       * `.wide-table`이 표에 최소 폭을 준다 — 폭이 모자라면 짓누르는 대신 가로로 넘긴다.
       * 스크롤 상자는 디자인 시스템 `Table`이 이미 갖고 있어 우리가 만들지 않는다.
       */}
      <div className="wide-table">
        <Table
          density="compact"
          columns={columns}
          rows={rows}
          /*
           * 선택 열을 쓰지 않아도 지정한다 — 미지정이면 인덱스가 React key가 되어
           * 쪽이 바뀔 때 앞 쪽의 행이 남아 보일 수 있다.
           *
           * **여기의 `String()`은 화면에 나오지 않는다** — React key로만 쓰이며 셀 텍스트가 되지 않는다.
           */
          getRowId={(row) => String(row.purchaseOrderId)}
          empty={emptySlot()}
        />
      </div>

      {supplierLookup.isError && (
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
