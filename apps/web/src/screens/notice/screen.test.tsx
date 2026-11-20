import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { NoticeScreen } from './screen';

const t = messages.notice;
const more = messages.common.filterMore;

/** 목록은 비워 둔다 — 여기서 재는 것은 조회 조건 줄이고, 나간 조건은 요청 주소로 본다. */
const setup = (route = '/notification/notices') => {
  const listQueries: URL[] = [];

  renderWithProviders(<NoticeScreen />, {
    fetch: createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/app/notices',
        respond: (request) => {
          listQueries.push(new URL(request.url));
          return jsonResponse({ items: [], page: { page: 1, size: 20, total: 0 } });
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

const listPane = () => within(screen.getByRole('region', { name: t.panes.list }));

describe('NoticeScreen — 조회 조건(C-6)', () => {
  it('대상 범위와 체크칸 둘은 조건 더보기 안에 접혀 있다', async () => {
    const { user } = setup();

    await waitFor(() => {
      expect(listPane().getByRole('button', { name: more.open })).toBeVisible();
    });
    expect(listPane().queryByRole('combobox', { name: t.filters.scope })).toBeNull();
    expect(listPane().queryByRole('checkbox', { name: t.filters.activeOnly })).toBeNull();

    await user.click(listPane().getByRole('button', { name: more.open }));

    expect(listPane().getByRole('combobox', { name: t.filters.scope })).toBeVisible();
    expect(listPane().getByRole('checkbox', { name: t.filters.activeOnly })).toBeChecked();
    expect(listPane().getByRole('checkbox', { name: t.filters.unacknowledgedByMe })).toBeVisible();
  });

  /* 「게시 중만」은 기본이 켜짐이다 — 접혀서도 끝난 공지가 왜 안 보이는지 드러나야 한다. */
  it('접힌 칸에 걸린 조건만 칩이 되고 × 가 그 조건만 풀어 다시 조회한다', async () => {
    const { listQueries, user } = setup('/notification/notices?q=점검&scopeCode=COMPANY');

    const scopeChip = await listPane().findByRole('button', { name: more.remove(t.filters.scope) });
    expect(listPane().getByText(t.filters.chipScope(t.scope.COMPANY))).toBeVisible();
    expect(
      listPane().getByRole('button', { name: more.remove(t.filters.activeOnly) }),
    ).toBeVisible();
    /* 제목은 보이는 칸이라 칩으로 겹쳐 적지 않는다. */
    expect(listPane().getAllByRole('button', { name: /조건 제거$/ })).toHaveLength(2);

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
      expect(listPane().getByRole('button', { name: more.open })).toBeVisible();
    });
    expect(listPane().queryByRole('button', { name: t.filters.clear })).toBeNull();

    await user.type(listPane().getByPlaceholderText(t.filters.searchPlaceholder), '점');

    expect(listPane().getByRole('button', { name: t.filters.clear })).toBeVisible();
  });
});
