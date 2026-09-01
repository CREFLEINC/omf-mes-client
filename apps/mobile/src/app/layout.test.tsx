import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../patterns/request';
import { useScreenTitle } from '../patterns/screen-title';
import { OutboxProvider, useOutbox } from '../patterns/outbox';
import { WorkerSessionProvider, useWorkerSession } from '../patterns/worker-session';
import { AppLayout } from './layout';

const Screen = ({ title }: { title: string }) => {
  useScreenTitle(title);
  return <p>본문 자리</p>;
};

/* 화면이 사번을 세우는 자리를 대신한다. */
const SignedInScreen = () => {
  const { signIn } = useWorkerSession();

  return (
    <button
      type="button"
      onClick={() => {
        signIn({ workerNo: '900029', workerName: '작업자 2' });
      }}
    >
      사번 세우기
    </button>
  );
};

/* 화면이 무언가를 담는 자리를 대신한다. */
const EnqueueScreen = () => {
  const { enqueue } = useOutbox();

  return (
    <button
      type="button"
      onClick={() => {
        void enqueue({
          label: '생산 실적',
          idempotencyKey: 'k-1',
          method: 'POST',
          path: '/production/results',
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

/* 셸이 읽는 것들을 한 자리에 모은다. 여기가 늘면 화면마다 다시 쌓지 않아도 된다. */
const Shell = ({ children }: { children: ReactNode }) => (
  <OutboxProvider send={() => Promise.resolve()}>
    <WorkerSessionProvider>
      <AppLayout>{children}</AppLayout>
    </WorkerSessionProvider>
  </OutboxProvider>
);

const renderLayout = (children: string) => {
  render(<Shell>{children}</Shell>);
};

/* 큐는 단말 보관소에 남는다. 비우지 않으면 앞 시험이 담은 것을 다음 시험이 함께 센다. */
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AppLayout', () => {
  it('본문을 main 랜드마크 안에 둔다', () => {
    renderLayout('본문 자리');

    expect(screen.getByRole('main', { name: '본문' })).toHaveTextContent('본문 자리');
  });

  it('상단 바를 banner 랜드마크로 둔다', () => {
    renderLayout('본문 자리');

    expect(screen.getByRole('banner')).toHaveTextContent('OMF-MES 모바일');
  });

  it('화면이 넘긴 제목을 상단 바에 보인다', () => {
    render(
      <Shell>
        <Screen title="자재 위치 확인" />
      </Shell>,
    );

    expect(screen.getByRole('banner')).toHaveTextContent('자재 위치 확인');
    expect(screen.getByRole('heading', { name: '자재 위치 확인' })).toBeInTheDocument();
  });

  it('제목을 넘긴 화면을 떠나면 그 제목이 남지 않는다', () => {
    const { rerender } = render(
      <Shell>
        <Screen title="자재 위치 확인" />
      </Shell>,
    );

    rerender(<Shell>본문 자리</Shell>);

    expect(screen.getByRole('banner')).not.toHaveTextContent('자재 위치 확인');
    expect(screen.getByRole('banner')).toHaveTextContent('OMF-MES 모바일');
  });

  /* 귀속이 어디로 붙는지는 상시 보여야 한다 - 화면을 옮겨도 앱바에 남는다(D-5). */
  it('현재 작업자를 상단 바에 보인다', async () => {
    const user = userEvent.setup();
    render(
      <Shell>
        <SignedInScreen />
      </Shell>,
    );

    expect(screen.getByRole('banner')).not.toHaveTextContent('900029');

    await user.click(screen.getByRole('button', { name: '사번 세우기' }));

    expect(screen.getByRole('banner')).toHaveTextContent('작업자 2 · 900029');
  });

  /* 담긴 순간 성공으로 보이므로 닿지 않은 건수를 보이지 않으면 알 방법이 사라진다. */
  it('보내지 못한 건수를 상단 바에 보인다', async () => {
    const user = userEvent.setup();
    render(
      <Shell>
        <EnqueueScreen />
      </Shell>,
    );

    expect(screen.getByRole('banner')).not.toHaveTextContent('미동기');

    await user.click(screen.getByRole('button', { name: '담기' }));

    expect(await screen.findByText('미동기 1')).toBeInTheDocument();
  });

  it('상시 메뉴를 두지 않아 navigation 랜드마크가 없다', () => {
    renderLayout('본문 자리');

    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('연결돼 있으면 온라인으로 보인다', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    renderLayout('본문 자리');

    expect(screen.getByRole('banner')).toHaveTextContent('온라인');
  });

  it('끊겨 있으면 오프라인으로 보인다', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    renderLayout('본문 자리');

    expect(screen.getByRole('banner')).toHaveTextContent('오프라인');
  });

  /*
   * 되돌아온 것은 화면을 떠난 뒤에 생긴다. 셸이 이고 다니지 않으면 그것을 적은 사람은
   * 되돌아왔다는 사실 자체를 만날 자리가 없다.
   */
  it('되돌아온 건수를 상단 바에 보이고 목록으로 가는 길을 낸다', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <OutboxProvider
          send={() => Promise.reject(new ApiRequestError({ kind: 'http', status: 422 }))}
        >
          <WorkerSessionProvider>
            <AppLayout>
              <EnqueueScreen />
            </AppLayout>
          </WorkerSessionProvider>
        </OutboxProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('banner')).not.toHaveTextContent('되돌아옴');

    await user.click(screen.getByRole('button', { name: '담기' }));
    window.dispatchEvent(new Event('online'));

    expect(await screen.findByText('되돌아옴 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '되돌아옴 1' })).toHaveAttribute('href', '/rejections');
  });
});
