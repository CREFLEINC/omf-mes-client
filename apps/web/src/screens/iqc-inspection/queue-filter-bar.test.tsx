import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
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
 * 참조 — **조건 줄이 이름을 읽어 온다**(종전에는 사용자가 번호를 쳤다 · omf-all-around#40). 품목 · 공급사는 칸에서 바로
 * 검색해 고른다(omf-all-around#226) — 펼치면 서버에 묻고, 고른 값의 이름은 상세로 푼다.
 */
const ITEM = { itemId: 1001, itemCode: 'SAMPLE-ITEM-01', itemName: '합성 품목 가', isActive: true };
const PARTNERS = [
  { partnerId: 2002, partnerCode: 'SAMPLE-SUP-01', partnerName: '합성 공급사 가', isActive: true },
  { partnerId: 2003, partnerCode: 'SAMPLE-SUP-02', partnerName: '합성 공급사 나', isActive: true },
];

const routes = (): StubRoute[] => [
  {
    /* 주소로 들어온 품목의 이름 — 목록을 펼치지 않은 값도 이름이 서야 한다. */
    match: (request) => isGet(request, '/mdm/items/1001'),
    respond: () => jsonResponse({ item: ITEM, editability: {} }),
  },
  {
    match: (request) => isGet(request, '/mdm/items'),
    respond: () => jsonResponse({ items: [ITEM], page: { page: 1, size: 50, total: 1 } }),
  },
  {
    /* 품목 유형 — 제품(FINISHED)을 뺀 나머지로 좁힌다. */
    match: (request) => isGet(request, '/mdm/code-values'),
    respond: () =>
      jsonResponse({
        items: [
          { code: 'RAW', codeName: '원자재' },
          { code: 'FINISHED', codeName: '제품' },
          { code: 'SEMI', codeName: '반제품' },
        ],
        page: { page: 1, size: 100, total: 3 },
      }),
  },
  {
    match: (request) => isGet(request, '/mdm/partners/2002'),
    respond: () => jsonResponse(PARTNERS[0]),
  },
  {
    match: (request) => isGet(request, '/mdm/partners'),
    respond: () => jsonResponse({ items: PARTNERS, page: { page: 1, size: 50, total: 2 } }),
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
  it('품목은 칸에서 바로 검색해 고른다 — 창(팝업)이 열리지 않는다(#226)', async () => {
    const { onSearch, user } = renderBar();

    await user.click(itemBox());
    await screen.findByRole('searchbox', { name: messages.common.selectSearch });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: ITEM_LABEL }));
    await user.click(apply());

    expect(onSearch).toHaveBeenCalledWith({ itemId: 1001, supplierId: null, keyword: '' });
  });

  it('품목 찾는 범위는 종전 창과 같다 — 사용 중지 포함, 제품 유형은 뺀다', async () => {
    const asked: URLSearchParams[] = [];
    const { user } = renderBar(EMPTY_FILTERS, [
      {
        match: (request) => {
          if (isGet(request, '/mdm/items')) asked.push(new URL(request.url).searchParams);
          return false;
        },
        respond: () => jsonResponse({}),
      },
    ]);

    await user.click(itemBox());
    await screen.findByRole('option', { name: ITEM_LABEL });

    /* 유형 목록이 오면 그 조건으로 다시 묻는다 — 마지막 물음이 제품을 뺀 유형이다. */
    await waitFor(() => expect(asked.at(-1)?.get('itemTypeCode')).toBe('RAW,SEMI'));
    expect(asked.at(-1)?.get('includeInactive')).toBe('true');
  });

  it('주소로 들어온 품목은 펼치지 않아도 이름으로 선다', async () => {
    renderBar({ itemId: 1001, supplierId: null, keyword: '', pendingOnly: true, statusCode: null });

    await waitFor(() => {
      expect(itemBox()).toHaveTextContent(ITEM_LABEL);
    });
    /* 짝 방향 — 번호가 칸에 남지 않는다. */
    expect(itemBox()).not.toHaveTextContent('1001');
  });

  it('주소로 들어온 공급사도 이름으로 선다', async () => {
    renderBar({ itemId: null, supplierId: 2002, keyword: '', pendingOnly: true, statusCode: null });

    await waitFor(() => {
      expect(supplierBox()).toHaveTextContent(SUPPLIER_LABEL);
    });
  });

  it('칸에서 고른 공급사를 조건으로 올린다 — 창(팝업)이 열리지 않는다(#226)', async () => {
    const { onSearch, user } = renderBar();

    await user.click(supplierBox());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: SUPPLIER_LABEL }));
    await user.click(apply());

    expect(onSearch).toHaveBeenCalledWith({ itemId: null, supplierId: 2002, keyword: '' });
  });

  it('검색어로 공급사를 찾는다 — 거래처 조회에 검색어 · 사용 중지 포함을 싣는다', async () => {
    const asked: URLSearchParams[] = [];
    const { user } = renderBar(EMPTY_FILTERS, [
      {
        match: (request) => {
          if (isGet(request, '/mdm/partners')) asked.push(new URL(request.url).searchParams);
          return false;
        },
        respond: () => jsonResponse({}),
      },
    ]);

    await user.click(supplierBox());
    await screen.findByRole('searchbox', { name: messages.common.selectSearch });
    await user.keyboard('SUP-02');

    await waitFor(() => expect(asked.at(-1)?.get('q')).toBe('SUP-02'));
    expect(asked.at(-1)?.get('includeInactive')).toBe('true');
  });

  it('「전체」를 고르면 공급사 조건을 푼다', async () => {
    const { onSearch, user } = renderBar({
      itemId: null,
      supplierId: 2002,
      keyword: '',
      pendingOnly: true,
      statusCode: null,
    });

    await waitFor(() => {
      expect(supplierBox()).toHaveTextContent(SUPPLIER_LABEL);
    });
    await user.click(supplierBox());
    await user.click(await screen.findByRole('option', { name: t.all }));
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
