import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { goodsIssueFixtures, INTERNAL_IDS, warehouseFixtures } from './fixtures';
import { buildGiColumns, GiTable, HISTORY_TABLE_MIN_WIDTH_PX, type GiTableProps } from './gi-table';
import type { ReferenceSource } from './lookups';

const t = messages.disposalIssue;

const WAREHOUSE_LABEL = 'SAMPLE-WH-01 · 합성 폐기창고 가';

const warehouseSource = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: warehouseFixtures.map((warehouse) => ({
    value: String(warehouse.warehouseId),
    label: `${warehouse.warehouseCode} · ${warehouse.warehouseName}`,
    isActive: warehouse.isActive,
  })),
  isError: false,
  isLoading: false,
  truncated: false,
  ...overrides,
});

const baseProps = (overrides: Partial<GiTableProps> = {}): GiTableProps => ({
  rows: goodsIssueFixtures,
  isLoading: false,
  isBeyondLast: false,
  selectedIssueId: null,
  warehouseLookup: warehouseSource(),
  onFirstPage: vi.fn(),
  onToggleSelect: vi.fn(),
  onRetryReferences: vi.fn(),
  ...overrides,
});

const renderTable = (overrides: Partial<GiTableProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<GiTable {...props} />);

  return { ...props, ...result, user: userEvent.setup() };
};

describe('buildGiColumns — 열 폭 예산', () => {
  const columns = buildGiColumns({
    selectedIssueId: null,
    warehouseLookup: warehouseSource(),
    onToggleSelect: vi.fn(),
  });

  it('흡수 열이 정확히 하나다', () => {
    expect(columns.filter((column) => column.width === undefined)).toHaveLength(1);
  });

  it('지정 폭 합과 흡수 예산이 표 하한 안에 든다', () => {
    const fixed = columns.reduce(
      (sum, column) => sum + Number.parseInt(column.width ?? '0px', 10),
      0,
    );

    expect(fixed).toBe(680);
    /* 흡수 열이 실제로 받는 폭이 예산(200px)보다 넓어야 「코드 · 이름」이 접히지 않는다. */
    expect(HISTORY_TABLE_MIN_WIDTH_PX - fixed).toBe(248);
    expect(HISTORY_TABLE_MIN_WIDTH_PX - fixed).toBeGreaterThanOrEqual(200);
  });

  /* 출고 유형·승인 진행 열을 두지 않았다 — 열을 늘리는 것보다 줄이는 것이 먼저다. */
  it('열이 여섯이다', () => {
    expect(columns.map((column) => column.key)).toEqual([
      'goodsIssueNo',
      'warehouse',
      'reasonCode',
      'issuedAt',
      'statusCode',
      'select',
    ]);
  });
});

describe('GiTable — 행 표기', () => {
  it('출고번호와 일시를 읽을 수 있게 낸다', () => {
    renderTable();

    expect(screen.getByText('GI-2026-950001')).toBeInTheDocument();
    expect(screen.getByText('2026-08-08 14:20')).toBeInTheDocument();
    expect(screen.getByText('2026-08-09 10:05')).toBeInTheDocument();
  });

  /** 짝 방향 단언 — 이름이 실제로 보이고, 그 자리에 번호가 없다(`omf-mes#44`). */
  it('창고를 이름으로 풀고 번호를 내지 않는다', () => {
    const { container } = renderTable();

    expect(screen.getAllByText(WAREHOUSE_LABEL).length).toBeGreaterThan(0);

    for (const id of INTERNAL_IDS) {
      expect(container.textContent ?? '').not.toContain(id);
    }
  });

  /* 이름을 못 푼 갈래도 번호를 내지 않는다 — 「알 수 없음」이 그 자리를 맡는다. */
  it('목록에 없는 창고는 알 수 없음으로 낸다', () => {
    renderTable();

    expect(screen.getByText(t.values.unknown)).toBeInTheDocument();
  });

  it('참조가 아직 오지 않았으면 그 사실을 낸다', () => {
    renderTable({ warehouseLookup: warehouseSource({ entries: [], isLoading: true }) });

    expect(screen.getAllByText(t.values.referenceLoading).length).toBe(goodsIssueFixtures.length);
    expect(screen.queryByText(t.values.unknown)).not.toBeInTheDocument();
  });

  it('참조 실패는 사유와 복구 경로를 함께 낸다', async () => {
    const { onRetryReferences, user } = renderTable({
      warehouseLookup: warehouseSource({ entries: [], isError: true }),
    });

    expect(screen.getAllByText(t.values.referenceFailed).length).toBe(goodsIssueFixtures.length);

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryReferences).toHaveBeenCalledTimes(1);
  });

  /**
   * **상태 코드가 실제로 그 행에 그려진다**(검증 t3 관찰 ②).
   *
   * 이 열은 `render`가 없어 표가 값을 그대로 그리는데, 그 자리는 계획이 **「승인 후 미출고」를
   * 대신 보이는 역할**을 맡긴 곳이다(별도 표식을 만들지 않는 근거) — 열 선언만 재고 값이
   * 나가는지 보지 않으면, 키가 살아 있는 채로 값이 비어도 아무도 모른다.
   */
  it('상태 코드가 행마다 그려진다', () => {
    renderTable();

    const rowOf = (goodsIssueNo: string): HTMLElement => {
      const row = screen.getByText(goodsIssueNo).closest('tr');

      if (row === null) throw new Error('행을 찾지 못했다');

      return row;
    };

    expect(within(rowOf('GI-2026-950001')).getByText('SAMPLE_GI_STATUS_A')).toBeInTheDocument();
    expect(within(rowOf('GI-2026-950002')).getByText('SAMPLE_GI_STATUS_B')).toBeInTheDocument();
  });

  /**
   * **사유 코드가 없이 오는 전표가 실재한다.** 빈 칸으로 두면 값이 없는 것인지 화면이 못 그린
   * 것인지 구분되지 않는다 — 코드를 지어내지 않고 그 사실을 적는다.
   */
  it('사유 코드가 없으면 그 사실을 적는다', () => {
    renderTable();

    expect(screen.getByText('SAMPLE_GI_REASON_A')).toBeInTheDocument();
    expect(screen.getByText(t.values.noReasonCode)).toBeInTheDocument();
  });
});

describe('GiTable — 미상신 표식', () => {
  const rowOf = (goodsIssueNo: string): HTMLElement => {
    const cell = screen.getByText(goodsIssueNo);
    const row = cell.closest('tr');

    if (row === null) throw new Error('행을 찾지 못했다');

    return row;
  };

  /**
   * **`approvalRequestId`가 있는가로만 갈린다**(계획 결정 7). 상태 코드로 판정하면 값이
   * 정해질 때 조용히 틀린다 — 두 방향을 함께 잰다.
   */
  it('상신되지 않은 전표에만 표식이 붙는다', () => {
    renderTable();

    expect(within(rowOf('GI-2026-950002')).getByText(t.values.notSubmitted)).toBeInTheDocument();
    expect(
      within(rowOf('GI-2026-950001')).queryByText(t.values.notSubmitted),
    ).not.toBeInTheDocument();
  });

  /* 표식이 하나뿐이다 — 픽스처 셋 중 미상신은 한 건이다. */
  it('표식이 미상신 건수만큼만 뜬다', () => {
    renderTable();

    expect(screen.getAllByText(t.values.notSubmitted)).toHaveLength(1);
  });

  /*
   * 색·아이콘에만 기대지 않는다 — 보이는 글자가 그 사실을 말한다.
   *
   * 글자를 여기서 한 번 더 무는 것이 **낱말 교체의 둘째 감지기**다(#124) — 승인 축의 낱말이
   * 「상신」으로 되돌아가면 이 자리와 `tabs.test.ts`에서만 운다.
   */
  it('표식이 글자다', () => {
    renderTable();

    expect(screen.getByText(t.values.notSubmitted).textContent).toBe('미요청');
  });
});

describe('GiTable — 고르기', () => {
  it('행마다 어느 건인지 밝힌 버튼이 있다', async () => {
    const { onToggleSelect, user } = renderTable();

    await user.click(
      screen.getByRole('button', { name: t.actions.selectIssueRow('GI-2026-950001') }),
    );

    expect(onToggleSelect).toHaveBeenCalledWith(9501);
  });

  it('고른 행의 버튼은 해제로 바뀐다', () => {
    renderTable({ selectedIssueId: 9501 });

    expect(
      screen.getByRole('button', { name: t.actions.deselectIssueRow('GI-2026-950001') }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: t.actions.selectIssueRow('GI-2026-950002') }),
    ).toBeInTheDocument();
  });

  /* 접근 이름에도 내부 번호를 넣지 않는다 — 그것이 화면 밖으로 새는 또 하나의 경로다. */
  it('버튼 이름에 내부 번호가 없다', () => {
    renderTable();

    for (const button of screen.getAllByRole('button')) {
      for (const id of INTERNAL_IDS) {
        expect(button.getAttribute('aria-label') ?? '').not.toContain(id);
      }
    }
  });
});

describe('GiTable — 빈 상태와 불러오는 중', () => {
  /**
   * **빈 상태를 바깥에서 가르지 않는다.** 표를 늘 그리고 `empty`가 0건을 맡아야
   * `Table.empty`가 닿을 수 있는 가지가 된다(감지기 M40).
   */
  it('결과가 없으면 표의 빈 자리가 그 사실을 맡는다', () => {
    renderTable({ rows: [] });

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(t.empty.historyNoResultTitle)).toBeInTheDocument();
  });

  it('쪽 밖은 다른 안내와 첫 쪽 경로를 낸다', async () => {
    const { onFirstPage, user } = renderTable({ rows: [], isBeyondLast: true });

    expect(screen.getByText(t.empty.historyBeyondLastTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.historyNoResultTitle)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    expect(onFirstPage).toHaveBeenCalledTimes(1);
  });

  /* 대상 탭의 문구를 돌려쓰지 않는다 — 사용자가 할 조치가 다르다. */
  it('대상 목록의 빈 상태 문구와 다르다', () => {
    expect(t.empty.historyNoResultTitle).not.toBe(t.empty.noResultTitle);
    expect(t.empty.historyNoSelectionTitle).not.toBe(t.empty.noSelectionTitle);
  });

  it('불러오는 중에는 뼈대가 서고 표가 없다', () => {
    renderTable({ isLoading: true });

    expect(screen.getByRole('status', { name: t.loading.goodsIssues })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
