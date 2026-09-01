import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';

export interface Worker {
  workerNo: string;
  workerName: string;
}

export interface WorkerSession {
  worker: Worker | null;
  signIn: (worker: Worker) => void;
  signOut: () => void;
}

const WorkerSessionContext = createContext<WorkerSession | null>(null);

/**
 * 지금 이 단말을 쓰는 작업자.
 *
 * 세션이 아니라 귀속 정보다 — 서버에 아무것도 만들지 않고, 쓰기 요청에 사번을 실을 때만
 * 쓴다. 앱 메모리에만 두는 이유가 그것이다. 앱을 다시 띄우면 누구인지 다시 물어야 하는데,
 * 공용 장비에서 앞사람의 사번이 남아 있는 것이 훨씬 나쁘다.
 */
export const WorkerSessionProvider = ({ children }: { children: ReactNode }) => {
  const [worker, setWorker] = useState<Worker | null>(null);

  const signIn = useCallback((next: Worker) => {
    setWorker(next);
  }, []);

  const signOut = useCallback(() => {
    setWorker(null);
  }, []);

  const value = useMemo(() => ({ worker, signIn, signOut }), [signIn, signOut, worker]);

  return <WorkerSessionContext value={value}>{children}</WorkerSessionContext>;
};

export const useWorkerSession = (): WorkerSession => {
  const session = use(WorkerSessionContext);

  if (session === null) {
    throw new Error('useWorkerSession은 WorkerSessionProvider 안에서만 쓸 수 있습니다.');
  }

  return session;
};
