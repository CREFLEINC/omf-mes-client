import { messages } from '@omf-mes/i18n';

import type { ShipmentProgressCode } from './types';

/**
 * 출하 진행 필터의 선택지. 2차 고정 계약의 닫힌 6개 값과 순서를 그대로 쓴다.
 * 화면이 라인 수량으로 상태를 재계산하거나 조회 결과에서 목록을 유추하지 않는다.
 */

/**
 * 진행 코드의 표시명. **모르는 값은 코드를 그대로 돌려준다** — 계약에 값이 늘어도 빈 칸이
 * 되지 않고, 담당자에게 전할 단서가 남는다(공유계약 G-9).
 *
 * ⭐ 표·필터 목록·조건 칩이 **모두 이 함수를 쓴다** — 한 화면에서 같은 값이 표에서는
 * 「미편성」, 필터에서는 `NOT_ALLOCATED` 로 갈리면 같은 값인 줄 모른다.
 */
export const progressLabel = (code: string): string =>
  (messages.shipmentSchedule.progressCodes as Record<string, string | undefined>)[code] ?? code;

export const SHIPMENT_PROGRESS_CODES: readonly ShipmentProgressCode[] = [
  'NOT_ALLOCATED',
  'PARTIALLY_ALLOCATED',
  'PICKING',
  'PICKED',
  'PARTIALLY_SHIPPED',
  'SHIPPED',
];
