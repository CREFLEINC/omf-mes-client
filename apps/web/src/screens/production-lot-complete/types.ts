import type { components } from '@omf-mes/api-client';

/**
 * P-02-06 생산LOT 완료 처리 화면 슬라이스의 계약.
 *
 * ⭐ **완료는 코드 값이 아니라 시각이다**(계약 `Lot.completedAt` · `omf-mes#269`). 「완료」·「미달
 * 마감」은 품질 판정 축(`statusCode`)에도 생명주기 축(`lifecycleStatusCode`)에도 값으로 들어가지
 * 않는다 — 완료 시각이 있고 없고로 갈리고, 미달 여부는 사유 유무로 갈린다.
 *
 * ⛔ **그래서 목록을 `statusCode` 로 좁히지 않는다.** 그 축으로는 완료를 고를 수 없어 목록이
 * 조용히 빈다(계약 명시).
 */
export type Lot = components['schemas']['Lot'];
export type LotProgress = components['schemas']['LotProgress'];
export type LotComplete = components['schemas']['LotComplete'];
export type CodeValue = components['schemas']['CodeValue'];
export type TerminalProcess = components['schemas']['TerminalProcess'];

/**
 * 미달 사유의 코드 그룹.
 *
 * ⚠ **계약이 이 필드에 코드 그룹을 적어 두지 않았다**(같은 파일의 다른 사유 필드들은 적혀 있다).
 * 계약이 「`work_order.completion_variance_reason_code` 로 간다」고 밝혔고 같은 컬럼을 쓰는 W/O
 * 마감(`W-02-05`)이 이미 이 그룹 이름으로 서 있어 같은 값을 쓴다 — **검토 요청 `omf-mes#399` 2번**.
 *
 * 회신이 오면 **이 상수 한 줄만** 바뀐다. 화면 곳곳에 문자열을 흩뿌리면 값이 도착했을 때 고치다
 * 만 자리가 조용히 남는다.
 */
export const VARIANCE_REASON_CODE_GROUP = 'WORK_ORDER_COMPLETION_VARIANCE_REASON';

/** 사유 선택칸에 놓을 한 줄. */
export interface ReasonOption {
  value: string;
  label: string;
}
