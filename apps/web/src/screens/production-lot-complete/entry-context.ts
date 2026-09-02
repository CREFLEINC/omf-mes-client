import { useSearchParams } from 'react-router';

import { usePopIdentity } from '../../patterns/pop-identity';
import { useWorkerSession } from '../../patterns/worker-session';

/**
 * 이 화면이 「어느 작업지시에서 · 누가」 들어왔는지.
 *
 * ⚠ **작업지시를 주소에서 읽는 것은 임시다.** POP 은 작업지시를 고른 뒤 진입하고 헤더에
 * 고정하는데, 그 진입 화면(`P-02-01`)이 넘겨주는 형태가 아직 서지 않았다. 그것이 서면 **이 파일
 * 하나가** 바뀐다 — 화면 본문은 이 훅만 부른다.
 *
 * ⭐ **사번은 새로 받지 않는다.** POP 쓰기 화면이 쓸 사번의 자리는 하나이며(`P-CO-01` 이
 * `patterns/worker-session` 에 둔다), 화면마다 키패드를 새로 만들면 작업자가 화면을 옮길 때마다
 * 같은 것을 다시 친다. 셸이 단말 토큰에서 푸는 값(`pop-identity`)이 정본이고, 없으면 이 회차에
 * 지정된 작업자를 읽는다.
 *
 * ⛔ **없는 값을 지어내지 않는다.** 사번이 없으면 서버가 쓰기를 거부하므로(D-5), 임시 사번을
 * 채워 두면 화면은 완료되는 것처럼 보이고 실패는 서버에서야 드러난다 — 완료는 되돌릴 수 없다.
 */
export interface LotCompleteEntry {
  /** 작업지시 식별자. 대상 LOT 목록을 이 축으로 좁힌다. 없으면 `null` */
  workOrderId: number | null;
  /** 귀속용 사번. 완료 쓰기의 `X-Worker-No` 헤더에 실린다. 없으면 `null` */
  workerNo: string | null;
}

const parseWorkOrderId = (value: string | null): number | null => {
  if (value === null || value.trim() === '') return null;

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const trimmedOrNull = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;

  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
};

export const useLotCompleteEntry = (): LotCompleteEntry => {
  const [searchParams] = useSearchParams();
  const identity = usePopIdentity();
  const session = useWorkerSession();

  return {
    workOrderId: parseWorkOrderId(searchParams.get('workOrderId')),
    /*
     * 셸이 채운 값이 먼저다 — 단말 토큰이 정본이고, 지정 화면의 값은 그것이 없을 때의 자리다.
     * 순서를 뒤집으면 셸이 값을 채운 뒤에도 화면이 앞서 지정된 사람으로 기록한다.
     */
    workerNo: trimmedOrNull(identity.workerNo) ?? trimmedOrNull(session?.worker.workerNo),
  };
};
