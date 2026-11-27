import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { NoticeScreen } from './screen';

const t = messages.notice;
const more = messages.common.filterMore;
const pn = messages.screenPatterns.pageNav;

/** 목록은 비워 둔다 — 여기서 재는 것은 조회 조건 줄이고, 나간 조건은 요청 주소로 본다. */
const setup = (route = '/notification/notices', total = 0) => {
  const listQueries: URL[] = [];

  renderWithProviders(<NoticeScreen />, {
    fetch: createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/app/notices',
        respond: (request) => {
          listQueries.push(new URL(request.url));
          const size = Number(new URL(request.url).searchParams.get('size') ?? '20');
          return jsonResponse({ items: [], page: { page: 1, size, total } });
        },
      },
      {
        match: (request) => new URL(request.url).pathname === '/production/work-orders',
        respond: () => jsonResponse({ items: [], page: { page: 1, size: 100, total: 0 } }),
      },
    ]),
    route,
  });

  return { listQueries, user: userEvent.setup() };
};

/* 조회 조건은 목록과 따로 선 조회 조건 상자에 있다(통일 배치 · #350). */
const filterPane = () =>
  within(screen.getByRole('region', { name: messages.common.paneList.filter }));

describe('NoticeScreen — 조회 조건(C-6)', () => {
  /* 「새 공지 쓰기」는 조회 조건 상자에 있고, 누르면 팝업이 뜬다(#361 — 상세 자리 대신). */
  it('조회 조건 상자의 「새 공지 쓰기」를 누르면 등록 팝업이 뜬다', async () => {
    const { user } = setup();

    await user.click(await filterPane().findByRole('button', { name: t.form.create }));

    const dialog = await screen.findByRole('dialog', { name: t.form.create });
    expect(within(dialog).getByLabelText(t.form.title)).toBeVisible();
    expect(within(dialog).getByRole('button', { name: t.form.save })).toBeVisible();

    await user.click(within(dialog).getByRole('button', { name: t.form.cancel }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: t.form.create })).toBeNull();
    });
  });

  it('대상 범위와 「내가 아직 확인하지 않은 것만」은 조건 더보기 안에 접혀 있다', async () => {
    const { user } = setup();

    await waitFor(() => {
      expect(filterPane().getByRole('button', { name: more.open })).toBeVisible();
    });
    expect(filterPane().queryByRole('combobox', { name: t.filters.scope })).toBeNull();

    await user.click(filterPane().getByRole('button', { name: more.open }));

    expect(filterPane().getByRole('combobox', { name: t.filters.scope })).toBeVisible();
    expect(
      filterPane().getByRole('checkbox', { name: t.filters.unacknowledgedByMe }),
    ).toBeVisible();
  });

  it('접힌 칸에 걸린 조건만 칩이 되고 × 가 그 조건만 풀어 다시 조회한다', async () => {
    const { listQueries, user } = setup('/notification/notices?q=점검&scopeCode=COMPANY');

    const scopeChip = await filterPane().findByRole('button', {
      name: more.remove(t.filters.scope),
    });
    expect(filterPane().getByText(t.filters.chipScope(t.scope.COMPANY))).toBeVisible();
    /* 제목은 보이는 칸이라 칩으로 겹쳐 적지 않는다. 상태는 목록 위 탭이 맡는다. */
    expect(filterPane().getAllByRole('button', { name: /조건 제거$/ })).toHaveLength(1);

    await user.click(scopeChip);

    await waitFor(() => {
      expect(listQueries.at(-1)?.searchParams.get('scopeCode')).toBeNull();
    });
    expect(listQueries.at(-1)?.searchParams.get('q')).toBe('점검');
    expect(listQueries.at(-1)?.searchParams.get('activeOnly')).toBe('true');
  });

  it('[초기화]는 처음 값과 달라진 것이 있을 때만 보인다', async () => {
    const { user } = setup();

    await waitFor(() => {
      expect(filterPane().getByRole('button', { name: more.open })).toBeVisible();
    });
    expect(filterPane().queryByRole('button', { name: messages.common.reset })).toBeNull();

    await user.type(filterPane().getByPlaceholderText(t.filters.searchPlaceholder), '점');

    expect(filterPane().getByRole('button', { name: messages.common.reset })).toBeVisible();
  });

  it('제목은 [조회]를 눌러야 조회되고, 같은 조건의 [조회]는 다시 조회한다', async () => {
    const { listQueries, user } = setup();

    await waitFor(() => {
      expect(listQueries.length).toBe(1);
    });
    await user.type(filterPane().getByPlaceholderText(t.filters.searchPlaceholder), '점검');
    expect(listQueries.length).toBe(1);

    await user.click(filterPane().getByRole('button', { name: messages.common.search }));
    await waitFor(() => {
      expect(listQueries.at(-1)?.searchParams.get('q')).toBe('점검');
    });
    const count = listQueries.length;

    await user.click(filterPane().getByRole('button', { name: messages.common.search }));
    await waitFor(() => {
      expect(listQueries.length).toBe(count + 1);
    });
  });
});

/* #361 — 「게시 중만」 체크 · 상태 선택칸 대신 목록 위 상태 탭. 기본은 종전과 같은 「게시 중」 조회다. */
describe('NoticeScreen — 상태 탭', () => {
  it('처음에는 「게시 중」 탭이고 종전과 같은 조건(activeOnly)으로 조회한다', async () => {
    const { listQueries } = setup();

    expect(await screen.findByRole('tab', { name: t.status.PUBLISHED })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await waitFor(() => {
      expect(listQueries.at(-1)?.searchParams.get('activeOnly')).toBe('true');
    });
    expect(listQueries.at(-1)?.searchParams.get('statusCode')).toBeNull();
  });

  it('다른 상태 탭은 그 상태로, 「전체」는 상태 조건 없이 조회한다', async () => {
    const { listQueries, user } = setup();

    await user.click(await screen.findByRole('tab', { name: t.status.DRAFT }));
    await waitFor(() => {
      expect(listQueries.at(-1)?.searchParams.get('statusCode')).toBe('DRAFT');
    });
    expect(listQueries.at(-1)?.searchParams.get('activeOnly')).toBeNull();

    await user.click(screen.getByRole('tab', { name: t.filters.statusTabAll }));
    await waitFor(() => {
      expect(listQueries.at(-1)?.searchParams.get('statusCode')).toBeNull();
    });
    expect(listQueries.at(-1)?.searchParams.get('activeOnly')).toBeNull();
  });
});

/* #361 — 목록 아래 쪽 이동 줄을 공용 부품으로 맞춘다. 처음 크기는 지금처럼 20건이다. */
describe('NoticeScreen — 쪽 이동', () => {
  it('0건이면 쪽 이동 줄을 내지 않는다', async () => {
    const { listQueries } = setup();

    await waitFor(() => {
      expect(listQueries.length).toBeGreaterThan(0);
    });
    expect(screen.queryByRole('navigation', { name: pn.label })).toBeNull();
  });

  it('처음에는 20건씩 조회하고, 크기를 고르면 첫 쪽으로 돌아가 그 크기로 조회한다', async () => {
    const { listQueries, user } = setup('/notification/notices?page=2', 45);

    await screen.findByRole('navigation', { name: pn.label });
    expect(listQueries.at(-1)?.searchParams.get('size')).toBe('20');
    expect(screen.getByText(pn.total(45))).toBeVisible();

    await user.click(screen.getByRole('combobox', { name: pn.pageSize }));
    await user.click(screen.getByRole('option', { name: pn.pageSizeOption(50) }));

    await waitFor(() => {
      expect(listQueries.at(-1)?.searchParams.get('size')).toBe('50');
    });
    expect(listQueries.at(-1)?.searchParams.get('page')).toBe('1');
  });
});

/* #361 — 줄 아무 곳이나 눌러 고르고, 고르면 아직 확인하지 않은 게시 중 공지만 한 번 확인으로 기록한다. */
describe('NoticeScreen — 고르기 · 확인 기록', () => {
  const noticeOf = (noticeId: number, acknowledgeRequired: boolean) => ({
    noticeId,
    title: `합성 공지 ${String(noticeId)}`,
    body: '합성 본문',
    statusCode: 'PUBLISHED',
    startDate: '2026-11-27',
    createdBy: 1,
    acknowledgeRequired,
    acknowledgedCount: 0,
    targetCount: 1,
    versionNo: 2,
    publishedAt: '2026-11-27T00:00:00Z',
    scopeCode: 'COMPANY',
    targetWorkOrderId: null,
    targetWorkOrderNo: null,
  });

  const setupWith = (unacknowledgedIds: number[]) => {
    const acknowledges: string[] = [];
    const notices = [noticeOf(1, true), noticeOf(2, false)];

    renderWithProviders(<NoticeScreen />, {
      fetch: createStubFetch([
        {
          match: (request) =>
            request.method === 'GET' && new URL(request.url).pathname === '/app/notices',
          respond: (request) => {
            const url = new URL(request.url);
            const items =
              url.searchParams.get('unacknowledgedByMe') === 'true'
                ? notices.filter((n) => unacknowledgedIds.includes(n.noticeId))
                : notices;
            return jsonResponse({ items, page: { page: 1, size: 20, total: items.length } });
          },
        },
        {
          match: (request) => /^\/app\/notices\/\d+$/.test(new URL(request.url).pathname),
          respond: (request) => {
            const id = Number(new URL(request.url).pathname.split('/').at(-1));
            return jsonResponse(notices.find((n) => n.noticeId === id));
          },
        },
        {
          match: (request) => new URL(request.url).pathname.endsWith(':acknowledge'),
          respond: (request) => {
            acknowledges.push(new URL(request.url).pathname);
            return new Response(null, { status: 204 });
          },
        },
        {
          match: (request) => new URL(request.url).pathname.endsWith('/acknowledgements'),
          respond: () => jsonResponse({ items: [], page: { page: 1, size: 50, total: 0 } }),
        },
        {
          match: (request) => new URL(request.url).pathname === '/production/work-orders',
          respond: () => jsonResponse({ items: [], page: { page: 1, size: 100, total: 0 } }),
        },
      ]),
      route: '/notification/notices',
    });

    return { acknowledges, user: userEvent.setup() };
  };

  it('줄의 아무 칸을 눌러도 고르고, 상세 제목은 「공지 상세」에 상태 라벨이 붙는다', async () => {
    const { user } = setupWith([]);

    await user.click(await screen.findByText(t.list.ackNotRequired));

    const detail = screen.getByRole('region', { name: t.panes.detail });
    expect(await within(detail).findByRole('heading', { name: t.panes.detail })).toBeVisible();
    expect(within(detail).getByText(t.status.PUBLISHED)).toBeVisible();
    expect(within(detail).queryByRole('button', { name: '확인했습니다' })).toBeNull();
  });

  it('아직 확인하지 않은 공지를 고르면 확인을 한 번만 기록한다', async () => {
    const { acknowledges, user } = setupWith([1]);

    await user.click(await screen.findByText('합성 공지 1'));

    await waitFor(() => {
      expect(acknowledges).toEqual(['/app/notices/1:acknowledge']);
    });
  });

  it('이미 확인한 공지는 다시 기록하지 않는다 — 확인 일시가 덮어써지면 안 된다', async () => {
    const { acknowledges, user } = setupWith([]);

    await user.click(await screen.findByText('합성 공지 1'));
    await screen.findByRole('heading', { name: t.panes.detail });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(acknowledges).toEqual([]);
  });
});
