import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../test/api-harness';
import { PopIdentityProvider, UNKNOWN_POP_IDENTITY } from './pop-identity';
import { POP_SCREENS } from './pop-screen-catalog';
import { PopScreenNav, destinationOf, formatRefreshedAt } from './pop-screen-nav';
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
  /*
   * 자재 1 · 생산 3(재작업 실적 등록 포함 · #295) · 출하 1(출하 완료 · 피처 010) · 품질 1 — 설비·창고 화면은 없다.
   * 감춘 출하 포장(P-04-01) 권한도 남겨 두어, 권한이 있어도 탭·남은 작업에 서지 않는지 잰다.
   */
  permissions: ['P-01-01', 'P-02-01', 'P-02-03', 'P-04-01', 'P-04-03', 'P-04-06', 'P-04-07'],
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
    plantId?: number | null;
    extra?: Parameters<typeof createStubFetch>[0];
  } = {},
) => {
  const counted: Request[] = [];
  renderWithProviders(
    <PopIdentityProvider
      value={{
        ...UNKNOWN_POP_IDENTITY,
        workerNo: options.workerNo === undefined ? '2048' : options.workerNo,
        plantId: options.plantId ?? null,
      }}
    >
      <PopScreenNav terminalCode="POP-OA-01" />
      <Here />
    </PopIdentityProvider>,
    {
      fetch: createStubFetch([
        ...(options.extra ?? []),
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
          /* 단말에 열린 W/O 가 아니면(마감 등) 서버는 상세를 401 로 거절한다 — 단말 읽기 규칙. */
          match: (request) => new URL(request.url).pathname === '/production/work-orders/7803',
          respond: () => jsonResponse({ message: '단말 인증 범위 밖입니다.' }, { status: 401 }),
        },
        {
          match: (request) => new URL(request.url).pathname === '/production/work-orders/7802',
          respond: () =>
            jsonResponse({ workOrderId: 7802, workOrderNo: 'WO-SYN-7802', statusCode: 'CLOSED' }),
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
    expect(screen.getByText('지금: /pop/home')).toBeInTheDocument();
  });

  /* 작업 단계 화면(자재 투입 등)은 탭에 두지 않고 작업 지시 목록 탭 아래 단계 줄이 연다(#291 · 사용자 승인 2026-11-17). */
  it('갈 수 있는 화면이 있는 묶음만 서고, 단계 화면에서는 작업 지시 목록 탭과 단계 줄이 지금 자리를 표시한다', async () => {
    setup();

    const tabs = await screen.findByRole('navigation', { name: nav.screensLabel('생산') });
    expect(
      within(groupsNav())
        .getAllByRole('button')
        .map((button) => button.textContent?.replace(/\d+\+?$/u, '')),
    ).toEqual(['홈', '창고', '생산', '품질', '출하']);
    expect(
      within(tabs)
        .getAllByRole('button')
        .map((tab) => tab.textContent?.replace(/\d+\+?$/u, '')),
      /* 재작업 실적 등록은 생산 묶음이다(#295) — 작업지시 목록 다음. */
    ).toEqual(['작업지시 목록', '재작업 실적 등록']);
    expect(within(tabs).getByRole('button', { name: /^작업지시 목록/u })).toHaveAttribute(
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

    /* 출하 묶음의 탭은 출하 완료뿐이다 — 감춘 출하 포장(P-04-01)은 권한이 있어도 서지 않는다(피처 010). */
    expect(
      within(tabs)
        .getAllByRole('button')
        .map((tab) => tab.textContent),
    ).toEqual([expect.stringMatching(/^출하 완료/u)]);
    expect(screen.getByText('지금: /pop/shipment-complete')).toBeInTheDocument();
    /* 재작업 실적 등록은 출하가 아니라 생산 묶음에 선다(#295). */
    expect(within(tabs).queryByRole('button', { name: /^재작업 실적 등록/u })).toBeNull();
  });

  it('[새로고침]은 화면을 다시 읽지 않고 자료만 다시 받는다', async () => {
    const user = userEvent.setup();
    const { counted } = setup({ route: '/pop/material-input?workOrderId=7801' });
    await waitFor(() => expect(counted).toHaveLength(1));

    await user.click(
      screen.getByRole('button', { name: new RegExp(messages.popChrome.refresh, 'u') }),
    );

    await waitFor(() => expect(counted).toHaveLength(2));
    expect(screen.getByText('지금: /pop/material-input?workOrderId=7801')).toBeInTheDocument();
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
      session: { ...SESSION, permissions: ['P-02-01', 'P-02-03', 'P-02-04'] },
      route: '/pop/material-input?workOrderId=7801',
    });

    const steps = await screen.findByRole('list', { name: messages.popChrome.workSteps.label });
    expect(screen.queryByText('WO-SYN-7801')).toBeNull();
    await user.click(within(steps).getByRole('button', { name: /생산 작업/u }));
    expect(screen.getByText('지금: /pop/production-result?workOrderId=7801')).toBeInTheDocument();

    await user.click(
      within(screen.getByRole('navigation', { name: nav.screensLabel('생산') })).getByRole(
        'button',
        { name: /^작업지시 목록/u },
      ),
    );
    expect(screen.getByText('지금: /pop/work-start')).toBeInTheDocument();
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

  it('마감된 W/O 에서는 작업 중 화면 버튼이 잠긴다', async () => {
    const permissions = ['P-02-01', 'P-02-03', 'P-02-10', 'P-02-11'];
    setup({ session: { ...SESSION, permissions }, route: '/pop/work-start?workOrderId=7802' });
    await waitFor(() => expect(screen.getByRole('button', { name: '작업 중단' })).toBeDisabled());
    expect(await screen.findByText('WO-SYN-7802')).toBeInTheDocument();
  });

  it('서버가 열린 W/O 로 보이지 않는(401) W/O 에서도 작업 중 화면 버튼이 잠긴다', async () => {
    const permissions = ['P-02-01', 'P-02-03', 'P-02-10', 'P-02-11'];
    setup({ session: { ...SESSION, permissions }, route: '/pop/running-change?workOrderId=7803' });
    await waitFor(() => expect(screen.getByRole('button', { name: '작업 중단' })).toBeDisabled());
  });

  it('열린 W/O 에서는 작업 중 화면 버튼이 열린다', async () => {
    const permissions = ['P-02-01', 'P-02-03', 'P-02-10', 'P-02-11'];
    setup({ session: { ...SESSION, permissions }, route: '/pop/work-start?workOrderId=7801' });
    expect(await screen.findByText('WO-SYN-7801')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '작업 중단' })).toBeEnabled();
  });

  it('묶음·탭에 남은 수가 붙고 숨은 글이 실제 수를 읽는다', async () => {
    const user = userEvent.setup();
    const { counted } = setup();
    await waitFor(() => expect(counted).toHaveLength(1));

    expect(
      /* 긴급 작업지시는 작업지시 목록에 합쳐(#295) 따로 세지 않는다 — 서버가 준 긴급 수 1 을 더하지 않는다. */
      await within(groupsNav()).findByRole('button', { name: nav.groupCount('생산', 3) }),
    ).toBeInTheDocument();
    expect(groupButton('품질')).toHaveAccessibleName(nav.groupCount('품질', 12));

    await user.click(groupButton('품질'));
    const tab = within(
      screen.getByRole('navigation', { name: nav.screensLabel('품질') }),
    ).getByRole('button', { name: remaining.count('OQC 출하검사', 12) });
    /* 탭 건수는 수 그대로(#295 시안 「창고 29」) — 「9+」로 줄이지 않는다. */
    expect(within(tab).getByText('12')).toBeInTheDocument();
  });

  /*
   * #295 시안 — 남은 작업 수가 없는 화면도 그 화면 대기 건수를 탭에 붙이고, 묶음 수는 탭 수의 합이다.
   * 피처 010 — 출하 단위 구성(P-04-05)은 감춘 화면이라 권한이 있어도 그 수를 묻지 않는다.
   */
  it('창고 화면 탭에 대기 건수가 붙고 묶음 수는 탭 합이며(감춘 출하 단위 구성은 묻지 않는다), 남은 작업 창 수는 그대로다', async () => {
    const user = userEvent.setup();
    const asked: string[] = [];
    const path = (request: Request) => new URL(request.url).pathname;
    setup({
      plantId: 2,
      session: { ...SESSION, permissions: [...SESSION.permissions, 'P-01-02', 'P-04-05'] },
      extra: [
        {
          match: (request) => path(request) === '/logistics/waiting-material-lots',
          respond: (request) => {
            asked.push(request.url);
            return jsonResponse({ items: [{ waitingCount: 20 }, { waitingCount: 6 }] });
          },
        },
        {
          match: (request) => path(request) === '/logistics/split-material-lots',
          respond: (request) => {
            asked.push(request.url);
            return jsonResponse({
              items: [],
              page: { page: 1, size: 1, total: 3 },
              unprintedCount: 3,
            });
          },
        },
        {
          match: (request) => path(request) === '/logistics/shipments',
          respond: (request) => {
            asked.push(request.url);
            return jsonResponse({ items: [], page: { page: 1, size: 1, total: 2 } });
          },
        },
      ],
    });

    expect(
      await within(groupsNav()).findByRole('button', { name: nav.groupCount('창고', 29) }),
    ).toBeInTheDocument();
    expect(asked.some((url) => url.includes('plantId=2'))).toBe(true);
    expect(asked.some((url) => url.includes('labelState=UNPRINTED'))).toBe(true);
    expect(asked.some((url) => url.includes('hasUnassignedPackedBox=true'))).toBe(false);

    await user.click(groupButton('창고'));
    const tabs = within(screen.getByRole('navigation', { name: nav.screensLabel('창고') }));
    expect(
      tabs.getByRole('button', { name: remaining.count('자재 관리 LOT 라벨', 26) }),
    ).toBeInTheDocument();
    expect(
      tabs.getByRole('button', { name: remaining.count('분할 LOT 라벨', 3) }),
    ).toBeInTheDocument();
    /*
     * 남은 작업 창은 남은 작업 수(`/app/terminal-work-counts`)만 — 3 + 12(긴급 수는 작업지시 목록에 합쳐,
     * 감춘 출하 포장 수 4 는 빠진다).
     */
    expect(
      await screen.findByRole('button', { name: remaining.buttonLabel(15) }),
    ).toBeInTheDocument();
  });

  it('갱신 시각은 「MM-DD HH:mm:ss」다', () => {
    expect(formatRefreshedAt(new Date(2026, 10, 9, 8, 7, 6))).toBe('11-09 08:07:06');
  });

  it('[새로고침] 오른쪽에 갱신 시각이 서고, 누르면 화면 자료를 다시 받는다', async () => {
    const user = userEvent.setup();
    const { counted } = setup();
    await waitFor(() => expect(counted).toHaveLength(1));
    const stamp = () =>
      screen.getByText(
        (_, element) =>
          element?.classList.contains('pop-nav-top__refreshed') === true &&
          /^갱신 \d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(element.textContent),
      );
    expect(stamp()).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.popChrome.refresh }));
    await waitFor(() => expect(counted).toHaveLength(2));
    expect(stamp()).toBeInTheDocument();
  });

  it('[종료]는 확인 창을 거친다 — [취소]는 닫기만, [종료]는 POP 앱이면 앱 종료, 아니면 창 닫기', async () => {
    const user = userEvent.setup();
    setup();
    const exit = messages.popChrome.exit;
    const close = vi.spyOn(window, 'close').mockImplementation(() => undefined);

    await user.click(screen.getByRole('button', { name: exit.button }));
    const dialog = screen.getByRole('dialog', { name: exit.title });
    expect(within(dialog).getByText(exit.body)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();

    /* 브라우저 — 셸 통로가 없으면 창 닫기. */
    await user.click(screen.getByRole('button', { name: exit.button }));
    await user.click(
      within(screen.getByRole('dialog', { name: exit.title })).getByRole('button', {
        name: exit.confirm,
      }),
    );
    expect(close).toHaveBeenCalledTimes(1);

    /* POP 앱(Electron) — 셸의 앱 종료를 부르고 창 닫기는 하지 않는다. */
    const quit = vi.fn(() => Promise.resolve());
    const carrier = globalThis as { pop?: unknown };
    const before = carrier.pop;
    carrier.pop = { app: { quit } };
    try {
      await user.click(screen.getByRole('button', { name: exit.button }));
      await user.click(
        within(screen.getByRole('dialog', { name: exit.title })).getByRole('button', {
          name: exit.confirm,
        }),
      );
      expect(quit).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledTimes(1);
    } finally {
      carrier.pop = before;
      close.mockRestore();
    }
  });

  /*
   * Q21 피처 010 — 출하 포장(P-04-01)은 화면 이동 후보에서 감췄다. 서버가 그 수(shipmentPacking 4)를
   * 보내도 창에 서지 않고 합계에도 들지 않는다.
   */
  it('Q21 [남은 작업] 창은 수가 있는 화면만 많은 순으로 보이고(감춘 출하 포장 제외), 누르면 그 화면으로 간다', async () => {
    const user = userEvent.setup();
    const { counted } = setup();
    await waitFor(() => expect(counted).toHaveLength(1));

    const button = await screen.findByRole('button', { name: remaining.buttonLabel(15) });
    await user.click(button);

    const dialog = within(screen.getByRole('dialog', { name: remaining.title(15) }));
    expect(
      dialog
        .getAllByRole('button')
        .filter((item) => item.classList.contains('pop-remaining__item'))
        .map((item) => item.getAttribute('aria-label')),
    ).toEqual([remaining.count('OQC 출하검사', 12), remaining.count('작업지시 목록', 3)]);

    await user.click(dialog.getByRole('button', { name: remaining.count('OQC 출하검사', 12) }));
    expect(screen.getByText('지금: /pop/oqc-inspection')).toBeInTheDocument();
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

    /* 사번 확인 전에는 [남은 작업]이 잠긴다(#334). */
    expect(await screen.findByRole('button', { name: /^남은 작업 \d+건$/u })).toBeDisabled();
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

  /* 사번 입력 화면을 홈으로 합쳤다(omf-all-around#334) — 사번 확인 전에는 메뉴를 감추지 않고 잠근다. */
  it('사번이 없으면(홈의 사번 입력) 묶음 · 남은 작업 · 작업자 변경을 잠근다', async () => {
    setup({ route: '/pop/home', workerNo: null });

    await waitFor(() => {
      expect(within(groupsNav()).getAllByRole('button').length).toBeGreaterThan(1);
    });
    const groups = within(groupsNav())
      .getAllByRole('button')
      .filter((button) => button.textContent !== nav.home);
    expect(groups.length).toBeGreaterThan(0);
    for (const button of groups) expect(button).toBeDisabled();
    expect(screen.getByRole('button', { name: remaining.buttonLabel(0) })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: new RegExp(`^${messages.popChrome.userSwitch}`, 'u') }),
    ).toBeDisabled();
  });
});

describe('destinationOf — 화면으로 가는 주소', () => {
  const screenAt = (path: string) => {
    const found = POP_SCREENS.find((candidate) => candidate.path === path);
    if (found === undefined) throw new Error(`목록에 없는 화면: ${path}`);
    return found;
  };

  it('작업 단계·작업 중 화면은 W/O 없이 가면 작업 지시 목록으로 보낸다(홈 바로가기·남은 작업)', () => {
    expect(destinationOf(screenAt('/pop/material-input'), '')).toBe('/pop/work-start');
    expect(destinationOf(screenAt('/pop/work-hold'), '?workOrderId=')).toBe('/pop/work-start');
  });

  it('W/O 를 들고 있으면 그 W/O 를 실어 간다', () => {
    expect(destinationOf(screenAt('/pop/material-input'), '?workOrderId=7801')).toBe(
      '/pop/material-input?workOrderId=7801',
    );
  });

  it('작업 흐름 밖의 화면은 W/O 와 상관없이 그 화면으로 간다', () => {
    expect(destinationOf(screenAt('/pop/work-start'), '')).toBe('/pop/work-start');
    expect(destinationOf(screenAt('/pop/material-defect'), '?workOrderId=7801')).toBe(
      '/pop/material-defect',
    );
  });
});
