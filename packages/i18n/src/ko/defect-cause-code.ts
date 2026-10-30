/**
 * W-06-03 불량·원인코드 2계층 마스터.
 *
 * 불량 코드와 원인 코드는 같은 화면 부품을 쓰므로 문구도 한 벌이다.
 * 탭마다 달라지는 말은 `tabs`·`filters`에만 있고 나머지는 두 탭이 그대로 공유한다 —
 * 탭이 셋으로 늘어도 여기에 항목만 더하면 된다.
 */
export const defectCauseCode = {
  title: '불량·원인코드',
  breadcrumbRoot: '품질 관리',
  tabs: {
    defect: '불량코드',
    cause: '원인코드',
    mapping: '불량코드 공정 연결',
  },
  panes: {
    list: (tab: string): string => `${tab} 목록`,
    form: (tab: string): string => `${tab} 등록·편집`,
    mapping: '공정별 상세 불량코드 매핑',
  },
  /** 공정 매핑 탭(#209) — 불량코드 탭과 같은 짜임: 위 조회 카드 · 아래 표 카드 */
  mappingView: {
    searchLabel: '불량코드 검색',
    searchPlaceholder: '불량코드 또는 불량명을 입력하세요',
    rowHeader: '불량코드 · 명칭',
    categoryLabel: '대분류 선택',
    linkLabel: '연결 상태로 거르기',
    processLabel: '공정 선택',
    linked: '매핑',
    unlinked: '매핑 해제',
    noMatchTitle: '조건에 맞는 불량코드가 없습니다',
    noMatchDescription: '검색어를 줄이거나 초기화한 뒤 다시 찾으세요.',
    counts: (defects: number, processes: number): string =>
      `상세 불량코드 ${String(defects)}건 · 공정 ${String(processes)}건`,
  },
  actions: {
    addCategory: '대분류 추가',
    addChild: '하위 코드 추가',
  },
  actionReasons: {
    addChildNeedsCategory: '상세 추가는 대분류를 하나 고른 뒤에 쓸 수 있습니다.',
    parentLockedByChildren: '이 대분류 아래에 상세 코드가 있어서 상위 대분류를 바꿀 수 없습니다.',
    /** 다른 기록에서 쓰고 있어 코드가 잠겼을 때(수정 창 · 사용자 시안 #209) */
    codeLockedReferenced: '이 코드는 이미 다른 기록에서 쓰이고 있어서 바꿀 수 없습니다.',
  },
  loading: {
    codes: '코드 목록을 불러오는 중',
    codeDetail: '코드 정보를 불러오는 중',
    mapping: '공정 매핑을 불러오는 중',
  },
  /** 서버가 목록을 잘라 내려보냈을 때. 잘림을 감추지 않고 조건을 좁힐 방법을 함께 알린다. */
  listTruncated: (shown: number, total: number): string =>
    `전체 ${total}건 중 ${shown}건을 표시합니다. 조건을 좁혀 조회하세요.`,
  optionsTruncated: '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
  optionsLoadFailed: '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
  /** 상위가 목록에 없는 코드를 모으는 그룹. 감추면 사용자는 코드가 사라진 줄 안다. */
  groupHeaderOrphan: '상위를 찾을 수 없는 코드',
  categoryWarning: '대분류는 모든 현장에서 공통으로 사용됩니다.',
  parentListProvisional: '대분류 목록은 임시이며, 확정 후 변경될 수 있습니다.',
  empty: {
    codeNoneTitle: '아직 등록된 코드가 없습니다',
    codeNoneDescription: '「대분류 추가」로 첫 대분류를 등록하세요.',
    codeNoMatchTitle: '조건에 맞는 결과가 없습니다',
    codeNoMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
    codeNotSelected: '왼쪽에서 코드를 고르거나 「대분류 추가」로 시작하세요',
    codeNotSelectedTitle: '코드를 선택하세요',
    codeNotSelectedDescription: '목록에서 선택하면 상세 정보가 표시됩니다.',
    mappingNoneTitle: '매핑할 상세 불량코드가 없습니다',
    mappingNoneDescription: '불량코드 탭에서 대분류 아래에 상세 코드를 먼저 등록하세요.',
    processNoneTitle: '매핑할 공정이 없습니다',
    processNoneDescription: 'Routing 화면의 공정 마스터 탭에서 사용할 공정을 먼저 등록하세요.',
  },
  filters: {
    defectSearchLabel: '불량코드 검색',
    defectSearchPlaceholder: '불량코드 또는 불량명을 입력하세요',
    causeSearchLabel: '원인코드 검색',
    causeSearchPlaceholder: '원인코드 또는 원인명을 입력하세요',
    chipRemoveKeyword: '검색어 조건 제거',
    chipRemoveIncludeInactive: '미사용 포함 조건 제거',
    chipKeyword: (value: string): string => `검색어: ${value}`,
    /** 처분 유형 · 공정 조건(불량코드 탭 · #209) */
    disposition: '처분 유형 선택',
    process: '공정 검색',
    all: '전체',
    chipDisposition: (value: string): string => `처분 유형: ${value}`,
    chipProcess: (value: string): string => `공정: ${value}`,
    chipRemoveDisposition: '처분 유형 조건 제거',
    chipRemoveProcess: '공정 조건 제거',
  },
  fields: {
    code: '코드',
    name: '명칭',
    parent: '상위 대분류',
    isActive: '사용',
    kind: '구분',
    /** 불량코드 탭의 코드 · 이름 칸 이름(창 · 상세 · #209) */
    defectCode: '불량코드',
    defectName: '불량명',
    /** 원인코드 탭의 코드 · 이름 칸 이름 — 불량코드 탭과 같은 짜임(#209) */
    causeCode: '원인코드',
    causeName: '원인명',
    disposition: '처분 유형',
    process: '공정',
    nameKo: '한국어명',
    nameVi: '베트남어명',
    referenceCount: '사용된 기록',
  },
  /** 코드 검색 창(#209) — 검사 조회·판정의 품목 검색 창과 같은 모양 */
  picker: {
    title: (tab: string): string => `${tab} 검색`,
    keywordLabel: '검색어',
    search: '검색',
    cancel: '취소',
    pick: '선택',
    searching: '검색 중입니다.',
    noResult: '검색 결과가 없습니다.',
    searchFailed: '검색하지 못했습니다. 다시 시도하세요.',
    select: '선택',
    clear: (tab: string): string => `${tab} 검색 지우기`,
  },
  /** 공정 검색 창(#209) — 불량코드 검색 창과 같은 모양 */
  processPicker: {
    title: '공정 검색',
    placeholder: '공정코드 또는 공정명을 입력하세요',
    code: '공정코드',
    name: '공정명',
    fieldPlaceholder: '공정을 입력하세요',
    clear: '공정 검색 지우기',
  },
  /** 표의 대분류 · 상세 관계(사용자 지시 · #209) */
  tree: {
    childCount: (count: number): string => `하위 코드 ${String(count)}건`,
    collapse: '하위 코드 접기',
    expand: '하위 코드 펼치기',
  },
  /** 탭 줄 오른쪽 사용 여부 칩(사용자 지시 2026-10-29 · #209) */
  usage: {
    label: '사용 여부로 거르기',
    all: '전체',
    active: '사용',
    inactive: '미사용',
    /** 칩 글 — 「사용 6」처럼 건수를 붙인다(사용자 지시 · #209) */
    count: (label: string, count: number): string => `${label} ${String(count)}`,
  },
  /** 표 머리 문구(사용자 지시 2026-10-29 · #209). 폼 · 상세 이름표는 `fields` 를 그대로 쓴다. */
  listColumns: {
    defectCode: '불량코드',
    defectName: '불량명',
    causeCode: '원인코드',
    causeName: '원인명',
    kind: '구분',
    isActive: '사용 여부',
  },
  /** 상세 카드(omf-all-around#209) — 제목 · 상태 칩 · 이름표 상자, 수정은 창에서. */
  detail: {
    title: (tab: string): string => `${tab} 상세`,
    edit: '수정',
    chipActive: '사용',
    chipInactive: '미사용',
    kindCategory: '대분류',
    kindChild: '상세',
    /** 대분류 상세 아래 하위 코드 목록(#209) */
    childrenTitle: '하위 코드',
    childrenNone: '아직 등록된 하위 코드가 없습니다.',
  },
  /** 등록 · 수정 창(#209). 닫기는 「취소」로 한다. */
  dialog: {
    createCategoryTitle: (tab: string): string => `대분류 ${tab} 추가`,
    createChildTitle: (tab: string): string => `상세 ${tab} 추가`,
    editTitle: (tab: string): string => `${tab} 수정`,
    /** 코드 · 이름 칸 입력 안내 — 탭마다 다르다(사용자 지시 2026-10-29 · #209) */
    defectCodePlaceholder: '불량코드를 입력하세요',
    defectNamePlaceholder: '불량명을 입력하세요',
    causeCodePlaceholder: '원인코드를 입력하세요',
    causeNamePlaceholder: '원인명을 입력하세요',
  },
  values: {
    active: '사용 중',
    inactive: '미사용',
    noParent: '없음 (대분류)',
    /** 미사용 항목을 선택지에 남길 때 라벨 뒤에 붙인다. */
    inactiveSuffix: ' (미사용)',
    disposition: { REWORKABLE: '재작업 가능', SCRAP: '폐기' },
    /** 이 코드를 쓰는 기록 수 — 상세 조회에만 온다(#209) */
    referenceCount: (count: number): string => `${String(count)}건`,
    empty: '—',
    /** 그룹 머리글 — 대분류의 코드와 명칭을 함께 낸다. */
    groupHeader: (code: string, name: string): string => `${code} · ${name}`,
  },
  validation: {
    required: '필수 입력 항목입니다.',
    codeBlank: '코드는 공백만으로 지정할 수 없습니다.',
    parentSelfReference: '자기 자신을 상위로 지정할 수 없습니다.',
    parentMustBeCategory: '상위는 대분류만 지정할 수 있습니다. 계층은 2단계까지입니다.',
    parentBlockedByChildren: '하위 코드가 있어 상위를 지정할 수 없습니다. 계층은 2단계까지입니다.',
  },
  /** 되돌리기 어려운 액션이라 확인을 한 단계 둔다. 무엇이 일어나는지 먼저 밝힌다. */
  deactivate: {
    title: '사용 중지할까요?',
    description:
      '사용 중지하면 새 작업에서 이 코드를 선택할 수 없습니다. 기존 데이터는 유지됩니다.',
    confirm: '사용 중지',
    /*
     * 「표시된 목록 기준」이라고 적는 이유: 목록이 잘렸으면 하위 건수가 실제보다 적을 수 있다.
     * 「N건입니다」라고 단정하면 사실과 다른 안내가 된다.
     */
    childCount: (count: number): string => `연결된 하위 코드 ${String(count)}건이 있습니다.`,
  },
  mapping: {
    description: '선택하면 연결되고, 다시 선택하면 해제됩니다.',
    assigned: '매핑됨',
    notAssigned: '매핑 안 됨',
    saved: '공정 매핑을 반영했습니다',
    truncated: '불량코드 또는 공정 목록이 일부만 표시되어 전체 매핑을 편집할 수 없습니다.',
  },
} as const;
