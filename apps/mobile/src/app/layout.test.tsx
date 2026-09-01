import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useScreenTitle } from '../patterns/screen-title';
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

const renderLayout = (children: string) => {
  render(
    <WorkerSessionProvider>
      <AppLayout>{children}</AppLayout>
    </WorkerSessionProvider>,
  );
};

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
      <WorkerSessionProvider>
        <AppLayout>
          <Screen title="자재 위치 확인" />
        </AppLayout>
      </WorkerSessionProvider>,
    );

    expect(screen.getByRole('banner')).toHaveTextContent('자재 위치 확인');
    expect(screen.getByRole('heading', { name: '자재 위치 확인' })).toBeInTheDocument();
  });

  it('제목을 넘긴 화면을 떠나면 그 제목이 남지 않는다', () => {
    const { rerender } = render(
      <WorkerSessionProvider>
        <AppLayout>
          <Screen title="자재 위치 확인" />
        </AppLayout>
      </WorkerSessionProvider>,
    );

    rerender(
      <WorkerSessionProvider>
        <AppLayout>본문 자리</AppLayout>
      </WorkerSessionProvider>,
    );

    expect(screen.getByRole('banner')).not.toHaveTextContent('자재 위치 확인');
    expect(screen.getByRole('banner')).toHaveTextContent('OMF-MES 모바일');
  });

  /* 귀속이 어디로 붙는지는 상시 보여야 한다 - 화면을 옮겨도 앱바에 남는다(D-5). */
  it('현재 작업자를 상단 바에 보인다', async () => {
    const user = userEvent.setup();
    render(
      <WorkerSessionProvider>
        <AppLayout>
          <SignedInScreen />
        </AppLayout>
      </WorkerSessionProvider>,
    );

    expect(screen.getByRole('banner')).not.toHaveTextContent('900029');

    await user.click(screen.getByRole('button', { name: '사번 세우기' }));

    expect(screen.getByRole('banner')).toHaveTextContent('작업자 2 · 900029');
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
});
