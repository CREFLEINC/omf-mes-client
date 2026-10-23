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

/**
 * 「확인」을 누르지 않아도 되는 사번인가.
 *
 * 명부의 사번 하나와 꼭 같고, 그 뒤로 더 쳐서 될 다른 사번이 없을 때만이다. 사번 길이로 정하지
 * 않는다 - 계약이 형식을 강제하지 않아(최대 50자) 「여섯 자리가 차면」은 맞지 않는 사번이 있다.
 * `1000` 과 `100027` 이 함께 있으면 `1000` 에서 넘겨 버리면 `100027` 은 칠 수 없다.
 */
export const autoSignInOf = (directory: WorkerEntry[] | null, workerNo: string): Worker | null => {
  if (directory === null || workerNo === '') {
    return null;
  }

  const found = directory.find((entry) => entry.workerNo === workerNo);

  if (found === undefined) {
    return null;
  }

  const longer = directory.some(
    (entry) => entry.workerNo !== workerNo && entry.workerNo.startsWith(workerNo),
  );

  return longer ? null : found;
};
