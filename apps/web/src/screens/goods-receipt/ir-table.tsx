import { Button, Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { describeReference, toReference, type ReferenceSource } from './lookups';
import { toStatusTone } from './status-badge';
import { formatDateTime, type IrView } from './types';

const t = messages.goodsReceipt;

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | null): ReactNode => value ?? t.values.empty;

export interface IrColumnsInput {
  selectedIrId: number | null;
  supplierLookup: ReferenceSource;
  /**
   * 입고 처리를 보내는 중인가.
   *
   * 참이면 **대상을 바꾸는 길을 닫는다**(계획 결정 13). 열어 두면 사용자가 다른 전표로 옮긴 뒤
   * **앞 전표의 처리 결과가 지금 보는 전표의 맥락에 나타난다** — 중복 전송이 생기지는 않지만
   * 「무엇이 어느 전표에 입고됐는가」가 화면에서 흐려지고, 되돌릴 수 없는 쓰기라 그 혼선이 비싸다.
   */
  isLocked: boolean;
  onToggleSelect: (inboundReceiptId: number) => void;
}

/**
 * 대상 입하 전표 목록의 열 구성.
 *
 * **열이 여섯이다.** 계약의 입하 헤더에는 필드가 더 있으나 차량 번호·입하장·예외 유형·
 * 승인 요청·접수자는 열로 만들지 않았다 — 이 화면의 판단(무엇을 창고로 받아들일까)에 쓰이지
 * 않고, 승인 요청은 내부 번호뿐이라 낼 것이 번호밖에 없다(#44). 공장은 고른 전표의 제목줄로 보냈다.
 *
 * 열 폭의 도출(`docs/layout-conventions.md`의 방식 — 흡수 열에도 예산을 잡는다):
 *
 * | 열 | 폭 | 정렬 | 근거 |
 * | --- | ---: | --- | --- |
 * | 입하번호 | 200px | 가운데 | `IR-YYYYMMDD-NNNN` 16자가 한 줄로 서고 여유가 남는 폭 |
 * | **공급사** | **35%** | 가운데 | 가장 넓은 열. 너무 긴 이름은 `32rem` 에서 말줄임한다 |
 * | 입하일시 | 180px | 가운데 | `YYYY-MM-DD HH:mm` 가 줄바꿈 없이 선다 |
 * | 거래명세서번호 | 180px | 가운데 | 15자 안팎의 번호 · 없으면 `—` |
 * | 상태 | 140px | 가운데 | 상태 칩 하나 |
 * | 선택 | 96px | 가운데 | `md` 버튼 하나 |
 * | **지정 폭 합** | **796px** | | |
 * | 공급사 예산 | 200px | | 「코드 · 이름」이 접히지 않고 읽히는 하한 |
 * | **합** | **996px** | | 이 표의 하한 `64rem`(1024px) 안에 들어간다 — 28px 여유 |
 *
 * **공급사를 비율로 둔다.** 폭을 비우면 표가 남는 폭을 전부 그 열에 줘서, 넓은 화면(1920px)에서
 * 짧은 이름 뒤로 1,000px 넘는 빈 칸이 생긴다. 35% 로 두면 남는 폭이 px 열들에 비례로 나뉜다
 * (실측 1880px: 307 · 658 · 276 · 276 · 215 · 147, 1400px: 229 · 490 · 206 · 206 · 160 · 110).
 * 그래서 위 px 값은 넓은 화면에서의 «하한»이다.
 *
 * 머리줄과 본문은 모두 가운데 정렬이다(사용자 지시) — `app.css` 의 `.goods-receipt-ir-table` 이 맞춘다.
 * 날짜·상태 칩·버튼은 줄을 바꾸지 않는다.
 *
 * 지정 폭 합이 표 하한에 가까우면 흡수 열이 몇십 px밖에 못 받아 「코드 · 이름」이 낱말 단위로
 * 쪼개진다. 그 어긋남은 열 폭 합만 세는 단언을 통과하므로 **남는 폭까지 함께 단언한다**.
 */
export const buildIrColumns = ({
  selectedIrId,
  supplierLookup,
  isLocked,
  onToggleSelect,
}: IrColumnsInput): Column<IrView>[] => [
  { key: 'inboundReceiptNo', header: t.table.inboundReceiptNo, width: '200px' },
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
    key: 'select',
    /* 머리줄 글자는 화면에서 감춘다(사용자 지시) — 단추가 스스로 말한다. 열 이름은 스크린리더에만 남긴다. */
    header: <span className="goods-receipt-visually-hidden">{t.table.select}</span>,
    width: '96px',
    render: (row) => {
      const selected = row.inboundReceiptId === selectedIrId;

      return (
        /*
         * 접근 이름에 **입하번호**를 넣는다 — 「선택」이 행마다 되풀이되면 어느 건인지 알 수 없다.
         * 내부 번호를 넣지 않는 이유는 그것이 화면 밖으로 새는 또 하나의 경로이기 때문이다.
         */
        <Button
          variant="outlined"
          className="goods-receipt-ir-nowrap"
          disabled={isLocked}
          /* 고른 전표 표시 — 다른 목록 화면과 같은 표식(`aria-current`). `app.css` 가 이 값으로 행을 칠한다. */
          aria-current={selected ? 'true' : undefined}
          aria-label={
            selected
              ? t.actions.deselectRow(row.inboundReceiptNo)
              : t.actions.selectRow(row.inboundReceiptNo)
          }
          onClick={() => {
            onToggleSelect(row.inboundReceiptId);
          }}
        >
          {selected ? t.actions.deselect : t.actions.select}
        </Button>
      );
    },
  },
];

export interface IrTableProps extends IrColumnsInput {
  rows: IrView[];
  isLoading: boolean;
  /** 결과는 있는데 이 쪽에는 없다. 「결과가 없다」와 다른 안내를 낸다. */
  isBeyondLast: boolean;
  onFirstPage: () => void;
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
  selectedIrId,
  supplierLookup,
  isLocked,
  onFirstPage,
  onToggleSelect,
  onRetryReferences,
}: IrTableProps) => {
  const columns = buildIrColumns({ selectedIrId, supplierLookup, isLocked, onToggleSelect });

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
      <div className="wide-table goods-receipt-ir-table">
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
          getRowId={(row) => String(row.inboundReceiptId)}
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
