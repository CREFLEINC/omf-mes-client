import { useSearchParams } from 'react-router';

import { usePopIdentity } from '../../patterns/pop-identity';
import { useWorkerSession } from '../../patterns/worker-session';

/**
 * 이 화면이 「어느 작업지시에서 · 누가」 들어왔는지.
 *
 * ⚠ **작업지시를 주소에서 읽는 것은 임시다.** POP 은 작업지시를 고른 뒤 진입하고 헤더에
 * 고정하는데(스펙 §3), 그 진입 화면(`P-02-01`)이 아직 이 저장소에 없다. 그것이 서면 **이 파일
 * 하나가** 셸에서 받는 형태로 바뀐다 — 화면 본문은 이 훅만 부른다.
 *
 * ⛔ **화면이 작업지시를 고르는 목록을 두지 않는다.** 스펙 §3 은 작업지시를 헤더에 «고정»으로
 * 그린다 — 고르는 자리가 아니다.
 *
 * ⭐ **사번은 한 자리에서 읽는다.** 셸의 `pop-identity` 가 정본이고, 아직 비어 있으면
 * `P-CO-01` 이 채운 `worker-session` 을 본다. 마지막이 주소다 — 진입 화면이 서기 전까지의
 * 임시 경로이며, 셸이 채우기 시작하면 앞의 둘이 먼저 잡는다.
 *
 * ⛔ **없는 값을 지어내지 않는다.** 사번이 없으면 서버가 쓰기를 거부하므로(계약: 없으면 거부),
 * 임시 사번을 채워 두면 화면은 되는 것처럼 보이고 실패는 서버에서야 드러난다.
 */
export interface WorkHoldEntry {
  /** 작업지시 식별자. 이 축으로 열린 세션을 찾는다. 없으면 `null` */
  workOrderId: number | null;
  /** 귀속용 사번. 쓰기의 `X-Worker-No` 헤더에 실린다. 없으면 `null` */
  workerNo: string | null;
}

/**
 * 주소의 작업지시 번호. **양의 정수만 받는다** — 계약이 `int64`를 요구하므로 소수·음수·0은
 * 있을 수 없는 값이고, 그대로 조회에 실으면 서버가 거절할 요청을 화면이 한 번 더 만든다.
 *
 * `Number`는 빈 문자열과 공백을 0으로 읽으므로 **자릿수 검사를 먼저 한다.**
 */
export const parseWorkOrderId = (value: string | null): number | null => {
  if (value === null || !/^\d+$/.test(value)) return null;

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export const parseWorkerNo = (value: string | null): string | null => {
  if (value === null) return null;

  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
};

export const useWorkHoldEntry = (): WorkHoldEntry => {
  const [searchParams] = useSearchParams();
  const { workerNo: identityWorkerNo } = usePopIdentity();
  const workerSession = useWorkerSession();

  return {
    workOrderId: parseWorkOrderId(searchParams.get('workOrderId')),
    workerNo:
      parseWorkerNo(identityWorkerNo) ??
      parseWorkerNo(workerSession?.worker.workerNo ?? null) ??
      parseWorkerNo(searchParams.get('workerNo')),
  };
};
