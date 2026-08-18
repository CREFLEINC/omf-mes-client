import { Button, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { describeReference, toReference, type ReferenceSource } from './lookups';
import { formatDateTime, type AdjustmentSummaryView } from './types';

const t = messages.stockAdjust;

/**
 * `.wide-table`이 표에 주는 최소 폭(`58rem`).
 *
 * **선언과 산출물 두 자리를 잇는 값이다**(사본 체크리스트 8번). 시험이 지역 리터럴로 들고
 * 있으면 그 CSS가 바뀌어도 조용히 어긋나므로, 제품 파일이 내고 시험이 이것을 쓴다.
 * **조정 라인 표의 상수와 값이 같아도 각 표가 자기 것을 갖는다** — 한 표의 열 구성이 바뀌어
 * 최소 폭을 올려야 할 때 다른 표까지 함께 끌려가면 안 된다.
 */
export const HISTORY_TABLE_MIN_WIDTH_PX = 928;

/** 「전표번호 · 계획일」이 접히지 않고 한 줄에 들어가는 폭 — 흡수 열의 예산이다. */
export const HISTORY_ABSORBING_COLUMN_BUDGET_PX = 200;

export interface HistoryColumnsInput {
  selectedAdjustmentId: number | null;
  /**
   * 실사 이름 풀이. **번호가 아니라 이름을 그린다**(`omf-mes#44`) — 화면이 실사 목록에서
   * 만들어 넘긴다. 참조가 잘리거나 실패한 갈래의 문구도 이 한 자리를 지난다.
   */
  countLookup: ReferenceSource;
  /** 잠겼는가. 고르기는 주소를 바꾸므로 나가는 중인 쓰기가 있으면 잠근다 */
  isLocked?: boolean;
  onToggleSelect: (inventoryAdjustmentId: number) => void;
}

/**
 * 처리 이력 목록의 열 구성.
 *
 * **열이 여섯이다.** ERP 적재 열을 두지 않았다 — 세 갈래를 담으면 128px을 쓰는데 목록에서
 * 그 값으로 무엇을 판단하는 자리가 없다(고른 전표의 제목줄이 말한다). **승인 진행 열도 두지
 * 않는다**: 진행을 열로 넣으면 전표마다 승인 조회가 나가 한 쪽에 쉰 번이 된다.
 *
 * ⛔ **승인·반려 조작이 없다**(조심 ① · D-3 · C42). 이 표는 되찾아 읽는 자리이고, 승인과
 * 반려는 결재함(W-CO-09)이 소유한다.
 *
 * ⭐ **실사 참조가 비어 있는 것이 정상이다**(조심 ⑤ · C43). 원천이 셋이고 그중 둘(현장 실측 ·
 * 직접 등록)은 실사를 거치지 않는다 — 그 칸은 **「—」이고 경고 표식을 붙이지 않는다.**
 * 「알 수 없음」으로 내면 *값이 잘못됐다*는 뜻이 되어 사용자가 반대로 읽는다.
 *
 * **정렬을 열지 않는다.** 계약의 조정 목록 조회에 정렬 파라미터가 **없고**(실측) 화면 안에서만
 * 정렬하면 「지금 쪽 안에서만 정렬됐다」는 사정을 매번 설명해야 한다.
 *
 * 열 폭의 도출(`docs/layout-conventions.md`의 방식 — 흡수 열에도 예산을 잡는다):
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 조정 전표번호 | 168px | 14자(자폭 약 7.5px) 105px + 셀 여백 32px |
 * | **대상 실사** | **미지정** | 「전표번호 · 계획일」 또는 「—」를 담고 남는 폭을 흡수한다 |
 * | 조정 사유 | 128px | 코드 문자열 |
 * | 상태 | 128px | 코드 문자열 |
 * | 전기일 | 168px | `YYYY-MM-DD HH:mm` 16자 120px + 셀 여백 32px |
 * | 선택 | 88px | `sm` 버튼 하나 |
 * | **지정 폭 합** | **680px** | |
 * | 흡수 열 예산 | 200px | 「전표번호 · 계획일」이 접히지 않고 읽히는 하한 |
 * | **합** | **880px** | `58rem`(928px) 안에 들어간다 — 48px 여유 |
 *
 * **흡수 열이 실제로 받는 폭은 248px**(928 − 680)로 예산 200px보다 넓다. 지정 폭 합이 표
 * 하한에 가까우면 흡수 열이 몇십 px밖에 못 받아 이름이 낱말 단위로 쪼개진다 — 그 어긋남은
 * 폭 합만 세는 단언을 통과하므로 **남는 폭까지 함께 단언한다.**
 */
export const buildHistoryColumns = ({
  selectedAdjustmentId,
  countLookup,
  isLocked = false,
  onToggleSelect,
}: HistoryColumnsInput): Column<AdjustmentSummaryView>[] => [
  {
    key: 'inventoryAdjustmentNo',
    header: t.historyTable.inventoryAdjustmentNo,
    width: '168px',
  },
  {
    key: 'countRef',
    header: t.historyTable.countRef,
    /*
     * **없는 것과 못 푼 것을 가른다.** 참조가 아예 없는 줄은 「—」(정상)이고, 있는데 이름을
     * 풀지 못한 줄만 네 갈래 문구를 지난다 — 둘을 합치면 정상 상태에 「알 수 없음」이 선다.
     */
    render: (row) =>
      row.inventoryCountId === null
        ? t.values.empty
        : describeReference(toReference(countLookup, row.inventoryCountId)),
  },
  { key: 'reasonCode', header: t.historyTable.reason, width: '128px' },
  { key: 'statusCode', header: t.historyTable.status, width: '128px' },
  {
    key: 'adjustedAt',
    header: t.historyTable.adjustedAt,
    width: '168px',
    /*
     * **전기 여부의 판정 근거가 이 값의 유무 하나다**(C35) — 상태 코드를 읽지 않는다.
     * 「—」로만 두면 값이 없는 것인지 화면이 못 그린 것인지 갈리지 않으므로 글자로 적는다.
     */
    render: (row) =>
      row.adjustedAt === null ? t.historyTable.notPosted : formatDateTime(row.adjustedAt),
  },
  {
    key: 'select',
    header: t.historyTable.select,
    width: '88px',
    render: (row) => {
      const selected = row.inventoryAdjustmentId === selectedAdjustmentId;

      return (
        /*
         * 접근 이름에 **전표번호**를 넣는다 — 「선택」이 행마다 되풀이되면 어느 건인지 알 수
         * 없다. 내부 번호를 넣지 않는 이유는 그것이 화면 밖으로 새는 또 하나의 경로이기 때문이다.
         */
        <Button
          variant="outlined"
          size="sm"
          disabled={isLocked}
          aria-label={
            selected
              ? t.actions.deselectAdjustmentRow(row.inventoryAdjustmentNo)
              : t.actions.selectAdjustmentRow(row.inventoryAdjustmentNo)
          }
          onClick={() => {
            onToggleSelect(row.inventoryAdjustmentId);
          }}
        >
          {selected ? t.actions.deselect : t.actions.select}
        </Button>
      );
    },
  },
];

export interface HistoryTableProps extends HistoryColumnsInput {
  rows: AdjustmentSummaryView[];
  isLoading: boolean;
  /** 결과는 있는데 이 쪽에는 없다. 「결과가 없다」와 다른 안내를 낸다 */
  isBeyondLast: boolean;
  onFirstPage: () => void;
}

/**
 * 처리 이력 목록 표.
 *
 * **빈 상태가 두 갈래다** — 결과 없음 / 쪽 밖. 사용자가 할 조치가 서로 다르다.
 * 셋째 갈래(「아직 전표를 고르지 않았다」)는 이 표가 아니라 **아래 구획**이 맡는다.
 *
 * **빈 상태를 바깥에서 가르지 않는다.** 표를 늘 그리고 `empty`가 0건을 맡는다 — 바깥에서
 * 0건을 갈라 내면 `Table.empty`가 닿을 수 없는 가지가 된다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const HistoryTable = ({
  rows,
  isLoading,
  isBeyondLast,
  selectedAdjustmentId,
  countLookup,
  isLocked = false,
  onFirstPage,
  onToggleSelect,
}: HistoryTableProps) => {
  const columns = buildHistoryColumns({
    selectedAdjustmentId,
    countLookup,
    isLocked,
    onToggleSelect,
  });

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.adjustments}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  const emptySlot = (): ReactNode =>
    isBeyondLast ? (
      <EmptyState
        size="sm"
        live
        title={t.empty.historyBeyondLastTitle}
        description={t.empty.historyBeyondLastDescription}
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
        title={t.empty.historyNoResultTitle}
        description={t.empty.historyNoResultDescription}
      />
    );

  return (
    /*
     * `.wide-table`이 표에 최소 폭을 준다 — 폭이 모자라면 짓누르는 대신 가로로 넘긴다.
     * 스크롤 상자는 디자인 시스템 `Table`이 이미 갖고 있어 우리가 만들지 않는다.
     */
    <div className="wide-table">
      <Table
        density="compact"
        columns={columns}
        rows={rows}
        /*
         * 선택 열을 쓰지 않아도 지정한다 — 미지정이면 인덱스가 React key가 되어 쪽이 바뀔 때
         * 앞 쪽의 행이 남아 보일 수 있다.
         *
         * **여기의 `String()`은 화면에 나오지 않는다** — React key로만 쓰인다.
         */
        getRowId={(row) => String(row.inventoryAdjustmentId)}
        empty={emptySlot()}
      />
    </div>
  );
};
