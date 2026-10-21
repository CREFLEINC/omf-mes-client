/**
 * W-CO-11 알림 수신자 설정 — 부서 × 이벤트 단위(001 재설계, omf-all-around#160).
 * 수신자는 개인 지정만 남았고 미리보기는 없앴다(결정 #19).
 */
export const alarmRecipientSettings = {
  title: '알람 수신자 설정',
  breadcrumbRoot: '시스템 관리',
  description: '부서마다 알림 이벤트를 켜고 끄며, Zalo 부가 전달 여부와 받을 사람을 정합니다.',
  panes: { events: '이벤트', setting: (eventName: string): string => `설정: ${eventName}` },
  fields: {
    department: '부서',
    enabled: '알림 받기',
    zalo: 'Zalo로도 보내기',
    recipients: (count: number): string => `수신자 (${String(count)})`,
  },
  values: {
    on: '켬',
    off: '끔',
    approver: '결재자',
    /** 수신자 행에 붙는 표식. 이 사람은 Zalo 를 받지 못하고 알림센터로만 받는다. */
    noPhone: '전화번호 없음',
    inactive: '비활성',
    /** 후보 표의 전화번호 칸 */
    hasPhone: '있음',
    alreadyAdded: '이미 추가됨',
    noDepartment: '—',
  },
  actions: {
    add: '추가',
    remove: '해제',
    revert: '되돌리기',
    save: '저장',
    reload: '다시 불러오기',
    openConnection: '알림 연결 설정 열기',
    cancel: '취소',
    discard: '버리고 이동',
    search: '검색',
    prevPage: '이전 쪽',
    nextPage: '다음 쪽',
    addSelected: (count: number): string => `추가 (${String(count)})`,
  },
  state: {
    selectDepartment: '부서를 고르면 그 부서의 이벤트 설정이 보입니다.',
    noDepartments: '부서가 없습니다',
    noEvents: '설정할 이벤트가 없습니다.',
    noRecipients: '지정한 수신자가 없습니다.',
    /** US4-4 — 켜 두었는데 받을 사람이 없다. 저장은 막지 않는다. */
    noRecipientsWarning: '수신자가 없어 알림이 가지 않습니다',
    /** US4-5 — 전화번호가 없는 수신자는 Zalo 를 받지 못한다. */
    noPhoneNotice: (count: number): string =>
      `전화번호가 없는 수신자 ${String(count)}명은 알림센터로만 받습니다`,
    zaloHelp: '실패해도 알림센터는 받습니다',
    zaloNeedsEnabled: '알림을 켜야 Zalo도 보낼 수 있습니다',
    approverNotice: '그 차례의 결재자가 받습니다. 결재선(W-06-15)에서 정한 사람입니다.',
    saved: '저장했습니다',
    /** US4-6 — 409. */
    conflict: '다른 사람이 먼저 저장했습니다. 다시 불러온 뒤 저장하세요',
    zaloNotActive:
      'Zalo 연결이 설정되지 않아 지금은 알림센터로만 갑니다 — 알림 연결 설정(W-CO-12)',
    unsavedTitle: '저장하지 않은 변경이 있습니다',
    unsavedBody: '이동하면 고친 내용이 사라집니다. 버리고 이동할까요?',
    candidatesEmpty: '검색 결과 없음',
    pageOf: (page: number, totalPages: number): string => `${String(page)} / ${String(totalPages)}`,
  },
  picker: {
    title: '수신자 추가',
    searchLabel: '이름 또는 로그인 ID',
    caption: '수신자 후보',
  },
  errors: {
    /** 서버도 400 으로 막는다 — 화면이 먼저 알린다. */
    inactiveRecipient: '비활성 사용자는 수신자로 둘 수 없습니다. 해제한 뒤 저장하세요.',
    lookupFailed: '목록을 불러오지 못했습니다. 다시 시도해 주세요.',
  },
  columns: {
    event: '이벤트',
    enabled: '알림',
    zalo: 'Zalo',
    recipients: '수신자',
    userName: '이름',
    loginId: '로그인 ID',
    department: '부서',
    phone: '전화번호',
  },
} as const;
