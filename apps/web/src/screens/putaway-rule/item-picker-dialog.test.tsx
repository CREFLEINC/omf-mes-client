import { messages } from '@omf-mes/i18n';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { itemFixtures } from './fixtures';
import { ItemPickerDialog } from './item-picker-dialog';

const t = messages.putawayRule;

const ITEMS_PATH = '/mdm/items';

const isItemSearch = (request: Request): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === ITEMS_PATH;

const searchRoute = (
  items: unknown[] = itemFixtures,
  page: Partial<{ page: number; size: number; total: number }> = {},
): StubRoute => ({
  match: isItemSearch,
  respond: () => jsonResponse({ items, page: { page: 1, size: 50, total: items.length, ...page } }),
});

const failingRoute: StubRoute = {
  match: isItemSearch,
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
};

const renderDialog = (routes: StubRoute[] = [searchRoute()]) => {
  const onPick = vi.fn();
  const onClose = vi.fn();
  const urls: URL[] = [];
  const stub = createStubFetch(routes);

  renderWithProviders(<ItemPickerDialog onPick={onPick} onClose={onClose} />, {
    fetch: async (request) => {
      urls.push(new URL(request.url));

      return stub(request);
    },
  });

  return { onPick, onClose, urls, user: userEvent.setup() };
};

const search = async (
  user: ReturnType<typeof userEvent.setup>,
  keyword = '합성',
): Promise<void> => {
  await user.type(screen.getByLabelText(t.itemPicker.keywordLabel), keyword);
  await user.click(screen.getByRole('button', { name: t.actions.searchItems }));
};

describe('ItemPickerDialog — 찾기 전', () => {
  /**
   * 빈 검색어로 받은 앞 N건은 고를 만한 후보가 아니다. **아직 찾지 않았다**를 「결과 없음」과
   * 다른 문구로 말한다 — 두 사실을 뭉개면 사용자가 「그런 품목은 없다」로 읽고 그만둔다.
   */
  it('검색어가 비면 조회하지 않고 그 사실을 말한다', async () => {
    const { urls } = renderDialog();

    expect(await screen.findByText(t.itemPicker.beforeSearch)).toBeInTheDocument();
    expect(urls).toHaveLength(0);
  });

  /** 빈 검색어로 눌러도 요청이 나가지 않는다 — 버튼을 감추는 대신 조회를 열지 않는다. */
  it('빈 검색어로 찾기를 눌러도 요청이 나가지 않는다', async () => {
    const { urls, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.searchItems }));

    expect(urls).toHaveLength(0);
    expect(screen.getByText(t.itemPicker.beforeSearch)).toBeInTheDocument();
  });
});

describe('ItemPickerDialog — 찾은 뒤', () => {
  it('검색어를 실어 부르고 결과를 표로 그린다', async () => {
    const { urls, user } = renderDialog();

    await search(user);

    expect(await screen.findByText('합성품목 가')).toBeInTheDocument();
    expect(urls.at(-1)?.searchParams.get('q')).toBe('합성');
  });

  /** 새로 만드는 규칙이 미사용 품목을 가리킬 이유가 없다(공유계약 G-8). */
  it('미사용 품목을 함께 달라고 하지 않는다', async () => {
    const { urls, user } = renderDialog();

    await search(user);

    expect(urls.at(-1)?.searchParams.get('includeInactive')).toBeNull();
  });

  /** 표의 행을 눌러 고른다 — **창 안에 펼침 선택칸을 두지 않는다.** */
  it('행을 누르면 고른 품목을 이름과 함께 올린다', async () => {
    const { onPick, user } = renderDialog();

    await search(user);
    await user.click(
      await screen.findByRole('button', {
        name: t.actions.chooseItem('SYN-ITEM-01 · 합성품목 가'),
      }),
    );

    expect(onPick).toHaveBeenCalledWith({
      itemId: 9101,
      itemCode: 'SYN-ITEM-01',
      itemName: '합성품목 가',
    });
  });

  /** 창 본문이 펼침 목록을 잘라 무엇을 고르는지 읽을 수 없다(`design-system-v2-webui#68`). */
  it('창 안에 펼침 선택칸을 두지 않는다', async () => {
    const { user } = renderDialog();

    await search(user);
    await screen.findByText('합성품목 가');

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('조회는 됐는데 결과가 없으면 실패와 다른 문구를 낸다', async () => {
    const { user } = renderDialog([searchRoute([])]);

    await search(user);

    expect(await screen.findByText(t.itemPicker.noResult)).toBeInTheDocument();
    expect(screen.queryByText(t.itemPicker.searchFailed)).not.toBeInTheDocument();
  });

  /**
   * 실패를 로딩보다 앞에서 판정한다 — 먼저 로딩을 보면 실패한 조회가 영원히 「찾는 중」으로
   * 보인다(사본 대조 추가 ①).
   */
  it('조회가 실패하면 결과 없음이 아니라 실패를 말한다', async () => {
    const { user } = renderDialog([failingRoute]);

    await search(user);

    expect(await screen.findByText(t.itemPicker.searchFailed)).toBeInTheDocument();
    expect(screen.queryByText(t.itemPicker.noResult)).not.toBeInTheDocument();
  });

  /** 잘렸다는 사실을 감추면 사용자가 「그런 품목은 없다」로 읽고 검색을 그만둔다. */
  it('잘렸으면 그 사실을 밝힌다', async () => {
    const { user } = renderDialog([searchRoute(itemFixtures, { total: 120 })]);

    await search(user);
    await screen.findByText('합성품목 가');

    expect(screen.getByText(t.itemPicker.truncated)).toBeInTheDocument();
  });

  /** 잘리지 않았는데 안내를 내면 사용자가 늘 목록을 의심하게 된다. */
  it('잘리지 않았으면 그 안내를 내지 않는다', async () => {
    const { user } = renderDialog();

    await search(user);
    await screen.findByText('합성품목 가');

    expect(screen.queryByText(t.itemPicker.truncated)).not.toBeInTheDocument();
  });

  /** 검색칸에서 엔터를 치면 창이 통째로 확인되는 것을 막고 검색만 한다. */
  it('엔터로도 찾는다', async () => {
    const { urls, user } = renderDialog();

    await user.type(screen.getByLabelText(t.itemPicker.keywordLabel), '합성{Enter}');

    expect(await screen.findByText('합성품목 가')).toBeInTheDocument();
    expect(urls).toHaveLength(1);
  });

  /** 앞뒤 공백을 턴 말로 찾는다 — 공백만 친 검색어는 검색이 아니다. */
  it('검색어의 앞뒤 공백을 턴다', async () => {
    const { urls, user } = renderDialog();

    await search(user, '  합성  ');

    expect(await screen.findByText('합성품목 가')).toBeInTheDocument();
    expect(urls.at(-1)?.searchParams.get('q')).toBe('합성');
  });
});

describe('ItemPickerDialog — 나가기', () => {
  it('취소하면 고르지 않고 닫는다', async () => {
    const { onPick, onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: messages.common.cancel }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPick).not.toHaveBeenCalled();
  });

  /**
   * **Escape는 막을 수 없다** — native `<dialog>`가 `cancel`을 내고 디자인 시스템이 그것을
   * 닫기 요청으로 무조건 잇는다. 여기서는 그것이 옳다: 고르기 전에 닫히면 아무 일도 일어나지
   * 않는다. **고르기로 이어지지 않는다**는 사실을 값으로 고정한다(초안 파기 창과 같은 방향).
   */
  it('Escape는 닫기 요청으로 이어지고 고르기로 이어지지 않는다', async () => {
    const { onPick, onClose, user } = renderDialog();

    await search(user);
    await screen.findByText('합성품목 가');

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPick).not.toHaveBeenCalled();
  });

  /** 스크림 클릭도 같다 — 실수로 닫혀도 잃는 것이 없고, **고르지도 않는다.** */
  it('스크림을 눌러도 고르기로 이어지지 않는다', async () => {
    const { onPick, user } = renderDialog();

    await search(user);
    await screen.findByText('합성품목 가');

    fireEvent.click(screen.getByRole('dialog'));

    expect(onPick).not.toHaveBeenCalled();
  });
});
