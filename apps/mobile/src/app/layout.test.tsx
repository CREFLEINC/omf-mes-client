import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { noteServerSilent } from '../patterns/online-status';
import { ApiRequestError } from '../patterns/request';
import { useScreenTitle } from '../patterns/screen-title';
import { OutboxProvider, useOutbox, type OutboxTransport } from '../patterns/outbox';
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

/*
 * 셸이 읽는 것들을 한 자리에 모은다. 여기가 늘면 화면마다 다시 쌓지 않아도 된다.
 *
 * 셸은 늘 라우터 안에 선다 - 홈 단추가 지금 주소를 읽는다. 기본 주소는 작업 화면 하나다.
 */
const Shell = ({
  children,
  path = '/inbound-receipt',
  send = () => Promise.resolve(),
}: {
  children: ReactNode;
  path?: string;
  send?: OutboxTransport;
}) => (
  <MemoryRouter initialEntries={[path]}>
    <OutboxProvider send={send}>
      <WorkerSessionProvider>
        <AppLayout>{children}</AppLayout>
      </WorkerSessionProvider>
    </OutboxProvider>
  </MemoryRouter>
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

  /* 사번 확인 화면은 본문의 확인 박스가 사번을 보여 주므로 앱바에 싣지 않는다. */
  it('앱바를 한 줄로 두는 화면에서는 사번을 싣지 않고, 떠나면 다시 싣는다', async () => {
    const user = userEvent.setup();
    const CompactScreen = () => {
      useScreenTitle('사번 확인', { compact: true });
      return <SignedInScreen />;
    };
    const { rerender } = render(
      <Shell>
        <CompactScreen />
      </Shell>,
    );

    await user.click(screen.getByRole('button', { name: '사번 세우기' }));

    expect(screen.getByRole('banner')).toHaveTextContent('사번 확인');
    expect(screen.getByRole('banner')).not.toHaveTextContent('900029');

    rerender(
      <Shell>
        <Screen title="자재 위치 확인" />
      </Shell>,
    );

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

    expect(screen.getByRole('banner')).not.toHaveTextContent('전송 대기');

    await user.click(screen.getByRole('button', { name: '담기' }));

    expect(await screen.findByText('전송 대기 1')).toBeInTheDocument();
  });

  it('상시 메뉴를 두지 않아 navigation 랜드마크가 없다', () => {
    renderLayout('본문 자리');

    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('연결 상태는 제목과 같은 줄, 사번과 보내지 못한 건수는 아래 줄에 선다', async () => {
    /*
     * 화면 이름과 「지금 보낼 수 있는가」는 함께 읽는 값이다(사용자 지시 2026-09-21). 사번과 아직
     * 안 간 건수는 「누구로, 무엇이 남았나」라 아래 줄에 함께 선다(사용자 결정 2026-10-21).
     */
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const user = userEvent.setup();
    render(
      <Shell send={() => Promise.reject(new ApiRequestError({ kind: 'network' }))}>
        <SignedInScreen />
        <EnqueueScreen />
      </Shell>,
    );
    await user.click(screen.getByRole('button', { name: '사번 세우기' }));
    await user.click(screen.getByRole('button', { name: '담기' }));

    const banner = screen.getByRole('banner');
    const titleRow = banner.querySelector('.mobile-shell__titlebar');
    const statusRow = banner.querySelector('.mobile-shell__statusbar');

    expect(titleRow).not.toBeNull();
    expect(statusRow).not.toBeNull();
    expect(titleRow).toHaveTextContent('온라인');
    /* 사번은 제목 줄에 끼지 않는다 — 성격이 다른 값이라 아래 줄에 선다. */
    expect(titleRow).not.toHaveTextContent('900029');
    expect(statusRow).toHaveTextContent('작업자 2 · 900029');
    expect(
      await within(statusRow as HTMLElement).findByRole('link', { name: '전송 대기 1' }),
    ).toBeInTheDocument();
    expect(titleRow).not.toHaveTextContent('전송 대기');
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

  /* 못 닿는 사정은 patterns/online-status.ts 에 적어 두었다. */
  it('망이 붙어 있어도 서버가 답하지 않으면 오프라인으로 보인다', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    noteServerSilent();

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
      <Shell send={() => Promise.reject(new ApiRequestError({ kind: 'http', status: 422 }))}>
        <EnqueueScreen />
      </Shell>,
    );

    expect(screen.getByRole('banner')).not.toHaveTextContent('전송 실패');

    await user.click(screen.getByRole('button', { name: '담기' }));
    window.dispatchEvent(new Event('online'));

    expect(await screen.findByText('전송 실패 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '전송 실패 1' })).toHaveAttribute(
      'href',
      '/rejections',
    );
  });

  /* 건수만으로는 무엇이 묶여 있는지 모른다. 그 목록과 「지금 보내기」로 가는 길이어야 한다. */
  it('보내지 못한 건수가 전송 대기 목록으로 가는 길이다', async () => {
    const user = userEvent.setup();
    render(
      <Shell send={() => Promise.reject(new ApiRequestError({ kind: 'network' }))}>
        <EnqueueScreen />
      </Shell>,
    );

    await user.click(screen.getByRole('button', { name: '담기' }));

    expect(await screen.findByRole('link', { name: '전송 대기 1' })).toHaveAttribute(
      'href',
      '/outbox',
    );
  });

  /* 단계가 깊은 화면에서 뒤로가기 키를 여러 번 누르지 않고 작업 목록으로 돌아간다. */
  it('작업 화면에서 홈 단추를 누르면 작업 목록으로 간다', async () => {
    const user = userEvent.setup();
    render(
      <Shell path="/inbound-receipt">
        <Routes>
          <Route path="/inbound-receipt" element={<p>입하 화면</p>} />
          <Route path="/screens" element={<p>작업 목록 화면</p>} />
        </Routes>
      </Shell>,
    );

    await user.click(screen.getByRole('button', { name: '작업 목록' }));

    expect(await screen.findByText('작업 목록 화면')).toBeInTheDocument();
  });

  it.each(['/screens', '/'])('%s 에는 홈 단추를 두지 않는다', (path) => {
    render(<Shell path={path}>본문 자리</Shell>);

    expect(screen.queryByRole('button', { name: '작업 목록' })).toBeNull();
  });
});
