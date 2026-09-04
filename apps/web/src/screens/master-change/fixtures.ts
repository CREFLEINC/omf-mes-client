import type { AuditEventView } from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다. 이 화면은 **자유 형식 전후 값**을 그대로 그리는 자리라
 * 거래처 코드·품목 코드·수량·사번처럼 실제로 보일 법한 값을 넣지 않는다 —
 * 한눈에 예시임이 보이는 이름(`SAMPLE_…`)만 쓴다(공개 저장소 경계).
 */

const BASE_EVENT: AuditEventView = {
  auditEventId: 9001,
  occurredAt: '2026-08-04T09:12:00+09:00',
  targetTypeCode: 'ITEM',
  targetId: 9101,
  eventTypeCode: 'SAMPLE_EVENT_A',
  /*
   * 키 이름도 합성값이다. 계약이 키 구조를 정하지 않았으므로 화면이 모르는 키가 오는 것이 정상이고,
   * `someUnknownKey`는 그 사실을 테스트가 실제로 넣어 보기 위한 값이다.
   */
  beforeValue: { sampleFieldA: '이전 값', sampleFieldB: 3, someUnknownKey: 'SAMPLE-KEEP' },
  afterValue: { sampleFieldA: '이후 값', sampleFieldB: 3, someUnknownKey: 'SAMPLE-KEEP' },
  reason: '예시 사유 — 합성 데이터입니다',
  performedBy: 9201,
  terminalId: 9301,
  correlationId: 'SAMPLE-CORR-0001',
};

/** 한 항목만 다른 행을 만든다. 무엇을 검사하는 테스트인지 그 인자만 보고 읽히게 한다. */
export const auditEvent = (overrides: Partial<AuditEventView> = {}): AuditEventView => ({
  ...BASE_EVENT,
  ...overrides,
});

/**
 * 화면 수준 테스트가 목록 응답으로 쓰는 세 건. 화면이 다뤄야 하는 까다로운 입력을 일부러 담는다.
 *
 * - 9001 — 전후 값이 채워져 있고 **바뀌지 않은 항목**(`sampleFieldB`)도 섞여 있다
 * - 9002 — **전후 값이 둘 다 빈 객체**다. 목 서버가 실제로 이렇게 내려준다
 * - 9003 — `performedBy`·`reason`·`terminalId`·`correlationId`가 전부 `null`이고
 *   전후 값이 **한쪽에만** 있다
 *
 * 대상 종류는 9001·9003이 **같은 값**이다 — 선택지를 뽑을 때 중복이 접히는지 여기서 드러난다.
 * 사건 종류는 셋이 서로 다르다 — 목록에서 한 건을 집을 때 쓰는 표식이 된다.
 */
export const auditEventFixtures: AuditEventView[] = [
  auditEvent(),
  auditEvent({
    auditEventId: 9002,
    occurredAt: '2026-08-04T10:30:00+09:00',
    targetTypeCode: 'WORKER',
    targetId: 9102,
    eventTypeCode: 'SAMPLE_EVENT_B',
    beforeValue: {},
    afterValue: {},
  }),
  auditEvent({
    auditEventId: 9003,
    occurredAt: '2026-08-05T14:05:00+09:00',
    targetId: 9103,
    eventTypeCode: 'SAMPLE_EVENT_C',
    beforeValue: null,
    afterValue: { sampleFieldC: 0 },
    reason: null,
    performedBy: null,
    terminalId: null,
    correlationId: null,
  }),
];
