import { Button, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { readSubmission } from './approval-progress';
import { describeReference, toReference, type ReferenceSource } from './lookups';
import { formatDateTime, type IssueView } from './types';

const t = messages.disposalIssue;

/**
 * `.wide-table`이 표에 주는 최소 폭(`58rem`).
 *
 * 열 폭 예산을 재는 감지기가 이 값을 읽는다 — 숫자를 테스트가 따로 적으면 배치 규범이 바뀔 때
 * 둘이 갈린다. **대상 표의 상수와 값이 같아도 각 표가 자기 것을 갖는다**: 한 표의 열 구성이
 * 바뀌어 최소 폭을 올려야 할 때 다른 표까지 함께 끌려가면 안 된다.
 */
export const HISTORY_TABLE_MIN_WIDTH_PX = 928;

export interface GiColumnsInput {
  selectedIssueId: number | null;
  warehouseLookup: ReferenceSource;
  onToggleSelect: (goodsIssueId: number) => void;
}

/**
 * 처리 이력 목록의 열 구성.
 *
 * **열이 여섯이다.** 출고 유형 열을 두지 않았다 — 이 화면의 이력은 전부 기타 출고라 값이 한
 * 가지이고, 조건 축인 **폐기 사유**가 더 많은 것을 말한다(계획 §5.5). 승인 진행 열도 두지
 * 않는다: 진행을 열로 넣으면 **전표마다 승인 조회가 나가 한 쪽에 쉰 번**이 된다 — 진행은
 * 고른 품의의 아래 구획이 말한다.
 *
 * **미상신 표식은 열이 아니라 출고번호 칸의 표식이다.** 열을 늘리는 것보다 줄이는 것이
 * 먼저이고(계획 §5.5), 이 표식은 그 전표를 가리키는 이름 옆에 붙어야 「이 전표가 아직
 * 안 올라갔다」로 읽힌다. **`approvalRequestId`가 있는가로만 갈린다**(계획 결정 7) —
 * 상태 코드를 읽지 않는다.
 *
 * **정렬을 열지 않는다.** 계약의 출고 목록 조회에 정렬 파라미터가 **없고**(실측) 화면 안에서만
 * 정렬하면 「지금 쪽 안에서만 정렬됐다」는 사정을 매번 설명해야 한다.
 *
 * 열 폭의 도출(`docs/layout-conventions.md`의 방식 — 흡수 열에도 예산을 잡는다):
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 출고번호 | 168px | 14자(자폭 약 7.5px) 105px + 셀 여백 32px + **미상신 표식** |
 * | **창고** | **미지정** | 「코드 · 이름」을 담고 남는 폭을 흡수한다 |
 * | 폐기 사유 | 128px | 코드 문자열. **이 화면의 조건 축이다** |
 * | 출고 일시 | 168px | `YYYY-MM-DD HH:mm` 16자 120px + 셀 여백 32px |
 * | 상태 | 128px | 코드 문자열 |
 * | 선택 | 88px | `sm` 버튼 하나 |
 * | **지정 폭 합** | **680px** | |
 * | 흡수 열 예산 | 200px | 「코드 · 이름」이 접히지 않고 읽히는 하한 |
 * | **합** | **880px** | `58rem`(928px) 안에 들어간다 — 48px 여유 |
 *
 * **흡수 열이 실제로 받는 폭은 248px**(928 − 680)로 예산 200px보다 넓다. 지정 폭 합이 표
 * 하한에 가까우면 흡수 열이 몇십 px밖에 못 받아 「코드 · 이름」이 낱말 단위로 쪼개진다 —
 * 그 어긋남은 폭 합만 세는 단언을 통과하므로 **남는 폭까지 함께 단언한다.**
 */
export const buildGiColumns = ({
  selectedIssueId,
  warehouseLookup,
  onToggleSelect,
}: GiColumnsInput): Column<IssueView>[] => [
  {
    key: 'goodsIssueNo',
    header: t.historyTable.goodsIssueNo,
    width: '168px',
    render: (row) => (
      <>
        {row.goodsIssueNo}
        {/*
         * **색·아이콘에만 기대지 않는다** — 글자로 낸다. 상신되지 않은 전표는 결재가 시작되지
         * 않은 중간 상태이며, 이 탭이 그것을 **숨기지 않고 보이는 자리**다.
         */}
        {readSubmission(row.approvalRequestId).kind === 'notSubmitted' && (
          <span className="field-note">{t.values.notSubmitted}</span>
        )}
      </>
    ),
  },
  {
    key: 'warehouse',
    header: t.historyTable.warehouse,
    /*
     * **번호를 문자열로 바꾸는 자리가 없다**(`omf-mes#44`). 이름으로 풀 수 없는 세 갈래
     * (미도착·목록에 없음·실패)는 전부 문구로 갈리며, 어느 갈래에도 원시 번호가 담기지 않는다.
     */
    render: (row) => describeReference(toReference(warehouseLookup, row.sourceWarehouseId)),
  },
  {
    key: 'reasonCode',
    header: t.historyTable.reason,
    width: '128px',
    /*
     * 사유 코드는 계약이 선택으로 두어 **없이 오는 전표가 실재한다.** 빈 칸으로 두면 값이
     * 없는 것인지 화면이 못 그린 것인지 구분되지 않는다 — **코드를 지어내지 않고** 그 사실을 적는다.
     */
    render: (row) => row.reasonCode ?? t.values.noReasonCode,
  },
  {
    key: 'issuedAt',
    header: t.historyTable.issuedAt,
    width: '168px',
    render: (row) => formatDateTime(row.issuedAt),
  },
  { key: 'statusCode', header: t.historyTable.status, width: '128px' },
  {
    key: 'select',
    header: t.historyTable.select,
    width: '88px',
    render: (row) => {
      const selected = row.goodsIssueId === selectedIssueId;

      return (
        /*
         * 접근 이름에 **출고번호**를 넣는다 — 「선택」이 행마다 되풀이되면 어느 건인지 알 수 없다.
         * 내부 번호를 넣지 않는 이유는 그것이 화면 밖으로 새는 또 하나의 경로이기 때문이다.
         */
        <Button
          variant="outlined"
          size="sm"
          aria-label={
            selected
              ? t.actions.deselectIssueRow(row.goodsIssueNo)
              : t.actions.selectIssueRow(row.goodsIssueNo)
          }
          onClick={() => {
            onToggleSelect(row.goodsIssueId);
          }}
        >
          {selected ? t.actions.deselect : t.actions.select}
        </Button>
      );
    },
  },
];

export interface GiTableProps extends GiColumnsInput {
  rows: IssueView[];
  isLoading: boolean;
  /** 결과는 있는데 이 쪽에는 없다. 「결과가 없다」와 다른 안내를 낸다. */
  isBeyondLast: boolean;
  onFirstPage: () => void;
  onRetryReferences: () => void;
}

/**
 * 처리 이력 목록 표.
 *
 * **빈 상태가 두 갈래다** — 결과 없음 / 쪽 밖. 사용자가 할 조치가 서로 다르다.
 * 셋째 갈래(「아직 품의를 고르지 않았다」)는 이 표가 아니라 **아래 구획**이 맡는다.
 *
 * **빈 상태를 바깥에서 가르지 않는다.** 표를 늘 그리고 `empty`가 0건을 맡는다 —
 * 바깥에서 0건을 갈라 내면 `Table.empty`가 닿을 수 없는 가지가 된다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const GiTable = ({
  rows,
  isLoading,
  isBeyondLast,
  selectedIssueId,
  warehouseLookup,
  onFirstPage,
  onToggleSelect,
  onRetryReferences,
}: GiTableProps) => {
  const columns = buildGiColumns({ selectedIssueId, warehouseLookup, onToggleSelect });

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.goodsIssues}>
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
          <Button variant="outlined" onClick={onFirstPage}>
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
           * **여기의 `String()`은 화면에 나오지 않는다** — React key로만 쓰인다.
           */
          getRowId={(row) => String(row.goodsIssueId)}
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
