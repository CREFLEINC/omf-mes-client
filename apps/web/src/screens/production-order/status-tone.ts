import type { ChipStatus } from '@crefle/web-ui';

/**
 * ERP W/O 상태의 색.
 *
 * ⛔ **값 목록을 화면이 정하지 않는다** — 이름은 서버 코드 목록이 준다. 여기서는 색만 정한다
 * (사용자 지시 2026-09-20): 수신은 파랑, 수정됨은 노랑, 취소는 빨강. 그 밖의 코드가 오면 중립색이다.
 */
export const productionOrderStatusTone = (statusCode: string): ChipStatus => {
  switch (statusCode) {
    case 'RECEIVED':
      return 'info';
    case 'UPDATED':
      return 'warning';
    case 'CANCELLED':
      return 'error';
    default:
      return 'idle';
  }
};
