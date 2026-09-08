import { useSearchParams } from 'react-router';

import { usePopIdentity } from '../../patterns/pop-identity';
import { useWorkerSession } from '../../patterns/worker-session';

/**
 * 이 화면이 「어느 출고 전표에서 · 누가」 들어왔는지.
 *
 * ⚠ **주소에서 읽는 것은 임시다.** 창고 스테이션 모드가 전표를 고른 뒤 이 화면으로 넘기고
 * 사번은 사번 경량 인증(P-CO-01)이 `patterns/worker-session` 에 두는데, 전자는 아직 없고
 * 후자는 **그 자리를 읽는 화면이 아직 없다**(`P-02-05` 가 같은 사정을 적어 두었다). 그때
 * **이 파일 하나가** 세션·셸에서 받는 형태로 바뀐다 — 화면 본문은 이 훅만 부른다.
 *
 * ⛔ **없는 값을 지어내지 않는다.** 사번이 없으면 서버가 쓰기를 거부하므로(귀속 조항), 임시
 * 사번을 채워 두면 화면은 발행되는 것처럼 보이고 실패는 서버에서야 드러난다.
 *
 * 전례: `screens/tool-usage/entry-context.ts`(P-05-01) — 같은 사정, 같은 형태.
 */
export interface GoodsIssueQrEntry {
  /** 출고 전표 식별자. 없으면 `null` */
  goodsIssueId: number | null;
  /** 귀속용 사번. 없으면 `null` */
  workerNo: string | null;
}

const parseGoodsIssueId = (value: string | null): number | null => {
  if (value === null || value.trim() === '') return null;

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseWorkerNo = (value: string | null): string | null => {
  if (value === null) return null;

  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
};

export const useGoodsIssueQrEntry = (): GoodsIssueQrEntry => {
  const [searchParams] = useSearchParams();
  const identity = usePopIdentity();
  const session = useWorkerSession();

  return {
    goodsIssueId: parseGoodsIssueId(searchParams.get('goodsIssueId')),
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
