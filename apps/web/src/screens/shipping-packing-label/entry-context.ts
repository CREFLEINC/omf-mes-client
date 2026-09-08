import { useSearchParams } from 'react-router';

import { usePopIdentity } from '../../patterns/pop-identity';
import { useWorkerSession } from '../../patterns/worker-session';

/**
 * 이 화면이 **어느 출하의** 라벨을 뽑는지.
 *
 * 구 P-04-02는 P-04-01에 통합됐다. 공개 POP 라우트에서는 P-04-01이 출하를 고른 뒤 이 라벨
 * 구획을 내장하고 `shipmentId`를 직접 넘긴다. 이 훅의 주소값은 상위에서 값을 넘기지 않은
 * 독립 호출을 위한 호환 경로이며, 내장된 제품 흐름에서는 상위 값이 우선한다.
 *
 * ⛔ **없는 값을 지어내지 않는다.** 출하가 없으면 대상 목록을 조회하지 않고 왜 비었는지
 * 보인다 — 아무 출하나 골라 보이면 다른 출하의 라벨을 뽑게 된다.
 */
export interface ShippingLabelEntry {
  /** 출하 식별자. 대상 목록을 이 축으로 좁힌다. 없으면 `null` */
  shipmentId: number | null;
  /**
   * 귀속용 사번. 쓰기 2종(`POST /app/document-issues` · `:report-print`)의 `X-Worker-No`
   * 헤더에 실린다. 없으면 `null` — 발행을 열지 않는다.
   *
   * 이 훅을 직접 쓸 때는 셸의 `patterns/pop-identity`를 우선하고, 없으면 P-CO-01이 지정한
   * `patterns/worker-session`, 마지막으로 기존 주소값을 읽는다. P-04-01 내장 흐름에서는
   * 상위 화면이 현재 작업자를 prop으로 직접 넘긴다.
   */
  workerNo: string | null;
}

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

export const useShippingLabelEntry = (): ShippingLabelEntry => {
  const [searchParams] = useSearchParams();
  const identity = usePopIdentity();
  const session = useWorkerSession();

  return {
    shipmentId: parseId(searchParams.get('shipmentId')),
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
