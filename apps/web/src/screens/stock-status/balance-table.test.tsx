import type { Column, SortState } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BalanceTable, buildBalanceColumns, type BalanceTableProps } from './balance-table';
import { balance, itemViewFixtures, locationViewFixtures, lotViewFixtures } from './fixtures';
import type { BalanceView } from './types';
import type { ReferenceSource } from './lookups';
import { VIEW_AXES, type ViewAxis } from './view-axis';

const t = messages.stockStatus;

/** `.wide-table`이 표에 주는 최소 폭(58rem). **바닥이지 천장이 아니다.** */
const WIDE_TABLE_MIN_PX = 928;

/** 「코드 · 이름」이 한 줄에 들어가는 폭(`docs/layout-conventions.md`의 선례 값). */
const CODE_NAME_COLUMN_PX = 200;

const toPx = (width: string | undefined): number =>
  width === undefined ? 0 : Number.parseInt(width, 10);

const widthOf = (columns: Column<BalanceView>[], key: string): number =>
  toPx(columns.find((column) => column.key === key)?.width);

const totalWidthOf = (columns: Column<BalanceView>[]): number =>
  columns.reduce((sum, column) => sum + toPx(column.width), 0);

const source = (values: [number, string][], overrides: Partial<ReferenceSource> = {}) =>
  ({
    entries: values.map(([id, label]) => ({ value: String(id), label, isActive: true })),
    isError: false,
    isLoading: false,
    ...overrides,
  }) satisfies ReferenceSource;

/* 9302(품목) · 9403(LOT) · 9202(위치)는 일부러 빼 둔다 — 「목록에 없음」 갈래를 만든다. */
const ITEMS = source([[9301, 'SAMPLE-ITEM-01 · 합성 품목 가']]);
const LOTS = source([
  [9401, 'SAMPLE-LOT-0001'],
  [9402, 'SAMPLE-LOT-0002'],
]);
const LOCATIONS = source([[9201, 'SAMPLE-LOC-01 · 합성 위치 가']]);
const UOMS = source([[9501, 'SAMPLE-EA']]);
const PARTNERS = source([[9601, 'SAMPLE-PTR-01 · 합성 거래처 가']]);

const LOOKUPS = {
  itemLookup: ITEMS,
  lotLookup: LOTS,
  locationLookup: LOCATIONS,
  uomLookup: UOMS,
  partnerLookup: PARTNERS,
};

const renderTable = (overrides: Partial<BalanceTableProps> = {}) => {
  const onSortChange = vi.fn<(next: SortState | null) => void>();
  const onFirstPage = vi.fn<() => void>();
  const onRetryReferences = vi.fn<() => void>();

  render(
    <BalanceTable
      view="item"
      rows={itemViewFixtures}
      isLoading={false}
      hasQuery
      isBeyondLast={false}
      sortKey={null}
      onSortChange={onSortChange}
      onFirstPage={onFirstPage}
      onRetryReferences={onRetryReferences}
      {...LOOKUPS}
      {...overrides}
    />,
  );

  return { onSortChange, onFirstPage, onRetryReferences, user: userEvent.setup() };
};

const table = (): HTMLElement => screen.getByRole('table');

const headerNames = (): string[] =>
  within(table())
    .getAllByRole('columnheader')
    .map((cell) => cell.textContent ?? '');

const sortableHeaderNames = (): string[] =>
  within(table())
    .getAllByRole('columnheader')
    .filter((cell) => within(cell).queryByRole('button') !== null)
    .map((cell) => cell.textContent ?? '');

describe('buildBalanceColumns — 보기마다의 열 구성', () => {
  /* 열이 9~10개다. 축 열만 보기마다 다르고 나머지 여덟은 세 보기가 공유한다. */
  it('품목별은 아홉 열, LOT별·위치별은 열 열이다', () => {
    expect(buildBalanceColumns({ view: 'item', ...LOOKUPS })).toHaveLength(9);
    expect(buildBalanceColumns({ view: 'lot', ...LOOKUPS })).toHaveLength(10);
    expect(buildBalanceColumns({ view: 'location', ...LOOKUPS })).toHaveLength(10);
  });

  /*
   * **선언한 폭이 곧 실렌더 폭이 되게 한다.**
   *
   * 디자인 시스템 `Table`은 `table-layout: fixed`이고 폭을 `<colgroup>`에 싣는다 —
   * 고정 배치에서 **폭을 지정하지 않은 열은 남는 폭의 잔여분**을 받는다. 지정 합이 표 폭에
   * 가까우면 그 열에 남는 것이 사실상 없고, 브라우저 확인 F-B2에서 실제로 품목 열이 82px로
   * 렌더돼 주 식별자가 네 줄로 쪼개졌다.
   *
   * **지난 회차의 「합 ≤ 928px」 단언이 그 결함을 통과시켰다** — 미지정 열을 세지 않아
   * 924px을 「여유 있음」으로 읽었기 때문이다. 그래서 세 갈래로 바꾼다.
   */
  it('모든 열이 폭을 지정한다 — 미지정 열은 잔여분을 받아 선언과 실렌더가 어긋난다', () => {
    for (const view of VIEW_AXES) {
      const unspecified = buildBalanceColumns({ view, ...LOOKUPS }).filter(
        (column) => column.width === undefined,
      );

      expect(unspecified).toEqual([]);
    }
  });

  /* 주 식별자 열이다. 「코드 · 이름」이 한 줄에 들어가지 않으면 표를 훑을 수 없다. */
  it('축 열이 「코드 · 이름」을 담는 폭 이상이다', () => {
    const axisKeys: Record<ViewAxis, string[]> = {
      item: ['itemCode'],
      lot: ['itemCode'],
      location: ['locationCode', 'itemCode'],
    };

    for (const view of VIEW_AXES) {
      const columns = buildBalanceColumns({ view, ...LOOKUPS });

      for (const key of axisKeys[view]) {
        expect(widthOf(columns, key)).toBeGreaterThanOrEqual(CODE_NAME_COLUMN_PX);
      }
    }
  });

  /*
   * **`.wide-table`은 `min-width`라 바닥이지 천장이 아니다.** 합이 하한보다 작으면 고정 배치가
   * 남는 폭을 나눠 넣어 선언과 실렌더가 다시 어긋난다. 합이 하한 이상이면 각 열이 선언한 폭
   * 그대로 렌더되고, 모자란 폭은 디자인 시스템의 `overflow-x` 상자가 가로 스크롤로 처리한다
   * (브라우저 확인 B6의 통과 기준이 「좁으면 가로 스크롤이 생긴다」이다).
   */
  it('열 폭 합이 세 보기 모두 표 하한 이상이다', () => {
    for (const view of VIEW_AXES) {
      expect(totalWidthOf(buildBalanceColumns({ view, ...LOOKUPS }))).toBeGreaterThanOrEqual(
        WIDE_TABLE_MIN_PX,
      );
    }
  });
});

describe('BalanceTable — 정렬 가능한 열', () => {
  /*
   * 이슈 #21 §6이 「임의 열 정렬을 열지 마세요」로 못 박았다. 계약 열거값 밖의 열에
   * 정렬을 열면 눌렀을 때 400이 돌아온다.
   */
  it('품목별에서는 품목·보유·가용에만 정렬 버튼이 붙는다', () => {
    renderTable({ view: 'item' });

    expect(sortableHeaderNames()).toEqual([t.table.item, t.table.onHandQty, t.table.availableQty]);
  });

  it('LOT별에서는 품목·LOT·보유·가용에만 붙는다', () => {
    renderTable({ view: 'lot', rows: lotViewFixtures });

    expect(sortableHeaderNames()).toEqual([
      t.table.item,
      t.table.lot,
      t.table.onHandQty,
      t.table.availableQty,
    ]);
  });

  it('위치별에서는 위치·품목·보유·가용에만 붙는다', () => {
    renderTable({ view: 'location', rows: locationViewFixtures });

    expect(sortableHeaderNames()).toEqual([
      t.table.location,
      t.table.item,
      t.table.onHandQty,
      t.table.availableQty,
    ]);
  });

  /* 선행 단언 — 정렬되지 않는 열이 실제로 표에 있어야 위 단언이 뜻을 갖는다. */
  it('단위·상태·소유·최근 거래 열은 표에 있으나 정렬되지 않는다', () => {
    renderTable({ view: 'item' });

    const notSortable = [
      t.table.uom,
      t.table.qualityStatus,
      t.table.inventoryStatus,
      t.table.ownership,
      t.table.lastTransactionAt,
    ];

    for (const name of notSortable) {
      expect(headerNames()).toContain(name);
      expect(sortableHeaderNames()).not.toContain(name);
    }
  });

  /*
   * 계약이 방향을 받지 않아 「모름」을 표기할 수단이 없다. 오름차순으로 적고 그 사실을
   * 표 아래 안내가 밝힌다.
   */
  it('정렬 중인 열이 오름차순으로 표기된다', () => {
    renderTable({ view: 'item', sortKey: 'onHandQty' });

    const header = within(table())
      .getAllByRole('columnheader')
      .find((cell) => cell.textContent === t.table.onHandQty);

    expect(header).toHaveAttribute('aria-sort', 'ascending');
  });

  it('머리글을 누르면 다음 상태를 상위에 알린다', async () => {
    const { onSortChange, user } = renderTable({ view: 'item' });

    await user.click(screen.getByRole('button', { name: t.table.onHandQty }));

    expect(onSortChange).toHaveBeenCalledTimes(1);
  });
});

describe('BalanceTable — 1단 그룹 헤더', () => {
  it('품목별에는 그룹 헤더가 없다', () => {
    renderTable({ view: 'item' });

    expect(screen.queryByText(t.groupHeader.item('SAMPLE-ITEM-01 · 합성 품목 가'))).toBeNull();
  });

  /* 같은 품목의 줄 둘과 다른 품목의 줄 하나 — 그룹은 셋이 아니라 둘이어야 한다. */
  it('LOT별은 품목으로 묶고 그룹 수가 품목 수와 같다', () => {
    renderTable({ view: 'lot', rows: lotViewFixtures });

    expect(
      screen.getByText(t.groupHeader.item('SAMPLE-ITEM-01 · 합성 품목 가')),
    ).toBeInTheDocument();
    /* 9302는 참조 목록에 없다 — 그래도 번호가 아니라 「알 수 없음」으로 묶인다. */
    expect(screen.getByText(t.groupHeader.item(t.values.unknown))).toBeInTheDocument();
    expect(screen.getAllByText(/^품목: /)).toHaveLength(2);
  });

  it('위치별은 위치로 묶는다', () => {
    renderTable({ view: 'location', rows: locationViewFixtures });

    expect(
      screen.getByText(t.groupHeader.location('SAMPLE-LOC-01 · 합성 위치 가')),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^위치: /)).toHaveLength(2);
  });

  /* **중첩 그룹을 만들지 않는다**(이슈 #21 §4 미결 4 — 다단 위치 트리 없음). */
  it('한 보기에 그룹 축이 하나뿐이다 — 품목과 위치가 함께 묶이지 않는다', () => {
    renderTable({ view: 'location', rows: locationViewFixtures });

    expect(screen.queryAllByText(/^품목: /)).toHaveLength(0);
  });
});

describe('BalanceTable — 표 아래 안내', () => {
  /*
   * **W-01-09와 반대다.** 그 화면은 「현재 쪽 안에서만」이고 이 화면은 서버 정렬이라
   * 「전체 결과 기준」이다. 밝히지 않으면 사용자가 쪽 안 정렬로 읽는다.
   */
  it('정렬 범위와 방향 제약을 밝힌다', () => {
    renderTable({ view: 'item' });

    expect(screen.getByText(t.notes.sortScope)).toBeInTheDocument();
  });

  it('묶은 보기에서는 그룹 범위도 함께 밝힌다', () => {
    renderTable({ view: 'lot', rows: lotViewFixtures });

    expect(screen.getByText(t.notes.sortScope)).toBeInTheDocument();
    expect(screen.getByText(t.notes.groupScope)).toBeInTheDocument();
  });

  /* 짝이 되는 방향 — 묶지 않는 보기에서는 가리킬 그룹이 없어 안내가 뜻을 잃는다. */
  it('묶지 않는 보기에서는 그룹 안내를 내지 않는다', () => {
    renderTable({ view: 'item' });

    expect(screen.queryByText(t.notes.groupScope)).not.toBeInTheDocument();
  });
});

describe('BalanceTable — 참조 값 표기', () => {
  it('참조가 오면 이름으로 보인다', () => {
    renderTable({ view: 'item' });

    expect(within(table()).getAllByText('SAMPLE-ITEM-01 · 합성 품목 가')).not.toHaveLength(0);
  });

  /*
   * **#44 — 이름으로 풀 수 없어도 내부 번호를 내지 않는다.**
   * 「이름이 보인다」를 선행으로 짝지어, 아무것도 안 그려도 통과하는 단언이 되지 않게 한다.
   */
  it('참조를 못 푸는 상태에서도 표에 내부 번호가 보이지 않는다', () => {
    renderTable({
      view: 'lot',
      rows: lotViewFixtures,
      itemLookup: source([], { isError: true }),
      lotLookup: source([], { isError: true }),
      uomLookup: source([], { isError: true }),
      partnerLookup: source([], { isError: true }),
    });

    // 선행 단언 — 실패 표기가 실제로 그려졌다.
    expect(within(table()).getAllByText(t.values.referenceFailed)).not.toHaveLength(0);

    const text = table().textContent ?? '';

    for (const id of ['9301', '9302', '9401', '9402', '9403', '9501', '9601']) {
      expect(text).not.toContain(id);
    }
  });

  /* **#47** — 미도착과 「목록에 없음」을 같은 표기로 뭉개면 정상 값이 잘못된 값으로 읽힌다. */
  it('참조가 아직 오지 않았으면 「알 수 없음」이 아니라 로딩 표기다', () => {
    renderTable({
      view: 'item',
      itemLookup: source([], { isLoading: true }),
      uomLookup: source([], { isLoading: true }),
    });

    expect(table()).toHaveTextContent(t.values.referenceLoading);
    expect(table()).not.toHaveTextContent(t.values.unknown);
  });

  it('참조 목록에 없는 번호는 알 수 없음이다', () => {
    renderTable({ view: 'item' });

    // 9302는 참조 목록에 없다.
    expect(table()).toHaveTextContent(t.values.unknown);
  });

  /*
   * **미사용 표식은 선택지에만 붙인다.** 표 칸에는 붙이지 않는다 —
   * `ReferenceState`가 사용 여부를 나르지 않고, 표는 그 값의 이름만 말하면 된다.
   */
  it('표 칸에 미사용 표식을 붙이지 않는다', () => {
    renderTable({
      view: 'item',
      itemLookup: {
        entries: [{ value: '9301', label: 'SAMPLE-ITEM-01 · 합성 품목 가', isActive: false }],
        isError: false,
        isLoading: false,
      },
    });

    expect(within(table()).getAllByText('SAMPLE-ITEM-01 · 합성 품목 가')).not.toHaveLength(0);
    expect(table()).not.toHaveTextContent(t.values.inactiveSuffix.trim());
  });

  /* 단위·소유처 이름은 이 구획에서만 보인다 — 복구 수단도 이 구획이 소유한다. */
  it('단위 참조가 실패하면 이 구획이 사유와 다시 시도를 낸다', async () => {
    const { onRetryReferences, user } = renderTable({
      view: 'item',
      uomLookup: source([], { isError: true }),
    });

    expect(screen.getByText(t.reasons.listReferencesFailed)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryReferences).toHaveBeenCalledTimes(1);
  });

  /* 조건 줄이 소유하는 참조가 실패해도 이 구획은 자기 사유를 내지 않는다. */
  it('품목 참조만 실패하면 이 구획의 사유는 나오지 않는다', () => {
    renderTable({ view: 'item', itemLookup: source([], { isError: true }) });

    expect(screen.queryByText(t.reasons.listReferencesFailed)).not.toBeInTheDocument();
  });
});

describe('BalanceTable — null이 뜻을 갖는 자리', () => {
  /*
   * 품목별·위치별 보기에서 LOT이 비는 것은 **정상**이다(계약이 「groupBy가 LOT일 때 채워진다」).
   * 「알 수 없음」으로 두면 *값이 잘못됐다*는 뜻이 되어 정반대로 읽힌다.
   */
  it('LOT이 없는 줄은 「(LOT 무관)」이다', () => {
    renderTable({ view: 'lot', rows: [balance({ groupBy: 'LOT', lotId: null })] });

    expect(within(table()).getByText(t.values.noLot)).toBeInTheDocument();
    expect(within(table()).queryByText(t.values.unknown)).not.toBeInTheDocument();
  });

  /* 계약이 「소유가 자사가 아닐 때의 거래처」로 두었다 — 비는 것이 곧 자사 소유다. */
  it('소유처가 없는 줄은 「(자사 소유)」다', () => {
    renderTable({ view: 'item', rows: [balance({ ownerPartnerId: null })] });

    expect(within(table()).getByText(t.values.ownedBySelf)).toBeInTheDocument();
    expect(within(table()).queryByText(t.values.empty)).not.toBeInTheDocument();
  });

  it('소유처가 있는 줄은 거래처 이름으로 보인다', () => {
    renderTable({ view: 'item', rows: [balance({ ownerPartnerId: 9601 })] });

    expect(within(table()).getByText('SAMPLE-PTR-01 · 합성 거래처 가')).toBeInTheDocument();
    expect(within(table()).queryByText(t.values.ownedBySelf)).not.toBeInTheDocument();
  });
});

describe('BalanceTable — 수량 표시', () => {
  /*
   * **가용 수량을 화면이 다시 계산하지 않는다**(이슈 #21 §6). 픽스처의 가용(77)은
   * 보유−예약−피킹−보류(85)와 일부러 다르다 — 다시 계산하면 이 단언이 깨진다.
   */
  it('가용 수량을 서버가 준 값 그대로 그린다', () => {
    renderTable({ view: 'item', rows: [balance()] });

    expect(within(table()).getByText('77')).toBeInTheDocument();
    expect(within(table()).queryByText('85')).not.toBeInTheDocument();
  });

  /* 음수를 허용하는 품목인지 알 수 있는 필드가 계약에 없다 — 「음수」라는 사실만 말한다. */
  it('보유가 음수인 줄에 표식이 붙는다', () => {
    renderTable({ view: 'item', rows: [balance({ onHandQty: -4 })] });

    expect(screen.getByText(t.values.negativeOnHand)).toBeInTheDocument();
  });

  it('보유가 0 이상인 줄에는 표식이 붙지 않는다', () => {
    renderTable({ view: 'item', rows: [balance({ onHandQty: 0 })] });

    expect(screen.queryByText(t.values.negativeOnHand)).not.toBeInTheDocument();
  });

  /* 계약이 세어 준 값이다 — 화면이 보류 LOT을 따로 세지 않는다. */
  it('보류 LOT이 있으면 몇 건인지 밝힌다', () => {
    renderTable({ view: 'item', rows: [balance({ heldLotCount: 2 })] });

    expect(screen.getByText(t.values.heldLotCount(2))).toBeInTheDocument();
  });

  it('보류 LOT이 0이거나 없으면 밝히지 않는다', () => {
    renderTable({ view: 'item', rows: [balance({ heldLotCount: 0 })] });

    expect(screen.queryByText(t.values.heldLotCount(0))).not.toBeInTheDocument();

    renderTable({ view: 'item', rows: [balance({ heldLotCount: null })] });

    expect(screen.queryByText(/보류 LOT/)).not.toBeInTheDocument();
  });

  it('최근 거래가 없으면 대시로 둔다', () => {
    renderTable({ view: 'item', rows: [balance({ lastTransactionAt: null })] });

    expect(within(table()).getAllByText(t.values.empty)).not.toHaveLength(0);
  });

  /*
   * **계약 값을 그대로 그리지 않는다.** `lastTransactionAt`은 시간대까지 붙은 25자라
   * 어떤 열 폭에도 한 줄로 들어가지 않는다 — 브라우저 확인 F-B2가 드러낸 자리다.
   *
   * 정확한 값이 아니라 **형태와 계약 값 부재**를 본다 — 시간대가 붙은 값의 현지 표기는
   * 실행 환경에 따라 달라져, 기대값을 박으면 테스트가 실행 환경을 검사하게 된다.
   * 값의 정확도는 `as-of.test.ts`가 맡는다.
   */
  it('최근 거래를 「MM-DD HH:mm」으로 줄여 낸다', () => {
    const contractValue = '2026-08-06T09:12:00+09:00';

    renderTable({ view: 'item', rows: [balance({ lastTransactionAt: contractValue })] });

    expect(within(table()).getByText(/^\d{2}-\d{2} \d{2}:\d{2}$/)).toBeInTheDocument();
    expect(table()).not.toHaveTextContent(contractValue);
  });

  /*
   * **요약 카드도 합계 행도 만들지 않는다**(계획 결정 7). 줄마다 `uomId`가 달라
   * 더하면 값이 틀린다 — 지어낸 수를 큰 글씨로 내는 것보다 없는 것이 낫다.
   */
  it('합계 행을 만들지 않는다', () => {
    renderTable({ view: 'item' });

    expect(table().querySelector('tfoot')).toBeNull();
  });
});

describe('BalanceTable — 상태 배지', () => {
  /*
   * 값 목록이 확정되지 않아(omf-mes#64) 색을 가르면 **뜻을 지어내는 것**이 된다.
   * 서버가 준 코드를 번역하지 않고 그대로 낸다.
   */
  it('서버가 준 코드를 그대로 낸다', () => {
    renderTable({
      view: 'item',
      rows: [balance({ qualityStatusCode: 'SAMPLE_Q_A', inventoryStatusCode: 'SAMPLE_I_A' })],
    });

    expect(within(table()).getByText('SAMPLE_Q_A')).toBeInTheDocument();
    expect(within(table()).getByText('SAMPLE_I_A')).toBeInTheDocument();
  });

  /* 값이 무엇이든 같은 변형이다 — 값에 따라 갈리면 그 순간 뜻을 지어낸 것이다. */
  it('코드가 달라도 배지 변형이 같다', () => {
    renderTable({
      view: 'item',
      rows: [
        balance({ qualityStatusCode: 'SAMPLE_Q_A' }),
        balance({ itemId: 9302, qualityStatusCode: 'SAMPLE_Q_B' }),
      ],
    });

    const first = screen.getByText('SAMPLE_Q_A').className;
    const second = screen.getByText('SAMPLE_Q_B').className;

    expect(first).toBe(second);
  });

  it('코드가 없으면 배지 대신 대시를 둔다', () => {
    renderTable({
      view: 'item',
      rows: [balance({ qualityStatusCode: null, inventoryStatusCode: null })],
    });

    expect(within(table()).getAllByText(t.values.empty)).not.toHaveLength(0);
  });
});

describe('BalanceTable — 비어 있는 상태 세 갈래', () => {
  /*
   * 순서가 뜻을 정한다. **조회 전이 맨 앞이다** — 요청을 보내지 않은 상태를 「결과가 없다」로
   * 말하면 안내가 시키는 조치(조건을 줄여라)가 실제 원인(창고를 안 골랐다)과 어긋난다.
   */
  it('창고를 고르기 전에는 「아직 조회하지 않았다」만 낸다', () => {
    renderTable({ rows: [], hasQuery: false });

    expect(screen.getByText(t.empty.notQueriedTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
  });

  it('조회했는데 0건이면 「결과 없음」만 낸다', () => {
    renderTable({ rows: [], hasQuery: true });

    expect(screen.getByText(t.empty.noResultTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.notQueriedTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
  });

  it('쪽 밖이면 첫 쪽으로 가는 안내만 낸다', async () => {
    const { onFirstPage, user } = renderTable({ rows: [], hasQuery: true, isBeyondLast: true });

    expect(screen.getByText(t.empty.beyondLastTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.notQueriedTitle)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    expect(onFirstPage).toHaveBeenCalledTimes(1);
  });

  it('불러오는 중에는 빈 상태 문구를 내지 않는다', () => {
    renderTable({ rows: [], isLoading: true });

    expect(screen.getByRole('status', { name: t.loading.balances })).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.notQueriedTitle)).not.toBeInTheDocument();
  });
});

describe('BalanceTable — 배치', () => {
  /* 열이 9~10개다. 최소 폭이 없으면 셀이 낱말 단위로 쪼개진다. */
  it('표를 넓은 표 상자로 감싼다', () => {
    const { container } = render(
      <BalanceTable
        view="item"
        rows={itemViewFixtures}
        isLoading={false}
        hasQuery
        isBeyondLast={false}
        sortKey={null}
        onSortChange={() => undefined}
        onFirstPage={() => undefined}
        onRetryReferences={() => undefined}
        {...LOOKUPS}
      />,
    );

    expect(container.querySelector('.wide-table')).not.toBeNull();
  });
});
