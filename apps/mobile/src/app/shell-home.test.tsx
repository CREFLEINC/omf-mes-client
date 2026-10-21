import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { ApiRequestError } from '../patterns/request';
import { OutboxProvider, useOutbox, type OutboxTransport } from '../patterns/outbox';
import { TaskDraftProvider, useTaskDraft } from '../patterns/task-draft';
import { WorkerSessionProvider, useWorkerSession } from '../patterns/worker-session';
import { appRoutes } from '../routes';
import { FrequentScreensProvider, useRecordScreenVisit } from './frequent-screens';
import { homeAreas } from './home-menu';
import { HomeAreaScreen, ShellHome } from './shell-home';

/*
 * 작업 목록에 걸 자리가 아닌 것.
 * - 홈 자신과 업무 목록, 사번 확인
 * - 전송 기록 두 화면 — 업무가 아니다. 앱바의 칩과 홈의 전송 현황이 그 길이고, 걸린 것이 없을
 *   때는 갈 일이 없다.
 * - 설정 — 업무가 아니다. 홈 맨 아래 단추가 그 길이다.
 */
const NOT_LISTED = new Set(['screens', 'screens/:area', 'outbox', 'rejections', 'settings']);

const routedPaths = (): string[] =>
  (appRoutes[0]?.children ?? [])
    .map((child) => ('path' in child ? child.path : undefined))
    .filter((path): path is string => path !== undefined && !NOT_LISTED.has(path));

const linkedPaths = (): string[] =>
  screen
    .getAllByRole('link')
    .map((link) => link.getAttribute('href'))
    .filter((href): href is string => href !== null);

const Shell = ({
  children,
  path = '/screens',
  send = () => Promise.resolve(),
}: {
  children: ReactNode;
  path?: string;
  send?: OutboxTransport;
}) => (
  <MemoryRouter initialEntries={[path]}>
    <OutboxProvider send={send}>
      <WorkerSessionProvider>
        <TaskDraftProvider>
          <FrequentScreensProvider>{children}</FrequentScreensProvider>
        </TaskDraftProvider>
      </WorkerSessionProvider>
    </OutboxProvider>
  </MemoryRouter>
);

const HomeRoutes = () => (
  <Routes>
    <Route path="/screens" element={<ShellHome />} />
    <Route path="/screens/:area" element={<HomeAreaScreen />} />
    <Route path="*" element={<p>작업 화면</p>} />
  </Routes>
);

/* 화면이 적던 것을 남기는 자리를 대신한다. */
const DraftingScreen = () => {
  const [, setDraft] = useTaskDraft(
    'inbound-receipt',
    { lotNo: '' },
    {
      to: '/inbound-receipt',
      title: '입하 등록',
      summarize: (draft) => (draft.lotNo === '' ? null : `LOT ${draft.lotNo}`),
    },
  );

  return (
    <button
      type="button"
      onClick={() => {
        setDraft({ lotNo: 'ABC-123|0107' });
      }}
    >
      적다가 나가기
    </button>
  );
};

/* 사번을 세우고 작업 화면에 들어가는 것을 대신한다 — 셸은 들어갈 때마다 센다. */
const Visits = () => {
  const { signIn } = useWorkerSession();
  const record = useRecordScreenVisit();

  return (
    <>
      <button type="button" onClick={() => signIn({ workerNo: '100027', workerName: '갑' })}>
        사번 세우기
      </button>
      <button type="button" onClick={() => record('/putaway')}>
        적치 들어가기
      </button>
      <button type="button" onClick={() => record('/inbound-receipt')}>
        입하 들어가기
      </button>
    </>
  );
};

/* 보내지 못한 것을 담는 자리를 대신한다. */
const EnqueueScreen = () => {
  const { enqueue } = useOutbox();

  return (
    <button
      type="button"
      onClick={() => {
        void enqueue({
          label: '입하 등록',
          idempotencyKey: 'k-1',
          method: 'POST',
          path: '/inbound/receipts',
          body: {},
          occurredAt: '2026-09-01T00:00:00.000Z',
          confirmation: 'immediate',
        });
      }}
    >
      담기
    </button>
  );
};

beforeEach(() => {
  localStorage.clear();
});

/**
 * 홈이 화면 목록의 전부다.
 *
 * 이 셸에는 좌측 레일이 없어 홈에 걸리지 않은 화면은 주소를 아는 사람만 연다. 실제로 임시
 * 위치 적재가 라우트에만 있고 홈에 없어, 만들어 놓고도 현장에서 열 수 없었다.
 */
describe('작업 목록', () => {
  it('라우트에 있는 작업 화면이 모두 어느 업무엔가 걸려 있다', () => {
    const linked = new Set<string>();

    for (const area of homeAreas) {
      const { unmount } = render(
        <Shell path={`/screens/${area.id}`}>
          <HomeRoutes />
        </Shell>,
      );
      linkedPaths().forEach((href) => linked.add(href));
      unmount();
    }

    const missing = routedPaths().filter((path) => !linked.has(`/${path}`));

    expect(missing).toEqual([]);
  });

  it('걸린 곳이 모두 라우트에 있다', () => {
    const routed = new Set(routedPaths().map((path) => `/${path}`));

    for (const area of homeAreas) {
      const { unmount } = render(
        <Shell path={`/screens/${area.id}`}>
          <HomeRoutes />
        </Shell>,
      );
      const dangling = linkedPaths().filter((href) => !routed.has(href));
      expect(dangling).toEqual([]);
      unmount();
    }
  });

  /* 스물한 타일을 늘어놓던 첫 화면을 네 업무로 줄였다(사용자 지시 2026-10-20). */
  it('첫 화면에는 네 업무만 선다', () => {
    render(
      <Shell>
        <HomeRoutes />
      </Shell>,
    );

    const areas = screen.getByRole('heading', { name: '업무' }).parentElement!;

    expect(
      within(areas)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual([
      '/screens/inbound',
      '/screens/warehouse',
      '/screens/shopfloor',
      '/screens/shipping',
    ]);
    expect(screen.getByRole('link', { name: /^창고/ })).toHaveTextContent('작업 6개');
  });

  it('업무를 누르면 그 업무의 작업들이 선다', async () => {
    const user = userEvent.setup();
    render(
      <Shell>
        <HomeRoutes />
      </Shell>,
    );

    await user.click(screen.getByRole('link', { name: /^창고/ }));

    const list = screen.getByRole('navigation', { name: '창고' });
    expect(within(list).getByRole('link', { name: /적치·입고 완료/ })).toHaveAttribute(
      'href',
      '/putaway',
    );
    expect(within(list).getAllByRole('link')).toHaveLength(6);
  });

  it('없는 업무 주소는 첫 화면으로 돌린다', () => {
    render(
      <Shell path="/screens/nowhere">
        <HomeRoutes />
      </Shell>,
    );

    expect(screen.getByRole('heading', { name: '업무' })).toBeInTheDocument();
  });

  /* 한 사람이 하루에 쓰는 작업은 서너 개다. 매번 업무를 열어 찾게 하지 않는다. */
  it('이 사번이 많이 쓴 작업을 차례대로 맨 위에 세운다', async () => {
    const user = userEvent.setup();
    render(
      <Shell>
        <Visits />
        <HomeRoutes />
      </Shell>,
    );

    expect(screen.queryByRole('heading', { name: '자주 쓰는 작업' })).toBeNull();

    await user.click(screen.getByRole('button', { name: '사번 세우기' }));
    await user.click(screen.getByRole('button', { name: '입하 들어가기' }));
    await user.click(screen.getByRole('button', { name: '적치 들어가기' }));
    await user.click(screen.getByRole('button', { name: '적치 들어가기' }));

    const frequent = screen.getByRole('heading', { name: '자주 쓰는 작업' }).parentElement!;
    expect(
      within(frequent)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/putaway', '/inbound-receipt']);
  });

  /* 걸린 것이 없는데 자리를 세우면 0 이 홈 맨 위를 차지한다. */
  /* 교대 때 다음 사람이 바로 사번을 넣는다 - 사번 확인에서 「사번 바꾸기」를 다시 누르지 않는다. */
  it('「사용자 전환」은 지금 사번을 내리고 사번 확인으로 간다', async () => {
    const user = userEvent.setup();
    const WorkerName = () => <p>{useWorkerSession().worker?.workerName ?? '사번 없음'}</p>;
    render(
      <Shell>
        <Visits />
        <WorkerName />
        <Routes>
          <Route path="/" element={<p>사번 확인 화면</p>} />
          <Route path="/screens" element={<ShellHome />} />
        </Routes>
      </Shell>,
    );

    await user.click(screen.getByRole('button', { name: '사번 세우기' }));
    expect(screen.getByText('갑')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /사용자 전환/ }));

    expect(screen.getByText('사번 확인 화면')).toBeTruthy();
    expect(screen.getByText('사번 없음')).toBeTruthy();
  });

  /* 기기 등록 해제처럼 드물게 쓰는 것은 사번 입력 화면이 아니라 설정에 있다(사용자 지시 2026-10-21). */
  it('「설정」은 설정 화면으로 간다', async () => {
    const user = userEvent.setup();
    render(
      <Shell>
        <Routes>
          <Route path="/screens" element={<ShellHome />} />
          <Route path="/settings" element={<p>설정 화면</p>} />
        </Routes>
      </Shell>,
    );

    await user.click(screen.getByRole('button', { name: /설정/ }));

    expect(screen.getByText('설정 화면')).toBeTruthy();
  });

  it('이어서 할 작업도 못 보낸 기록도 없으면 맨 위에 아무것도 세우지 않는다', () => {
    render(
      <Shell>
        <HomeRoutes />
      </Shell>,
    );

    expect(screen.queryByRole('heading', { name: '이어서 하기' })).toBeNull();
    expect(screen.queryByRole('heading', { name: '전송 현황' })).toBeNull();
  });

  it('적다가 나간 작업을 맨 위에 세우고 그 화면으로 돌아가는 길을 낸다', async () => {
    const user = userEvent.setup();
    render(
      <Shell>
        <DraftingScreen />
        <HomeRoutes />
      </Shell>,
    );

    await user.click(screen.getByRole('button', { name: '적다가 나가기' }));

    expect(screen.getByRole('heading', { name: '이어서 하기' })).toBeInTheDocument();
    const resume = screen.getByRole('link', { name: '입하 등록 이어서 하기' });
    expect(resume).toHaveAttribute('href', '/inbound-receipt');
    expect(resume).toHaveTextContent('LOT ABC-123|0107');
  });

  it('보내지 못한 기록이 있으면 건수와 목록으로 가는 길을 맨 위에 세운다', async () => {
    const user = userEvent.setup();
    render(
      <Shell send={() => Promise.reject(new ApiRequestError({ kind: 'network' }))}>
        <EnqueueScreen />
        <HomeRoutes />
      </Shell>,
    );

    await user.click(screen.getByRole('button', { name: '담기' }));

    expect(await screen.findByRole('heading', { name: '전송 현황' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /전송 대기\s*1건/ })).toHaveAttribute(
      'href',
      '/outbox',
    );
  });
});
