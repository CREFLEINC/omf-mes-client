import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../test/api-harness';
import { PopIdentityProvider, UNKNOWN_POP_IDENTITY } from './pop-identity';
import { PopScreenNav } from './pop-screen-nav';
import { POP_WORK_COUNT_INTERVAL_MS } from './pop-work-counts';

type TerminalWorkCounts = components['schemas']['TerminalWorkCounts'];

const nav = messages.popChrome.nav;
const remaining = messages.popChrome.remaining;
const header = messages.popChrome.header;

const SESSION = {
  userId: 1001,
  loginId: 'pop.terminal',
  userName: '합성 단말',
  scopes: [{ businessUnitId: 1001 }],
  /* 자재 1 · 생산 3 · 출하 2 · 품질 1 — 설비·창고 화면은 없다. */
  permissions: ['P-01-01', 'P-02-01', 'P-02-03', 'P-02-12', 'P-04-01', 'P-04-03', 'P-04-06'],
};

const COUNTS: TerminalWorkCounts = {
  shipmentPacking: 4,
  workStart: 3,
  emergencyWorkOrder: 1,
  reworkResult: 0,
  oqcInspection: 12,
};

/** 지금 주소(인자 포함) — 이동이 실제로 일어났는지 잰다. */
const Here = () => {
  const { pathname, search } = useLocation();
  return <p>지금: {`${pathname}${search}`}</p>;
};

const setup = (
  options: {
    session?: unknown;
    sessionStatus?: number;
    counts?: TerminalWorkCounts | 'fail';
    workerNo?: string | null;
    route?: string;
  } = {},
) => {
  const counted: Request[] = [];
  renderWithProviders(
    <PopIdentityProvider
      value={{
        ...UNKNOWN_POP_IDENTITY,
        workerNo: options.workerNo === undefined ? '2048' : options.workerNo,
      }}
    >
      <PopScreenNav terminalCode="POP-OA-01" />
      <Here />
    </PopIdentityProvider>,
    {
      fetch: createStubFetch([
        {
          match: (request) => request.url.endsWith('/app/sessions/current'),
          respond: () =>
            jsonResponse(options.session ?? SESSION, { status: options.sessionStatus ?? 200 }),
        },
        {
          match: (request) => new URL(request.url).pathname === '/production/work-orders/7801',
          respond: () => jsonResponse({ workOrderId: 7801, workOrderNo: 'WO-SYN-7801' }),
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
      route: options.route ?? '/pop/material-input',
    },
  );
  return { counted };
};

const groupsNav = () => screen.getByRole('navigation', { name: nav.groupsLabel });

/** 묶음 이름으로 단추를 찾는다 — 남은 작업이 있으면 접근 이름에 수가 붙는다. */
const groupButton = (name: string) =>
  within(groupsNav()).getByRole('button', { name: new RegExp(`^${name}`, 'u') });

const remainingButton = async () => {
  const button = await screen.findByRole('button', { name: /^남은 작업 \d+건$/u });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
};

afterEach(() => {
  vi.useRealTimers();
});

describe('PopScreenNav — 공통 이동 메뉴(#291)', () => {
  /* 사번 칩이 곧 [사용자 전환] 버튼이다(사용자 지시 2026-11-17 · #291). */
  it('맨 위 줄에 단말·사번 버튼이 서고, 사번을 누르면 사용자 전환으로 간다', async () => {
    const user = userEvent.setup();
    setup();

    expect(screen.getByText(header.terminalLabel('POP-OA-01'))).toBeInTheDocument();
    expect(screen.getByText(header.workerLabel('2048', null))).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: new RegExp(`^${messages.popChrome.userSwitch}`, 'u') }),
    );
    expect(screen.getByText('지금: /pop/worker-assignment')).toBeInTheDocument();
  });

  /* 작업 단계 화면(자재 투입 등)은 탭에 두지 않고 작업 지시 목록 탭 아래 단계 줄이 연다(#291 · 사용자 승인 2026-11-17). */
  it('갈 수 있는 화면이 있는 묶음만 서고, 단계 화면에서는 작업 지시 목록 탭과 단계 줄이 지금 자리를 표시한다', async () => {
    setup();

    const tabs = await screen.findByRole('navigation', { name: nav.screensLabel('생산') });
    expect(
      within(groupsNav())
        .getAllByRole('button')
        .map((button) => button.textContent?.replace(/\d+\+?$/u, '')),
    ).toEqual(['홈', '자재', '생산', '품질', '출하']);
    expect(
      within(tabs)
        .getAllByRole('button')
        .map((tab) => tab.textContent?.replace(/\d+\+?$/u, '')),
    ).toEqual(['작업 지시 목록', '긴급 W/O']);
    expect(within(tabs).getByRole('button', { name: /^작업 지시 목록/u })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const steps = screen.getByRole('list', { name: messages.popChrome.workSteps.label });
    expect(within(steps).getByRole('button', { name: /자재 투입/u })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(groupButton('생산')).toHaveAttribute('aria-pressed', 'true');
  });

  it('묶음을 누르면 그 묶음의 첫 탭 화면으로 가고, 지금 묶음을 다시 누르면 그대로다', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole('navigation', { name: nav.screensLabel('생산') });

    await user.click(groupButton('생산'));
    expect(screen.getByText('지금: /pop/material-input')).toBeInTheDocument();

    await user.click(groupButton('출하'));

    const tabs = screen.getByRole('navigation', { name: nav.screensLabel('출하') });
    const firstTab = within(tabs).getAllByRole('button')[0];
    expect(firstTab).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText('지금: /pop/material-input')).not.toBeInTheDocument();

    await user.click(within(tabs).getByRole('button', { name: /^재작업 실적 등록/u }));
    expect(screen.getByText('지금: /pop/rework-results')).toBeInTheDocument();
  });

  it('[홈]을 누르면 홈으로 간다', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(await screen.findByRole('button', { name: nav.home }));
    expect(screen.getByText('지금: /pop/home')).toBeInTheDocument();
  });

  it('단계 줄은 고른 W/O 를 다음 단계로 실어 주며(번호는 박스에 보이는 자재 투입·생산 작업에선 숨긴다), 작업지시를 받지 않는 탭에는 싣지 않는다', async () => {
    const user = userEvent.setup();
    setup({
      session: { ...SESSION, permissions: ['P-02-01', 'P-02-03', 'P-02-04', 'P-02-12'] },
      route: '/pop/material-input?workOrderId=7801',
    });

    const steps = await screen.findByRole('list', { name: messages.popChrome.workSteps.label });
    expect(screen.queryByText('WO-SYN-7801')).toBeNull();
    await user.click(within(steps).getByRole('button', { name: /생산 작업/u }));
    expect(screen.getByText('지금: /pop/production-result?workOrderId=7801')).toBeInTheDocument();

    await user.click(
      within(screen.getByRole('navigation', { name: nav.screensLabel('생산') })).getByRole(
        'button',
        { name: /^긴급 W\/O/u },
      ),
    );
    expect(screen.getByText('지금: /pop/emergency-work-orders')).toBeInTheDocument();
  });

  it('작업지시를 고르기 전(작업 지시 목록)에는 다음 단계와 작업 중 화면 버튼이 잠긴다', async () => {
    setup({
      session: { ...SESSION, permissions: ['P-02-01', 'P-02-03', 'P-02-04', 'P-02-10'] },
      route: '/pop/work-start',
    });

    const steps = await screen.findByRole('list', { name: messages.popChrome.workSteps.label });
    expect(
      within(steps).getByRole('button', {
        name: new RegExp(messages.popChrome.workSteps.pickWorkOrder, 'u'),
      }),
    ).toHaveAttribute('aria-current', 'step');
    expect(within(steps).getByRole('button', { name: /자재 투입/u })).toBeDisabled();
    expect(within(steps).getByRole('button', { name: /생산 작업/u })).toBeDisabled();
    expect(screen.getByRole('button', { name: '작업 중단' })).toBeDisabled();
  });

  it('묶음·탭에 남은 수가 붙고 숨은 글이 실제 수를 읽는다', async () => {
    const user = userEvent.setup();
    const { counted } = setup();
    await waitFor(() => expect(counted).toHaveLength(1));

    expect(
      await within(groupsNav()).findByRole('button', { name: nav.groupCount('생산', 4) }),
    ).toBeInTheDocument();
    expect(groupButton('품질')).toHaveAccessibleName(nav.groupCount('품질', 12));

    await user.click(groupButton('품질'));
    const tab = within(
      screen.getByRole('navigation', { name: nav.screensLabel('품질') }),
    ).getByRole('button', { name: remaining.count('OQC 출하검사 판정', 12) });
    expect(within(tab).getByText('9+')).toBeInTheDocument();
  });

  it('[남은 작업] 창은 수가 있는 화면만 많은 순으로 보이고, 누르면 그 화면으로 간다', async () => {
    const user = userEvent.setup();
    const { counted } = setup();
    await waitFor(() => expect(counted).toHaveLength(1));

    const button = await screen.findByRole('button', { name: remaining.buttonLabel(20) });
    await user.click(button);

    const dialog = within(screen.getByRole('dialog', { name: remaining.title(20) }));
    expect(
      dialog
        .getAllByRole('button')
        .filter((item) => item.classList.contains('pop-remaining__item'))
        .map((item) => item.getAttribute('aria-label')),
    ).toEqual([
      remaining.count('OQC 출하검사 판정', 12),
      remaining.count('출하 포장', 4),
      remaining.count('작업 지시 목록', 3),
      remaining.count('긴급 W/O', 1),
    ]);

    await user.click(dialog.getByRole('button', { name: remaining.count('출하 포장', 4) }));
    expect(screen.getByText('지금: /pop/packing')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('[남은 작업] 창은 닫기·Esc 로 닫힌다', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(await remainingButton());
    await user.click(screen.getByRole('button', { name: remaining.close }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(await remainingButton());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('수를 못 받으면 배지 없이 「남은 작업이 없습니다」로 선다', async () => {
    const user = userEvent.setup();
    const { counted } = setup({ counts: 'fail' });
    await waitFor(() => expect(counted.length).toBeGreaterThan(0));

    await user.click(await screen.findByRole('button', { name: remaining.buttonLabel(0) }));
    expect(screen.getByText(remaining.none)).toBeInTheDocument();
    expect(document.querySelector('.pop-work-badge')).toBeNull();
  });

  it('60초마다, 그리고 [남은 작업] 창을 열 때 다시 센다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const { counted } = setup();

    await waitFor(() => expect(counted).toHaveLength(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POP_WORK_COUNT_INTERVAL_MS);
    });
    await waitFor(() => expect(counted).toHaveLength(2));
    await user.click(await remainingButton());
    await waitFor(() => expect(counted).toHaveLength(3));
  });

  it('사번이 확인되기 전에는 수를 묻지 않는다', async () => {
    const { counted } = setup({ workerNo: null });

    await remainingButton();
    expect(counted).toHaveLength(0);
    expect(screen.getByText(header.workerUnset)).toBeInTheDocument();
  });

  it('권한 목록을 못 받으면 사유를 보이고 [남은 작업]을 막는다', async () => {
    setup({ session: { ...SESSION, permissions: undefined } });

    expect(await screen.findByText(nav.unknown)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: remaining.buttonLabel(0) })).toBeDisabled();
  });

  it('갈 수 있는 화면이 없으면 그 사유를 보인다', async () => {
    setup({ session: { ...SESSION, permissions: [] } });

    expect(await screen.findByText(nav.empty)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: remaining.buttonLabel(0) })).toBeDisabled();
  });

  it('진입 화면(사번 입력)에서는 서지 않는다', async () => {
    setup({ route: '/pop/worker-assignment' });

    await waitFor(() => {
      expect(screen.getByText('지금: /pop/worker-assignment')).toBeInTheDocument();
    });
    expect(screen.queryByRole('navigation', { name: nav.groupsLabel })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: messages.popChrome.userSwitch }),
    ).not.toBeInTheDocument();
  });
});
