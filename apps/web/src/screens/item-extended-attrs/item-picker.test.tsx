import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { itemFixtures } from './fixtures';
import { ItemPicker } from './item-picker';

const ITEMS_PATH = '/mdm/items';

interface RecordedRequest {
  url: URL;
}

const createRecordingFetch = (
  routes: StubRoute[],
): { fetch: StubFetch; requests: RecordedRequest[] } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);

  const fetch: StubFetch = async (request) => {
    requests.push({ url: new URL(request.url) });

    return stub(request);
  };

  return { fetch, requests };
};

const searchRoute = (items = itemFixtures, total = itemFixtures.length): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === ITEMS_PATH,
  respond: () => jsonResponse({ items, page: { page: 1, size: 20, total } }),
});

const failingSearchRoute = (): StubRoute => ({
  match: (request) => new URL(request.url).pathname === ITEMS_PATH,
  respond: () => jsonResponse({ message: '조회에 실패했습니다' }, { status: 500 }),
});

const renderPicker = (
  routes: StubRoute[],
  overrides: Partial<Parameters<typeof ItemPicker>[0]> = {},
) => {
  const { fetch, requests } = createRecordingFetch(routes);
  const onChange = vi.fn<(value: string) => void>();

  renderWithProviders(<ItemPicker value="" onChange={onChange} {...overrides} />, { fetch });

  return { requests, onChange, user: userEvent.setup() };
};

const searchRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === ITEMS_PATH);

/**
 * M31 — 품목 고르기는 **검색어 없이 조회하지 않는다.**
 *
 * 빈 검색어로 받은 앞 N건은 고를 만한 후보가 아니고, 전 품목을 받는 것은
 * 화면에도 서버에도 의미가 없다.
 */
describe('ItemPicker — 검색어 없이 조회하지 않는다 (M31)', () => {
  it('그리자마자 조회하지 않는다', async () => {
    const { requests } = renderPicker([searchRoute()]);

    expect(await screen.findByLabelText('대상 품목 검색')).toBeInTheDocument();
    expect(searchRequests(requests)).toHaveLength(0);
  });

  it('검색어가 비어 있으면 찾기를 눌러도 조회하지 않는다', async () => {
    const { requests, user } = renderPicker([searchRoute()]);

    await user.click(screen.getByRole('button', { name: '찾기' }));

    expect(searchRequests(requests)).toHaveLength(0);
  });

  /* 공백만 넣은 검색어도 조건이 아니다 — 서버에는 「전부 달라」로 읽힌다. */
  it('공백만 넣어도 조회하지 않는다', async () => {
    const { requests, user } = renderPicker([searchRoute()]);

    await user.type(screen.getByLabelText('대상 품목 검색'), '   ');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    expect(searchRequests(requests)).toHaveLength(0);
  });

  it('검색어를 넣고 찾기를 누르면 그 검색어로 조회한다', async () => {
    const { requests, user } = renderPicker([searchRoute()]);

    await user.type(screen.getByLabelText('대상 품목 검색'), 'SYN');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    await waitFor(() => {
      expect(searchRequests(requests)).toHaveLength(1);
    });
    expect(searchRequests(requests)[0]?.url.searchParams.get('q')).toBe('SYN');
  });
});

describe('ItemPicker — 결과에서 고른다', () => {
  it('검색 결과를 선택지로 낸다 — 번호가 아니라 이름이다', async () => {
    const { user } = renderPicker([searchRoute()]);

    await user.type(screen.getByLabelText('대상 품목 검색'), 'SYN');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    await user.click(await screen.findByLabelText('대상 품목'));

    expect(screen.getByRole('option', { name: 'SYN-ITEM-01 · 합성 품목 A' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '1001' })).not.toBeInTheDocument();
  });

  it('고른 값을 바깥에 알린다', async () => {
    const { onChange, user } = renderPicker([searchRoute()]);

    await user.type(screen.getByLabelText('대상 품목 검색'), 'SYN');
    await user.click(screen.getByRole('button', { name: '찾기' }));
    await user.click(await screen.findByLabelText('대상 품목'));
    await user.click(screen.getByRole('option', { name: 'SYN-ITEM-01 · 합성 품목 A' }));

    expect(onChange).toHaveBeenCalledWith('1001');
  });

  /*
   * 검색을 다시 하면 지금 고른 값이 결과에 없을 수 있다.
   * 빼 버리면 선택칸이 비어 보여 사용자가 값이 사라진 줄 안다.
   */
  it('검색 결과에 없는 현재 값도 이름으로 남는다', async () => {
    const { user } = renderPicker([searchRoute()], {
      value: '9001',
      selectedLabel: 'SYN-ITEM-09 · 합성 품목 I',
    });

    await user.click(screen.getByLabelText('대상 품목'));

    expect(screen.getByRole('option', { name: 'SYN-ITEM-09 · 합성 품목 I' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '9001' })).not.toBeInTheDocument();
  });

  it('이름을 모르는 현재 값도 번호 대신 미확인 상태로 남는다', async () => {
    const { user } = renderPicker([searchRoute()], { value: '9001' });

    await user.click(screen.getByLabelText('대상 품목'));

    expect(screen.getByRole('option', { name: '알 수 없음' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '9001' })).not.toBeInTheDocument();
  });

  /* 검색 전에 선택칸이 비어 있는 것은 정상이다 — 밝히지 않으면 고장으로 읽힌다. */
  it('검색 전에는 무엇을 하라는 안내가 붙는다', () => {
    renderPicker([searchRoute()]);

    expect(screen.getByText('품목코드나 품목명을 넣고 찾기를 누르세요.')).toBeInTheDocument();
  });
});

describe('ItemPicker — 결과가 온전하지 않을 때', () => {
  /* 잘렸다는 사실을 감추면 사용자가 「이 품목은 없다」로 읽고 검색을 그만둔다. */
  it('결과가 잘리면 안내가 난다', async () => {
    const { user } = renderPicker([searchRoute(itemFixtures, 120)]);

    await user.type(screen.getByLabelText('대상 품목 검색'), 'SYN');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    expect(
      await screen.findByText('검색 결과가 많아 일부만 표시합니다. 검색어를 좁히세요.'),
    ).toBeInTheDocument();
  });

  /* 결과 0건과 조회 실패는 다른 사실이다 — 같은 문구를 내면 원인을 알 수 없다. */
  it('결과가 0건이면 실패와 다른 문구를 낸다', async () => {
    const { user } = renderPicker([searchRoute([], 0)]);

    await user.type(screen.getByLabelText('대상 품목 검색'), 'ZZZ');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    expect(
      await screen.findByText('검색어에 맞는 품목이 없습니다. 검색어를 바꿔 다시 찾아 보세요.'),
    ).toBeInTheDocument();
  });

  it('조회에 실패하면 실패했다고 낸다', async () => {
    const { user } = renderPicker([failingSearchRoute()]);

    await user.type(screen.getByLabelText('대상 품목 검색'), 'SYN');
    await user.click(screen.getByRole('button', { name: '찾기' }));

    expect(
      await screen.findByText('품목을 검색하지 못했습니다. 잠시 뒤 다시 찾아 보세요.'),
    ).toBeInTheDocument();
  });

  it('조회 실패 중인 현재 값은 번호 대신 실패 상태로 남는다', async () => {
    const { user } = renderPicker([failingSearchRoute()], { value: '9001' });

    await user.type(screen.getByLabelText('대상 품목 검색'), 'SYN');
    await user.click(screen.getByRole('button', { name: '찾기' }));
    await screen.findByText('품목을 검색하지 못했습니다. 잠시 뒤 다시 찾아 보세요.');
    await user.click(screen.getByLabelText('대상 품목'));

    expect(screen.getByRole('option', { name: '이름을 불러오지 못했습니다' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '9001' })).not.toBeInTheDocument();
  });
});
