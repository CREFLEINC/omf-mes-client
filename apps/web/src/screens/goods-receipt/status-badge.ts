/**
 * 입하 전표 상태를 배지 색으로 가른다. **글자는 서버 코드 그대로다**(사용자 지시 2026-09-19) — 번역하지
 * 않는다. 조회 조건·요청에 싣는 값도 그대로다.
 *
 * 설계에 입하 상태의 값 목록이 아직 없다(`omf-mes#64`). 서버가 지금 만드는 값은 `REGISTERED` 하나뿐이고,
 * 나머지 넷의 색은 사용자가 정했다. 모르는 값은 중립(회색)으로 둔다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 디자인 시스템 `Chip` 의 상태 색. 어두운 바탕 + 상태 색 글자(soft container)다. */
export type StatusTone = 'idle' | 'info' | 'success' | 'error' | 'warning';

export const toStatusTone = (statusCode: string): StatusTone => {
  switch (statusCode) {
    case 'CONFIRMED':
      return 'info';
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
      return 'error';
    case 'INSPECTION_PENDING':
      return 'warning';
    default:
      /* REGISTERED 와 모르는 값 — 중립. */
      return 'idle';
  }
};
