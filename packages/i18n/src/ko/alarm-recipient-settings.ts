/**
 * W-CO-11 알림 수신자 설정 — 부서 × 이벤트 단위(001 재설계, omf-all-around#160).
 * 수신자는 개인 지정만 남았고 미리보기는 없앴다(결정 #19).
 */
export const alarmRecipientSettings = {
  panes: { events: '이벤트', setting: (eventName: string): string => `${eventName} 알림 설정` },
  fields: {
    department: '부서 선택',
    departmentPlaceholder: '부서를 선택하세요',
    /** 끄면 알림센터 · Zalo 모두 보내지 않는다(서버 `EVENT_DISABLED`) — 알림 전체 사용 여부. */
    enabled: '알림 사용',
    zalo: 'Zalo 발송',
    recipients: (count: number): string => `수신자 ${String(count)}명`,
  },
  values: {
    on: 'ON',
    off: 'OFF',
    /** Zalo 연결이 ACTIVE 가 아닐 때 Zalo 발송 옆 노란 칩. */
    notConnected: '미연결',
    approver: '결재자',
    /** 수신자 행에 붙는 표식. 이 사람은 Zalo 를 받지 못하고 알림센터로만 받는다. */
    noPhone: '전화번호 없음',
    inactive: '미사용',
    /** 후보 표의 「전화번호 등록」 칸 — 없으면 Zalo 를 받지 못한다(서버가 그 사람의 Zalo 만 건너뛴다). */
    hasPhone: '등록됨',
    // ui-check-ignore: C-13 사용자 지정 문구 「미등록 · Zalo 발송 불가」 그대로
    phoneMissing: '미등록 · Zalo 발송 불가',
    alreadyAdded: '추가됨',
    selectRow: (userName: string): string => `${userName} 선택`,
    noDepartment: '—',
    recipientCount: (count: number): string => `${String(count)}명`,
  },
  actions: {
    add: '수신자 추가',
    remove: '제거',
    revert: '취소',
    save: '저장',
    reload: '다시 불러오기',
    openConnection: 'Zalo 연결 설정',
    cancel: '취소',
    search: '검색',
    /** 수신자 추가 창 — 고르기 전 「추가」, 고른 뒤 「N명 추가」. */
    addPick: '추가',
    addSelected: (count: number): string => `${String(count)}명 추가`,
  },
  state: {
    selectDepartment: '부서를 선택하면 그 부서의 이벤트 설정이 보입니다.',
    noDepartments: '부서가 없습니다.',
    departmentsTruncated:
      '부서 목록이 일부만 표시됩니다. 찾는 부서가 없으면 담당자에게 알려 주세요.',
    noEvents: '설정할 이벤트가 없습니다.',
    noRecipients: '지정한 수신자가 없습니다.',
    /** US4-4 — 켜 두었는데 받을 사람이 없다. 저장은 막지 않는다. */
    /** US4-5 — 전화번호가 없는 수신자는 Zalo 를 받지 못한다. */
    noPhoneNotice: (count: number): string =>
      `전화번호가 없는 수신자 ${String(count)}명은 알림센터로만 받습니다.`,
    zaloNeedsEnabled: '알림 사용을 ON으로 해야 Zalo로 보낼 수 있습니다.',
    /** 발송 건마다 ZBS 잔액 · OA 일일 한도를 쓴다. 한도 초과(-144 · -147)는 다음 07:00(현장 시각)으로 미룬다. */
    zaloQuota:
      '발송 요금은 ZBS 잔액에서 차감됩니다. 일일 발송 한도를 초과한 알림은 다음 날 오전 7시(현장 시간)에 발송됩니다.',
    unsaved: '저장되지 않은 변경 사항',
    approverNotice: '그 차례의 결재자가 받습니다. 결재선 정의에서 정한 사람입니다.',
    saved: '저장했습니다.',
    /** US4-6 — 409. */
    conflict: '다른 사람이 먼저 저장했습니다. 다시 불러온 뒤 저장하세요.',
    /** 연결 전 Zalo 건은 보내지 않고 대기한다(러너 CONNECTION_NOT_READY · 24시간 뒤 만료). 알림센터 행은 바로 생긴다. */
    zaloNotActive: 'Zalo가 연결되지 않아 Zalo는 보내지 않습니다. 알림센터로는 바로 받습니다.',
    candidatesEmpty: '검색 결과가 없습니다.',
  },
  picker: {
    title: '수신자 추가',
    departmentAll: '전체',
    searchLabel: '수신자 검색',
    searchPlaceholder: '이름 또는 로그인 아이디를 입력하세요',
    /** 표 이름 — 보이지 않고 읽기 도구에만 쓴다. */
    caption: '수신자 후보',
    /** 상한이 있는 화면(W-CO-14)만 — 지금 고른 사람까지 뺀 남은 자리. */
    /** 후보가 받는 상한(5,000명)을 넘어 끝까지 받지 못했다. */
    truncated: '후보가 많아 일부만 표시됩니다. 이름이나 로그인 아이디로 검색하세요.',
  },
  errors: {
    /** 서버도 400 으로 막는다 — 화면이 먼저 알린다. */
    inactiveRecipient: '미사용 사용자는 수신자로 둘 수 없습니다. 제거한 뒤 저장하세요.',
    lookupFailed: '목록을 불러오지 못했습니다. 다시 시도해 주세요.',
  },
  /** 지정한 수신자 표(두 알림 설정 화면이 함께 쓴다 · 사용자 지시 2026-11-25). */
  recipientTable: {
    name: '이름',
    department: '부서',
    phone: '전화번호',
    manage: '관리',
  },
  columns: {
    event: '이벤트',
    enabled: '알림',
    zalo: 'Zalo',
    recipients: '수신자',
    userName: '이름',
    loginId: '로그인 아이디',
    department: '부서',
    phone: '전화번호 등록',
  },
  /** 목록(부서 선택은 목록 제목 아래) · 상세 통일 배치(omf-all-around#358). */
  workspace: {
    list: '이벤트 목록',
    apply: '조회',
    clear: '초기화',
    selectEventTitle: '이벤트를 선택하세요.',
    selectEvent: '부서와 이벤트를 선택하면 알림 사용, Zalo 발송, 수신자를 정할 수 있습니다.',
  },
} as const;
