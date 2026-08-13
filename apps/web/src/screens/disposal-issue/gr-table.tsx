import { Button, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { describeReference, toReference, type ReferenceSource } from './lookups';
import { formatDateTime, type ReceiptView } from './types';

const t = messages.disposalIssue;

/**
 * `.wide-table`이 표에 주는 최소 폭(`58rem`).
 *
 * 열 폭 예산을 재는 감지기가 이 값을 읽는다 — 숫자를 테스트가 따로 적으면 배치 규범이 바뀔 때
 * 둘이 갈린다.
 */
export const TABLE_MIN_WIDTH_PX = 928;

export interface GrColumnsInput {
  selectedReceiptId: number | null;
  warehouseLookup: ReferenceSource;
  onToggleSelect: (goodsReceiptId: number) => void;
}

/**
 * 폐기 대상 입고 전표 목록의 열 구성.
 *
 * **이 표는 전표 한 건을 고르는 자리다.** 무엇을 얼마나 폐기할지는 **고른 전표의 라인 표**가
 * 받는다 — 자재 LOT · 품목 · 그 창고의 보유 수량은 라인·잔액 수준의 값이라 전표 목록 응답에
 * 없고, 그 세 열은 라인 표가 생기는 회차에서 그 표의 열이 된다(실행 보고서의 어긋남 기록).
 * 이 표가 그 대신 내는 것은 **원천**(입고번호)과 **입고일**, 그리고 그 둘만으로는 같은 날
 * 들어온 전표를 가리지 못하므로 **창고·유형·상태**다.
 *
 * **열이 여섯이다.** 계약의 입고 헤더에는 필드가 더 있으나 공장·원천 문서 유형과 식별자·
 * 사유·비고는 열로 만들지 않았다 — 이 화면의 판단(무엇을 폐기할까)에 쓰이지 않고,
 * 원천 문서는 낼 것이 번호밖에 없다(`omf-mes#44`).
 *
 * **정렬을 열지 않는다.** 계약의 입고 목록 조회에 정렬 파라미터가 **없고**(실측) 화면 안에서만
 * 정렬하면 「지금 쪽 안에서만 정렬됐다」는 사정을 매번 설명해야 한다. 이 화면에서 대상을
 * 찾는 정상 경로는 창고·기간 조건과 입고번호 검색이다.
 *
 * **이미 폐기된 전표를 가려내지 않는다.** 계약에 그 조건이 없고, 상태 코드로 거르는 것은
 * 공유계약이 금지한다 — 화면이 값을 해석하면 값이 정해질 때 조용히 틀린다.
 *
 * 열 폭의 도출(`docs/layout-conventions.md`의 방식 — 흡수 열에도 예산을 잡는다):
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 입고번호 | 168px | 14자(자폭 약 7.5px) 105px + 셀 여백 32px + 여유 |
 * | **창고** | **미지정** | 「코드 · 이름」을 담고 남는 폭을 흡수한다 |
 * | 입고 유형 | 128px | 코드 문자열 |
 * | 입고 일시 | 168px | `YYYY-MM-DD HH:mm` 16자 120px + 셀 여백 32px |
 * | 상태 | 128px | 코드 문자열 |
 * | 선택 | 88px | `sm` 버튼 하나 |
 * | **지정 폭 합** | **680px** | |
 * | 흡수 열 예산 | 200px | 「코드 · 이름」이 접히지 않고 읽히는 하한 |
 * | **합** | **880px** | `58rem`(928px) 안에 들어간다 — 48px 여유 |
 *
 * **흡수 열이 실제로 받는 폭은 248px**(928 − 680)로 예산 200px보다 넓다. 지정 폭 합이 표
 * 하한에 가까우면 흡수 열이 몇십 px밖에 못 받아 「코드 · 이름」이 낱말 단위로 쪼개진다.
 * 그 어긋남은 열 폭 합만 세는 단언을 통과하므로 **남는 폭까지 함께 단언한다.**
 */
export const buildGrColumns = ({
  selectedReceiptId,
  warehouseLookup,
  onToggleSelect,
}: GrColumnsInput): Column<ReceiptView>[] => [
  { key: 'goodsReceiptNo', header: t.table.goodsReceiptNo, width: '168px' },
  {
    key: 'warehouse',
    header: t.table.warehouse,
    /*
     * **번호를 문자열로 바꾸는 자리가 없다**(`omf-mes#44`). 이름으로 풀 수 없는 세 갈래
     * (미도착·목록에 없음·실패)는 전부 문구로 갈리며, 어느 갈래에도 원시 번호가 담기지 않는다.
     */
    render: (row) => describeReference(toReference(warehouseLookup, row.warehouseId)),
  },
  {
    key: 'receiptTypeCode',
    header: t.table.receiptType,
    width: '128px',
    /*
     * **값에 따라 변형을 가르지 않는다.** 값 집합이 확정되지 않아 색을 가르면 뜻을 지어내는
     * 것이 된다. 코드는 번역하지 않고 그대로 낸다.
     */
  },
  {
    key: 'receiptDatetime',
    header: t.table.receiptDatetime,
    width: '168px',
    render: (row) => formatDateTime(row.receiptDatetime),
  },
  { key: 'statusCode', header: t.table.status, width: '128px' },
  {
    key: 'select',
    header: t.table.select,
    width: '88px',
    render: (row) => {
      const selected = row.goodsReceiptId === selectedReceiptId;

      return (
        /*
         * 접근 이름에 **입고번호**를 넣는다 — 「선택」이 행마다 되풀이되면 어느 건인지 알 수 없다.
         * 내부 번호를 넣지 않는 이유는 그것이 화면 밖으로 새는 또 하나의 경로이기 때문이다.
         */
        <Button
          variant="outlined"
          size="sm"
          aria-label={
            selected
              ? t.actions.deselectRow(row.goodsReceiptNo)
              : t.actions.selectRow(row.goodsReceiptNo)
          }
          onClick={() => {
            onToggleSelect(row.goodsReceiptId);
          }}
        >
          {selected ? t.actions.deselect : t.actions.select}
        </Button>
      );
    },
  },
];

export interface GrTableProps extends GrColumnsInput {
  rows: ReceiptView[];
  isLoading: boolean;
  /** 결과는 있는데 이 쪽에는 없다. 「결과가 없다」와 다른 안내를 낸다. */
  isBeyondLast: boolean;
  onFirstPage: () => void;
  onRetryReferences: () => void;
}

/**
 * 폐기 대상 입고 전표 목록 표.
 *
 * **빈 상태가 두 갈래다** — 결과 없음 / 쪽 밖. 사용자가 할 조치가 서로 다르다.
 * 「아직 조회하지 않았다」 갈래는 없다 — 이 화면은 조건 없이도 들어오자마자 조회한다.
 * 셋째 갈래(「아직 전표를 고르지 않았다」)는 이 표가 아니라 **아래 구획**이 맡는다.
 *
 * **빈 상태를 바깥에서 가르지 않는다.** 표를 늘 그리고 `empty`가 0건을 맡는다 —
 * 바깥에서 0건을 갈라 내면 `Table.empty`가 닿을 수 없는 가지가 된다.
 */
export const GrTable = ({
  rows,
  isLoading,
  isBeyondLast,
  selectedReceiptId,
  warehouseLookup,
  onFirstPage,
  onToggleSelect,
  onRetryReferences,
}: GrTableProps) => {
  const columns = buildGrColumns({ selectedReceiptId, warehouseLookup, onToggleSelect });

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.goodsReceipts}>
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
          getRowId={(row) => String(row.goodsReceiptId)}
          empty={emptySlot()}
        />
      </div>

      {warehouseLookup.isError && (
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
