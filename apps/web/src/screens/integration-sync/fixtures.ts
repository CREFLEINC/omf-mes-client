import type { IntegrationMessageRow } from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다. 이 화면은 **연계 전문**을 다루는 자리라
 * 거래처 코드·품목 코드·수량처럼 실제로 보일 법한 값을 넣지 않는다 —
 * 한눈에 예시임이 보이는 이름(`SAMPLE-…`)만 쓴다(공개 저장소 경계).
 */

const BASE_ROW: IntegrationMessageRow = {
  integrationMessageId: 9001,
  messageKey: 'SAMPLE-KEY-0001',
  interfaceCode: 'IF-SAMPLE-A',
  directionCode: 'OUTBOUND',
  targetTypeCode: 'SAMPLE_TARGET',
  targetId: 9101,
  statusCode: 'FAILED',
  retryCount: 3,
  lastErrorMessage: '연계 대상 시스템 응답 없음',
  createdAt: '2026-08-04T09:12:00+09:00',
  availableAt: '2026-08-04T09:20:00+09:00',
  sentAt: null,
  completedAt: null,
  lockedAt: null,
  lockedBy: null,
};

/** 한 항목만 다른 행을 만든다. 무엇을 검사하는 테스트인지 그 인자만 보고 읽히게 한다. */
export const messageRow = (
  overrides: Partial<IntegrationMessageRow> = {},
): IntegrationMessageRow => ({ ...BASE_ROW, ...overrides });

/**
 * 화면 수준 테스트가 목록 응답으로 쓰는 세 행. 화면이 다뤄야 하는 까다로운 입력을 일부러 담는다.
 *
 * - 9001 — `sentAt`·`completedAt`·`lockedAt`·`lockedBy`가 전부 `null`이다
 * - 9002 — **화면이 모르는 상태 코드**이고 워커가 잡고 있다
 * - 9003 — `lastErrorMessage`가 `null`이고 다음 시도가 **미래**다
 */
export const messageRowFixtures: IntegrationMessageRow[] = [
  messageRow(),
  messageRow({
    integrationMessageId: 9002,
    messageKey: 'SAMPLE-KEY-0002',
    interfaceCode: 'IF-SAMPLE-B',
    directionCode: 'INBOUND',
    // 계약이 「값 목록 미정」으로 둔 자리다. 화면이 이름을 지어내지 않는지 여기서 드러난다.
    statusCode: 'ERROR',
    retryCount: 0,
    lockedBy: 'sync-worker-01',
    lockedAt: '2026-08-04T11:20:00+09:00',
    sentAt: '2026-08-04T09:13:00+09:00',
  }),
  messageRow({
    integrationMessageId: 9003,
    messageKey: 'SAMPLE-KEY-0003',
    retryCount: 12,
    lastErrorMessage: null,
    /*
     * 실행 시각과 무관하게 「미래」로 판정되도록 아주 먼 날을 쓴다.
     * 가까운 날을 쓰면 이 테스트가 달력이 넘어간 날 조용히 뜻을 잃는다.
     */
    availableAt: '2099-12-31T23:30:00+09:00',
  }),
];
