import type { Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { heldLotDetail, plainLotDetail } from './fixtures';
import { buildHoldColumns, LotHoldTable, type LotHoldTableProps } from './lot-hold-table';
import type { ReferenceSource } from './lookups';
import type { LotHoldView } from './types';

const t = messages.stockStatus;

/** `.wide-table`이 표에 주는 최소 폭(58rem). **바닥이지 천장이 아니다.** */
const WIDE_TABLE_MIN_PX = 928;

/** 축 열(주 식별자)이 한 줄에 값을 담는 폭. 잔액 표와 같은 값을 쓴다. */
const AXIS_COLUMN_PX = 200;

const toPx = (width: string | undefined): number =>
  width === undefined ? 0 : Number.parseInt(width, 10);

const totalWidthOf = (columns: Column<LotHoldView>[]): number =>
  columns.reduce((sum, column) => sum + toPx(column.width), 0);

const UOMS: ReferenceSource = {
  entries: [{ value: '9501', label: 'SAMPLE-EA', isActive: true }],
  isError: false,
  isLoading: false,
};

const TODAY = new Date(2026, 7, 8);
const HELD = heldLotDetail(TODAY);

const renderHolds = (overrides: Partial<LotHoldTableProps> = {}) =>
  render(<LotHoldTable holds={HELD.holds} uomLookup={UOMS} {...overrides} />);

const table = (): HTMLElement => screen.getByRole('table');

describe('buildHoldColumns — 열 폭', () => {
  /*
   * **모든 열이 폭을 지정한다.** 디자인 시스템 `Table`은 `table-layout: fixed`라 폭을
   * 지정하지 않은 열이 남는 폭의 잔여분을 받아, 선언과 실렌더가 어긋난다(브라우저 확인 F-B2).
   */
  it('모든 열이 폭을 지정한다', () => {
    expect(buildHoldColumns(UOMS).filter((column) => column.width === undefined)).toEqual([]);
  });

  /* 합이 하한보다 작으면 고정 배치가 남는 폭을 나눠 넣어 다시 어긋난다. */
  it('열 폭 합이 표 하한 이상이다', () => {
    expect(totalWidthOf(buildHoldColumns(UOMS))).toBeGreaterThanOrEqual(WIDE_TABLE_MIN_PX);
  });

  /* 이 표의 주 식별자는 사유다 — 짓눌리면 무엇 때문에 묶였는지 훑을 수 없다. */
  it('사유 열이 축 열 폭 이상이다', () => {
    const reason = buildHoldColumns(UOMS).find((column) => column.key === 'reasonCode');

    expect(toPx(reason?.width)).toBeGreaterThanOrEqual(AXIS_COLUMN_PX);
  });
});

describe('LotHoldTable — 보류 수량', () => {
  /*
   * **`holdQty`가 없으면 전량 보류다**(계약이 그렇게 적었다). 빈칸이나 `0`으로 두면
   * 정반대(아무것도 묶이지 않았다)로 읽힌다 — 이 LOT을 쓸 수 있다고 판단하게 만든다.
   */
  it('보류 수량이 없으면 「전량 보류」로 적는다', () => {
    renderHolds();

    expect(within(table()).getByText(t.detail.holds.wholeLot)).toBeInTheDocument();
    /* 선행 단언 — 같은 표에 수량이 적힌 보류가 함께 있어야 위 단언이 뜻을 갖는다. */
    expect(within(table()).getByText('40')).toBeInTheDocument();
  });

  /* 「전량 보류」에는 견줄 수가 없어 단위도 없다 — 지어내지 않고 대시로 둔다. */
  it('전량 보류에는 단위를 지어내지 않는다', () => {
    renderHolds();

    expect(within(table()).getByText('SAMPLE-EA')).toBeInTheDocument();
    expect(within(table()).getAllByText(t.values.empty).length).toBeGreaterThan(0);
  });

  /* `0`은 「없음」과 다르다 — 서버가 0을 보냈으면 0으로 적는다. */
  it('보류 수량이 0이면 0으로 적고 전량 보류로 적지 않는다', () => {
    const [first] = HELD.holds;

    if (first === undefined) throw new Error('픽스처에 보류가 없습니다.');

    renderHolds({ holds: [{ ...first, holdQty: 0, uomId: 9501 }] });

    expect(within(table()).getByText('0')).toBeInTheDocument();
    expect(within(table()).queryByText(t.detail.holds.wholeLot)).not.toBeInTheDocument();
  });
});

describe('LotHoldTable — 표기', () => {
  it('사유·상태·해제 조건·비고를 그대로 낸다', () => {
    renderHolds();

    expect(within(table()).getByText('SAMPLE_HOLD_R_A')).toBeInTheDocument();
    expect(within(table()).getByText('SAMPLE_HOLD_R_B')).toBeInTheDocument();
    expect(within(table()).getByText('합성 해제 조건입니다')).toBeInTheDocument();
    expect(within(table()).getByText('합성 보류 비고입니다')).toBeInTheDocument();
  });

  /* 값 목록이 확정되지 않아(omf-mes#64) 색을 가르면 뜻을 지어내는 것이 된다. */
  it('코드가 달라도 배지 변형이 같다', () => {
    renderHolds();

    const first = screen.getByText('SAMPLE_HOLD_R_A').className;
    const second = screen.getByText('SAMPLE_HOLD_R_B').className;

    expect(first).toBe(second);
  });

  /* 사용자 번호는 이름을 풀 참조가 이 화면에 없다 — 번호를 그대로 내면 #44다. */
  it('내부 번호가 표에 보이지 않는다', () => {
    renderHolds();

    // 선행 단언 — 표가 실제로 그려졌다.
    expect(within(table()).getByText('SAMPLE_HOLD_R_A')).toBeInTheDocument();

    for (const id of ['9701', '9702', '9401', '9501']) {
      expect(table()).not.toHaveTextContent(id);
    }
  });

  it('보류가 없으면 그 사실을 낸다', () => {
    renderHolds({ holds: plainLotDetail().holds });

    expect(screen.getByText(t.detail.holds.emptyTitle)).toBeInTheDocument();
  });
});

describe('LotHoldTable — 의심자재 등록', () => {
  /*
   * **경로 안내뿐이고 등록 수단이 아니다**(이슈 §6). 그 화면(W-03-03)이 아직 없어
   * 링크를 만들면 죽은 링크가 되고, 버튼으로 만들면 이 조회 화면이 쓰기를 갖게 된다.
   */
  it('경로를 안내하되 링크도 버튼도 아니다', () => {
    renderHolds();

    expect(screen.getByText(t.detail.holds.suspectMaterialPath)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  /* 보류가 없어도 안내는 남는다 — 의심자재를 등록할 자리는 보류 유무와 무관하다. */
  it('보류가 없어도 경로 안내가 남는다', () => {
    renderHolds({ holds: [] });

    expect(screen.getByText(t.detail.holds.suspectMaterialPath)).toBeInTheDocument();
  });
});
