import type { ChipStatus } from '@crefle/web-ui';

/**
 * W/O 상태 칩의 색 — 상태 하나에 색 하나(C-19). 표의 상태 칩과 표 위 조건 칩이 같은 색을 쓴다(C-17).
 *
 * ⛔ **이것은 값 목록이 아니라 색 사전이다.** 무슨 상태가 있는지와 그 이름은 공통코드 마스터가 정하고
 * (`status-options.ts`), 여기 없는 코드는 중립 색으로 그린다 — 마스터에 상태가 늘어도 칩은 빠지지 않는다.
 *
 * 빨강은 쓰지 않는다. 이 화면에서 빨강은 지연 하나를 가리킨다.
 */
const STATUS_TONE: Record<string, ChipStatus> = {
  RELEASED: 'info',
  IN_PROGRESS: 'success',
  SUSPENDED: 'warning',
};

export const statusTone = (statusCode: string): ChipStatus => STATUS_TONE[statusCode] ?? 'idle';
