import { Button, type Column, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { SelectableTable } from '../../patterns/selectable-table';
import { describeReference, toReference, type ReferenceSource } from './lookups';
import { describeBlindCount, type CountView } from './types';

const t = messages.stocktaking;

export interface CountColumnsInput {
  selectedCountId: number | null;
  warehouseLookup: ReferenceSource;
  /** 전송 중인가. 다른 실사로 옮기면 **앞 요청의 결과가 그 실사 맥락에 나타난다**. */
  isLocked: boolean;
  onToggleSelect: (inventoryCountId: number) => void;
}

/**
 * 실사 목록의 열 구성.
 *
 * **열이 여섯이다.** 계약의 실사 헤더는 필드가 일곱뿐이고 그중 여섯이 여기 있다 —
 * 빠진 하나(`warehouseId`)는 이름으로 풀려 창고 열이 된다. 내부 번호는 어디에도 내지 않는다(#44).
 *
 * 열 폭의 도출(`docs/layout-conventions.md`의 방식 — 흡수 열에도 예산을 잡는다):
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 실사번호 | 168px | `IC-2026-000019` 14자(`--type-body-sm` 14px · 자폭 약 7.5px) 105px + 셀 여백 32px + 여유 |
 * | **창고** | **미지정** | 「코드 · 이름」을 담고 남는 폭을 흡수한다 |
 * | 실사 유형 | 128px | 코드 문자열 |
 * | 계획일 | 120px | `YYYY-MM-DD` 10자 75px + 셀 여백 32px |
 * | 블라인드 | 88px | 「예」/「아니오」 |
 * | 상태 | 128px | 코드 문자열 |
 * | **지정 폭 합** | **632px** | |
 * | 흡수 열 예산 | 200px | 「코드 · 이름」이 접히지 않고 읽히는 하한 |
 * | **합** | **832px** | `58rem`(928px) 안에 들어간다 — 96px 여유 |
 *
 * **흡수 열이 실제로 받는 폭은 296px**(928 − 632)로 예산 200px보다 넓다. 지정 폭 합이 표
 * 하한에 가까우면 흡수 열이 몇십 px밖에 못 받아 「코드 · 이름」이 낱말 단위로 쪼개진다.
 * 그 어긋남은 열 폭 합만 세는 단언을 통과하므로 **남는 폭까지 함께 단언한다**.
 */
export const buildCountColumns = ({
  warehouseLookup,
}: Pick<CountColumnsInput, 'warehouseLookup'>): Column<CountView>[] => [
  { key: 'inventoryCountNo', header: t.table.inventoryCountNo, width: '168px' },
  {
    key: 'warehouse',
    header: t.table.warehouse,
    /*
     * **번호를 문자열로 바꾸는 자리가 없다**(#44). 이름으로 풀 수 없는 세 갈래(미도착·목록에
     * 없음·실패)는 전부 문구로 갈리며, 어느 갈래에도 원시 번호가 담기지 않는다.
     */
    render: (row) => describeReference(toReference(warehouseLookup, row.warehouseId)),
  },
  { key: 'countTypeCode', header: t.table.countType, width: '128px' },
  { key: 'plannedDate', header: t.table.plannedDate, width: '120px' },
  {
    key: 'blindCount',
    header: t.table.blindCount,
    width: '88px',
    /* **읽히는 말로 낸다** — `true`·`false`가 그대로 나오면 값이 읽히지 않는다(완료 조건 C18). */
    render: (row) => describeBlindCount(row.blindCount),
  },
  {
    key: 'statusCode',
    header: t.table.status,
    width: '128px',
    /*
     * **값에 따라 표현을 가르지 않는다.** 값 집합이 확정되지 않아(공유계약 G-2) 색이나 배지를
     * 가르면 뜻을 지어내는 것이 된다. 코드는 번역하지 않고 **평문으로 그대로** 낸다 —
     * 배지(`Chip`)를 쓰지 않는 것은 이 화면이 비활성 표현에서 `Chip`을 피하는 것과 같은 줄기다
     * (설치본의 `StatusChipProps`에 `disabled`가 없어 표현이 어긋나는 갭 — 계획 §5.2).
     */
  },
];

export interface CountTableProps extends CountColumnsInput {
  rows: CountView[];
  isLoading: boolean;
  /** 결과는 있는데 이 쪽에는 없다. 「결과가 없다」와 다른 안내를 낸다. */
  isBeyondLast: boolean;
  onFirstPage: () => void;
  onRetryReferences: () => void;
}

/**
 * 실사 목록 표.
 *
 * **빈 상태가 두 갈래다** — 결과 없음 / 쪽 밖. 사용자가 할 조치가 서로 다르다.
 * 「아직 조회하지 않았다」 갈래는 없다 — 이 화면은 조건 없이도 들어오자마자 조회한다.
 * 그리고 **빈 상태를 표의 `empty`가 맡는다**: 바깥에서 0건을 갈라 다른 것을 그리면
 * `empty`가 닿을 수 없는 죽은 가지가 된다(W-01-07 Minor의 형태).
 *
 * **정렬을 열지 않는다.** 디자인 시스템 `Table`에는 서버 정렬 배선이 있으나 **계약의 실사
 * 목록 조회에 `sort` 쿼리가 없다**(실측 — 어긋남 3). 화면 안에서만 정렬하면 「지금 쪽 안에서만
 * 정렬됐다」는 사정을 매번 설명해야 한다. 이 화면에서 실사를 찾는 정상 경로는 창고·계획일
 * 범위·「진행 중만」 조건이다.
 */
export const CountTable = ({
  rows,
  isLoading,
  isBeyondLast,
  selectedCountId,
  warehouseLookup,
  isLocked,
  onFirstPage,
  onToggleSelect,
  onRetryReferences,
}: CountTableProps) => {
  const columns = buildCountColumns({ warehouseLookup });

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.counts}>
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
        action={
          <Button variant="outlined" disabled={isLocked} onClick={onFirstPage}>
            {t.actions.goFirstPage}
          </Button>
        }
      />
    ) : (
      <EmptyState size="sm" live title={t.empty.noResultTitle} />
    );

  return (
    <>
      {/*
       * `.wide-table`이 표에 최소 폭을 준다 — 폭이 모자라면 짓누르는 대신 가로로 넘긴다.
       * 스크롤 상자는 디자인 시스템 `Table`이 이미 갖고 있어 우리가 만들지 않는다.
       */}
      <div className="wide-table">
        {/*
         * 행 아무 곳이나 누르면 그 실사를 고른다(사용자 지시 2026-11-26 「선택 단추가 아니라 행 클릭」 · 공용
         * `SelectableTable`). 고른 행을 다시 누르면 선택을 푼다 — 종전 [선택 해제] 단추와 같은 동작. 잠금 중에는 누르지 않는다.
         */}
        <SelectableTable
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.inventoryCountId)}
          activeId={selectedCountId === null ? null : String(selectedCountId)}
          rowLabel={(row) =>
            row.inventoryCountId === selectedCountId
              ? t.actions.deselectRow(row.inventoryCountNo)
              : t.actions.selectRow(row.inventoryCountNo)
          }
          onActivate={(row) => {
            if (!isLocked) onToggleSelect(row.inventoryCountId);
          }}
          empty={emptySlot()}
        />
      </div>

      {warehouseLookup.isError && (
        <div className="field-cell">
          <span className="field-note">{t.reasons.warehouseReferenceFailed}</span>
          <Button variant="outlined" size="sm" onClick={onRetryReferences}>
            {messages.common.retry}
          </Button>
        </div>
      )}
    </>
  );
};
