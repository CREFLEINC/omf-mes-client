export const warehouseLocation = {
  title: '창고·Location',
  breadcrumbRoot: '기준정보 관리',
  /* 입고 관리 짜임(사용자 지시 2026-10-29) — 위 조건 상자 · 왼쪽 창고 목록 | 오른쪽 상세. */
  splitter: '끌어서 목록·상세 폭 조절',
  listCollapse: '창고 목록 접기',
  listExpand: '창고 목록 펼치기',
  panes: {
    filters: '창고 조회 조건',
    list: '창고 목록',
    detail: '창고 상세',
  },
  tabs: {
    warehouse: '창고 정보',
    location: 'Location',
    putaway: '적치 규칙',
  },
  actions: {
    addWarehouse: '창고 추가',
    addZone: '구역 추가',
    addRack: '랙 추가',
    configureRack: '층·셀 설정',
    generateLabel: '라벨 이미지 생성',
    activate: '다시 사용',
  },
  actionReasons: {
    locationHierarchyUnavailable: 'Location 계층을 불러온 뒤 추가할 수 있습니다.',
    generateLabelNeedsSelection: 'Location을 하나 이상 선택해 주세요.',
    /* 개발 진행 상황이 아니라 지금 되는지만 말한다(omf-all-around#17). */
    warehouseFixedInLocation: '좌측에서 선택한 창고로 고정됩니다.',
    /* 서버가 창고마다 두는 위치(적치 대기 · 창고 전체) — 별칭만 고친다(서버 #875). */
    systemLocation: '시스템이 만든 위치라 별칭만 바꿀 수 있습니다.',
    /* 위치 코드는 사람이 치지 않는다(사용자 지시 2026-10-29). */
    locationCodeIssued: 'MES가 자동으로 발행합니다.',
  },
  loading: {
    warehouses: '창고 목록을 불러오는 중',
    warehouseDetail: '창고 정보를 불러오는 중',
    locations: 'Location을 불러오는 중',
    locationDetail: '최신 Location 정보를 불러오는 중입니다.',
  },
  /** 서버가 목록을 잘라 내려보냈을 때. 잘림을 감추지 않고 조건을 좁힐 방법을 함께 알린다. */
  listTruncated: (shown: number, total: number): string =>
    `전체 ${total}건 중 ${shown}건을 표시합니다. 조건을 좁혀 조회하세요.`,
  optionsTruncated:
    '선택할 수 있는 항목이 일부만 표시될 수 있습니다. 찾는 항목이 없으면 담당자에게 문의해 주세요.',
  optionsLoadFailed: '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
  empty: {
    warehouseNoneTitle: '아직 등록된 창고가 없습니다',
    warehouseNoMatchTitle: '조건에 맞는 결과가 없습니다',
    locationNoneTitle: '등록된 Location이 없습니다',
    locationNoneDescription: '구역을 추가해 주세요.',
    locationNoMatchTitle: '조건에 맞는 Location이 없습니다',
    locationNoMatchDescription: '검색어를 지우면 전체 계층이 보입니다.',
    /* 창고를 고르기 전 오른쪽 자리 — 제목 + 안내(사용자 지시 2026-09-18 · omf-all-around#17). */
    warehouseNotSelectedTitle: '창고 정보',
    warehouseNotSelectedDescription: '창고를 먼저 선택하세요',
  },
  filters: {
    searchLabel: '창고 검색',
    searchPlaceholder: '창고 코드 또는 창고명',
    locationSearchLabel: 'Location 검색',
    locationSearchPlaceholder: '위치 코드 또는 별칭',
    plantAll: '전체 공장',
    typeAll: '전체 유형',
  },
  fields: {
    plant: '공장',
    businessUnit: '사업부',
    warehouseCode: '창고 코드',
    warehouseName: '창고명',
    warehouseType: '창고 유형',
    isExternal: '외부 창고',
    isDefect: '불량 창고',

    isActive: '사용 상태',
    warehouse: '창고',
    parentLocation: '상위 위치',
    locationCode: '위치 코드',
    locationLevel: '단계',
    aliasName: '별칭',
    locationType: '위치유형',
    allowMixedItem: '품목 혼적 허용',
    allowMixedLot: 'LOT 혼적 허용',
  },
  /** 값이 비었을 때 선택칸 안에 보이는 안내 — 값·검증과 무관하다. */
  values: {
    active: '사용 중',
    inactive: '미사용',
    currentParentOutsideList: '현재 상위 위치 (조회 목록 밖)',
    /** 미사용 항목을 선택지에 남길 때 라벨 뒤에 붙인다. */
    inactiveSuffix: ' (미사용)',
    /** 위치 단계(서버 `locationLevelCode`) — 창고 › 구역 › 랙 › 층 › 셀. */
    locationLevels: { ZONE: '구역', RACK: '랙', LEVEL: '층', CELL: '셀' },
  },
  validation: {
    required: '필수 입력 항목입니다.',
    codeBlank: '코드는 공백만으로 지정할 수 없습니다.',
    codeDuplicated: '이미 사용 중인 코드입니다. 다른 코드를 입력하세요.',
    aliasTooLong: (max: number): string => `별칭은 ${String(max)}자 이하로 입력하세요.`,
    parentLocationUnavailable: '상위 위치를 전체 Location 목록에서 확인할 수 없습니다.',
    locationLevelChanged: '같은 단계의 다른 상위로만 옮길 수 있습니다.',
  },
  locationTable: {
    expand: '하위 펼치기',
    collapse: '하위 접기',
    selectionLabel: 'Location 선택',
  },
  dialog: {
    createTitle: 'Location 추가',
    createZoneTitle: '구역 추가',
    createRackTitle: '랙 추가',
    editTitle: 'Location 수정',
  },
  /** 랙의 층 · 셀 설정 대화상자(사용자 지시 2026-10-29). */
  rackLayout: {
    title: '층·셀 설정',
    target: (code: string, name: string): string => `랙 ${code} · ${name}`,
    levelCount: '층 수',
    cellCount: '층마다 셀 수',
    countInvalid: (max: number): string => `1부터 ${String(max)}까지 숫자로 입력하세요.`,
    cannotShrink: (count: number): string =>
      `이미 ${String(count)}층이 있습니다. 줄이려면 층을 사용 중지하세요.`,
    summary: (levels: number, cells: number): string =>
      `층 ${String(levels)}개 · 셀 ${String(cells)}개를 새로 만듭니다.`,
    nothingToCreate: '새로 만들 위치가 없습니다.',
    previewLabel: '새로 만들 위치',
    more: (count: number): string => `외 ${String(count)}건`,
    shrinkNote: '이미 있는 층·셀은 그대로 둡니다. 셀이 더 많은 층은 줄이지 않습니다.',
    submit: '만들기',
    saving: (done: number, total: number): string => `만드는 중 ${String(done)}/${String(total)}`,
    created: (count: number): string => `위치 ${String(count)}개를 만들었습니다.`,
    stopped: (done: number, reason: string): string =>
      `${String(done)}개를 만든 뒤 멈췄습니다. ${reason} 다시 만들기를 누르면 남은 것만 만듭니다.`,
  },
  labelPreview: {
    title: 'Location 라벨 미리보기',
    notice: (count: number): string =>
      `${String(count)}건의 발행 기록을 만들었습니다. 서버가 생성한 이미지를 확인해 내려받으세요. 물리 인쇄는 이 화면에서 하지 않습니다.`,
    alt: (locationCode: string, issueSeq: number): string =>
      `${locationCode} Location 라벨 ${String(issueSeq)}회차`,
    /** 그림 아래 설명. 보이는 글자라 `alt`와 따로 둔다 — 둘은 같은 값이 아니다. */
    caption: (locationCode: string, issueSeq: number): string =>
      `${locationCode} · ${String(issueSeq)}회`,
    download: '이미지 내려받기',
    loadFailed: '라벨 이미지를 불러오지 못했습니다.',
    loadSummary: (success: number, failed: number, pending: number): string =>
      `이미지 성공 ${String(success)}건 · 실패 ${String(failed)}건 · 불러오는 중 ${String(pending)}건`,
    created: (count: number): string => `${String(count)}건의 Location 라벨을 생성했습니다.`,
  },
  labelIssue: {
    title: 'Location 라벨 재생성',
    notice: (count: number): string =>
      `선택한 Location 중 ${String(count)}건은 발행 이력이 있습니다. 새 회차를 만들 사유를 선택하세요.`,
    reason: '재발행 사유',
    confirm: '새 회차 생성',
  },
  /** 되돌리기 어려운 액션이라 확인을 한 단계 둔다. 무엇이 일어나는지 먼저 밝힌다. */
  deactivate: {
    title: '사용 중지할까요?',
    description: '삭제하지 않습니다. 사용 중지하면 새 작업에서 고를 수 없게 됩니다.',
    confirm: '사용 중지',
  },
  activate: {
    title: '다시 사용할까요?',
    description: '다시 사용하면 새 작업에서 이 항목을 선택할 수 있습니다.',
    confirm: '다시 사용',
  },
} as const;
