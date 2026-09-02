import type { Worker } from '../../patterns/worker-session';
import type { WorkerEntry } from './directory';

/**
 * 사번 확인 결과.
 *
 * 없는 사번과 목록을 못 받은 것을 가른다 — 둘 다 확인이 안 된 상태지만, 앞은 작업자가
 * 다시 칠 일이고 뒤는 작업자가 할 수 있는 것이 없다. 같은 문구로 뭉치면 없는 사번을 계속
 * 다시 치게 된다.
 */
export type SignInResult =
  { kind: 'ok'; worker: Worker } | { kind: 'unknown' } | { kind: 'no-directory' };

export const verifyWorkerNo = (directory: WorkerEntry[] | null, workerNo: string): SignInResult => {
  if (directory === null) {
    return { kind: 'no-directory' };
  }

  const found = directory.find((entry) => entry.workerNo === workerNo);

  return found === undefined ? { kind: 'unknown' } : { kind: 'ok', worker: found };
};
