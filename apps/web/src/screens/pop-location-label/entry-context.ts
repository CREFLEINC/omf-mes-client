import { useSearchParams } from 'react-router';

import { usePopIdentity } from '../../patterns/pop-identity';
import { useWorkerSession } from '../../patterns/worker-session';

/**
 * 이 화면이 「누가」 들어왔는지.
 *
 * ⚠ **사번은 인증이 아니라 귀속이다** — 쓰기의 `X-Worker-No` 헤더에 실린다. 단말 토큰이 이것을
 * 대신하지 않으므로 화면은 사번을 확보한 뒤에만 발행을 연다.
 *
 * ⛔ **없는 값을 지어내지 않는다.** 빈 문자열로 떨어뜨리면 「사번이 있다」로 나가 거절이 서버에서
 * 나고, 작업자는 무엇을 고쳐야 할지 모른 채 막힌다.
 *
 * 순서가 뜻이다 — 셸이 단말 토큰에서 푸는 값이 정본이고(`pop-identity`), 없으면 사번 경량
 * 인증이 둔 작업자(`worker-session`)를, 그것도 없을 때만 주소를 본다. 전례는
 * `screens/goods-issue-qr/entry-context.ts` 와 `screens/tool-usage/entry-context.ts` 다.
 */
export interface PopLocationLabelEntry {
  /** 귀속용 사번. 없으면 `null` */
  workerNo: string | null;
}

const parseWorkerNo = (value: string | null): string | null => {
  if (value === null) return null;

  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
};

export const usePopLocationLabelEntry = (): PopLocationLabelEntry => {
  const [searchParams] = useSearchParams();
  const identity = usePopIdentity();
  const session = useWorkerSession();

  return {
    workerNo:
      parseWorkerNo(identity.workerNo) ??
      parseWorkerNo(session?.worker.workerNo ?? null) ??
      parseWorkerNo(searchParams.get('workerNo')),
  };
};
