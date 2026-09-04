import { useSearchParams } from 'react-router';

import { usePopIdentity, type PopIdentity } from '../../patterns/pop-identity';

/**
 * 이 화면이 「어느 단말·공정에서 · 누가」 서 있는지.
 *
 * ⚠ **주소에서 읽는 것은 임시다.** 단말 번호·공정은 단말 토큰이, 사번은 사번 경량 인증
 * (`P-CO-01`)이 채울 값이고 그 자리가 아직 비어 있다(`patterns/pop-identity`의 기본값이
 * 전부 `null`인 이유다). 그것들이 서면 **이 파일 하나가** 셸에서 받는 형태로 바뀐다 —
 * 화면 본문은 이 훅만 부르므로 고칠 자리가 한 곳으로 남는다. 같은 사정의 전례가
 * `tool-usage/entry-context.ts`다.
 *
 * ⭐ **셸이 채운 값이 이긴다.** 주소는 셸이 모를 때만 쓰는 대체 경로이고, 둘이 다르면
 * 단말이 자기에 대해 아는 것이 옳다 — 주소는 사람이 칠 수 있는 값이다.
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
 * 셸이 아는 것과 주소에 적힌 것을 합친다 — **셸이 이긴다.**
 *
 * 순수 함수로 떼어 둔 이유는 「어느 쪽이 이기는가」가 **틀려도 조용한** 판정이어서다.
 * 주소가 이기면 화면은 멀쩡히 뜨고, 남의 단말 번호로 게이팅을 물어 엉뚱한 판정을 받는다.
 */
export const mergeIdentity = (identity: PopIdentity, params: URLSearchParams): PopIdentity => ({
  terminalId: identity.terminalId ?? parseId(params.get('terminalId')),
  processId: identity.processId ?? parseId(params.get('processId')),
  workerNo: identity.workerNo ?? parseWorkerNo(params.get('workerNo')),
});

export const usePackingIdentity = (): PopIdentity => {
  const identity = usePopIdentity();
  const [searchParams] = useSearchParams();

  return mergeIdentity(identity, searchParams);
};
