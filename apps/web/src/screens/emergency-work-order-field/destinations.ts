/**
 * 이탈 대상 — **정상 경로 화면**의 주소.
 *
 * ⭐ **긴급이라고 투입·실적 화면을 따로 두지 않는다**(설계 확정). 이 화면이 하는 일은 고른
 * 긴급 W/O 를 실어 정상 화면으로 넘기는 것뿐이고, 넘긴 뒤의 판정은 그쪽 화면과 서버가 한다.
 *
 * ⛔ **긴급 여부를 주소에 싣지 않는다.** 유형은 W/O 자체가 갖고 있으므로, 주소에 또 실으면
 * 두 곳이 어긋날 수 있는 사실이 하나 는다 — 받는 화면은 `workOrderId` 로 서버에 묻는다.
 */
export const MATERIAL_INPUT_PATH = '/pop/material-input';
export const PRODUCTION_RESULT_PATH = '/pop/production-result';

export const toWorkOrderHref = (path: string, workOrderId: number): string =>
  `${path}?workOrderId=${String(workOrderId)}`;
