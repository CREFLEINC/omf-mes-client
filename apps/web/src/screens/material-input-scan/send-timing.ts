/**
 * 스캔한 투입을 언제 서버로 보내는가(PI-30). 한 곳에서 정한다.
 *
 * - `next-action`(지금): 스캔하면 단말 저장소에 「미전송」으로 두고, 다음 동작(다음 LOT 스캔,
 *   다른 줄 선택, [생산 작업으로], 화면 떠남, [투입 등록])에서 보낸다. 그 사이 수량을 고치거나
 *   [취소]로 버린다. 서버에 투입 취소가 없어서다.
 * - `immediate`(omf-mes-server#828 이후): 스캔하면 바로 보내고, 잘못 보낸 것은 투입 기록 목록의
 *   [취소](취소 기록을 덧붙임)로 되돌린다.
 *
 * 바꾸는 방법은 PI-30을 본다. 이 값 한 줄과, 기록 목록에 취소 동작을 넘기는 것이다.
 */
export type SendTiming = 'next-action' | 'immediate';

export const SEND_TIMING: SendTiming = 'next-action';
