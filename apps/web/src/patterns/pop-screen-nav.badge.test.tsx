import type { TerminalWorkCounts } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../test/api-harness';
import { PopIdentityProvider, UNKNOWN_POP_IDENTITY } from './pop-identity';
import { PopScreenNavButton } from './pop-screen-nav';
import { POP_WORK_COUNT_INTERVAL_MS } from './pop-work-counts';

const work = messages.popChrome.screenNavWork;

const SESSION = {
  userId: 1001,
  loginId: 'pop.terminal',
  userName: '합성 단말',
  scopes: [{ businessUnitId: 1001 }],
  /* 일곱 화면 — 한 쪽(다섯 줄)을 넘어 뒤쪽 화면의 수는 넘겨야 보인다. */
  permissions: ['P-01-01', 'P-02-01', 'P-02-03', 'P-02-12', 'P-04-01', 'P-04-03', 'P-04-06'],
};

const COUNTS: TerminalWorkCounts = {
  shipmentPacking: 4,
  workStart: 3,
  emergencyWorkOrder: 1,
  reworkResult: 0,
  oqcInspection: 12,
};

const Here = () => {
  const { pathname } = useLocation();
  return <p>지금: {pathname}</p>;
};

const setup = (
  options: { counts?: TerminalWorkCounts | 'fail'; workerNo?: string | null } = {},
) => {
  const counted: Request[] = [];
  renderWithProviders(
    <PopIdentityProvider
      value={{
        ...UNKNOWN_POP_IDENTITY,
        workerNo: options.workerNo === undefined ? '2048' : options.workerNo,
      }}
    >
      <PopScreenNavButton />
      <Here />
    </PopIdentityProvider>,
    {
      fetch: createStubFetch([
        {
          match: (request) => request.url.endsWith('/app/sessions/current'),
          respond: () => jsonResponse(SESSION),
        },
        {
          match: (request) => new URL(request.url).pathname === '/app/terminal-work-counts',
          respond: (request) => {
            counted.push(request);
            return options.counts === 'fail'
              ? jsonResponse({ message: '' }, { status: 503 })
              : jsonResponse(options.counts ?? COUNTS);
          },
        },
      ]),
      route: '/pop/material-input',
    },
  );
  return { counted };
};

const openNav = async (user: ReturnType<typeof userEvent.setup>) => {
  const trigger = await screen.findByRole('combobox', { name: messages.popChrome.screenNav });
  await waitFor(() => expect(trigger).toBeEnabled());
  await user.click(trigger);
  return screen.getByRole('dialog');
};

afterEach(() => {
  vi.useRealTimers();
});

describe('PopScreenNavButton — 남은 작업 배지(피처 002)', () => {
  it('US3-6 창 맨 위 「남은 작업」 묶음에 수가 있는 화면만, 접근 이름에 실제 수', async () => {
    const user = userEvent.setup();
    const { counted } = setup();
    await waitFor(() => expect(counted).toHaveLength(1));

    const dialog = within(await openNav(user));
    const lead = within(dialog.getByRole('region', { name: work.title }));
    expect(lead.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      work.count('작업 지시 목록', 3),
      work.count('긴급 W/O', 1),
      work.count('출하 포장', 4),
      work.count('OQC 출하검사 판정', 12),
    ]);
    /* 0건인 재작업 실적은 묶음에 없다. */
    expect(lead.queryByRole('button', { name: /재작업 실적 등록/ })).toBeNull();
    expect(
      within(lead.getByRole('button', { name: work.count('OQC 출하검사 판정', 12) })).getByText(
        '9+',
      ),
    ).toBeInTheDocument();
  });

  it('US3-6 목록 항목 끝에도 그 수가 붙고 숨은 글이 실제 수를 읽는다', async () => {
    const user = userEvent.setup();
    const { counted } = setup();
    await waitFor(() => expect(counted).toHaveLength(1));

    const dialog = within(await openNav(user));
    const start = dialog.getByRole('option', { name: `작업 지시 목록${work.suffix(3)}` });
    expect(within(start).getByText('3')).toBeInTheDocument();
    expect(dialog.getByRole('option', { name: '자재 LOT 라벨 발행' })).toBeInTheDocument();
  });

  it('묶음의 화면을 누르면 그 화면으로 바로 간다', async () => {
    const user = userEvent.setup();
    const { counted } = setup();
    await waitFor(() => expect(counted).toHaveLength(1));

    const dialog = within(await openNav(user));
    await user.click(dialog.getByRole('button', { name: work.count('출하 포장', 4) }));

    expect(screen.getByText('지금: /pop/packing')).toBeInTheDocument();
  });

  it('남은 작업이 있으면 [화면 이동] 단추에 점, 이름은 그대로이고 설명으로 읽는다', async () => {
    setup();

    const trigger = await screen.findByRole('combobox', { name: messages.popChrome.screenNav });
    await waitFor(() => expect(trigger).toHaveAccessibleDescription(work.trigger));
    expect(trigger.querySelector('.pop-work-dot')).not.toBeNull();
  });

  it('FR-018 모두 0이거나 조회가 실패하면 점·묶음·배지를 그리지 않는다', async () => {
    const user = userEvent.setup();
    const { counted } = setup({ counts: 'fail' });
    await waitFor(() => expect(counted).toHaveLength(1));

    const trigger = screen.getByRole('combobox', { name: messages.popChrome.screenNav });
    expect(trigger.querySelector('.pop-work-dot')).toBeNull();
    const dialog = within(await openNav(user));
    expect(dialog.queryByRole('region', { name: work.title })).toBeNull();
    expect(dialog.getByRole('option', { name: '작업 지시 목록' })).toBeInTheDocument();
  });

  it('모두 0 이면 묶음도 점도 없다', async () => {
    const user = userEvent.setup();
    const { counted } = setup({
      counts: {
        shipmentPacking: 0,
        workStart: 0,
        emergencyWorkOrder: 0,
        reworkResult: 0,
        oqcInspection: 0,
      },
    });
    await waitFor(() => expect(counted).toHaveLength(1));

    const dialog = within(await openNav(user));
    expect(dialog.queryByRole('region', { name: work.title })).toBeNull();
    expect(dialog.getByRole('option', { name: '작업 지시 목록' })).toBeInTheDocument();
  });

  it('SC-002 열려 있는 동안 60초마다, 창을 열 때 다시 센다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const { counted } = setup();

    await waitFor(() => expect(counted).toHaveLength(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POP_WORK_COUNT_INTERVAL_MS);
    });
    await waitFor(() => expect(counted).toHaveLength(2));
    await openNav(user);
    await waitFor(() => expect(counted).toHaveLength(3));
  });

  it('사번이 확인되기 전에는 수를 묻지 않는다', async () => {
    const { counted } = setup({ workerNo: null });

    const trigger = await screen.findByRole('combobox', { name: messages.popChrome.screenNav });
    await waitFor(() => expect(trigger).toBeEnabled());
    expect(counted).toHaveLength(0);
  });
});
