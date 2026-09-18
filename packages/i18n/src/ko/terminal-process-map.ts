/**
 * W-CO-06 단말기-공정 매핑 설정 — 어느 단말에서 어느 공정의 무엇을 열어 둘 것인가.
 *
 * ⭐ **8플래그는 보안이 아니라 오조작 방지다.** 보안 경계는 단말 토큰 하나뿐이다.
 * ⭐ **저장은 단말 단위 한 트랜잭션이다** — 표에서 뺀 공정은 지워진다.
 * ⭐ **등록 토큰을 발급해 QR 로 보이는 것이 이 화면이다** — 기기의 유일한 진입이다.
 */
export const terminalProcessMap = {
  title: '단말기-공정 매핑 설정',
  breadcrumbRoot: '시스템 관리',

  panes: {
    list: '단말 목록',
    terminal: '단말 정보',
    grid: '공정별 기능 구성',
  },

  filters: {
    search: '단말 코드 검색',
    searchPlaceholder: '단말 코드를 입력하세요',
    includeInactive: '중지 단말 포함',
    apply: '조회',
    clear: '초기화',
  },

  list: {
    code: '단말 코드',
    type: '유형',
    status: '운영 상태',
    registration: '등록 상태',
    registrationPending: '미등록',
    registrationComplete: '등록 완료',
    registrationUnknown: '확인 전',
    equipment: '설비',
    active: '사용',
    activeHeader: '사용 여부',
    inactive: '중지',
    notAvailable: '—',
    emptyTitle: '단말이 없습니다',
    empty: '조건에 맞는 단말이 없습니다. 조건을 넓히거나 새 단말을 등록하세요.',
    select: '고르기',
    selected: '고른 단말',
    loadFailed: '단말 목록을 불러오지 못했습니다.',
  },

  terminal: {
    create: '새 단말 등록',
    edit: '단말 수정',
    code: '단말 코드',
    /** ⛔ 등록 뒤에는 못 바꾼다 — 키다. */
    codeLocked: '등록한 뒤에는 바꿀 수 없습니다. 키로 쓰입니다.',
    plant: '공장',
    type: '유형',
    status: '운영 상태',
    registration: '등록 상태',
    equipment: '설치 설비',
    equipmentNone: '설비에 붙이지 않음',
    /** POP 이 「이 설비」를 전제로 도는 화면들이 이 값을 쓴다. */
    equipmentNote: 'POP 화면이 「이 설비」를 전제로 도는 자리에서 이 값을 씁니다.',
    codeListPending: '단말 유형 코드를 적으세요.',
    statusHelp: 'RUNNING 또는 STOPPED를 적으세요.',
    /** 설치 위치는 창고를 먼저 골라야 조회되는 자원이라 이 화면에서 열지 않는다. */
    locationOmitted: '설치 위치는 창고를 먼저 골라야 조회할 수 있어 이 화면에서 다루지 않습니다.',
    save: '저장',
    saving: '저장하는 중입니다.',
    saved: '단말 정보를 저장했습니다.',
    cancel: '취소',
    deactivate: '사용 중지',
    deactivated: '단말을 중지했습니다. 기록은 남습니다.',
    deactivateTitle: '이 단말을 중지할까요?',
    deactivateLead: '지우지 않고 끕니다 — 그 단말이 남긴 기록이 참조로 남아 있습니다.',
    deactivateConfirm: '중지',
    requiredCode: '단말 코드를 적으세요.',
    requiredPlant: '공장을 고르세요.',
    requiredType: '유형 코드를 적으세요.',
    requiredStatus: '운영 상태 코드를 적으세요.',
    plantLookupFailed: '공장 목록을 불러오지 못해 지금은 고를 수 없습니다.',
    equipmentLookupFailed: '설비 목록을 불러오지 못해 지금은 고를 수 없습니다.',
    lookupTruncated: '목록의 일부만 보입니다. 찾는 것이 없으면 담당자에게 문의하세요.',
    selectPlaceholder: '고르세요',
  },

  token: {
    issue: '등록 토큰 발급',
    title: '단말 등록 토큰',
    lead: '기기에서 QR을 스캔하거나 등록 코드를 붙여넣으세요. 기기가 서버 확인과 작업자 정보 수신을 마치면 등록 완료로 표시됩니다.',
    /** ⭐ 재발급하면 이전 기기가 끊긴다 — 계약이 세대 번호를 올린다. */
    reissueWarning:
      '재발급하면 이전에 등록한 기기가 모두 끊깁니다. 그 기기들은 다시 등록해야 합니다.',
    imageLabel: '단말 등록용 코드 그림',
    copy: '등록 코드 복사',
    copied: '등록 코드를 복사했습니다.',
    copyFailed: '복사하지 못했습니다. 브라우저의 클립보드 권한을 확인하세요.',
    copyUnavailable:
      '이 주소에서는 브라우저가 복사를 막아 등록 코드를 복사할 수 없습니다. 기기에서 QR을 스캔해 등록하세요.',
    copyError: '복사하지 못했습니다. 다시 시도하거나 기기에서 QR을 스캔해 등록하세요.',
    issuedAt: '발급 시각',
    expiresAt: '만료',
    noExpiry: '만료 없음',
    close: '닫기',
    failed: '등록 토큰을 발급하지 못했습니다. 다시 시도해 주세요.',
    textOmitted:
      '등록 코드는 화면에 표시하지 않습니다. QR을 스캔하거나 복사해 기기에 붙여넣으세요.',
  },

  grid: {
    process: '공정',
    /** 여덟 칸을 하나씩 누르지 않게 한 줄을 통째로 여닫는다. */
    openAll: '모두 열기',
    add: '공정 추가',
    addPlaceholder: '추가할 공정을 선택하세요',
    remove: '빼기',
    /** ⭐ 빠진 공정은 지워진다 — 그 사실을 표 옆에 적는다. */
    replaceNote:
      '저장하면 현재 목록 기준으로 이 단말의 구성이 바뀝니다. 목록에서 뺀 공정은 이 단말에서 제외됩니다.',
    /** ⭐ 0건이 정상인 단말이 있다. */
    emptyTitle: '공정 행이 없습니다',
    empty:
      '이 단말에는 열어 둔 공정이 없습니다. 창고 전용 단말은 0건이 정상입니다 — 오류가 아닙니다.',
    /** ⭐ 보안이 아니라 오조작 방지다. */
    /*
     * ⚠ 「체크하지 않은 기능은 쓸 수 없다」고 단정하지 않는다 — 서버가 공정 단위로 막는 것은
     * 작업 시작·라벨 발행뿐이고, 나머지는 POP 화면 목록을 가르거나(단말 전체 기준) 소비처가 없다.
     */
    purpose: '이 단말에서 사용할 기능을 공정별로 설정합니다.',
    save: '구성 저장',
    saved: '기능 구성을 저장했습니다.',
    saving: '저장하는 중입니다.',
    reset: '되돌리기',
    duplicate: '이미 표에 있는 공정입니다.',
    selectTerminalTitle: '단말을 선택해 주세요',
    selectTerminal: '왼쪽 목록에서 단말을 선택하면 상세 정보와 공정별 기능을 확인할 수 있습니다.',
    unselectedNote: '단말을 선택하면 공정별 기능을 설정할 수 있습니다.',
    loadFailed: '기능 구성을 불러오지 못했습니다.',
    processLookupFailed: '공정 목록을 불러오지 못해 지금은 더할 수 없습니다.',
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
    canInputMaterial: '자재 투입',
    canInputResult: '실적 입력',
    canInputInspection: '검사 입력',
    canPrintLabel: '라벨 발행',
    canCancelInput: '투입 취소',
    canReturnMaterial: '자재 반납',
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
