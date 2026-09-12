import { useSearchParams } from 'react-router';

import { usePopIdentity, type PopIdentity } from '../../patterns/pop-identity';
import { useWorkerSession } from '../../patterns/worker-session';

/**
 * 이 화면이 「어느 단말·공정에서 · 누가」 서 있는지.
 *
 * ⚠ **주소에서 읽는 것은 임시다.** 단말 번호·공정은 단말 토큰이 채우고, 사번은 사번 경량
 * 인증(`P-CO-01`)이 단말의 현재 작업자 세션에 둔다. 화면 본문은 이 훅만 부르므로 출처별
 * 우선순위가 한 곳에 남는다.
 *
 * ⭐ **셸이 채운 값이 이긴다.** 사번은 셸이 모르면 현재 작업자 세션을, 그마저 없을 때만
 * 주소를 쓰는 대체 경로다. 값이 다르면 단말이 자기에 대해 아는 것이 옳다 — 주소는 사람이
 * 칠 수 있는 값이다.
 *
 * ⛔ **없는 값을 지어내지 않는다.** 사번이 없으면 서버가 쓰기를 거부하므로, 임시 사번을 채워
 * 두면 화면은 확정되는 것처럼 보이고 실패는 서버에서야 드러난다(공유계약 F-6).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const parseId = (value: string | null): number | null => {
  if (value === null || value.trim() === '') return null;

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseWorkerNo = (value: string | null): string | null => {
  if (value === null) return null;

  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
};

/**
 * 셸, 현재 작업자 세션, 주소에 적힌 것을 합친다 — **셸이 이긴다.**
 *
 * 순수 함수로 떼어 둔 이유는 「어느 쪽이 이기는가」가 **틀려도 조용한** 판정이어서다.
 * 주소가 이기면 화면은 멀쩡히 뜨고, 남의 단말 번호로 게이팅을 물어 엉뚱한 판정을 받는다.
 */
export const mergeIdentity = (
  identity: PopIdentity,
  params: URLSearchParams,
  sessionWorkerNo: string | null = null,
): PopIdentity => ({
  terminalId: identity.terminalId ?? parseId(params.get('terminalId')),
  /*
   * ⛔ **공정은 주소에서 받지 않는다**(#999). 공정 구성은 셸이 등록 때 서버에서 받은 목록이
   *    정본이고(공유계약 F-4), 주소로 덮을 수 있으면 게이팅이 «주소를 고치는 것»으로 열린다.
   *    단말 번호의 주소 대체는 개발 확인용으로 남겨 둔다 — 그쪽은 판정이 아니라 조회 축이다.
   */
  processes: identity.processes,
  workerNo:
    identity.workerNo ?? parseWorkerNo(sessionWorkerNo) ?? parseWorkerNo(params.get('workerNo')),
});

export const usePackingIdentity = (): PopIdentity => {
  const identity = usePopIdentity();
  const session = useWorkerSession();
  const [searchParams] = useSearchParams();

  return mergeIdentity(identity, searchParams, session?.worker.workerNo ?? null);
};
