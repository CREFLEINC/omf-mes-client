/** W-CO-13 알림 발송 이력 — 이벤트 처리 결과와 수신자별 Zalo 결과(001 신설, 결정 #20). */
export const dispatchHistory = {
  panes: { dispatches: '이벤트 처리 결과', deliveries: 'Zalo 발송 상세' },
  filters: {
    period: '기간',
    event: '이벤트',
    department: '부서',
    result: '결과',
    deliveryStatus: '상태',
    all: '전체',
    search: '조회',
    /* 조회 상자 선택칸 이름(#358). 칩 · 「조건 제거」는 위 이름 그대로. */
    eventSelect: '이벤트 선택',
    resultSelect: '결과 선택',
    departmentSelect: '부서 선택',
    /** 「조건 더보기」에 접힌 부서 조건의 칩(C-6). */
    chipDepartment: (name: string): string => `부서: ${name}`,
    /** 이벤트 선택지의 묶음 이름 — 기존 6종 뒤에 인계 작업 10종(피처 002). */
    eventGroup: '이벤트',
    handoverGroup: '인계 작업',
  },
  results: { NOTIFIED: '알림', SKIPPED: '건너뜀' },
  /** 알리지 않은 이유(data-model §5). */
  skipReasons: {
    DEPARTMENT_UNRESOLVED: '부서 미확인',
    EVENT_DISABLED: '이벤트 꺼짐',
    NO_RECIPIENTS: '수신자 없음',
    REPORTER_OPTED_OUT: '보고자가 알림 끔',
    APPROVER_INACTIVE: '결재자 비활성',
  },
  skipped: (reason: string): string => `건너뜀: ${reason}`,
  /** 상태 네 가지 — `PENDING`·`SENDING` 은 「대기」로 합친다(설계 W-CO-13). */
  deliveryStatus: { PENDING: '대기', SENT: '성공', FAILED: '실패', EXPIRED: '만료' },
  zaloSummary: (
    sent: number,
    failed: number,
    pending: number,
    expired: number,
    noPhone: number,
  ): string =>
    `성공 ${String(sent)}, 실패 ${String(failed)}, 대기 ${String(pending)}, 만료 ${String(expired)}, 번호없음 ${String(noPhone)}`,
  columns: {
    occurredAt: '발생일시',
    event: '이벤트',
    department: '부서',
    target: '대상',
    result: '결과',
    notificationCount: '알림 수',
    zalo: 'Zalo',
    recipient: '수신자',
    phone: '번호',
    status: '상태',
    attempts: '시도',
    error: '오류',
    sentAt: '발송일시',
    trackingId: 'tracking id',
  },
  actions: { prevPage: '이전 쪽', nextPage: '다음 쪽' },
  state: {
    empty: '조건에 맞는 알림이 없습니다',
    deliveriesEmpty: 'Zalo 발송 건이 없습니다',
  },
  errors: {
    periodRequired: '기간을 입력하세요.',
    periodReversed: '종료일이 시작일보다 앞설 수 없습니다.',
    periodTooLong: '기간은 31일까지 조회할 수 있습니다',
  },
  /** 조회 조건 · 목록 · 상세 통일 배치(omf-all-around#358). */
  workspace: {
    filter: '조회 조건',
    list: '처리 결과 목록',
    clear: '초기화',
    selectTitle: '알림 건을 선택하세요.',
    select: '고른 건의 수신자별 Zalo 발송 결과를 볼 수 있습니다.',
  },
} as const;
