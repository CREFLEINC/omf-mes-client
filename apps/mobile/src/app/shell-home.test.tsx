import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { ApiRequestError } from '../patterns/request';
import { OutboxProvider, useOutbox, type OutboxTransport } from '../patterns/outbox';
import { TaskDraftProvider, useTaskDraft } from '../patterns/task-draft';
import { WorkerSessionProvider } from '../patterns/worker-session';
import { appRoutes } from '../routes';
import { ShellHome } from './shell-home';

/** 홈 자신과 사번 확인은 목록에 걸 자리가 아니다. */
const NOT_LISTED = new Set(['screens']);

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
  send = () => Promise.resolve(),
}: {
  children: ReactNode;
  send?: OutboxTransport;
}) => (
  <MemoryRouter>
    <OutboxProvider send={send}>
      <WorkerSessionProvider>
        <TaskDraftProvider>{children}</TaskDraftProvider>
      </WorkerSessionProvider>
    </OutboxProvider>
  </MemoryRouter>
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
describe('화면 목록', () => {
  it('라우트에 있는 화면이 모두 걸려 있다', () => {
    render(
      <Shell>
        <ShellHome />
      </Shell>,
    );

    const linked = new Set(linkedPaths());
    const missing = routedPaths().filter((path) => !linked.has(`/${path}`));

    expect(missing).toEqual([]);
  });

  it('걸린 곳이 모두 라우트에 있다', () => {
    render(
      <Shell>
        <ShellHome />
      </Shell>,
    );

    const routed = new Set(routedPaths().map((path) => `/${path}`));
    const dangling = linkedPaths().filter((href) => !routed.has(href));

    expect(dangling).toEqual([]);
  });

  /* 걸린 것이 없는데 자리를 세우면 0 이 홈 맨 위를 차지한다. */
  it('이어서 할 작업도 못 보낸 기록도 없으면 맨 위에 아무것도 세우지 않는다', () => {
    render(
      <Shell>
        <ShellHome />
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
        <ShellHome />
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
        <ShellHome />
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
