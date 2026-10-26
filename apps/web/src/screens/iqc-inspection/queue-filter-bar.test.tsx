import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { EMPTY_FILTERS, type QueueFilters } from './filters';
import { QueueFilterBar } from './queue-filter-bar';

const t = messages.iqcInspection.filters;

const ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 품목 가';
const SUPPLIER_LABEL = 'SAMPLE-SUP-01 · 합성 공급사 가';

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

/**
 * 참조 둘. **조건 줄이 이제 이름을 읽어 온다** — 종전에는 사용자가 번호를 쳤고 조회가 없었다
 * (omf-all-around#40).
 */
const routes = (): StubRoute[] => [
  {
    /* 주소로 들어온 품목의 이름 — 창을 거치지 않은 값도 이름이 서야 한다. */
    match: (request) => isGet(request, '/mdm/items/1001'),
    respond: () =>
      jsonResponse({
        item: {
          itemId: 1001,
          itemCode: 'SAMPLE-ITEM-01',
          itemName: '합성 품목 가',
          isActive: true,
        },
        editability: {},
      }),
  },
  {
    match: (request) => isGet(request, '/mdm/partners'),
    respond: () =>
      jsonResponse({
        items: [
          {
            partnerId: 2002,
            partnerCode: 'SAMPLE-SUP-01',
            partnerName: '합성 공급사 가',
            isActive: true,
          },
          {
            partnerId: 2003,
            partnerCode: 'SAMPLE-SUP-02',
            partnerName: '합성 공급사 나',
            isActive: true,
          },
        ],
        page: { page: 1, size: 200, total: 2 },
      }),
  },
];

const renderBar = (appliedFilters: QueueFilters = EMPTY_FILTERS, extra: StubRoute[] = []) => {
  const onSearch = vi.fn();
  const onReset = vi.fn();

  const view = renderWithProviders(
    <QueueFilterBar
      appliedFilters={appliedFilters}
      onSearch={onSearch}
      onTogglePendingOnly={vi.fn()}
      onReset={onReset}
    />,
    { fetch: createStubFetch([...extra, ...routes()]) },
  );

  return { onSearch, onReset, view, user: userEvent.setup() };
};

const itemBox = () => screen.getByLabelText(t.item);
const supplierBox = () => screen.getByLabelText(t.supplier);
const keywordBox = () => screen.getByLabelText(t.keyword);
const apply = () => screen.getByRole('button', { name: t.apply });

describe('QueueFilterBar — 조건은 골라서 넣는다', () => {
  /*
   * ⛔ **사용자에게 내부 번호를 치라고 하지 않는다**(omf-all-around#40). 종전 이 칸은
   * `inputMode="numeric"` 이었고 자리표시가 「품목 번호로 검색」이었다 — 품목 `12588` 을
   * 외우는 검사자는 없다.
   */
  it('품목 칸은 번호를 받지 않는다 — 읽기 전용이고 누르면 고르는 창이 열린다', async () => {
    const { user } = renderBar();

    expect(itemBox()).toHaveAttribute('readonly');
    expect(itemBox()).toHaveAttribute('aria-haspopup', 'dialog');

    await user.click(itemBox());

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('주소로 들어온 품목은 창을 거치지 않아도 이름으로 선다', async () => {
    renderBar({ itemId: 1001, supplierId: null, keyword: '', pendingOnly: true, statusCode: null });

    await waitFor(() => {
      expect(itemBox()).toHaveValue(ITEM_LABEL);
    });
    /* 짝 방향 — 번호가 칸에 남지 않는다. */
    expect(itemBox()).not.toHaveValue('1001');
  });

  it('공급사는 검색 창으로 고른다 — 주소로 들어온 값도 이름으로 선다(#133)', async () => {
    renderBar({ itemId: null, supplierId: 2002, keyword: '', pendingOnly: true, statusCode: null });

    await waitFor(() => {
      expect(supplierBox()).toHaveValue(SUPPLIER_LABEL);
    });
    expect(supplierBox()).toHaveAttribute('readonly');
    expect(supplierBox()).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('검색 창에서 고른 공급사를 조건으로 올린다', async () => {
    const { onSearch, user } = renderBar();

    await user.click(supplierBox());
    const dialog = await screen.findByRole('dialog', { name: t.supplierPicker.title });
    await user.click(await within(dialog).findByRole('checkbox', { name: 'SAMPLE-SUP-01' }));
    await user.click(within(dialog).getByRole('button', { name: t.supplierPicker.pick }));
    await user.click(apply());

    expect(onSearch).toHaveBeenCalledWith({ itemId: null, supplierId: 2002, keyword: '' });
  });

  it('검색어로 공급사를 찾는다 — 거래처 조회에 검색어를 싣는다', async () => {
    const searched: string[] = [];
    const { user } = renderBar(EMPTY_FILTERS, [
      {
        match: (request) => {
          if (isGet(request, '/mdm/partners')) {
            searched.push(new URL(request.url).searchParams.get('q') ?? '');
          }
          return false;
        },
        respond: () => jsonResponse({}),
      },
    ]);

    await user.click(supplierBox());
    const dialog = await screen.findByRole('dialog', { name: t.supplierPicker.title });
    await user.type(within(dialog).getByRole('textbox'), 'SUP-02{Enter}');

    await waitFor(() => expect(searched).toContain('SUP-02'));
  });

  it('고른 공급사는 칸 안의 × 로 풀 수 있다', async () => {
    const { onSearch, user } = renderBar({
      itemId: null,
      supplierId: 2002,
      keyword: '',
      pendingOnly: true,
      statusCode: null,
    });

    await waitFor(() => {
      expect(supplierBox()).toHaveValue(SUPPLIER_LABEL);
    });
    await user.click(screen.getByRole('button', { name: t.supplierClear }));
    await user.click(apply());

    expect(onSearch).toHaveBeenCalledWith({ itemId: null, supplierId: null, keyword: '' });
  });
});

describe('QueueFilterBar — 의뢰번호와 조회·초기화', () => {
  it('주소가 담은 의뢰번호를 편집 칸에 되돌린다', () => {
    renderBar({
      itemId: null,
      supplierId: null,
      keyword: 'IR-1',
      pendingOnly: true,
      statusCode: null,
    });

    expect(keywordBox()).toHaveValue('IR-1');
  });

  it('조회하면 채운 조건만 올린다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(keywordBox(), 'IR-1');
    await user.click(apply());

    expect(onSearch).toHaveBeenCalledWith({ itemId: null, supplierId: null, keyword: 'IR-1' });
  });

  /**
   * 부모에게만 알리면 아직 조회하지 않은 값은 주소가 바뀌지 않아 되돌림 effect 도 깨어나지
   * 않는다 — 그러면 **「초기화」를 눌렀는데 치던 값이 그대로 남는다.**
   */
  it('초기화는 치던 값도 함께 비운다', async () => {
    const { onReset, user } = renderBar();

    await user.type(keywordBox(), 'IR-1');
    await user.click(screen.getByRole('button', { name: t.reset }));

    expect(keywordBox()).toHaveValue('');
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  /**
   * 주소가 정본이다 — 뒤로가기로 주소가 바뀌면 편집 중이던 값도 그 값으로 되돌아간다.
   *
   * 조건을 **바깥에서 바꿔 넣는다** — `rerender` 로는 제공자 바깥에서 그려져 이 화면이
   * 쓰는 API 문맥이 사라진다.
   */
  it('주소가 바뀌면 편집 중이던 값이 그 값으로 되돌아간다', async () => {
    const Harness = () => {
      const [applied, setApplied] = useState<QueueFilters>(EMPTY_FILTERS);

      return (
        <>
          <button
            type="button"
            onClick={() => {
              setApplied({
                itemId: null,
                supplierId: null,
                keyword: 'IR-1',
                pendingOnly: true,
                statusCode: null,
              });
            }}
          >
            주소 바꾸기
          </button>
          <QueueFilterBar
            appliedFilters={applied}
            onSearch={vi.fn()}
            onTogglePendingOnly={vi.fn()}
            onReset={vi.fn()}
          />
        </>
      );
    };

    renderWithProviders(<Harness />, { fetch: createStubFetch(routes()) });
    const user = userEvent.setup();

    await user.type(keywordBox(), 'IR-9');
    await user.click(screen.getByRole('button', { name: '주소 바꾸기' }));

    await waitFor(() => {
      expect(keywordBox()).toHaveValue('IR-1');
    });
  });
});
