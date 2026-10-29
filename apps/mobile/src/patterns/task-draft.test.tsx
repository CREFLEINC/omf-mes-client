import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import {
  TaskDraftProvider,
  useResumableTasks,
  useTaskDraft,
  type TaskDraftOptions,
} from './task-draft';
import { WorkerSessionProvider, useWorkerSession } from './worker-session';

interface Draft {
  lotNo: string;
  qty: string;
}

const EMPTY: Draft = { lotNo: '', qty: '' };

const OPTIONS: TaskDraftOptions<Draft> = {
  to: '/inbound-receipt',
  title: '입하 등록',
  summarize: (draft) => (draft.lotNo === '' ? null : `LOT ${draft.lotNo}`),
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <WorkerSessionProvider>
    <TaskDraftProvider>{children}</TaskDraftProvider>
  </WorkerSessionProvider>
);

/* 화면이 떠났다 돌아오는 것을 흉내 낸다 — 화면은 사라져도 공급자는 남는다. */
const Screen = () => {
  const [draft, setDraft, clearDraft] = useTaskDraft('inbound-receipt', EMPTY, OPTIONS);

  return (
    <>
      <p>{`LOT=${draft.lotNo}`}</p>
      <button type="button" onClick={() => setDraft((current) => ({ ...current, lotNo: 'L-1' }))}>
        스캔
      </button>
      <button type="button" onClick={clearDraft}>
        등록
      </button>
    </>
  );
};

const Resumable = () => {
  const tasks = useResumableTasks();
  return <p>{`이어서=${tasks.map((task) => task.summary).join(',')}`}</p>;
};

const Workers = () => {
  const { signIn } = useWorkerSession();
  return (
    <>
      <button type="button" onClick={() => signIn({ workerNo: '100027', workerName: '갑' })}>
        갑
      </button>
      <button type="button" onClick={() => signIn({ workerNo: '100028', workerName: '을' })}>
        을
      </button>
    </>
  );
};

const App = () => {
  const [shown, setShown] = useState(true);

  return (
    <>
      <Workers />
      <button type="button" onClick={() => setShown((current) => !current)}>
        화면 오가기
      </button>
      {shown ? <Screen /> : null}
      <Resumable />
    </>
  );
};

describe('작업 임시저장', () => {
  it('처음에는 넘긴 초기값을 준다', () => {
    const { result } = renderHook(() => useTaskDraft('k', EMPTY, OPTIONS), { wrapper });

    expect(result.current[0]).toEqual(EMPTY);
  });

  /* 홈에서 위치를 확인하고 돌아왔을 뿐인데 스캔을 처음부터 다시 했다. */
  it('화면을 떠났다 돌아와도 적던 값이 남는다', async () => {
    const user = userEvent.setup();
    render(<App />, { wrapper });

    await user.click(screen.getByRole('button', { name: '갑' }));
    await user.click(screen.getByRole('button', { name: '스캔' }));
    await user.click(screen.getByRole('button', { name: '화면 오가기' }));
    await user.click(screen.getByRole('button', { name: '화면 오가기' }));

    expect(screen.getByText('LOT=L-1')).toBeInTheDocument();
  });

  it('적은 것이 있으면 이어서 할 작업으로 알리고, 등록하면 거둔다', async () => {
    const user = userEvent.setup();
    render(<App />, { wrapper });

    await user.click(screen.getByRole('button', { name: '갑' }));
    expect(screen.getByText('이어서=')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '스캔' }));
    expect(screen.getByText('이어서=LOT L-1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '등록' }));
    expect(screen.getByText('이어서=')).toBeInTheDocument();
    expect(screen.getByText('LOT=')).toBeInTheDocument();
  });

  /* 공용 장비다. 교대한 사람 화면에 앞사람이 적던 LOT 이 열리면 남의 것으로 등록된다. */
  it('사번이 바뀌면 앞사람이 적던 것을 버린다', async () => {
    const user = userEvent.setup();
    render(<App />, { wrapper });

    await user.click(screen.getByRole('button', { name: '갑' }));
    await user.click(screen.getByRole('button', { name: '스캔' }));
    await user.click(screen.getByRole('button', { name: '을' }));

    expect(screen.getByText('LOT=')).toBeInTheDocument();
    expect(screen.getByText('이어서=')).toBeInTheDocument();
  });

  it('같은 틱에 두 번 고쳐도 앞 것을 덮지 않는다', () => {
    const { result } = renderHook(() => useTaskDraft('k', EMPTY, OPTIONS), { wrapper });

    act(() => {
      result.current[1]((current) => ({ ...current, lotNo: 'L-1' }));
      result.current[1]((current) => ({ ...current, qty: '300' }));
    });

    expect(result.current[0]).toEqual({ lotNo: 'L-1', qty: '300' });
  });
});
