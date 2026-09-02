/**
 * W-CO-04 공지·전달 — 알릴 것을 쓰고, 게시하고, 누가 확인했는지 본다.
 *
 * ⛔⛔ **게시된 공지의 본문을 고치는 화면을 만들지 않는다** — 고치면 이미 확인한 사람이 다른
 * 것을 본 것이 되고, 확인 이력이 무엇에 대한 확인인지 알 수 없어진다.
 * ⭐ **종료는 지우는 것이 아니라 종료일을 당기는 것이다** — 확인 이력이 남아야 한다.
 * ⭐ **상태는 서버가 파생한다** — 상태를 직접 쓰는 액션을 만들지 않는다.
 */
export const notice = {
  title: '공지·전달',
  breadcrumbRoot: '알림',

  panes: {
    list: '공지 목록',
    detail: '공지',
    ack: '확인 현황',
  },

  filters: {
    search: '제목 검색',
    searchPlaceholder: '제목 일부를 적으세요',
    status: '상태',
    statusAll: '상태 전체',
    scope: '대상 범위',
    scopeAll: '범위 전체',
    activeOnly: '게시 중만',
    unacknowledgedByMe: '내가 아직 확인하지 않은 것만',
    from: '기간 시작',
    to: '기간 끝',
    /** ⭐ 시작일이 아니라 **겹침**으로 거른다 — 긴 공지가 조회 구간에서 빠지지 않는다. */
    periodNote: '게시 기간이 이 구간과 겹치는 공지를 찾습니다. 시작일 기준이 아닙니다.',
    /** ⛔ 기간은 필수가 아니다 — 계약이 그렇게 두었다. */
    periodOptional: '기간은 비워도 됩니다.',
    clear: '조건 지우기',
    invalidPeriod: '기간 끝이 시작보다 앞섭니다.',
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
    /** ⚠ 1차는 둘만 유효하다 — 나머지를 고르면 서버가 거부한다. */
    unsupported: '1차에서는 전사와 작업지시만 쓸 수 있습니다. 나머지는 서버가 거부합니다.',
    companyNote: '새로 만들어지는 계정도 자동으로 대상에 들어갑니다.',
  },

  list: {
    title: '제목',
    status: '상태',
    scope: '대상',
    period: '기간',
    ack: '확인',
    notAvailable: '—',
    /** ⭐ 분모를 셀 수 없는 범위가 있다 — 0으로 채우지 않는다. */
    ackOf: (done: number, total: number): string => `${String(done)} / ${String(total)}명`,
    ackDoneOnly: (done: number): string => `${String(done)}명`,
    ackNotRequired: '확인 안 받음',
    emptyTitle: '공지가 없습니다',
    empty: '조건에 맞는 공지가 없습니다. 조건을 넓히거나 새 공지를 쓰세요.',
    loadFailed: '공지 목록을 불러오지 못했습니다.',
    selectTitle: '공지를 고르세요',
    select: '왼쪽에서 공지를 고르면 내용과 확인 현황이 보입니다.',
  },

  form: {
    create: '새 공지 쓰기',
    edit: '공지 고치기',
    title: '제목',
    body: '본문',
    startDate: '시작일',
    endDate: '종료일',
    endDateNote: '비우면 종료일 없이 계속 게시됩니다.',
    acknowledgeRequired: '읽은 사람이 확인을 누르게 합니다',
    scope: '대상 범위',
    workOrder: '대상 작업지시',
    workOrderNote: '대상 범위가 작업지시일 때만 고릅니다.',
    save: '저장',
    saving: '저장하는 중입니다.',
    saved: '공지를 저장했습니다.',
    cancel: '취소',
    requiredTitle: '제목을 적으세요.',
    requiredBody: '본문을 적으세요.',
    requiredStartDate: '시작일을 고르세요.',
    requiredScope: '대상 범위를 고르세요.',
    requiredWorkOrder: '대상 작업지시를 고르세요.',
    workOrderNotAllowed: '대상 범위가 작업지시가 아니면 작업지시를 비웁니다.',
    unsupportedScope: '1차에서는 전사와 작업지시만 쓸 수 있습니다.',
    invalidDate: '달력에 없는 날짜입니다. 날짜를 다시 고르세요.',
    invalidEndDate: '종료일이 시작일보다 앞섭니다. 두 날짜를 다시 고르세요.',
    workOrderLookupFailed: '작업지시 목록을 불러오지 못해 지금은 고를 수 없습니다.',
    lookupTruncated: '목록의 일부만 보입니다. 찾는 것이 없으면 담당자에게 문의하세요.',
    selectPlaceholder: '고르세요',
    /** ⛔ 첨부 대상 유형이 미정이라 올릴 수 없다. */
    attachmentLocked: '첨부는 아직 열지 않았습니다. 첨부를 어디에 붙일지가 정해지면 열립니다.',
  },

  detail: {
    /** ⛔⛔ 게시 뒤에는 본문을 고칠 수 없다. */
    lockedAfterPublish:
      '게시한 공지는 본문을 고칠 수 없습니다. 이미 확인한 사람이 다른 것을 본 것이 되기 때문입니다. 고쳐야 하면 종료하고 새로 쓰세요.',
    publish: '게시',
    publishTitle: '이 공지를 게시할까요?',
    publishLead: '게시하면 본문이 잠깁니다. 고칠 수 있는 것은 게시 전까지입니다.',
    published: '공지를 게시했습니다.',
    close: '종료',
    closeTitle: '이 공지를 내릴까요?',
    /** ⭐ 지우는 것이 아니라 종료일을 당기는 것이다. */
    closeLead: '지우지 않고 종료일을 오늘로 당깁니다 — 확인 이력이 남아야 합니다.',
    closed: '공지를 종료했습니다.',
    confirm: '진행',
    cancel: '취소',
    acknowledge: '확인했습니다',
    acknowledged: '확인으로 기록했습니다.',
    dismiss: '확인 없이 닫기',
    dismissed: '확인하지 않고 닫은 것으로 기록했습니다.',
    /** ⭐ 확인을 요구한 공지는 닫을 수 없다 — 서버가 거부한다. */
    dismissLocked: '이 공지는 확인을 요구해 그냥 닫을 수 없습니다. 확인을 눌러 주세요.',
    createdBy: '작성자',
    publishedAt: '게시 시각',
    period: '게시 기간',
    noEndDate: '종료일 없음',
    loadFailed: '공지를 불러오지 못했습니다.',
  },

  ack: {
    title: '확인 현황',
    /** ⭐ 확인을 요구하지 않은 공지에는 미확인자 목록이 뜻이 없다. */
    notRequired: '이 공지는 확인을 요구하지 않아 확인 현황이 없습니다.',
    pendingOnly: '아직 확인하지 않은 사람만',
    who: '사람',
    state: '상태',
    at: '시각',
    /** ⭐ 세 갈래를 같은 모양으로 그리지 않는다. */
    done: '확인',
    opened: '열람(미확인)',
    pending: '미확인',
    notAvailable: '—',
    /** 현장 작업자는 계정이 없어 사번으로 온다. */
    workerNote: '현장 단말에서 확인한 사람은 사번으로 보입니다 — 계정을 갖지 않습니다.',
    emptyTitle: '대상이 없습니다',
    empty: '이 공지의 확인 대상이 아직 없습니다.',
    loadFailed: '확인 현황을 불러오지 못했습니다.',
    /** ⚠ 분모를 셀 수 없는 범위가 있다. */
    noDenominator: '작업지시 범위는 대상 인원을 셀 수 없어 확인한 수만 보입니다.',
  },

  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
    prev: '이전',
    next: '다음',
  },
} as const;
