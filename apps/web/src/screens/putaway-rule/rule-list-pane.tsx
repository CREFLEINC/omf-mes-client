import { Button, Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import type { RuleView } from './types';

const t = messages.putawayRule;

/**
 * 표의 열 폭.
 *
 * **흡수 열은 이름 열 둘(품목·위치)이고 나머지 셋은 폭을 지정한다.** 흡수 열이 셋이면 좁은
 * 칸에서 셋 다 짓눌린다. `.wide-table`을 붙이지 않는다 — 그 클래스의 최소 폭(928px)을
 * 강제하면 좁은 화면에서 언제나 가로 스크롤이 생기고, 「폭이 모자라 넘치는 것」과
 * 「폭을 강제해 넘치는 것」은 다른 문제이며 후자는 붙여서 만드는 문제다.
 */
export const RULE_COLUMN_WIDTH = {
  priorityNo: '88px',
  capacity: '160px',
  status: '96px',
} as const;

export interface RuleListPaneProps {
  rules: RuleView[];
  isLoading: boolean;
  pageView: PageView;
  onChangePage: (page: number) => void;
  selectedRuleId: number | null;
  onSelect: (putawayRuleId: number) => void;
  /**
   * 이름 풀이. **화면이 풀어 넘긴다** — 표가 참조 조회를 알면 이름을 못 풀었을 때의 네 갈래가
   * 표 안으로 흘러 들어오고, 그러면 내부 번호가 새는 자리도 함께 는다(`omf-mes#44`).
   */
  itemLabel: (itemId: number) => string;
  /** `null`은 「창고 전체」다 — 그 판정은 화면이 하고 표는 결과만 받는다. */
  locationLabel: (locationId: number | null) => string;
  uomLabel: (uomId: number) => string;
  /**
   * 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「등록된 규칙이 없습니다」로 보이면 사실과 다른 안내가 된다.
   */
  loadError: ReactNode;
}

/**
 * 적치 규칙 목록 표.
 *
 * **열은 다섯이다**(우선순위·품목·위치·용량·사용). 「현재 적재」 열은 그 값을 실제로 부르는
 * 회차가 함께 가져온다 — 부르지 않는 값의 자리를 미리 만들면 그 칸에 무엇을 그려도 사실이
 * 아니게 되고(「없다」도 「0」도 「모른다」도 지금은 참이 아니다) 죽은 자리가 다음 사본으로
 * 전파된다(사본 체크리스트 7번).
 *
 * **정렬 가능한 열도 선택 열도 두지 않는다.** 계약의 목록 쿼리에 정렬 파라미터가 없고
 * 일괄로 할 쓰기가 없다 — 눌러도 아무 일이 없는 칸이 된다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const RuleListPane = ({
  rules,
  isLoading,
  pageView,
  onChangePage,
  selectedRuleId,
  onSelect,
  itemLabel,
  locationLabel,
  uomLabel,
  loadError,
}: RuleListPaneProps) => {
  const columns: Column<RuleView>[] = [
    {
      key: 'priorityNo',
      header: t.fields.priorityNo,
      width: RULE_COLUMN_WIDTH.priorityNo,
      align: 'end',
      render: (row) => String(row.priorityNo),
    },
    {
      key: 'item',
      header: t.fields.item,
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-label={t.actions.selectRow(itemLabel(row.itemId), locationLabel(row.locationId))}
          aria-current={row.putawayRuleId === selectedRuleId ? 'true' : undefined}
          onClick={() => {
            onSelect(row.putawayRuleId);
          }}
        >
          {itemLabel(row.itemId)}
        </button>
      ),
    },
    {
      key: 'location',
      header: t.fields.location,
      render: (row) => locationLabel(row.locationId),
    },
    {
      key: 'capacity',
      header: t.fields.capacity,
      width: RULE_COLUMN_WIDTH.capacity,
      align: 'end',
      /* 수량과 단위는 한 몸이다 — 수량만 보이면 크고 작음을 판단할 수 없다. */
      render: (row) => t.values.capacity(String(row.capacityQty), uomLabel(row.uomId)),
    },
    {
      key: 'status',
      header: t.fields.status,
      width: RULE_COLUMN_WIDTH.status,
      /*
       * 꺼진 행에만 표식을 붙인다 — 표식은 예외를 가리키는 것이고, 모든 행에 붙이면
       * 어느 것이 예외인지 눈으로 갈리지 않는다.
       */
      render: (row) =>
        row.isActive ? (
          t.values.active
        ) : (
          <Chip variant="status" size="sm" status="idle">
            {t.values.inactive}
          </Chip>
        ),
    },
  ];

  /**
   * 빈 상태는 두 갈래다 — 사용자가 할 조치가 다르다.
   *
   * ① 범위 밖 쪽: 결과는 있는데 이 쪽에 없다(주소 조작·조건 변경으로 생긴다).
   * ② 결과 없음: 조건을 줄이거나 「사용 중만」을 끄면 나올 수 있다.
   *
   * ①을 먼저 본다. 범위 밖은 `total > 0`일 때만 참이라 ②와 겹치지 않는다.
   */
  const emptySlot: ReactNode = pageView.isBeyondLast ? (
    <EmptyState
      size="sm"
      live
      title={t.empty.beyondLastTitle}
      description={t.empty.beyondLastDescription}
      action={
        <Button
          variant="outlined"
          onClick={() => {
            onChangePage(1);
          }}
        >
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

  /**
   * **조회 실패 → 로딩 → 표 순서로 하나만 낸다.** 먼저 로딩을 보면 실패한 조회가 영원히
   * 「불러오는 중」으로 보이고, 사용자는 기다리면 될 일이라고 읽는다(사본 대조 추가 ①).
   */
  if (loadError !== null && loadError !== undefined) return <>{loadError}</>;

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.list}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  /**
   * **이 쪽 안에서 센 수다.** 전체 건수는 서버가 주지만 사용 중 건수는 주지 않으므로
   * 지금 보이는 쪽에서만 셀 수 있다 — 그 범위를 문구가 함께 말한다.
   */
  const activeCountInPage = rules.filter((rule) => rule.isActive).length;

  return (
    <>
      <Table
        density="compact"
        columns={columns}
        rows={rules}
        getRowId={(row) => String(row.putawayRuleId)}
        /* 0건을 바깥에서 가르지 않는다 — 가르면 표의 빈 자리가 닿을 수 없는 가지가 된다. */
        empty={emptySlot}
      />
      <p className="field-note">{t.notes.activeCountInPage(activeCountInPage)}</p>
      <PageNav view={pageView} onChange={onChangePage} />
    </>
  );
};
