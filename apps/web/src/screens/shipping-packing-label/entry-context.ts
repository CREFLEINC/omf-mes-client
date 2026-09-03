import { useSearchParams } from 'react-router';

/**
 * 이 화면이 **어느 출하의** 라벨을 뽑는지.
 *
 * 스펙 §3 은 머리에 출하와 거래처를 고정으로 그리고, 목록도 그 출하 범위다. 그런데 §3 의
 * 세로 예산이 슬랙 0 이라 **출하를 고르는 구획이 화면 안에 없다** — 골라서 들어오는 화면이다.
 *
 * ⚠ **주소에서 읽는 것은 임시다.** `P-04-01`(Packing 실적 등록)이 「라벨 출력 → 이 화면으로
 * 이동 — 소관 이동」으로 넘기는 것이 유일하게 적힌 경로인데, POP 모드 메뉴에서 직접 들어오는
 * 경로가 IA 에 함께 있다(「포장·출하 모드」). **그때 출하를 무엇으로 정하는지는 설계에 없다.**
 * 정해지면 이 파일 하나가 바뀐다 — 화면 본문은 이 훅만 부른다(전례 `P-02-05`·`P-05-01`).
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
   * ⚠ **`patterns/pop-identity` 에서 읽지 않는다.** 그 자리는 셸이 채우는 곳인데 **저장소에
   * 채우는 곳이 아직 없어** 항상 `null` 이다 — 그것을 읽으면 화면이 영구히 막힌다(실측
   * 2026-09-03: 발행 단추가 어떤 조작으로도 열리지 않았다).
   *
   * ⚠ **`patterns/worker-session` 에서도 읽지 않는다.** 그 파일이 「아직 이 자리를 읽는
   * 화면은 없다 · 모으는 일은 셸이 `pop-identity` 를 채울 때다」로 못박았다. 앞질러 읽으면
   * POP 쓰기 화면마다 사번 출처가 갈린다 — 전례 `P-02-05` 와 **같은 자리**를 쓴다.
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

  return {
    shipmentId: parseId(searchParams.get('shipmentId')),
    workerNo: parseWorkerNo(searchParams.get('workerNo')),
  };
};
