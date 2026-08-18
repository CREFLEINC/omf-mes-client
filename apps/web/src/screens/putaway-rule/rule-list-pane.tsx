import { Button, Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { RuleBalance } from './balance-lookup';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import type { RuleView } from './types';
import { UsageCell } from './usage-cell';

const t = messages.putawayRule;

/**
 * 표의 열 폭.
 *
 * **흡수 열은 이름 열 둘(품목·위치)이고 나머지 넷은 폭을 지정한다.** 흡수 열이 셋 이상이면
 * 좁은 칸에서 전부 짓눌린다. `.wide-table`을 붙이지 않는다 — 그 클래스의 최소 폭(928px)을
 * 강제하면 좁은 화면에서 언제나 가로 스크롤이 생기고, 「폭이 모자라 넘치는 것」과
 * 「폭을 강제해 넘치는 것」은 다른 문제이며 후자는 붙여서 만드는 문제다.
 *
 * **현재 적재 칸은 용량 칸보다 넓다** — 막대와 수치 줄이 함께 서고, 판정 불가 갈래에서는
 * 소유·단위별 줄이 여럿 선다. **사용 칸도 96px에서 넓어졌다** — 중복 표식이 사용 표기와
 * 함께 서기 때문이다.
 */
export const RULE_COLUMN_WIDTH = {
  priorityNo: '88px',
  capacity: '160px',
  onHand: '220px',
  status: '128px',
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
   * 그 규칙이 견줄 현재 적재. **표가 잔액 조회를 알지 않는다** — 이름 풀이와 같은 이유로
   * 화면이 풀어 넘긴다. 표가 조회를 알면 미도착·실패·잘림 갈래가 표 안으로 흘러 들어온다.
   */
  balanceOf: (rule: RuleView) => RuleBalance;
  /**
   * 같은 조합의 활성 규칙이 이 쪽에 둘 이상인 규칙 번호.
   *
   * ⚠ **지금 보이는 쪽 안의 사실이다.** 판정은 화면이 하고 표는 결과만 받는다 —
   * 표가 스스로 세면 「어느 범위에서 센 것인가」가 표 안에 갇혀 다른 쪽에서 읽을 수 없다.
   */
  duplicatedRuleIds: ReadonlySet<number>;
  /**
   * 이름 목록이 잘렸다는 안내. **위치·단위는 고르는 칸이 없어 표가 그 사실을 말하는 유일한
   * 자리다** — 밝히지 않으면 잘린 목록으로 이름을 푼 정상 규칙이 「알 수 없음」으로 보이고
   * 사용자는 그것을 *값이 잘못됐다*로 읽는다.
   */
  nameLookupNote?: string;
  /**
   * 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「등록된 규칙이 없습니다」로 보이면 사실과 다른 안내가 된다.
   */
  loadError: ReactNode;
}

/**
 * 적치 규칙 목록 표.
 *
 * **열은 여섯이다**(우선순위·품목·위치·용량·현재 적재·사용). 「현재 적재」는 그 값을 실제로
 * 부르는 이 회차가 값과 함께 가져왔다 — 부르지 않는 값의 자리를 미리 만들면 그 칸에 무엇을
 * 그려도 사실이 아니게 된다(「없다」도 「0」도 「모른다」도 참이 아니다).
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
  balanceOf,
  duplicatedRuleIds,
  nameLookupNote,
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
      key: 'onHand',
      header: t.fields.onHand,
      width: RULE_COLUMN_WIDTH.onHand,
      /*
       * **용량 바로 뒤에 둔다.** 두 수가 이웃해야 눈이 표를 오가지 않고 견준다 —
       * 이 열이 있는 이유가 바로 옆 칸의 수에 뜻을 주는 것이다.
       *
       * 오른쪽 정렬을 걸지 않는다: 막대와 사유 문구가 함께 서는 칸이라 수만 있는 칸이 아니다.
       */
      render: (row) => <UsageCell rule={row} balance={balanceOf(row)} uomLabel={uomLabel} />,
    },
    {
      key: 'status',
      header: t.fields.status,
      width: RULE_COLUMN_WIDTH.status,
      /*
       * 꺼진 행에만 표식을 붙인다 — 표식은 예외를 가리키는 것이고, 모든 행에 붙이면
       * 어느 것이 예외인지 눈으로 갈리지 않는다.
       *
       * **중복 표식도 이 칸에 선다.** 둘 다 「이 규칙이 지금 어떻게 효력을 갖는가」를 말한다 —
       * 꺼진 규칙은 효력이 없고, 중복된 규칙은 효력이 있는데 **어느 것이 이기는지 데이터가
       * 정하지 않는다.** 같은 물음의 답을 두 칸에 흩어 놓지 않는다.
       */
      render: (row) => (
        <div className="field-cell">
          {row.isActive ? (
            <span>{t.values.active}</span>
          ) : (
            <Chip variant="status" size="sm" status="idle">
              {t.values.inactive}
            </Chip>
          )}
          {duplicatedRuleIds.has(row.putawayRuleId) && (
            <Chip variant="status" size="sm" status="warning">
              {t.values.duplicate}
            </Chip>
          )}
        </div>
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
      {/*
       * 잘림 안내가 건수보다 앞선다 — 건수를 먼저 읽으면 그 아래 표를 이미 사실로 받아들인
       * 뒤다. 표를 어떻게 읽어야 하는지를 말하는 문장이 표 바로 아래에 서야 한다.
       */}
      {nameLookupNote !== undefined && <p className="field-note">{nameLookupNote}</p>}
      <p className="field-note">{t.notes.activeCountInPage(activeCountInPage)}</p>
      <PageNav view={pageView} onChange={onChangePage} />
    </>
  );
};
