/**
 * 비가동 사유 — **평면 1단이다**(스펙 §4-A · §7 · §8-2 「해소 2026-09-03」).
 *
 * 값은 공통코드 그룹 `DOWNTIME_REASON`(`GET /mdm/code-values`)이 정본이고 아래는 스펙이 적어
 * 둔 **초기 시드 6값**이다. 조회 배선이 서면 이 파일만 지운다(추적 omf-mes#145).
 *
 * ⛔ **이 값들을 판정에 쓰지 않는다.** 화면이 고르게 하는 선택지일 뿐이고, 어느 사유가
 * 어떤 뜻인지는 서버·집계 화면이 정한다. 화면이 「이 사유면 이렇게 한다」를 만들면 승인된 적
 * 없는 규칙이 굳는다.
 *
 * ## ⛔ 대분류를 두지 않는다
 *
 * 한때 화면만 대·소분류 2단으로 그렸다. 설계는 **1단으로 확정**했고 근거가 넷이다 —
 * 계약 5자리·코드 사전·시드·집계 축이 «전부» 1단이며, 2단으로 가려면 **대분류 값을 새로
 * 지어내야 한다**(`A-21`). 쓰기 본문도 `reasonCode` 한 칸뿐이라 대분류는 갈 곳이 없었다.
 *
 * ⭐ **고객이 늘리는 목록이다**(`G-31`) — 아래 여섯은 늘어날 목록의 시작점이지 전부가 아니다.
 */

/** 사유 하나 — 보내는 것은 이 `code`다. */
export interface DowntimeReason {
  code: string;
  name: string;
}

/**
 * 시드 목록. **화면은 이 목록을 「아직 서버에서 받지 않았다」고 밝히고 쓴다** — 밝히지 않으면
 * 고객이 늘린 값까지 다 보이는 것으로 읽힌다.
 */
export const PLACEHOLDER_REASONS: readonly DowntimeReason[] = [
  { code: 'EQUIPMENT_FAILURE', name: '설비 고장' },
  { code: 'MOLD_CHANGE', name: '금형 교체' },
  { code: 'MATERIAL_WAIT', name: '자재 대기' },
  { code: 'LABOR_WAIT', name: '작업자 대기' },
  { code: 'PREVENTIVE_MAINTENANCE', name: '예방 보전' },
  { code: 'OTHER', name: '기타' },
];

/**
 * 사유 코드의 이름. 시드에 없으면 `null`이다 — **코드를 이름인 척 보이지 않는다**.
 * 서버가 준 `reasonName`이 있으면 그쪽이 먼저다(이 함수는 그것이 없을 때만 쓰인다).
 */
export const reasonName = (code: string): string | null =>
  PLACEHOLDER_REASONS.find((reason) => reason.code === code)?.name ?? null;
