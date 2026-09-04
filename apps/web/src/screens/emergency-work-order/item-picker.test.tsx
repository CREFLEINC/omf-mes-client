import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { ItemPicker } from './item-picker';
import type { Item, SelectedItem } from './types';

const t = messages.emergencyWorkOrder.itemPicker;

const item = (overrides: Partial<Item> = {}): Item => ({
  itemId: 5001,
  itemCode: 'SYN-ITEM-0001',
  itemName: '합성 품목',
  itemTypeCode: 'SYN_PRODUCT',
  baseUomId: 11,
  lotControlled: true,
  serialControlTypeCode: 'SYN_NONE',
  inspectionRequired: false,
  fifoPolicyCode: 'SYN_FIFO',
  negativeStockAllowed: false,
  isActive: true,
  ...overrides,
});

interface StubOptions {
  items?: Item[];
  total?: number;
  fail?: boolean;
}

const stub = (options: StubOptions = {}): { urls: string[]; fetch: StubFetch } => {
  const urls: string[] = [];
  const fetch: StubFetch = async (request) => {
    urls.push(new URL(request.url).search);

    if (options.fail === true) return jsonResponse({ message: '실패' }, { status: 500 });

    const items = options.items ?? [item()];
    return jsonResponse({
      items,
      page: { page: 1, size: 20, total: options.total ?? items.length },
    });
  };

  return { urls, fetch };
};

const renderPicker = (
  options: StubOptions = {},
  selected: SelectedItem | null = null,
): {
  onSelect: ReturnType<typeof vi.fn>;
  user: ReturnType<typeof userEvent.setup>;
  urls: string[];
} => {
  const onSelect = vi.fn();
  const stubbed = stub(options);

  renderWithProviders(<ItemPicker selected={selected} onSelect={onSelect} />, {
    fetch: stubbed.fetch,
  });

  return { onSelect, user: userEvent.setup(), urls: stubbed.urls };
};

const searchFor = async (
  user: ReturnType<typeof userEvent.setup>,
  keyword: string,
): Promise<void> => {
  await user.type(screen.getByLabelText(t.label), keyword);
  await user.click(screen.getByRole('button', { name: t.search }));
};

describe('ItemPicker', () => {
  it('⛔ 글자마다 찾지 않는다 — 확정했을 때만 요청이 나간다', async () => {
    const { user, urls } = renderPicker();

    await user.type(screen.getByLabelText(t.label), 'SYN');
    expect(urls).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: t.search }));
    await waitFor(() => {
      expect(urls).toHaveLength(1);
    });
  });

  it('찾은 품목을 고를 수 있다', async () => {
    const { onSelect, user } = renderPicker();

    await searchFor(user, 'SYN');
    await user.click(await screen.findByRole('button', { name: /SYN-ITEM-0001/ }));

    expect(onSelect).toHaveBeenCalledWith({
      itemId: 5001,
      itemCode: 'SYN-ITEM-0001',
      itemName: '합성 품목',
      baseUomId: 11,
    });
  });

  it('⛔ 고른 품목의 기준 단위를 함께 들고 간다 — 수량이 어느 단위인지가 사실이다', async () => {
    const { onSelect, user } = renderPicker({ items: [item({ baseUomId: 77 })] });

    await searchFor(user, 'SYN');
    await user.click(await screen.findByRole('button', { name: /SYN-ITEM-0001/ }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ baseUomId: 77 }));
  });

  it('고른 품목을 지울 수 있다', async () => {
    const { onSelect, user } = renderPicker(
      {},
      { itemId: 5001, itemCode: 'SYN-ITEM-0001', itemName: '합성 품목', baseUomId: 11 },
    );

    await user.click(screen.getByRole('button', { name: t.clear }));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('찾은 것이 없으면 다음에 할 일을 적는다', async () => {
    const { user } = renderPicker({ items: [] });

    await searchFor(user, 'SYN');

    expect(await screen.findByText(t.empty)).toBeInTheDocument();
  });

  it('⛔ 조회 실패를 「없음」으로 두지 않는다', async () => {
    const { user } = renderPicker({ fail: true });

    await searchFor(user, 'SYN');

    expect(await screen.findByText(t.error)).toBeInTheDocument();
    expect(screen.queryByText(t.empty)).not.toBeInTheDocument();
  });

  it('⛔ 목록이 잘렸으면 잘렸다고 말한다 — 「찾는 품목이 없다」로 읽지 않게', async () => {
    const { user } = renderPicker({ items: [item()], total: 500 });

    await searchFor(user, 'SYN');

    expect(await screen.findByText(t.truncated(1))).toBeInTheDocument();
  });

  it('잘리지 않았으면 그 말을 하지 않는다', async () => {
    const { user } = renderPicker({ items: [item()], total: 1 });

    await searchFor(user, 'SYN');
    await screen.findByRole('button', { name: /SYN-ITEM-0001/ });

    expect(screen.queryByText(t.truncated(1))).not.toBeInTheDocument();
  });

  it('⛔ Routing 보유로 미리 거르지 않는다 — 지우면 「없는 품목」과 구분할 수 없다', async () => {
    const { user, urls } = renderPicker();

    await searchFor(user, 'SYN');
    await waitFor(() => {
      expect(urls).toHaveLength(1);
    });

    expect(urls[0]).not.toContain('hasRouting');
  });
});
