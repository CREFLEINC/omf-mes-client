import { useSearchParams } from 'react-router';

import { usePopIdentity } from '../../patterns/pop-identity';
import { useWorkerSession } from '../../patterns/worker-session';

/**
 * 이 화면이 「어느 작업지시에서 · 누가」 들어왔는지.
 *
 * ⚠ **주소에서 읽는 것은 임시다.** POP 은 작업지시를 고른 뒤 진입해 헤더에 고정하는데, 그
 * 진입 화면(`P-02-01`)이 아직 이 저장소에 없다. 그것이 서면 **이 파일 하나가** 세션·셸에서
 * 받는 형태로 바뀐다 — 화면 본문은 이 훅만 부른다(전례 `P-02-05`·`P-05-01`).
 *
 * ⛔ **없는 값을 지어내지 않는다.** 사번이 없으면 서버가 쓰기를 거부하므로, 임시 사번을 채워
 * 두면 화면은 발행되는 것처럼 보이고 실패는 서버에서야 드러난다.
 */
export interface LotLabelEntry {
  /** 작업지시 식별자. 완료 LOT 목록을 이 축으로 좁힌다. 없으면 `null` */
  workOrderId: number | null;
  /** 귀속용 사번. 발행·인쇄 보고의 `X-Worker-No` 헤더에 실린다. 없으면 `null` */
  workerNo: string | null;
}

const parseWorkOrderId = (value: string | null): number | null => {
  if (value === null || value.trim() === '') return null;

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseWorkerNo = (value: string | null): string | null => {
  if (value === null) return null;

  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
};

/** 발행도 인쇄 결과 보고도 사번을 요구한다 — 없으면 쓰기를 시도하지 않는다(슬라이스 ③). */
export const canWrite = (entry: LotLabelEntry): boolean => entry.workerNo !== null;

export const useLotLabelEntry = (): LotLabelEntry => {
  const [searchParams] = useSearchParams();
  const identity = usePopIdentity();
  const session = useWorkerSession();

  return {
    workOrderId: parseWorkOrderId(searchParams.get('workOrderId')),
    /*
     * ⭐ **사번은 주소가 아니라 «지금 이 단말의 작업자»다**(사용자 지시 2026-09-08).
     *
     * 주소에서만 읽던 탓에, 다른 화면(긴급 W/O 등)이 사번 없이 보내면 사번 입력을 마친
     * 뒤인데도 「사번이 확인되지 않아 저장할 수 없습니다」로 막혔다 — 작업자는 방금 친
     * 사번을 또 쳐야 했다(실기 실측).
     *
     * 순서가 뜻이다 — 셸이 단말 토큰에서 푸는 값이 정본이고(`pop-identity`), 없으면 진입
     * 화면이 지정한 작업자(`worker-session`)를, 그것도 없을 때만 주소를 본다.
     * ⛔ **사번을 지우는 것은 로그아웃뿐이다** — 화면을 옮겼다고 비우지 않는다.
     */
    workerNo:
      parseWorkerNo(identity.workerNo) ??
      parseWorkerNo(session?.worker.workerNo ?? null) ??
      parseWorkerNo(searchParams.get('workerNo')),
  };
};
