import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { ToolPmOrderScreen } from './screen';

const t = messages.toolPmOrder;
const more = messages.common.filterMore;

const EMPTY_PAGE = { items: [], page: { page: 1, size: 50, total: 0 } };

/** 목록은 비워 둔다 — 여기서 재는 것은 조회 조건 줄이고, 나간 조건은 요청 주소로 본다. */
const setup = (route = '/equipment/tool-pm-order') => {
  const moldQueries: URL[] = [];

  renderWithProviders(<ToolPmOrderScreen />, {
    fetch: createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/mdm/molds',
        respond: (request) => {
          moldQueries.push(new URL(request.url));
          return jsonResponse(EMPTY_PAGE);
        },
      },
      {
        match: (request) => ['/mdm/plants', '/app/users'].includes(new URL(request.url).pathname),
        respond: () => jsonResponse(EMPTY_PAGE),
      },
    ]),
    route,
  });

  return { moldQueries, user: userEvent.setup() };
};

const filterPane = () => within(screen.getByRole('region', { name: t.panes.filters }));

describe('ToolPmOrderScreen — 조회 조건(C-6)', () => {
  it('체크칸 셋은 조건 더보기 안에 접혀 있다', async () => {
    const { user } = setup();

    expect(filterPane().queryByRole('checkbox', { name: t.filters.guaranteedMissing })).toBeNull();

    await user.click(filterPane().getByRole('button', { name: more.open }));

    expect(filterPane().getAllByRole('checkbox')).toHaveLength(3);
  });

  /* 기본이 켜진 두 조건은 접혀서도 칩으로 보인다 — 무엇으로 좁혀 보고 있는지가 드러난다. */
  it('접힌 체크칸에 걸린 조건이 칩이 되고 × 가 그 조건만 풀어 다시 조회한다', async () => {
    const { moldQueries, user } = setup();

    await waitFor(() => {
      expect(moldQueries.length).toBeGreaterThan(0);
    });
    expect(filterPane().getAllByRole('button', { name: /조건 제거$/ })).toHaveLength(2);

    await user.click(filterPane().getByRole('button', { name: more.remove(t.filters.dueOnly) }));

    await waitFor(() => {
      expect(moldQueries.at(-1)?.searchParams.get('pmDueOnly')).toBeNull();
    });
    expect(moldQueries.at(-1)?.searchParams.get('withOpenMaintenanceOrder')).toBe('false');
  });

  it('초기화는 처음 값과 다를 때만 보인다', async () => {
    const { user } = setup();

    expect(filterPane().queryByRole('button', { name: t.filters.reset })).toBeNull();

    await user.click(filterPane().getByRole('button', { name: more.remove(t.filters.dueOnly) }));

    expect(await filterPane().findByRole('button', { name: t.filters.reset })).toBeVisible();
  });
});
