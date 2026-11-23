import { createApiClient } from '@omf-mes/api-client';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { ApiClientProvider } from '../patterns/api-context';
import { ApiRequestError } from '../patterns/request';
import { createTestQueryClient } from '../test/api-harness';
import { OutboxProvider, useOutbox, type OutboxTransport } from '../patterns/outbox';
import { TaskDraftProvider, useTaskDraft } from '../patterns/task-draft';
import { WorkerSessionProvider } from '../patterns/worker-session';
import { appRoutes } from '../routes';
import { hiddenScreens, homeAreas, parentScreenOf, screenOf } from './home-menu';
import { HomeAreaScreen, ShellHome } from './shell-home';

/*
 * 작업 목록에 걸 자리가 아닌 것.
 * - 홈 자신과 업무 목록, 사번 확인
 * - 전송 기록 두 화면 — 업무가 아니다. 앱바의 칩과 홈의 전송 현황이 그 길이고, 걸린 것이 없을
 *   때는 갈 일이 없다.
 * - 설정 — 업무가 아니다. 작업 목록 앱바의 설정 아이콘이 그 길이다.
 * - 감춘 작업 화면(`hiddenScreens`) — 라우트는 남기고 목록에서만 뺐다(피처 010 재포장).
 */
const NOT_LISTED = new Set([
  'screens',
  'screens/:area',
  'outbox',
  'rejections',
  'settings',
  ...hiddenScreens.map((hidden) => hidden.to.slice(1)),
]);

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
  /*
   * 홈이 남은 작업 수를 부른다(피처 002) — 이 시험들은 그 수를 재지 않으므로 조회는 늘 실패하게 둔다.
   * 실패하면 배지가 서지 않아 지금과 같은 홈이다(배지는 `shell-home.badge.test.tsx`).
   */
  <QueryClientProvider client={createTestQueryClient()}>
    <ApiClientProvider
      client={createApiClient({
        baseUrl: 'http://api.test',
        fetch: () => Promise.reject(new Error('이 시험은 서버를 부르지 않는다')),
      })}
    >
      <MemoryRouter initialEntries={[path]}>
        <OutboxProvider send={send}>
          <WorkerSessionProvider>
            <TaskDraftProvider>{children}</TaskDraftProvider>
          </WorkerSessionProvider>
        </OutboxProvider>
      </MemoryRouter>
    </ApiClientProvider>
  </QueryClientProvider>
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

  /*
   * Q21 피처 010 — 출하는 PDA 피킹 → OQC → POP 출하 완료로 끝나 재포장(포장 수정)을 쓰지 않는다.
   * 제품 출하 업무에서 감추되 라우트는 남긴다(배포 전 진행분).
   */
  it('입하 오류 등록 · 재생재 등록 · 긴급 IQC 생략 요청과 생산 현장 작업은 목록에 없다', () => {
    const hidden = [
      '/inbound-variance',
      '/recycle-entry',
      '/iqc-skip-request',
      '/shopfloor-receipt',
      '/wip-handover',
      '/repair-roundtrip',
      '/equipment-inspection',
      '/equipment-failure',
    ];
    render(
      <Shell path="/screens/inbound">
        <HomeRoutes />
      </Shell>,
    );

    expect(linkedPaths()).toEqual(expect.arrayContaining(['/inbound-receipt', '/inbound-close']));
    for (const path of hidden) {
      expect(linkedPaths()).not.toContain(path);
      expect(screenOf(path)).toBeUndefined();
    }
    expect(hiddenScreens.map((each) => each.to)).toEqual(expect.arrayContaining(hidden));
  });

  it('Q21 재포장은 제품 출하 업무에 없고 라우트는 남는다', () => {
    render(
      <Shell path="/screens/shipping">
        <HomeRoutes />
      </Shell>,
    );

    expect(linkedPaths()).not.toContain('/packing-repack');
    expect(screenOf('/packing-repack')).toBeUndefined();
    expect(hiddenScreens.map((hidden) => hidden.to)).toContain('/packing-repack');
    expect(
      (appRoutes[0]?.children ?? []).some(
        (child) => 'path' in child && child.path === 'packing-repack',
      ),
    ).toBe(true);
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
  /* 생산 현장 업무는 감췄다(사용자 지시 2026-11-20). */
  it('첫 화면에는 세 업무만 선다', () => {
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
    ).toEqual(['/screens/inbound', '/screens/warehouse', '/screens/shipping']);
    /* 창고 7 — 피처 011 이 적치 기록(M-01-14)을 더했다. */
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

  it('FR-003 · D-6 창고 업무에 「적치 기록」이 적치·입고 완료 바로 다음에 나타난다', async () => {
    const user = userEvent.setup();
    render(
      <Shell>
        <HomeRoutes />
      </Shell>,
    );

    await user.click(screen.getByRole('link', { name: /^창고/ }));

    const hrefs = within(screen.getByRole('navigation', { name: '창고' }))
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs.indexOf('/putaway-history')).toBe(hrefs.indexOf('/putaway') + 1);
  });

  /* 적치·입고 완료에서 LOT 을 들고만 들어온다 — 목록에서 열면 안내뿐이었다(사용자 지시 2026-11-23). */
  it('임시 위치 적재는 창고 업무에 없고 라우트는 남는다', () => {
    render(
      <Shell path="/screens/warehouse">
        <HomeRoutes />
      </Shell>,
    );

    expect(linkedPaths()).not.toContain('/temporary-putaway');
    expect(screenOf('/temporary-putaway')).toBeUndefined();
    expect(parentScreenOf('/temporary-putaway')?.to).toBe('/putaway');
    expect(
      (appRoutes[0]?.children ?? []).some(
        (child) => 'path' in child && child.path === 'temporary-putaway',
      ),
    ).toBe(true);
  });

  it('없는 업무 주소는 첫 화면으로 돌린다', () => {
    render(
      <Shell path="/screens/nowhere">
        <HomeRoutes />
      </Shell>,
    );

    expect(screen.getByRole('heading', { name: '업무' })).toBeInTheDocument();
  });

  /* 사용자 전환은 앱바의 사번 칩이, 설정은 그 오른쪽 아이콘이 한다(사용자 지시 2026-11-23). */
  it('맨 아래에 「사용자 전환」 · 「설정」 단추를 두지 않는다', () => {
    render(
      <Shell>
        <HomeRoutes />
      </Shell>,
    );

    expect(screen.queryByRole('button', { name: /사용자 전환/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /설정/ })).toBeNull();
  });

  /* 걸린 것이 없는데 자리를 세우면 0 이 홈 맨 위를 차지한다. */
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
