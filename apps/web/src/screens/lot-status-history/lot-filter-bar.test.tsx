import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { EMPTY_LOT_FILTERS, type LotFilters } from './filters';
import { LotFilterBar, type LotFilterBarProps } from './lot-filter-bar';

const TYPES = [
  { value: 'SAMPLE_MATERIAL', label: '합성 자재' },
  { value: 'SAMPLE_PRODUCT', label: '합성 제품' },
];
const WAREHOUSES = [
  { value: '101', label: 'SAMPLE-WH-01 · 합성 창고 가' },
  { value: '109', label: 'SAMPLE-WH-09 · 합성 창고 나' },
];
const locationWarehouseIds: string[] = [];

const itemSearchQueries: URLSearchParams[] = [];

const locationFetch = createStubFetch([
  {
    match: (request) => new URL(request.url).pathname === '/mdm/items',
    respond: (request) => {
      itemSearchQueries.push(new URL(request.url).searchParams);
      return jsonResponse({
        items: [
          {
            itemId: 103,
            itemCode: 'SAMPLE-ITEM-01',
            itemName: '합성 품목',
            itemTypeCode: 'SAMPLE_RAW',
            baseUomId: 1,
            isActive: false,
          },
        ],
        page: { page: 1, size: 20, total: 1 },
      });
    },
  },
  {
    match: (request) => new URL(request.url).pathname === '/mdm/items/103',
    respond: () =>
      jsonResponse({
        item: { itemId: 103, itemCode: 'SAMPLE-ITEM-01', itemName: '합성 품목', isActive: true },
      }),
  },
  {
    match: (request) => new URL(request.url).pathname === '/mdm/code-values',
    respond: () => jsonResponse({ items: [], page: { page: 1, size: 100, total: 0 } }),
  },
  {
    match: (request) => new URL(request.url).pathname === '/mdm/locations',
    respond: (request) => {
      locationWarehouseIds.push(new URL(request.url).searchParams.get('warehouseId') ?? '');
      return jsonResponse({
        items: [
          {
            locationId: 102,
            locationCode: 'SAMPLE-LOC-01',
            locationName: '합성 위치',
            isActive: true,
          },
        ],
        page: { page: 1, size: 50, total: 1 },
      });
    },
  },
]);

const filters = (overrides: Partial<LotFilters> = {}): LotFilters => ({
  ...EMPTY_LOT_FILTERS,
  ...overrides,
});

const props = (overrides: Partial<LotFilterBarProps> = {}): LotFilterBarProps => ({
  appliedFilters: EMPTY_LOT_FILTERS,
  lotTypeOptions: TYPES,
  warehouseOptions: WAREHOUSES,
  onSearch: vi.fn(),
  onReset: vi.fn(),
  ...overrides,
});

const renderBar = (overrides: Partial<LotFilterBarProps> = {}) => {
  const current = props(overrides);
  const view = renderWithProviders(<LotFilterBar {...current} />, { fetch: locationFetch });
  return { ...view, ...current, user: userEvent.setup() };
};

const AppliedProbe = ({ initial }: { initial: LotFilters }) => {
  const [applied, setApplied] = useState(initial);
  return (
    <>
      <LotFilterBar {...props({ appliedFilters: applied })} />
      <button type="button" onClick={() => setApplied({ ...applied })}>
        같은 적용
      </button>
      <button
        type="button"
        onClick={() => setApplied(filters({ lotType: 'SAMPLE_PRODUCT', q: '적용값' }))}
      >
        다른 적용
      </button>
    </>
  );
};

/** 창고는 칸에서 바로 검색해 고른다(#226) — 창(팝업)을 거치지 않는다. */
const pickWarehouse = async (user: ReturnType<typeof userEvent.setup>, code: string) => {
  await user.click(screen.getByLabelText('창고 검색'));
  await screen.findByRole('searchbox', { name: messages.common.selectSearch });
  await user.keyboard(code);
  await user.click(await screen.findByRole('option', { name: new RegExp(`^${code} · `) }));
};

const choose = async (user: ReturnType<typeof userEvent.setup>, label: string, option: string) => {
  await user.click(screen.getByLabelText(label));
  await user.click(await screen.findByRole('option', { name: option }));
};

describe('LOT 현재 조회 조건', () => {
  /* LOT 번호 스캔 칸 옆 [검색] — 검사 조회·판정의 LOT 스캔처럼 번호가 비면 잠기고, 누르면 바로 조회한다(사용자 2026-10-30). */
  it('LOT 번호를 넣고 Enter(스캐너)를 치면 바로 조회한다', async () => {
    const { onSearch, user } = renderBar();

    expect(screen.getByLabelText('LOT 스캔')).toHaveAttribute(
      'placeholder',
      'LOT 바코드 스캔 또는 번호를 입력하세요',
    );
    expect(screen.queryByRole('button', { name: '검색' })).toBeNull();
    await user.type(screen.getByLabelText('LOT 스캔'), 'SAMPLE-LOT-001{Enter}');

    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ q: 'SAMPLE-LOT-001' }));
  });

  it('LOT 유형을 고르지 않아도 「전체」로 조회한다', async () => {
    const { onSearch, user } = renderBar();

    expect(screen.getByLabelText('LOT 유형')).toHaveTextContent('전체');
    await user.click(screen.getByRole('button', { name: '조회' }));
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ lotType: 'ALL' }));
  });

  it('유형 기준값 안내는 칸 아래에 두고 조회를 막지 않는다', () => {
    renderBar({ lotTypeNote: 'LOT 유형 목록을 불러오지 못했습니다.' });

    expect(screen.getByText('LOT 유형 목록을 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '조회' })).toBeEnabled();
  });

  /* 현재 상태는 카드 위쪽 상태 단추가 정한다(사용자 2026-10-30) — 조회는 적용된 상태를 그대로 넘긴다. */
  it('초안을 모아 조회할 때 적용값과 기존 정렬·현재 상태를 함께 넘긴다', async () => {
    const { onSearch, user } = renderBar({
      appliedFilters: filters({ sort: 'lotNoAsc', status: 'SAMPLE_NORMAL' }),
    });

    await choose(user, 'LOT 유형', '합성 자재');
    await user.click(screen.getByRole('button', { name: '상세 검색 펼치기' }));
    // 품목은 칸에서 바로 검색해 고른다(#226) — 창(팝업)을 거치지 않고, 종전 창처럼 중지 품목까지 찾는다.
    itemSearchQueries.length = 0;
    await user.click(screen.getByLabelText('품목 검색'));
    await screen.findByRole('searchbox', { name: messages.common.selectSearch });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: /^SAMPLE-ITEM-01 · / }));
    expect(itemSearchQueries[0]?.get('includeInactive')).toBe('true');
    await waitFor(() =>
      expect(screen.getByLabelText('품목 검색')).toHaveTextContent('SAMPLE-ITEM-01 · 합성 품목'),
    );
    expect(screen.queryByLabelText('현재 상태')).not.toBeInTheDocument();
    await pickWarehouse(user, 'SAMPLE-WH-01');
    await choose(user, '위치 선택', 'SAMPLE-LOC-01 · 합성 위치');
    await user.type(screen.getByLabelText('LOT 스캔'), 'SAMPLE-LOT-001');
    expect(onSearch).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onSearch).toHaveBeenCalledOnce();
    expect(onSearch).toHaveBeenCalledWith(
      filters({
        lotType: 'SAMPLE_MATERIAL',
        item: '103',
        status: 'SAMPLE_NORMAL',
        warehouse: '101',
        location: '102',
        q: 'SAMPLE-LOT-001',
        sort: 'lotNoAsc',
      }),
    );
  });

  /* 잠긴 까닭은 칸 안 글자로 둔다(사용자 2026-10-30). */
  /* 상세 조건은 접혀 들어오지만, 걸린 상세 조건이 있으면 펼친 채로 들어온다(입하 예정 조회와 같다 · 사용자 2026-10-30). */
  it('품목 · 창고 · 위치는 접힌 상세 조건이고, 걸린 값이 있으면 펼쳐 들어온다', () => {
    const { unmount } = renderBar();
    expect(screen.getByRole('button', { name: '상세 검색 펼치기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByLabelText('창고 검색')).not.toBeVisible();
    unmount();

    renderBar({ appliedFilters: filters({ warehouse: '101' }) });
    expect(screen.getByRole('button', { name: '상세 검색 접기' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByLabelText('창고 검색')).toBeVisible();
  });

  /* 펼친 목록은 칸과 같은 폭이다(사용자 2026-10-30) — 긴 「코드 · 이름」이 칸 밖으로 넓어지지 않는다. */
  it('선택 목록을 칸 폭에 맞춘다', async () => {
    const { user } = renderBar();
    const trigger = screen.getByLabelText('LOT 유형');
    await user.click(trigger);
    const listbox = await screen.findByRole('listbox');

    await waitFor(() => expect(listbox).toHaveClass('lot-status-fit-listbox'));
    const width = `${String(trigger.getBoundingClientRect().width)}px`;
    expect(listbox.style.width).toBe(width);
    expect(listbox.style.maxWidth).toBe(width);
  });

  it('창고를 고르기 전에는 위치를 잠그고 칸 안에 까닭을 둔다', async () => {
    const { user } = renderBar();
    await user.click(screen.getByRole('button', { name: '상세 검색 펼치기' }));
    const location = screen.getByLabelText(/^위치/);

    expect(location).toBeDisabled();
    expect(location).toHaveTextContent('창고를 먼저 선택하세요');
    await pickWarehouse(user, 'SAMPLE-WH-01');
    expect(screen.getByLabelText(/^위치/)).toBeEnabled();
    expect(screen.getByLabelText(/^위치/)).not.toHaveTextContent('창고를 먼저 선택하세요');
  });

  it('창고를 바꾸면 앞 창고의 위치 초안을 제거한다', async () => {
    locationWarehouseIds.length = 0;
    const { onSearch, user } = renderBar({
      appliedFilters: filters({ lotType: 'SAMPLE_MATERIAL', warehouse: '101', location: '102' }),
    });

    await pickWarehouse(user, 'SAMPLE-WH-09');
    await waitFor(() => expect(locationWarehouseIds).toContain('109'));
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ warehouse: '109', location: '' }),
    );
  });

  it('같은 값의 새 적용 객체가 내려와도 작성 중인 LOT 번호를 지우지 않는다', async () => {
    const applied = filters({ lotType: 'SAMPLE_MATERIAL' });
    renderWithProviders(<AppliedProbe initial={applied} />, { fetch: locationFetch });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('LOT 스캔'), '작성 중');
    await user.click(screen.getByRole('button', { name: '같은 적용' }));

    expect(screen.getByLabelText('LOT 스캔')).toHaveValue('작성 중');
  });

  it('적용값이 실제로 바뀌면 초안도 그 값으로 되돌린다', async () => {
    renderWithProviders(<AppliedProbe initial={filters({ lotType: 'SAMPLE_MATERIAL' })} />, {
      fetch: locationFetch,
    });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('LOT 스캔'), '작성 중');
    await user.click(screen.getByRole('button', { name: '다른 적용' }));

    expect(screen.getByLabelText('LOT 스캔')).toHaveValue('적용값');
  });

  it('초기화는 상위에 한 번 알린다', async () => {
    const { onReset, user } = renderBar();

    await user.click(screen.getByRole('button', { name: '초기화' }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});
