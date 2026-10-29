import type { SyncTableStatus } from './sync-tables';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다.
 *
 * 표 이름·인터페이스 코드는 서버가 실제로 주는 여덟 중 하나지만 고객 자료가 아니다(공개 저장소 경계).
 * 건수·시각은 지어낸 값이다.
 */
const BASE: SyncTableStatus = {
  interfaceCode: 'IF-ERP-ITEM-RECV',
  name: '품목',
  laneCode: 'MASTER',
  laneName: '기준정보',
  running: false,
  requestedAt: null,
  lastStartedAt: '2026-10-20T06:59:58Z',
  lastFinishedAt: '2026-10-20T07:00:00Z',
  lastStatusCode: 'SUCCEEDED',
  lastReadCount: 12,
  lastAppliedCount: 11,
  lastFailedCount: 0,
  lastHeldCount: 1,
  lastErrorMessage: null,
  nextRunAt: '2026-10-20T19:00:00Z',
};

/** 한 항목만 다른 표 상태를 만든다. */
export const syncTable = (overrides: Partial<SyncTableStatus> = {}): SyncTableStatus => ({
  ...BASE,
  ...overrides,
});
