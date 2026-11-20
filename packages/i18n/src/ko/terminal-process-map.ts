/**
 * W-CO-06 단말기-공정 매핑 설정 — 어느 단말에서 어느 공정의 무엇을 열어 둘 것인가.
 *
 * ⭐ **8플래그는 보안이 아니라 오조작 방지다.** 보안 경계는 단말 토큰 하나뿐이다.
 * ⭐ **저장은 단말 단위 한 트랜잭션이다** — 표에서 뺀 공정은 지워진다.
 * ⭐ **등록 토큰을 발급해 QR 로 보이는 것이 이 화면이다** — 기기의 유일한 진입이다.
 */
export const terminalProcessMap = {
  title: '단말 관리',
  /** 메뉴에서 이 화면까지의 경로 — 다른 화면이 「어디로 가라」고 안내할 때 쓴다. 메뉴 라벨과 같아야 한다(app/nav-menu-path.test.ts). */
  menuPath: '시스템 관리 › 단말 관리',

  panes: {
    list: '단말 목록',
    terminal: '단말 정보',
    grid: '공정별 기능 구성',
    /* 위 조회 묶음(사용자 역할 권한 관리와 같은 틀 · omf-all-around#333). */
    search: '단말 조회 조건',
    settings: '단말 설정',
  },

  filters: {
    search: '단말 코드 검색',
    searchPlaceholder: '단말 코드를 입력하세요',
    /* 사용자 역할 권한 관리와 같은 말(#333). */
    includeInactive: '미사용 포함',
    apply: '조회',
    clear: '초기화',
  },

  list: {
    code: '단말 코드',
    type: '단말 유형',
    status: '운영 상태',
    registration: '등록 유무',
    registrationPending: '미등록',
    registrationComplete: '등록',
    registrationUnknown: '확인 전',
    equipment: '설치 설비',
    /** 피처 002 — 단말 창고. 없으면 공장 전체 기준이다. */
    warehouse: '창고',
    warehouseAll: '공장 전체',
    active: '사용',
    activeHeader: '사용 유무',
    inactive: '미사용',
    notAvailable: '—',
    emptyTitle: '단말이 없습니다',
    empty: '조건에 맞는 단말이 없습니다. 조건을 넓히거나 새 단말을 등록하세요.',
    select: '고르기',
    selected: '고른 단말',
    loadFailed: '단말 목록을 불러오지 못했습니다.',
  },

  chips: {
    label: '사용 상태',
    filterOn: (label: string): string => `${label}만 보기`,
    filterOff: (label: string): string => `${label} 거르기 해제`,
  },

  terminal: {
    create: '단말 추가',
    edit: '단말 수정',
    code: '단말 코드',
    /** ⛔ 등록 뒤에는 못 바꾼다 — 키다. */
    codeLocked: '등록 후 변경할 수 없습니다.',
    /** 수정 팝업의 단말 코드 옆(사용자 지시 2026-11-20 · #333). */
    codeReadOnly: '변경 불가',
    plant: '공장',
    type: '단말 유형',
    status: '운영 상태',
    registration: '등록 상태',
    /** 단말 정보 카드 — 설비 · 창고를 정하지 않았을 때(사용자 지시 2026-11-20 · #333). */
    unassigned: '미지정',
    registeredAt: '등록 일시',
    equipment: '설치 설비',
    equipmentNone: '미지정',
    plantPlaceholder: '공장 선택',
    typePlaceholder: '유형 선택',
    warehouse: '창고',
    warehouseAll: '공장 전체',
    register: '등록',
    /** 창고 칸 이름 오른쪽 안내 라벨(사용자 시안 2026-11-20 · #333). */
    warehouseScope: '작업 목록과 남은 작업 수는 선택한 창고 기준으로 표시됩니다.',
    optionalMark: '(선택)',
    save: '저장',
    saving: '저장하는 중입니다.',
    saved: '저장했습니다.',
    cancel: '취소',
    deactivate: '사용 중지',
    deactivated: '단말을 중지했습니다. 기록은 남습니다.',
    /* 사용자 · 역할 사용 중지 창과 같은 모양(#333). */
    deactivateTitle: '단말 사용 중지',
    deactivateCaption: '사용 중지 대상',
    deactivateMeta: (type: string): string => `단말 유형: ${type}`,
    deactivateQuestion: '이 단말의 사용을 중지하시겠습니까?',
    deactivateLead: '단말이 남긴 기록은 참조로 남아 있습니다.',
    deactivateConfirm: '사용 중지',
    requiredCode: '단말 코드를 적으세요.',
    requiredPlant: '공장을 고르세요.',
    requiredType: '유형 코드를 적으세요.',
    requiredStatus: '운영 상태 코드를 적으세요.',
    plantLookupFailed: '공장 목록을 불러오지 못해 지금은 고를 수 없습니다.',
    lookupTruncated: '목록의 일부만 보입니다. 찾는 것이 없으면 담당자에게 문의하세요.',
    selectPlaceholder: '고르세요',
  },

  token: {
    issue: '등록 토큰 발급',
    title: '단말 등록',
    lead: '등록할 기기에서 QR 코드를 스캔하세요.',
    imageLabel: '단말 등록용 코드 그림',
    copy: '등록 코드 복사',
    copied: '복사 완료',
    copyFailed: '복사하지 못했습니다. 브라우저의 클립보드 권한을 확인하세요.',
    copyUnavailable:
      '이 주소에서는 브라우저가 복사를 막아 등록 코드를 복사할 수 없습니다. 기기에서 QR을 스캔해 등록하세요.',
    copyError: '복사하지 못했습니다. 다시 시도하거나 기기에서 QR을 스캔해 등록하세요.',
    issuedAt: '발급 일시',
    expiresAt: '만료 일시',
    noExpiry: '만료 없음',
    close: '닫기',
    failed: '등록 토큰을 발급하지 못했습니다. 다시 시도해 주세요.',
    textOmitted: '복사한 코드는 기기의 등록 화면에 붙여넣으세요.',
  },

  grid: {
    process: '공정',
    /** 여덟 칸을 하나씩 누르지 않게 한 줄을 통째로 여닫는다. */
    openAll: '모든 기능',
    add: '공정 추가',
    addPlaceholder: '공정 선택',
    nothingToAdd: '추가할 공정이 없습니다.',
    /** 공정 행 관리 열 — 기능 칸과 성격이 다르다(이 단말의 구성에서 공정을 뺀다). */
    manage: '공정 제외',
    /** ⭐ 공정 마스터를 지우지 않는다 — 저장 때 이 단말의 공정 연결에서만 빠진다. */
    remove: '제외',
    /** ⭐ 공정이 없는 단말이 있다(창고 단말) — 빈 영역에 한 줄만(사용자 지시 2026-11-20 · #333). */
    emptyTitle: '설정된 공정이 없습니다.',
    /** 저장된 공정을 목록에서 뺐을 때 저장 단추 옆 경고(사용자 지시 2026-11-20 · #333). */
    removedWarning: '저장하면 목록에서 뺀 공정을 이 단말에서 사용할 수 없습니다.',
    save: '저장',
    saved: '저장했습니다.',
    saving: '저장하는 중입니다.',
    /** 저장하지 않은 변경을 버리고 마지막으로 불러온(저장된) 구성으로 돌아간다. */
    reset: '취소',
    duplicate: '이미 추가된 공정입니다.',
    noFlag: '작업지시 마감 말고 기능을 하나 이상 켜세요',
    selectTerminalTitle: '단말을 선택해 주세요.',
    selectTerminal: '선택한 단말의 정보와 공정별 기능을 확인할 수 있습니다.',
    noTerminalTitle: '단말이 없습니다.',
    loadFailed: '기능 구성을 불러오지 못했습니다.',
    processLookupFailed: '공정 목록을 불러오지 못해 지금은 공정을 추가할 수 없습니다.',
    lockLoading: '단말 구성을 불러오는 중입니다. 잠시 뒤 저장하세요.',
    lockFailed: '단말 구성을 불러오지 못해 저장할 수 없습니다. 다시 시도해 주세요.',
  },

  /**
   * 8플래그. ⛔ **승인 플래그는 만들지 않는다** — 계약에 없다.
   * ⚠ 이름만 보면 창고 작업이 있어 보이지만 실재하는 여덟은 전부 생산 축이다.
   */
  flags: {
    canStartWork: '작업 시작',
    canCompleteWork: '작업 완료',
    canCloseWorkOrder: '작업지시 마감',
    canInputMaterial: '자재 투입',
    canInputResult: '실적 입력',
    canInputInspection: '검사 입력',
    canPrintLabel: '라벨 발행',
    canCancelInput: '투입 취소',
    canReturnMaterial: '자재 반납',
  },

  /** 저장하지 않은 기능 구성을 두고 다른 단말로 옮길 때(사용자 역할 권한 관리와 같은 창 · #333). */
  discard: {
    title: '저장하지 않은 변경 사항이 있습니다',
    body: '지금 나가면 수정한 공정별 기능 설정이 사라집니다.',
  },
} as const;
