import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { ItemPicker } from './item-picker';
import type { SelectedItem } from './types';

/**
 * 찾는 일 자체(검색·쪽 이동·유형 좁히기)는 **공용 창**이 맡고 그쪽 감지기가 잰다
 * (`patterns/item-picker/dialog.test.tsx`). 여기서 무는 것은 **이 화면이 그 창에 무엇을
 * 부탁하고 결과를 어떻게 받는가** 셋이다.
 *
 * 1. 만들 수 없는 품목을 빼 달라고 한다(`hasRouting`)
 * 2. 창에서 고른 품목을 그대로(기준 단위까지) 받는다
 * 3. 고르기 전과 뒤의 화면이 다르다
 */
const t = messages.emergencyWorkOrder.itemPicker;
const dialogText = messages.itemPicker;

const SELECTED: SelectedItem = {
  itemId: 5001,
  itemCode: 'SYN-ITEM-0001',
  itemName: '합성 품목',
  baseUomId: 11,
};

const pathOf = (request: Request): string => new URL(request.url).pathname;

const routes = (searches: URL[], calls: URL[], items?: unknown[]): StubRoute[] => [
  {
    /* 나간 요청을 «전부» 담는다 — 부르지 «않는» 것을 재려면 담기는 자리가 넓어야 한다. */
    match: (request) => {
      calls.push(new URL(request.url));

      return false;
    },
    respond: () => jsonResponse({}),
  },
  {
    match: (request) => pathOf(request) === '/mdm/code-values',
    respond: () =>
      jsonResponse({
        items: [{ code: 'FINISHED', codeName: '제품' }],
        page: { page: 1, size: 100, total: 1 },
      }),
  },
  {
    match: (request) => pathOf(request) === '/mdm/items',
    respond: (request) => {
      searches.push(new URL(request.url));

      const rows = items ?? [
        {
          itemId: 5001,
          itemCode: 'SYN-ITEM-0001',
          itemName: '합성 품목',
          itemTypeCode: 'FINISHED',
          baseUomId: 11,
          isActive: true,
        },
      ];

      return jsonResponse({ items: rows, page: { page: 1, size: 20, total: rows.length } });
    },
  },
];

const renderPicker = (
  selected: SelectedItem | null = null,
  options: { items?: unknown[] } = {},
) => {
  const onSelect = vi.fn();
  const searches: URL[] = [];
  const calls: URL[] = [];

  renderWithProviders(<ItemPicker selected={selected} onSelect={onSelect} />, {
    fetch: createStubFetch(routes(searches, calls, options.items)),
    route: '/',
  });

  return { onSelect, searches, calls, user: userEvent.setup() };
};

/** 칸을 누르면 창이 열린다 — 이 화면에는 「찾기」 단추가 따로 없다. */
const openDialog = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByLabelText(t.label));
  await screen.findByRole('dialog');
};

describe('ItemPicker', () => {
  it('고르기 전에는 칸이 비어 있고 무엇을 할지 자리표시로 말한다', () => {
    renderPicker();

    const field = screen.getByLabelText(t.label);
    expect(field).toHaveValue('');
    expect(field).toHaveAttribute('placeholder', t.placeholder);
  });

  /** omf-all-around#43 — 고를 수 없는 품목(원자재 등)은 후보에 세우지 않는다. */
  it('만들 수 없는 품목을 빼려고 Routing 보유를 싣는다', async () => {
    const { searches, user } = renderPicker();

    await openDialog(user);

    await waitFor(() => {
      expect(searches.length).toBeGreaterThan(0);
    });
    expect(searches[0]?.searchParams.get('hasRouting')).toBe('true');
  });

  /* ⛔ 이 화면이 묻는 것은 「무엇을 만들까」다 — 품목마다 재고를 한 번 더 부르지 않는다. */
  it('가용 재고를 부르지 않는다', async () => {
    const { calls, user } = renderPicker();

    await openDialog(user);
    await waitFor(() => {
      expect(calls.some((url) => url.pathname === '/mdm/items')).toBe(true);
    });

    expect(calls.some((url) => url.pathname === '/inventory/balances')).toBe(false);
  });

  it('⛔ 고른 품목의 기준 단위를 함께 들고 간다 — 수량이 어느 단위인지가 사실이다', async () => {
    const { onSelect, user } = renderPicker();

    await openDialog(user);
    const dialog = within(screen.getByRole('dialog'));
    await user.click(await dialog.findByRole('checkbox', { name: 'SYN-ITEM-0001' }));
    await user.click(dialog.getByRole('button', { name: t.confirm }));

    expect(onSelect).toHaveBeenCalledWith(SELECTED);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('고른 뒤에는 그 품목이 칸의 값으로 선다', () => {
    renderPicker(SELECTED);

    expect(screen.getByLabelText(t.label)).toHaveValue(
      `${SELECTED.itemCode} · ${SELECTED.itemName}`,
    );
  });

  /*
   * omf-all-around#43 — 후보를 좁혀 놓고 「검색 결과가 없습니다」로만 답하면, 있는 품목을
   * 없다고 읽고 검색어만 바꾸게 된다. 창에 이 화면 전용 문구를 넘겨 그 사실을 말한다.
   */
  it('0건일 때 만들 수 있는 품목만 보인다는 사실을 말한다', async () => {
    const { user } = renderPicker(null, { items: [] });

    await openDialog(user);

    expect(await screen.findByText(t.empty)).toBeInTheDocument();
  });

  it('고른 품목을 지울 수 있다', async () => {
    const { onSelect, user } = renderPicker(SELECTED);

    await user.click(screen.getByRole('button', { name: t.clear }));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  /* 창이 스스로 닫히는 길 — 아무것도 고르지 않고 닫으면 고른 값이 바뀌지 않는다. */
  it('창을 닫기만 하면 고른 값을 건드리지 않는다', async () => {
    const { onSelect, user } = renderPicker(SELECTED);

    await openDialog(user);
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: dialogText.cancel }),
    );

    expect(onSelect).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
