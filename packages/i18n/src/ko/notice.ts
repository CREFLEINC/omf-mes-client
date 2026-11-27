/**
 * W-CO-04 공지·전달 — 알릴 것을 쓰고, 게시하고, 누가 확인했는지 본다.
 *
 * ⛔⛔ **게시된 공지의 본문을 고치는 화면을 만들지 않는다** — 고치면 이미 확인한 사람이 다른
 * 것을 본 것이 되고, 확인 이력이 무엇에 대한 확인인지 알 수 없어진다.
 * ⭐ **종료는 지우는 것이 아니라 종료일을 당기는 것이다** — 확인 이력이 남아야 한다.
 * ⭐ **상태는 서버가 파생한다** — 상태를 직접 쓰는 액션을 만들지 않는다.
 */
export const notice = {
  panes: {
    list: '공지 목록',
    detail: '공지 상세',
    ack: '확인 현황',
  },

  filters: {
    search: '공지 제목',
    searchPlaceholder: '공지 제목을 입력하세요',
    datePlaceholder: '날짜를 선택하세요',
    status: '상태',
    scope: '대상 범위',
    scopeAll: '범위 전체',
    unacknowledgedByMe: '미확인 공지',
    from: '게시 시작일',
    to: '게시 종료일',
    /** ⭐ 시작일이 아니라 **겹침**으로 거른다 — 긴 공지가 조회 구간에서 빠지지 않는다. */
    periodNote: '게시 기간이 선택한 기간과 하루라도 겹치는 공지를 모두 찾습니다.',
    /** ⛔ 기간은 필수가 아니다 — 계약이 그렇게 두었다. */
    periodOptional: '기간은 비워도 됩니다.',
    invalidPeriod: '게시 종료일이 시작일보다 빠릅니다.',
  },

  status: {
    DRAFT: '작성 중',
    SCHEDULED: '게시 예정',
    PUBLISHED: '게시 중',
    CLOSED: '종료',
    /** ⭐ 서버가 파생하는 값이라 화면이 직접 바꾸지 않는다. */
    derived: '상태는 게시 여부와 오늘 날짜로 정해집니다. 직접 바꾸지 않습니다.',
  },

  scope: {
    COMPANY: '전사',
    WORK_ORDER: '작업지시',
    BUSINESS_UNIT: '사업부',
    EQUIPMENT_GROUP: '설비그룹',
    WORK_SHIFT: '근무조',
    /** ⚠ 선택칸의 이름 **뒤**에 붙는 꼬리다 — 앞 공백까지가 이 값이다. */
    unsupportedSuffix: ' (지원 예정)',
    companyNote: '새로 만들어지는 계정도 자동으로 대상에 들어갑니다.',
  },

  list: {
    title: '제목',
    status: '상태',
    scope: '대상',
    period: '게시 기간',
    ack: '확인 현황',
    notAvailable: '—',
    /** ⭐ 분모를 셀 수 없는 범위가 있다 — 0으로 채우지 않는다. */
    ackOf: (done: number, total: number): string => `${String(done)} / ${String(total)}명`,
    ackDoneOnly: (done: number): string => `${String(done)}명`,
    ackNotRequired: '확인 불필요',
    emptyTitle: '조건에 맞는 공지가 없습니다',
    empty: '조회 조건을 바꾸거나 새 공지를 등록하세요.',
    loadFailed: '공지 목록을 불러오지 못했습니다.',
    selectTitle: '공지를 선택하세요.',
    select: '선택한 공지의 상세 정보가 표시됩니다.',
  },

  form: {
    create: '새 공지 쓰기',
    edit: '공지 수정',
    title: '제목',
    body: '본문',
    startDate: '시작일',
    endDate: '종료일',
    endDateNote: '종료일이 지나면 게시가 자동으로 끝납니다.',
    acknowledgeRequired: '읽은 사람에게 확인을 받습니다',
    scope: '대상 범위',
    workOrder: '대상 작업지시',
    save: '저장',
    saving: '저장하는 중입니다.',
    saved: '공지를 저장했습니다.',
    cancel: '취소',
    requiredTitle: '제목을 입력하세요.',
    requiredBody: '본문을 입력하세요.',
    requiredStartDate: '시작일을 선택하세요.',
    requiredEndDate: '종료일을 선택하세요.',
    requiredScope: '대상 범위를 선택하세요.',
    requiredWorkOrder: '대상 작업지시를 선택하세요.',
    workOrderNotAllowed: '대상 범위가 작업지시가 아니면 작업지시를 비웁니다.',
    unsupportedScope: '지금은 전사와 작업지시만 선택할 수 있습니다.',
    invalidDate: '올바른 날짜가 아닙니다. 다시 선택하세요.',
    invalidEndDate: '종료일이 시작일보다 빠릅니다. 날짜를 다시 선택하세요.',
    workOrderLookupFailed: '작업지시 목록을 불러오지 못해 지금은 고를 수 없습니다.',
    lookupTruncated: '목록의 일부만 보입니다. 찾는 것이 없으면 담당자에게 문의하세요.',
    selectPlaceholder: '선택하세요',
    titlePlaceholder: '공지 제목을 입력하세요',
    bodyPlaceholder: '본문을 입력하세요',
    scopePlaceholder: '대상 범위를 선택하세요',
    workOrderPlaceholder: '대상 작업지시를 선택하세요',
  },

  detail: {
    publish: '게시',
    publishTitle: '이 공지를 게시할까요?',
    publishLead: '게시한 뒤에는 내용을 수정할 수 없습니다.',
    published: '공지를 게시했습니다.',
    close: '게시 종료',
    closeTitle: '공지 게시를 종료할까요?',
    /** ⭐ 지우는 것이 아니라 종료일을 당기는 것이다. */
    closeLead: '게시 종료일이 오늘로 변경됩니다. 공지와 확인 기록은 그대로 남습니다.',
    closed: '게시를 종료했습니다.',
    confirm: '확인',
    cancel: '취소',
    createdBy: '작성자',
    publishedAt: '게시 일시',
    period: '게시 기간',
    noEndDate: '종료일 미지정',
    /** 상세의 게시 기간 — 종료일이 없을 때(#361 시안). */
    periodOpen: (start: string): string => `${start}부터 (종료일 미지정)`,
    loadFailed: '공지를 불러오지 못했습니다.',
  },

  ack: {
    title: '확인 현황',
    /** ⭐ 확인을 요구하지 않은 공지에는 미확인자 목록이 뜻이 없다. */
    notRequired: '이 공지는 확인을 요구하지 않습니다.',
    pendingOnly: '미확인자만',
    who: '이름',
    state: '상태',
    at: '확인 일시',
    /** ⭐ 세 갈래를 같은 모양으로 그리지 않는다. */
    done: '확인',
    opened: '열람만 함',
    pending: '미확인',
    notAvailable: '—',
    /** 현장 작업자는 계정이 없어 사번으로 온다. */
    workerNote: '현장 단말(POP)에서 확인한 작업자는 사번으로 표시됩니다.',
    emptyTitle: '대상이 없습니다',
    empty: '이 공지의 확인 대상이 아직 없습니다.',
    loadFailed: '확인 현황을 불러오지 못했습니다.',
    /** ⚠ 분모를 셀 수 없는 범위가 있다. */
    noDenominator: '작업지시 대상 공지는 전체 인원을 알 수 없어 확인한 인원만 표시됩니다.',
  },
} as const;
