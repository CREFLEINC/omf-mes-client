/**
 * 알림이 여는 주소의 키.
 *
 * 피처 009 — 「입고 처리」 창(`post=`)은 없어졌다. 구매 입하 자재는 PDA 적치로 입고한다(omf-all-around#294). 옛 주소의
 * `post=` 는 읽지 않는다 — 남아 있어도 목록만 그 LOT 으로 좁혀진다(`lot=`).
 */
const POSITIVE_INTEGER = /^\d+$/;

const positiveOf = (raw: string | null): number | null =>
  raw !== null && POSITIVE_INTEGER.test(raw) && Number(raw) >= 1 ? Number(raw) : null;

/**
 * 「검사 불합격(IQC)」 알림 · 005 이전 흐름 「적치 대기」 알림이 여는 주소 — `lot=<LOT 번호(내부)>`. 알림은 LOT 만 알고 발주를
 * 모르므로 목록을 그 LOT 이 입하된 발주로 좁힌다(기간·조건 없이). 다른 조건으로 조회하면 주소를 새로 쓰므로 이 키는 사라진다.
 */
export const readLotEntry = (params: URLSearchParams): number | null =>
  positiveOf(params.get('lot'));

/**
 * 「적치 대기」 알림(피처 009 · 대상 INBOUND_LOT)이 여는 주소 — `inboundLot=<입하 LOT 번호(내부)>`. 발주 목록은 입하 LOT 으로
 * 거르지 못해, 화면이 그 입하 LOT 의 자재 관리 LOT 하나를 찾아 `lot=` 과 같은 길로 좁힌다.
 */
export const readInboundLotEntry = (params: URLSearchParams): number | null =>
  positiveOf(params.get('inboundLot'));
