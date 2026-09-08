import { usePopIdentity } from '../../patterns/pop-identity';
import { useWorkerSession } from '../../patterns/worker-session';

/**
 * 이 화면에서 라벨을 발행하는 작업자.
 *
 * ⛔ **없는 값을 지어내지 않는다.** 사번이 없으면 서버가 쓰기를 거부하므로, 임시 사번을 채워
 * 두면 화면은 발행되는 것처럼 보이고 실패는 서버에서야 드러난다.
 *
 * ⭐ 대상 포장은 주소로 받지 않는다. 고정 설계 P-04-04 §5-1 이 확정한 발행 대기 목록에서
 * 사용자가 고른 값만 화면 상태로 가진다.
 */
export interface RepackLabelEntry {
  /** 귀속용 사번. 발행·인쇄 결과 보고의 `X-Worker-No` 헤더에 실린다. 없으면 `null` */
  workerNo: string | null;
}

const parseWorkerNo = (value: string | null): string | null => {
  if (value === null) return null;

  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
};

export const useRepackLabelEntry = (): RepackLabelEntry => {
  const identity = usePopIdentity();
  const session = useWorkerSession();

  return {
    /*
     * ⭐ **사번은 주소가 아니라 «지금 이 단말의 작업자»다**(사용자 지시 2026-09-08).
     *
     * 주소에서만 읽던 탓에, 다른 화면(긴급 W/O 등)이 사번 없이 보내면 사번 입력을 마친
     * 뒤인데도 「사번이 확인되지 않아 저장할 수 없습니다」로 막혔다 — 작업자는 방금 친
     * 사번을 또 쳐야 했다(실기 실측).
     *
     * 순서가 뜻이다 — 셸이 단말 토큰에서 푸는 값이 정본이고(`pop-identity`), 없으면 진입
     * 화면이 지정한 작업자(`worker-session`)를 본다.
     * ⛔ **사번을 지우는 것은 로그아웃뿐이다** — 화면을 옮겼다고 비우지 않는다.
     */
    workerNo: parseWorkerNo(identity.workerNo) ?? parseWorkerNo(session?.worker.workerNo ?? null),
  };
};
