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
  /* 「새 공지 쓰기」는 화면 제목 줄에서 조회 조건 상자로 옮겼다(#350) — 공지 등록으로 들어가는 단추다. */
  it('조회 조건 상자의 「새 공지 쓰기」를 누르면 등록 폼이 상세 자리에 선다', async () => {
    const { user } = setup();

    await user.click(await filterPane().findByRole('button', { name: t.form.create }));

    const detail = screen.getByRole('region', { name: t.panes.detail });
    expect(within(detail).getByRole('heading', { name: t.form.create })).toBeVisible();
    expect(within(detail).getByLabelText(t.form.title)).toBeVisible();
  });

  it('대상 범위와 체크칸 둘은 조건 더보기 안에 접혀 있다', async () => {
    const { user } = setup();

    await waitFor(() => {
      expect(filterPane().getByRole('button', { name: more.open })).toBeVisible();
    });
    expect(filterPane().queryByRole('combobox', { name: t.filters.scope })).toBeNull();
    expect(filterPane().queryByRole('checkbox', { name: t.filters.activeOnly })).toBeNull();

    await user.click(filterPane().getByRole('button', { name: more.open }));

    expect(filterPane().getByRole('combobox', { name: t.filters.scope })).toBeVisible();
    expect(filterPane().getByRole('checkbox', { name: t.filters.activeOnly })).toBeChecked();
    expect(
      filterPane().getByRole('checkbox', { name: t.filters.unacknowledgedByMe }),
    ).toBeVisible();
  });

  /* 「게시 중만」은 기본이 켜짐이다 — 접혀서도 끝난 공지가 왜 안 보이는지 드러나야 한다. */
  it('접힌 칸에 걸린 조건만 칩이 되고 × 가 그 조건만 풀어 다시 조회한다', async () => {
    const { listQueries, user } = setup('/notification/notices?q=점검&scopeCode=COMPANY');

    const scopeChip = await filterPane().findByRole('button', {
      name: more.remove(t.filters.scope),
    });
    expect(filterPane().getByText(t.filters.chipScope(t.scope.COMPANY))).toBeVisible();
    expect(
      filterPane().getByRole('button', { name: more.remove(t.filters.activeOnly) }),
    ).toBeVisible();
    /* 제목은 보이는 칸이라 칩으로 겹쳐 적지 않는다. */
    expect(filterPane().getAllByRole('button', { name: /조건 제거$/ })).toHaveLength(2);

    await user.click(scopeChip);

    await waitFor(() => {
      expect(listQueries.at(-1)?.searchParams.get('scopeCode')).toBeNull();
    });
    expect(listQueries.at(-1)?.searchParams.get('q')).toBe('점검');
    expect(listQueries.at(-1)?.searchParams.get('activeOnly')).toBe('true');
  });

  it('조건 지우기는 처음 값과 달라진 것이 있을 때만 보인다', async () => {
    const { user } = setup();

    await waitFor(() => {
      expect(filterPane().getByRole('button', { name: more.open })).toBeVisible();
    });
    expect(filterPane().queryByRole('button', { name: t.filters.clear })).toBeNull();

    await user.type(filterPane().getByPlaceholderText(t.filters.searchPlaceholder), '점');

    expect(filterPane().getByRole('button', { name: t.filters.clear })).toBeVisible();
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
