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

import { ItemPickerDialog } from './dialog';
import { ITEM_PAGE_SIZE } from './queries';

/**
 * 품목 선택 대화상자 — **무는 것은 규칙 넷**이다.
 *
 * 1. 검색어가 비면 조회하지 않는다
 * 2. 「찾기」로만 조회한다(글자마다 요청하지 않는다)
 * 3. 중지된 품목을 부르지 않는다(`includeInactive` 를 싣지 않는다)
 * 4. 유형 목록을 화면이 갖지 않는다(코드 그룹에서 받는다 · 공유계약 G-32)
 */

const t = messages.itemPicker;

const ITEMS_PATH = '/mdm/items';
const CODE_VALUES_PATH = '/mdm/code-values';
const BALANCES_PATH = '/inventory/balances';

const pathOf = (request: Request): string => new URL(request.url).pathname;

const item = (itemId: number, itemCode: string, itemName: string) => ({
  itemId,
  itemCode,
  itemName,
  itemTypeCode: 'FINISHED',
  baseUomId: 8401,
  isActive: true,
});

const ITEMS = [
  item(8301, 'SYN-ITEM-01', '합성 품목 가'),
  item(8302, 'SYN-ITEM-02', '합성 품목 나'),
];

interface Options {
  /** 나간 품목 조회를 담아 둔다 — 무엇을 «안» 보내는지가 이 창의 핵심이다. */
  searches?: URL[];
  /** 전체 건수를 부풀려 쪽 이동을 만든다. */
  total?: number;
  typeFails?: boolean;
}

const routes = (options: Options = {}): StubRoute[] => [
  {
    match: (request) => pathOf(request) === CODE_VALUES_PATH,
    respond: () =>
      options.typeFails === true
        ? jsonResponse({ message: '실패' }, { status: 500 })
        : jsonResponse({
            items: [
              { code: 'FINISHED', codeName: '제품' },
              { code: 'RAW_MATERIAL', codeName: '원자재' },
            ],
            page: { page: 1, size: 100, total: 2 },
          }),
  },
  {
    match: (request) => pathOf(request) === ITEMS_PATH,
    respond: (request) => {
      options.searches?.push(new URL(request.url));

      return jsonResponse({
        items: ITEMS,
        page: { page: 1, size: ITEM_PAGE_SIZE, total: options.total ?? ITEMS.length },
      });
    },
  },
  {
    match: (request) => pathOf(request) === BALANCES_PATH,
    respond: () =>
      jsonResponse({
        items: [{ itemId: 8301, availableQty: 480, ownershipTypeCode: 'OWNED' }],
        page: { page: 1, size: 50, total: 1 },
      }),
  },
];

const renderDialog = (
  props: Partial<Parameters<typeof ItemPickerDialog>[0]> = {},
  options: Options = {},
) =>
  renderWithProviders(
    <ItemPickerDialog
      multiple
      onClose={props.onClose ?? vi.fn()}
      onConfirm={props.onConfirm ?? vi.fn()}
      {...props}
    />,
    { fetch: createStubFetch(routes(options)), route: '/' },
  );

const dialog = () => within(screen.getByRole('dialog'));

describe('ItemPickerDialog — 조회를 언제 보내는가', () => {
  /*
   * ⭐ **열자마자 고른 유형의 전체가 보인다**(사용자 지시 2026-09-18).
   *
   * ⛔ 종전에는 「검색어가 비면 조회하지 않는다」였다 — `W-06-05` 인라인 픽커에서 가져온
   *    규칙이고 근거는 「빈 검색어로 받은 앞 N 건은 고를 만한 후보가 아니다」였는데, **이 창에는
   *    그 근거가 맞지 않는다.** 그쪽은 결과가 선택칸 하나라 앞 N 건 말고는 닿을 길이 없었지만,
   *    이 창은 쪽 나누기와 전체 건수로 전체를 훑을 길이 있다. 그 규칙을 두면 창을 열자마자
   *    **막다른 빈 화면**이라 무엇을 고를 수 있는지 아예 보이지 않는다.
   * ⚠ 빈 검색어를 «문자열로» 보내지도 않는다 — 축을 아예 싣지 않는다.
   */
  it('열자마자 고른 유형의 첫 쪽을 보이되 검색어 축은 싣지 않는다', async () => {
    const searches: URL[] = [];
    renderDialog({}, { searches });

    expect(await dialog().findByRole('checkbox', { name: 'SYN-ITEM-01' })).toBeInTheDocument();
    expect(searches).toHaveLength(1);
    expect(searches[0]?.searchParams.has('q')).toBe(false);
  });

  /* ⛔ **글자마다 요청하지 않는다** — 「찾기」를 눌러야 나간다. */
  it('치는 동안에는 부르지 않고 「찾기」에서 한 번 더 나간다', async () => {
    const user = userEvent.setup();
    const searches: URL[] = [];
    renderDialog({}, { searches });

    /* 창이 열리며 한 번 나간다 — 그 뒤로 타건은 요청을 만들지 않는다. */
    await waitFor(() => {
      expect(searches).toHaveLength(1);
    });

    await user.type(dialog().getByLabelText(t.keywordLabel), 'SYN');
    expect(searches).toHaveLength(1);

    await user.click(dialog().getByRole('button', { name: t.search }));

    await waitFor(() => {
      expect(searches).toHaveLength(2);
    });
  });

  /*
   * ⛔ **중지된 품목은 내지 않는다.** 종전 인라인 검색이 `includeInactive: true` 를 켜 두어
   *    중지된 품목까지 후보에 올렸다(2026-09-18 정정).
   * ⭐ 기본 유형은 부르는 쪽이 정한다 — 이 부품은 어느 유형이 맞는지 알지 않는다.
   */
  it('중지된 품목을 부르지 않고, 받은 기본 유형을 싣는다', async () => {
    const user = userEvent.setup();
    const searches: URL[] = [];
    renderDialog({ defaultItemTypeCode: 'FINISHED' }, { searches });

    await user.type(dialog().getByLabelText(t.keywordLabel), 'SYN');
    await user.click(dialog().getByRole('button', { name: t.search }));

    await waitFor(() => {
      expect(searches).toHaveLength(2);
    });

    const sent = searches.at(-1);

    expect(sent?.searchParams.get('includeInactive')).toBeNull();
    expect(sent?.searchParams.get('itemTypeCode')).toBe('FINISHED');
    expect(sent?.searchParams.get('size')).toBe(String(ITEM_PAGE_SIZE));
  });

  /* 「전체」는 유형 축을 아예 싣지 않는다 — 빈 문자열을 코드로 보내지 않는다. */
  it('「전체」면 유형을 싣지 않는다', async () => {
    const user = userEvent.setup();
    const searches: URL[] = [];
    renderDialog({}, { searches });

    await user.type(dialog().getByLabelText(t.keywordLabel), 'SYN');
    await user.click(dialog().getByRole('button', { name: t.search }));

    await waitFor(() => {
      expect(searches).toHaveLength(2);
    });

    expect(searches.at(-1)?.searchParams.has('itemTypeCode')).toBe(false);
  });
});

describe('ItemPickerDialog — 유형 선택지', () => {
  /*
   * ⛔ **값 목록을 화면이 갖지 않는다**(공유계약 G-32). 계약이 「고객이 늘릴 수 있다」고 못박아
   *    두었다 — 화면에 적어 두면 고객이 늘린 유형이 조용히 사라진다.
   */
  it('코드 그룹에서 받은 유형을 그대로 세운다', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(await dialog().findByRole('combobox', { name: t.typeLabel }));

    expect(await screen.findByRole('option', { name: '제품' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '원자재' })).toBeInTheDocument();
  });

  /* ⛔ 유형을 못 받아도 길을 막지 않는다 — 「전체」로는 찾을 수 있다(공유계약 G-9). */
  it('유형을 못 받으면 그 사실을 적되 검색은 막지 않는다', async () => {
    const user = userEvent.setup();
    const searches: URL[] = [];
    renderDialog({}, { searches, typeFails: true });

    expect(await dialog().findByText(t.typeFailed)).toBeInTheDocument();

    await user.type(dialog().getByLabelText(t.keywordLabel), 'SYN');
    await user.click(dialog().getByRole('button', { name: t.search }));

    await waitFor(() => {
      expect(searches.length).toBeGreaterThan(1);
    });
  });
});

describe('ItemPickerDialog — 고르기', () => {
  const search = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await user.type(dialog().getByLabelText(t.keywordLabel), 'SYN');
    await user.click(dialog().getByRole('button', { name: t.search }));
    await dialog().findByRole('checkbox', { name: 'SYN-ITEM-01' });
  };

  /*
   * ⛔ **「고르면 누를 수 있습니다」를 적지 않는다**(사용자 결정 2026-09-21) — 잠긴 단추가
   * 이미 그 말을 한다. 고른 뒤에는 **몇 건 골랐는지**만 알린다.
   */
  it('고르지 않으면 확인을 누를 수 없고, 군더더기 안내를 두지 않는다', async () => {
    const user = userEvent.setup();
    renderDialog();

    await search(user);

    expect(dialog().getByRole('button', { name: t.add })).toBeDisabled();
    expect(dialog().queryByText(t.needsSelection)).not.toBeInTheDocument();
  });

  it('여러 개를 골라 한 번에 넘긴다', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    await search(user);
    await user.click(dialog().getByRole('checkbox', { name: 'SYN-ITEM-01' }));
    await user.click(dialog().getByRole('checkbox', { name: 'SYN-ITEM-02' }));
    await user.click(dialog().getByRole('button', { name: t.add }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0]?.[0]).toHaveLength(2);
  });

  /*
   * ⛔ **단일 선택에서 둘이 남지 않는다.** 남으면 무엇이 그 줄의 품목이 될지 갈린다 —
   *    앞의 고름을 밀어낸다.
   */
  it('단일 선택이면 앞의 고름을 밀어낸다', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ multiple: false, onConfirm });

    await search(user);
    await user.click(dialog().getByRole('checkbox', { name: 'SYN-ITEM-01' }));
    await user.click(dialog().getByRole('checkbox', { name: 'SYN-ITEM-02' }));

    expect(dialog().getByRole('checkbox', { name: 'SYN-ITEM-01' })).not.toBeChecked();

    await user.click(dialog().getByRole('button', { name: t.replace }));

    expect(onConfirm.mock.calls[0]?.[0]).toEqual([expect.objectContaining({ itemId: 8302 })]);
  });

  /* ⛔ **이미 담긴 품목을 막지 않는다** — 편성은 같은 품목 두 라인을 허용한다. 표식만 단다. */
  it('이미 담긴 품목에 표식만 달고 고를 수 있게 둔다', async () => {
    const user = userEvent.setup();
    renderDialog({ addedItemIds: [8301] });

    await search(user);

    expect(dialog().getByText(new RegExp(t.alreadyAdded, 'u'))).toBeInTheDocument();
    expect(dialog().getByRole('checkbox', { name: 'SYN-ITEM-01' })).toBeEnabled();
  });
});

describe('ItemPickerDialog — 쪽 이동', () => {
  /* 한 쪽으로 자르고 전체 건수를 보인다 — 「앞쪽 일부만 보입니다」 같은 한계 문구가 필요 없어진다. */
  it('전체 건수와 보이는 범위를 적고 다음 쪽으로 넘긴다', async () => {
    const user = userEvent.setup();
    const searches: URL[] = [];
    renderDialog({}, { searches, total: 37 });

    await user.type(dialog().getByLabelText(t.keywordLabel), 'SYN');
    await user.click(dialog().getByRole('button', { name: t.search }));

    expect(await dialog().findByText(t.page.range(1, ITEM_PAGE_SIZE, 37))).toBeInTheDocument();

    await user.click(dialog().getByRole('button', { name: t.page.next }));

    await waitFor(() => {
      expect(searches.at(-1)?.searchParams.get('page')).toBe('2');
    });
  });
});
