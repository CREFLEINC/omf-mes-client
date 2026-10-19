import { Button, Chip, type Column, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { SelectableTable } from '../../patterns/selectable-table';
import { describeReference, toReference, type ReferenceSource } from './lookups';
import { toStatusTone } from './status-badge';
import { formatDateTime, type IrView } from './types';

const t = messages.goodsReceipt;

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | null): ReactNode => value ?? t.values.empty;

export interface IrColumnsInput {
  supplierLookup: ReferenceSource;
}

/**
 * 작업함 목록의 열 구성(T-W-C 작업함: 식별 번호, 상대, 일시, 문서 번호, 상태 칩, 이동 표시 ›).
 *
 * **「처리 대기 수량이나 건수」 열이 없다.** 입하 목록 응답에 라인 수가 없고, 행마다 라인을
 * 부르면 요청이 행 수만큼 는다(COMPOSITION.md 「숨길 기능」).
 *
 * 열 폭의 도출(`docs/layout-conventions.md`의 방식 — 흡수 열에도 예산을 잡는다):
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 입하번호 | 180px | `IR-YYYY-NNNNNN` 14자가 한 줄로 서는 폭 |
 * | **공급사** | **35%** | 가장 넓은 열. 너무 긴 이름은 `32rem` 에서 말줄임한다 |
 * | 입하일시 | 180px | `YYYY-MM-DD HH:mm` 가 줄바꿈 없이 선다 |
 * | 거래명세서번호 | 180px | 15자 안팎의 번호 · 없으면 `—` |
 * | 상태 | 140px | 상태 칩 하나 |
 * | › | 48px | 이동 표시 글자 하나 |
 * | **지정 폭 합** | **728px** | 공급사 예산 200px 을 더해 928px — 공용 하한 `58rem` 안이다 |
 *
 * 행 전체를 누르면 처리 화면으로 간다(C-1 이탈 조건 — 작업함은 선택 표시 없이 이동만 한다).
 * 끝 열에 [선택] 버튼을 두지 않는다(C-1).
 */
export const buildIrColumns = ({ supplierLookup }: IrColumnsInput): Column<IrView>[] => [
  { key: 'inboundReceiptNo', header: t.table.inboundReceiptNo, width: '180px' },
  {
    key: 'supplier',
    header: t.table.supplier,
    width: '35%',
    /*
     * **번호를 문자열로 바꾸는 자리가 없다**(#44). 이름으로 풀 수 없는 세 갈래(미도착·목록에
     * 없음·실패)는 전부 문구로 갈리며, 어느 갈래에도 원시 번호가 담기지 않는다.
     */
    render: (row) => {
      const name = describeReference(toReference(supplierLookup, row.supplierId));

      /* 너무 긴 이름은 말줄임한다 — 온전한 이름은 마우스를 올리면 보인다. */
      return (
        <span className="goods-receipt-ir-supplier" title={name}>
          {name}
        </span>
      );
    },
  },
  {
    key: 'receiptDatetime',
    header: t.table.receiptDatetime,
    width: '180px',
    render: (row) => (
      <span className="goods-receipt-ir-nowrap">{formatDateTime(row.receiptDatetime)}</span>
    ),
  },
  {
    key: 'deliveryNoteNo',
    header: t.table.deliveryNoteNo,
    width: '180px',
    render: (row) => orEmptyMark(row.deliveryNoteNo),
  },
  {
    key: 'statusCode',
    header: t.table.status,
    width: '140px',
    /* 글자는 서버 코드 그대로, 색만 `status-badge.ts` 가 가른다(사용자 지시). */
    render: (row) => (
      <span className="goods-receipt-ir-nowrap">
        <Chip variant="status" size="sm" status={toStatusTone(row.statusCode)}>
          {row.statusCode}
        </Chip>
      </span>
    ),
  },
  {
    key: 'go',
    header: <span className="goods-receipt-visually-hidden">{t.table.go}</span>,
    width: '48px',
    render: () => (
      <span className="selectable-table-go" aria-hidden="true">
        ›
      </span>
    ),
  },
];

export interface IrTableProps extends IrColumnsInput {
  rows: IrView[];
  isLoading: boolean;
  /** 결과는 있는데 이 쪽에는 없다. 「결과가 없다」와 다른 안내를 낸다. */
  isBeyondLast: boolean;
  onFirstPage: () => void;
  /** 행을 누르면 그 전표의 처리 화면을 연다 */
  onOpen: (row: IrView) => void;
  onRetryReferences: () => void;
}

/**
 * 대상 입하 전표 목록 표.
 *
 * **빈 상태가 두 갈래다** — 결과 없음 / 쪽 밖. 사용자가 할 조치가 서로 다르다.
 * 「아직 조회하지 않았다」 갈래는 없다 — 이 화면은 조건 없이도 들어오자마자 조회한다.
 *
 * **정렬을 열지 않는다.** 계약의 입하 목록 조회에 정렬 파라미터가 없어 서버로 보낼 수 없고,
 * 화면 안에서만 정렬하면 「지금 쪽 안에서만 정렬됐다」는 사정을 매번 설명해야 한다.
 * 이 화면에서 대상을 찾는 정상 경로는 입하번호 검색과 공급사·기간 조건이다.
 *
 * **이미 입고 처리된 전표를 가려내지 않는다.** 계약에 그 조건이 없고(입하 목록에 「입고 완료
 * 제외」가 없으며 입고 목록에도 원천 조건이 없다), 상태 코드로 거르는 것은 공유계약 G-2가
 * 금지한다. 화면이 중복 입고를 막을 수 없다는 사실은 계획 §8-1의 남은 위험으로 적혀 있다.
 */
export const IrTable = ({
  rows,
  isLoading,
  isBeyondLast,
  supplierLookup,
  onFirstPage,
  onOpen,
  onRetryReferences,
}: IrTableProps) => {
  const columns = buildIrColumns({ supplierLookup });

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.inboundReceipts}>
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
          <Button variant="outlined" onClick={onFirstPage}>
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
      <SelectableTable
        wrapperClassName="wide-table goods-receipt-ir-table"
        density="compact"
        columns={columns}
        rows={rows}
        getRowLabel={(row) => t.actions.openRow(row.inboundReceiptNo)}
        onRowActivate={onOpen}
        /*
         * 선택 열을 쓰지 않아도 지정한다 — 미지정이면 인덱스가 React key가 되어
         * 쪽이 바뀔 때 앞 쪽의 행이 남아 보일 수 있다.
         *
         * **여기의 `String()`은 화면에 나오지 않는다** — React key로만 쓰이며 셀 텍스트가 되지 않는다.
         */
        getRowId={(row) => String(row.inboundReceiptId)}
        empty={emptySlot()}
      />

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
