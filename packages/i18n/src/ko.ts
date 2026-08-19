/**
 * 한국어 화면 문구. 화면에 보이는 텍스트의 정본이다.
 *
 * 작성 규칙
 * - 비활성 컨트롤의 사유는 「무엇이 막혔는지 + 어떻게 풀 수 있는지」를 함께 담는다. 감추지 않는다.
 * - 비활성 사유는 그 컨트롤의 이름으로 시작한다. 주어가 없으면 사유가 붙은 대상이
 *   시각적으로 끊겼을 때 복원할 단서가 없다. 여러 컨트롤이 공유하는 안내는 예외다.
 * - 구현 사정을 드러내는 말(내부 절차·기술 스택·시스템 구성)과 내부 이슈 번호를 넣지 않는다.
 *   사용자가 쓰지 않는 말은 화면에 내지 않는다.
 */

const common = {
  save: '저장',
  cancel: '취소',
  add: '추가',
  search: '조회',
  reset: '초기화',
  confirm: '확인',
  close: '닫기',
  deactivate: '사용 중지',
  saved: '저장했습니다',
  created: '등록했습니다',
  retry: '다시 시도',
  includeInactive: '미사용 포함',
  discardChangesConfirm: '입력한 내용이 저장되지 않았습니다. 변경을 파기할까요?',
  /*
   * 날짜 칸이 비었을 때 트리거에 보이는 글자. `TextField type="date"`는 브라우저가 `yyyy-mm-dd`
   * 마스크를 그려 줬지만 `DatePicker`의 트리거는 우리가 넣지 않으면 빈 칸으로 남는다.
   */
  selectDate: '날짜 선택',
} as const;

/**
 * 저장 충돌(409) 원인별 안내. 세 원인은 대응 방법이 서로 다르므로 문구를 나눈다.
 * 재조회하면 풀리는 상태이므로 모두 「최신 불러오기」 액션을 함께 낸다.
 */
const conflict = {
  reloadAction: '최신 불러오기',
  reloadNote: '최신 내용을 불러오면 입력한 내용은 사라집니다.',
  user: '다른 사용자가 먼저 저장했습니다. 최신 내용을 불러온 뒤 다시 저장하세요.',
  erpSync: '외부 시스템에서 이 항목이 다시 동기화됐습니다. 최신 내용을 불러온 뒤 다시 저장하세요.',
  workerLease:
    '다른 작업에서 이 항목을 처리하는 중입니다. 잠시 뒤 최신 내용을 불러와 다시 저장하세요.',
} as const;

/** 다시 불러와도 풀리지 않는 상태 — 재시도를 권하지 않는다. */
const stateLocked = {
  title: '지금은 저장할 수 없는 상태입니다',
  description: '이 항목의 현재 상태에서는 변경이 허용되지 않습니다. 상태를 먼저 확인하세요.',
} as const;

const httpError = {
  title: '요청을 처리하지 못했습니다',
  loadTitle: '목록을 불러오지 못했습니다',
  description: '잠시 뒤 다시 시도하세요. 반복되면 담당자에게 알려 주세요.',
  offline: '네트워크 연결이 끊겼습니다. 연결을 확인한 뒤 다시 시도하세요.',
  forbidden: '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
} as const;

/** 저장을 서버로 보내기 전에 멈춘 경우. 사용자가 다시 시도하면 풀린다. */
const save = {
  staleToken: '최신 정보를 불러오는 중입니다. 잠시 뒤 다시 저장하세요.',
} as const;

/**
 * 코드 수정이 잠긴 사유. 참조 건수를 문구에 넣기 위해 함수로 둔다.
 * 건수를 셀 수 없는 경우(count가 null) 건수를 지어내지 않고 사유만 밝힌다.
 */
const editability = {
  referenced: (count: number | null): string =>
    count === null
      ? '이미 다른 자료에서 사용 중이라 코드를 바꿀 수 없습니다.'
      : `이미 ${count}건에서 사용 중이라 코드를 바꿀 수 없습니다.`,
  notCountable: (_count: number | null): string =>
    '이 코드를 참조하는 자료의 수를 확인할 수 없어 코드를 잠급니다. 변경이 필요하면 담당자에게 문의하세요.',
  receivedFromErp: (_count: number | null): string =>
    '외부 시스템에서 받은 자료라 여기서 수정할 수 없습니다. 원본 시스템에서 변경하세요.',
  /** 잠긴 것은 확실하나 사유가 특정되지 않을 때. 사유를 지어내지 않고 잠금 사실만 밝힌다. */
  locked: '지금은 코드를 바꿀 수 없습니다. 변경이 필요하면 담당자에게 문의하세요.',
} as const;

/** 공통코드 값 목록이 확정되지 않은 선택지에 붙인다. 값을 지어내지 않는다. */
const pendingCode = {
  note: '선택지 준비 중입니다. 코드 목록이 확정되면 이 항목에서 고를 수 있습니다.',
  placeholder: '선택지 준비 중',
} as const;

const warehouseLocation = {
  title: '창고·Location',
  breadcrumbRoot: '기준정보',
  tabs: {
    warehouse: '창고 정보',
    location: 'Location',
  },
  actions: {
    addWarehouse: '창고 추가',
    addRootLocation: '최상위 추가',
    addChildLocation: '하위 추가',
    generateLabel: '라벨 이미지 생성',
    changeHistory: '변경 이력',
  },
  actionReasons: {
    addChildNeedsSingleSelection: '하위 추가는 Location을 하나만 선택했을 때 쓸 수 있습니다.',
    generateLabelUnavailable:
      '라벨 이미지는 아직 만들 수 없습니다. 생성 기능이 준비되면 이 버튼을 쓸 수 있습니다.',
    changeHistoryUnavailable:
      '변경 이력은 아직 볼 수 없습니다. 조회 기능이 준비되면 이 버튼을 쓸 수 있습니다.',
    plantFixedAfterCreate:
      '등록 후에는 공장을 바꿀 수 없습니다. 다른 공장이면 창고를 새로 등록하세요.',
    warehouseFixedInLocation: '좌측에서 선택한 창고로 고정됩니다.',
  },
  loading: {
    warehouses: '창고 목록을 불러오는 중',
    warehouseDetail: '창고 정보를 불러오는 중',
    locations: 'Location을 불러오는 중',
  },
  /** 서버가 목록을 잘라 내려보냈을 때. 잘림을 감추지 않고 조건을 좁힐 방법을 함께 알린다. */
  listTruncated: (shown: number, total: number): string =>
    `전체 ${total}건 중 ${shown}건을 표시합니다. 조건을 좁혀 조회하세요.`,
  optionsTruncated: '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
  optionsLoadFailed: '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
  empty: {
    warehouseNoneTitle: '아직 등록된 창고가 없습니다',
    warehouseNoneDescription: '「창고 추가」로 첫 창고를 등록하세요.',
    warehouseNoMatchTitle: '조건에 맞는 결과가 없습니다',
    warehouseNoMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
    locationNoneTitle: '등록된 Location이 없습니다',
    locationNoneDescription: '「최상위 추가」로 첫 Location을 등록하세요.',
    locationNoMatchTitle: '조건에 맞는 Location이 없습니다',
    locationNoMatchDescription: '검색어를 지우면 전체 계층이 보입니다.',
    warehouseNotSelected: '좌측에서 창고를 먼저 고르세요',
  },
  filters: {
    searchLabel: '창고 검색',
    searchPlaceholder: '창고코드 또는 창고명',
    locationSearchLabel: 'Location 검색',
    locationSearchPlaceholder: '위치코드 또는 위치명',
    typeAll: '전체 유형',
    chipRemoveKeyword: '검색어 조건 제거',
    chipRemoveType: '창고유형 조건 제거',
    chipRemoveIncludeInactive: '미사용 포함 조건 제거',
    chipKeyword: (value: string): string => `검색어: ${value}`,
    chipType: (label: string): string => `창고유형: ${label}`,
  },
  fields: {
    plant: '공장',
    businessUnit: '사업부',
    warehouseCode: '창고코드',
    warehouseName: '창고명',
    warehouseType: '창고유형',
    managementLevel: '관리수준',
    isExternal: '외부창고',
    partner: '거래처',
    isActive: '사용',
    warehouse: '창고',
    parentLocation: '상위 위치',
    locationCode: '위치코드',
    locationName: '위치명',
    locationType: '위치유형',
    qualityZone: '품질구역',
    storageCondition: '보관조건',
    allowMixedItem: '품목 혼적 허용',
    allowMixedLot: 'LOT 혼적 허용',
    capacityQty: '수용량',
    capacityUom: '수용량 단위',
    code: '코드',
    name: '명칭',
  },
  values: {
    active: '사용 중',
    inactive: '미사용',
    noParent: '없음 (최상위)',
    /** 미사용 항목을 선택지에 남길 때 라벨 뒤에 붙인다. */
    inactiveSuffix: ' (미사용)',
  },
  validation: {
    required: '필수 입력 항목입니다.',
    codeBlank: '코드는 공백만으로 지정할 수 없습니다.',
    codeDuplicated: '이미 사용 중인 코드입니다. 다른 코드를 입력하세요.',
    partnerRequiredForExternal: '외부창고이면 거래처를 지정해야 합니다.',
    capacityNeedsUom: '수용량과 단위는 함께 입력하거나 함께 비워야 합니다.',
    capacityInvalid: '수용량은 0 이상의 숫자로 입력하세요.',
  },
  locationTable: {
    expand: '하위 펼치기',
    collapse: '하위 접기',
    selectionLabel: 'Location 선택',
  },
  dialog: {
    createTitle: 'Location 추가',
    editTitle: 'Location 수정',
  },
  /** 되돌리기 어려운 액션이라 확인을 한 단계 둔다. 무엇이 일어나는지 먼저 밝힌다. */
  deactivate: {
    title: '사용 중지할까요?',
    description: '삭제하지 않습니다. 사용 중지하면 새 작업에서 고를 수 없게 됩니다.',
    confirm: '사용 중지',
  },
} as const;

/**
 * W-06-01 Routing(공정) 등록·관리.
 *
 * 상태 문구(작성중·확정·폐기)는 서버 코드 문자열이 확정되기 전이라 화면이 매핑해서 고른다 —
 * 매핑의 정본은 screens/routing/routing-status.ts 한 곳이다.
 */
const routing = {
  title: 'Routing(공정)',
  breadcrumbRoot: '기준정보',
  panes: {
    item: '품목',
    revision: 'Rev 목록',
    header: 'Routing 정보',
    operations: '공정 라인',
  },
  actions: {
    newRevision: '신규 Rev 발행',
    createRouting: 'Routing 등록',
    addOperation: '공정 추가',
    confirm: '확정',
    obsolete: '폐기',
    dependencies: '선후행 설정',
    compareRevisions: 'Rev 비교',
    changeHistory: '변경 이력',
    /*
     * 행 안의 아이콘 버튼은 보이는 글자가 없어 접근 이름이 곧 이름이다.
     * 표시 번호를 함께 넣어야 「수정」이 행마다 되풀이되지 않는다.
     */
    editOperation: (displayNo: number): string => `${displayNo}번 공정 수정`,
    removeOperation: (displayNo: number): string => `${displayNo}번 공정 삭제`,
  },
  actionReasons: {
    dependenciesUnavailable:
      '선후행 설정은 아직 할 수 없습니다. 공정 사이의 선후 관계를 정하는 방식이 정해지면 이 버튼을 쓸 수 있습니다.',
    compareRevisionsUnavailable:
      'Rev 비교는 아직 할 수 없습니다. 비교 기능이 준비되면 이 버튼을 쓸 수 있습니다.',
    changeHistoryUnavailable:
      '변경 이력은 아직 볼 수 없습니다. 조회 기능이 준비되면 이 버튼을 쓸 수 있습니다.',
    outsourcedUnavailable:
      '외주 공정은 아직 지정할 수 없습니다. 저장할 항목이 준비되면 이 확인칸을 쓸 수 있습니다.',
    /** 계약이 라인 1건 이상을 요구한다(위반 시 400 LINE_REQUIRED) — 화면이 먼저 막고 사유를 밝힌다. */
    confirmNeedsOperations: '확정은 공정을 1건 이상 등록해야 할 수 있습니다.',
    confirmNeedsDraft: '확정은 작성중 Rev에만 할 수 있습니다. 변경하려면 신규 Rev를 발행하세요.',
    /*
     * 확정하면 그 Rev는 더 이상 수정할 수 없다 — 저장하지 않은 편집은 되돌릴 길 없이 사라진다.
     * 잃기 전에 막는다.
     */
    confirmBlockedByUnsaved:
      '확정은 저장하지 않은 변경이 있으면 할 수 없습니다. 먼저 저장하거나 취소하세요.',
    obsoleteNeedsConfirmed: '폐기는 확정된 Rev에만 할 수 있습니다. 먼저 확정하세요.',
    /*
     * 발행하면 새 판이 선택돼 지금 판을 떠난다 — 저장하지 않은 편집은 그때 사라진다.
     */
    newRevisionBlockedByUnsaved:
      '신규 Rev 발행은 저장하지 않은 변경이 있으면 할 수 없습니다. 먼저 저장하거나 취소하세요.',
    /** 첫 Rev 등록 폼이 열려 있는 동안. 여러 컨트롤이 공유하는 안내라 무엇에 대한 안내인지로 시작한다. */
    transitionNeedsRouting: '확정·폐기는 Routing을 먼저 등록해야 할 수 있습니다.',
    /*
     * 확정·폐기 Rev에서는 공정 라인도 잠긴다. 여러 컨트롤(추가·수정·삭제·순서 이동·저장)이
     * 공유하는 안내라 컨트롤 이름이 아니라 무엇에 대한 안내인지로 시작한다(배치 규범 4의 이탈 조건).
     */
    operationsLocked:
      '공정 라인은 작성중 Rev에서만 편집할 수 있습니다. 변경하려면 신규 Rev를 발행하세요.',
    /*
     * 라인을 저장하면 헤더도 다시 불러온다(판 번호가 올라갈 수 있다) —
     * 그때 저장하지 않은 헤더 편집이 서버 값으로 되돌아간다. 조용히 잃지 않도록 먼저 막는다.
     */
    operationsSaveBlockedByHeader:
      '공정 저장은 Routing 정보에 저장하지 않은 변경이 있으면 할 수 없습니다. 먼저 저장하거나 취소하세요.',
    operationsSaveBlockedByInvalid:
      '공정 저장은 입력이 완성되지 않은 공정이 있으면 할 수 없습니다. 표에서 그 공정을 수정하세요.',
  },
  /** 확정·폐기 Rev의 편집 잠금 안내. 「어떻게 풀 것인가」를 함께 담는다. */
  stateLock: {
    title: '지금은 수정할 수 없는 Rev입니다',
    confirmed: '확정된 Rev는 수정할 수 없습니다. 변경하려면 신규 Rev를 발행하세요.',
    obsolete: '폐기된 Rev는 수정할 수 없습니다. 변경하려면 신규 Rev를 발행하세요.',
  },
  filters: {
    searchLabel: '품목 검색',
    searchPlaceholder: '품목코드 또는 품목명',
    onlyWithoutRouting: 'Routing 미보유만',
    chipRemoveKeyword: '검색어 조건 제거',
    chipRemoveOnlyWithoutRouting: 'Routing 미보유만 조건 제거',
    chipKeyword: (value: string): string => `검색어: ${value}`,
  },
  loading: {
    items: '품목 목록을 불러오는 중',
    revisions: 'Rev 목록을 불러오는 중',
    header: 'Routing 정보를 불러오는 중',
    operations: '공정 라인을 불러오는 중',
  },
  listTruncated: (shown: number, total: number): string =>
    `전체 ${total}건 중 ${shown}건을 표시합니다. 조건을 좁혀 조회하세요.`,
  optionsTruncated: '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
  optionsLoadFailed: '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
  empty: {
    itemNoneTitle: '등록된 품목이 없습니다',
    itemNoneDescription: '품목이 등록되면 이 목록에서 고를 수 있습니다.',
    itemNoMatchTitle: '조건에 맞는 품목이 없습니다',
    itemNoMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
    itemNotSelected: '좌측에서 품목을 먼저 고르세요',
    revisionNoneTitle: '등록된 Rev가 없습니다',
    revisionNoneDescription: '「Routing 등록」으로 첫 Rev를 만드세요.',
    revisionNotSelected: '가운데에서 Rev를 먼저 고르세요',
    operationNoneTitle: '등록된 공정이 없습니다',
    operationNoneDescription: '「공정 추가」로 첫 공정을 등록하세요.',
  },
  fields: {
    item: '품목',
    itemCode: '품목코드',
    itemName: '품목명',
    routingCode: 'Routing 코드',
    revision: 'Rev',
    status: '상태',
    effectiveFrom: '유효시작',
    effectiveTo: '유효종료',
    operationNo: '순서',
    process: '공정',
    operationName: '공정명',
    managedItems: '관리 항목',
    /** 단위를 라벨에 적는다 — 값만 보고는 분·초를 구분할 수 없다. */
    standardCycleTimeSec: '표준 C/T(초)',
    /** 허용 범위를 라벨에 적는다 — 퍼센트로 오입력하면 100배가 조용히 통과한다. */
    standardYieldRate: '표준 수율(0~1)',
    outsourced: '외주 공정',
    /** 행 안의 수정·삭제 열. 머리글이 없으면 보조기술이 열의 뜻을 읽을 수 없다. */
    rowActions: '편집',
  },
  /** 공정 라인의 관리 플래그 7종. 표에서는 켜진 것의 이름만 이어 낸다. */
  operationFlags: {
    mesManaged: 'MES 관리',
    materialInputManaged: '자재투입 관리',
    productionResultManaged: '실적 관리',
    inspectionManaged: '검사 관리',
    outputLotRequired: '산출 LOT 필수',
    equipmentRequired: '설비 필수',
    moldRequired: '금형 필수',
  },
  values: {
    draft: '작성중',
    confirmed: '확정',
    obsolete: '폐기',
    none: '없음',
    empty: '—',
    inactiveSuffix: ' (미사용)',
    revision: (version: number): string => `Rev ${version}`,
  },
  validation: {
    required: '필수 입력 항목입니다.',
    codeBlank: 'Routing 코드는 공백만으로 지정할 수 없습니다.',
    effectiveRangeReversed: '유효종료는 유효시작과 같거나 그 뒤여야 합니다.',
    operationNameBlank: '공정명은 공백만으로 지정할 수 없습니다.',
    /** 단위가 초이고 0은 불가다 — 라벨과 같은 말을 오류에도 적어야 무엇을 고칠지 알 수 있다. */
    cycleTimeInvalid: '표준 C/T는 0보다 큰 초 단위 숫자여야 합니다.',
    /** 퍼센트로 넣으면 여기서 막힌다. 막지 않으면 100배 오입력이 조용히 통과한다. */
    yieldRateInvalid: '표준 수율은 0과 1 사이의 비율이어야 합니다. 퍼센트가 아닙니다.',
  },
  dialog: {
    operationCreateTitle: '공정 추가',
    operationEditTitle: '공정 수정',
    /*
     * 되돌리기 어려운 전이라 확인을 한 단계 둔다. 무엇이 일어나는지와
     * 그 뒤에 무엇을 할 수 있는지를 먼저 밝힌다.
     */
    confirmTitle: '이 Rev를 확정할까요?',
    confirmDescription:
      '확정하면 이 Rev는 더 이상 수정할 수 없습니다. 변경하려면 신규 Rev를 발행해야 합니다.',
    obsoleteTitle: '이 Rev를 폐기할까요?',
    obsoleteDescription: '삭제하지 않습니다. 폐기하면 새 작업에서 이 Rev를 쓸 수 없게 됩니다.',
    /*
     * 순서 컬럼에 유일 제약이 있어 행 단위 저장이 성립하지 않는다 —
     * 이 창의 확인은 표에만 반영되고 서버 반영은 「저장」 한 번뿐이다. 그 사실을 감추지 않는다.
     */
    operationLocalNote: '확인을 누르면 표에만 반영됩니다. 「저장」을 눌러야 서버에 반영됩니다.',
  },
} as const;

/**
 * W-06-03 불량·원인코드 2계층 마스터.
 *
 * 불량 코드와 원인 코드는 같은 화면 부품을 쓰므로 문구도 한 벌이다.
 * 탭마다 달라지는 말은 `tabs`·`filters`에만 있고 나머지는 두 탭이 그대로 공유한다 —
 * 탭이 셋으로 늘어도 여기에 항목만 더하면 된다.
 */
const defectCauseCode = {
  title: '불량·원인코드',
  breadcrumbRoot: '기준정보',
  tabs: {
    defect: '불량코드',
    cause: '원인코드',
  },
  actions: {
    addCategory: '대분류 추가',
    addChild: '상세 추가',
  },
  actionReasons: {
    addChildNeedsCategory: '상세 추가는 대분류를 하나 고른 뒤에 쓸 수 있습니다.',
    parentLockedByChildren:
      '상위 대분류는 하위 코드가 있는 동안 바꿀 수 없습니다. 하위 코드를 다른 대분류로 옮기면 이 항목을 쓸 수 있습니다.',
    deactivateNeedsActive: '사용 중지는 이미 미사용인 코드에는 할 수 없습니다.',
  },
  loading: {
    codes: '코드 목록을 불러오는 중',
    codeDetail: '코드 정보를 불러오는 중',
  },
  /** 서버가 목록을 잘라 내려보냈을 때. 잘림을 감추지 않고 조건을 좁힐 방법을 함께 알린다. */
  listTruncated: (shown: number, total: number): string =>
    `전체 ${total}건 중 ${shown}건을 표시합니다. 조건을 좁혀 조회하세요.`,
  optionsTruncated: '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
  optionsLoadFailed: '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
  /** 상위가 목록에 없는 코드를 모으는 그룹. 감추면 사용자는 코드가 사라진 줄 안다. */
  groupHeaderOrphan: '상위를 찾을 수 없는 코드',
  categoryWarning:
    '대분류는 전사에서 공통으로 쓰는 축입니다. 추가하면 모든 현장에서 함께 쓰이므로 신중히 정하세요.',
  parentListProvisional:
    '대분류 목록은 아직 임시입니다. 확정되면 이 항목의 선택지가 바뀔 수 있습니다.',
  empty: {
    codeNoneTitle: '아직 등록된 코드가 없습니다',
    codeNoneDescription: '「대분류 추가」로 첫 대분류를 등록하세요.',
    codeNoMatchTitle: '조건에 맞는 결과가 없습니다',
    codeNoMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
    codeNotSelected: '왼쪽에서 코드를 고르거나 「대분류 추가」로 시작하세요',
  },
  filters: {
    defectSearchLabel: '불량코드 검색',
    defectSearchPlaceholder: '불량코드 또는 불량명',
    causeSearchLabel: '원인코드 검색',
    causeSearchPlaceholder: '원인코드 또는 원인명',
    chipRemoveKeyword: '검색어 조건 제거',
    chipRemoveIncludeInactive: '미사용 포함 조건 제거',
    chipKeyword: (value: string): string => `검색어: ${value}`,
  },
  fields: {
    code: '코드',
    name: '명칭',
    parent: '상위 대분류',
    isActive: '사용',
  },
  values: {
    active: '사용 중',
    inactive: '미사용',
    noParent: '없음 (대분류)',
    /** 미사용 항목을 선택지에 남길 때 라벨 뒤에 붙인다. */
    inactiveSuffix: ' (미사용)',
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
    description: '삭제하지 않습니다. 사용 중지하면 새 작업에서 고를 수 없게 됩니다.',
    confirm: '사용 중지',
    /*
     * 「표시된 목록 기준」이라고 적는 이유: 목록이 잘렸으면 하위 건수가 실제보다 적을 수 있다.
     * 「N건입니다」라고 단정하면 사실과 다른 안내가 된다.
     */
    childCount: (count: number): string =>
      `이 대분류에는 표시된 목록 기준 하위 상세 코드 ${count}건이 있습니다.`,
  },
} as const;

/**
 * W-06-10 연계 동기화 현황·실패 재처리.
 *
 * 이 저장소의 첫 조회 형 화면이다 — 목록을 읽는 것이 주 동작이고 쓰기는 재처리뿐이다.
 *
 * 상태·연계 종류·방향·대상 유형의 코드 값 목록이 확정되지 않았다. 화면은 이름을 지어내지 않고
 * 모르는 코드를 코드 문자열 그대로 낸다 — 여기에 값 목록을 채워 넣지 않는다.
 */
const integrationSync = {
  title: '연계 동기화 현황',
  breadcrumbRoot: '기준정보',
  fields: {
    periodFrom: '기간 시작',
    periodTo: '기간 종료',
    status: '상태',
    interfaceCode: '연계 종류',
    direction: '방향',
    targetType: '대상 유형',
    retryMin: '시도 횟수 하한',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    retry: '재처리',
    /*
     * 행 안의 버튼은 보이는 글자가 행마다 같다. 접근 이름에 메시지 키를 넣어 어느 건인지 밝히되,
     * 보이는 글자를 그대로 담는다 — 담지 않으면 음성 조작이 「재처리」로 이 버튼을 부를 수 없다.
     */
    retryRow: (messageKey: string): string => `${messageKey} 재처리`,
    reload: '다시 조회',
    batchRetry: '선택 일괄 재처리',
  },
  /**
   * 선택 일괄 재처리. **부분 실패를 허용한다** — 전체를 되돌리지 않으므로
   * 성공 건수와 실패 건별 사유를 함께 낸다.
   */
  batch: {
    selectionCount: (count: number): string => `선택 ${String(count)}건`,
    confirmTitle: (count: number): string => `선택한 ${String(count)}건을 다시 보낼까요?`,
    confirmDescription: '일부만 성공할 수 있습니다. 결과를 건별로 알려 드립니다.',
    resultTitle: '재처리 결과',
    failedListLabel: '보내지 못한 건',
    allSucceeded: (count: number): string => `${String(count)}건을 다시 보냈습니다.`,
    partial: (succeeded: number, failed: number): string =>
      `${String(succeeded)}건을 다시 보냈습니다. ${String(failed)}건은 보내지 못했습니다.`,
    /** 서버가 준 위치 번호가 보낸 건수 밖일 때. 그 항목을 버리지 않고 이렇게 밝힌다. */
    unknownItem: '어느 건인지 알 수 없습니다.',
    noReason: '사유를 받지 못했습니다.',
  },
  /**
   * 재처리 — 같은 메시지 키로 다시 보낸다. 새 건을 만들지 않는다.
   * 되돌리기 쉽지 않은 조작이라 확인을 한 단계 둔다.
   */
  retry: {
    confirmTitle: '다시 보낼까요?',
    confirmDescription: '같은 메시지 키로 다시 보냅니다. 새 건을 만들지 않습니다.',
    requested: '다시 보내도록 요청했습니다',
  },
  /**
   * 재처리 실패. 「저장」 어휘를 쓰는 공통 배너를 쓰지 않는다 —
   * 이 화면의 쓰기는 저장이 아니라 재처리 요청이라 「다시 저장하세요」가 뜻을 잃는다.
   */
  retryError: {
    title: '다시 보내지 못했습니다',
    /** 상태가 실패가 아닌 건. 서버 문구가 비어도 이 안내는 남는다. */
    notRetryable: '지금 상태에서는 다시 보낼 수 없습니다. 목록을 다시 조회해 상태를 확인하세요.',
    workerLease: '이 건을 처리하는 작업이 진행 중입니다. 잠시 뒤 다시 시도하세요.',
    /** 시작 시각을 알 때. 모르면 위 문구를 그대로 쓴다 — 시각을 지어내지 않는다. */
    workerLeaseAt: (time: string): string =>
      `이 건을 처리하는 작업이 ${time}부터 진행 중입니다. 잠시 뒤 다시 시도하세요.`,
    user: '다른 사용자가 이 건을 먼저 처리했습니다. 목록을 다시 조회해 상태를 확인하세요.',
    erpSync: '외부 시스템에서 이 건이 다시 동기화됐습니다. 목록을 다시 조회해 상태를 확인하세요.',
  },
  /** 목록 표의 머리글. 열 구성의 근거는 screens/integration-sync/message-table.tsx에 있다. */
  table: {
    messageKey: '메시지 키',
    interfaceCode: '연계 종류',
    status: '상태',
    retryCount: '시도',
    createdAt: '생성',
    lastErrorMessage: '마지막 오류',
    retry: '재처리',
  },
  /** 비활성 사유는 그 컨트롤의 이름으로 시작한다. */
  reasons: {
    searchNeedsPeriod: '조회는 기간을 모두 채운 뒤에 쓸 수 있습니다. 시작일과 종료일을 고르세요.',
    periodReversed: '기간 종료는 기간 시작보다 앞설 수 없습니다.',
    batchNeedsSelection: '선택 일괄 재처리는 목록에서 건을 고른 뒤에 쓸 수 있습니다.',
  },
  loading: {
    messages: '연계 메시지 목록을 불러오는 중',
    messageDetail: '연계 메시지 정보를 불러오는 중',
  },
  /**
   * 상세. 목록에 없는 항목만 여기서 늘어난다.
   *
   * 전송 내용(전문)은 **구획만 두고 값을 그리지 않는다** — 열람 범위가 정해지지 않았다.
   */
  detail: {
    title: '연계 메시지 상세',
    openAction: (messageKey: string): string => `${messageKey} 상세 열기`,
    direction: '방향',
    target: '대상',
    createdAt: '생성',
    availableAt: '다음 시도',
    sentAt: '전송',
    completedAt: '완료',
    lockedBy: '처리 중',
    lastErrorMessage: '마지막 오류',
    payload: '전송 내용',
    payloadAction: '전송 내용 보기',
    payloadLocked: '전송 내용은 열람 범위가 정해진 뒤에 볼 수 있습니다. 지금은 표시하지 않습니다.',
    /*
     * 대상은 유형 코드와 번호를 그대로 낸다. 유형에서 어느 목록을 찾을지의 지도가 없어
     * 화면이 이름을 만들 수 없다 — 지어내지 않는다.
     */
    targetValue: (typeCode: string, id: number): string => `${typeCode} · ${String(id)}`,
    lockedValue: (worker: string, at: string): string => `${worker} (${at})`,
  },
  /**
   * 상태 열의 보조 한 줄. 계약이 정의한 사실만 옮긴다 —
   * 「잠금이 오래됐다」·「재시도 한도를 넘었다」 같은 판정은 하지 않는다.
   */
  status: {
    failed: '실패',
    processing: (time: string): string => `${time}부터 처리 중`,
    /** 처리 중인 것은 분명한데 시작 시각이 없을 때. 시각을 지어내지 않는다. */
    processingNoTime: '처리 중',
    autoRetry: (time: string): string => `${time} 자동 재시도`,
  },
  /**
   * 조건 줄. 선택지는 조회한 기록에서 만들므로 그 한계를 문구가 함께 밝힌다 —
   * 「한 번도 실행되지 않은 것」만 적으면 기간·범위 밖의 값이 빠진 사실이 숨는다.
   */
  filters: {
    all: '전체',
    optionsNote:
      '선택지는 조회한 기간의 기록에서 만듭니다. 한 번도 실행되지 않았거나 이 기간에 없는 값은 목록에 없습니다.',
    chipStatus: (value: string): string => `상태: ${value}`,
    chipInterface: (value: string): string => `연계 종류: ${value}`,
    chipDirection: (value: string): string => `방향: ${value}`,
    chipTargetType: (value: string): string => `대상 유형: ${value}`,
    chipRetryMin: (value: string): string => `시도 횟수 하한: ${value}`,
    chipRemoveStatus: '상태 조건 제거',
    chipRemoveInterface: '연계 종류 조건 제거',
    chipRemoveDirection: '방향 조건 제거',
    chipRemoveTargetType: '대상 유형 조건 제거',
    chipRemoveRetryMin: '시도 횟수 하한 조건 제거',
  },
  /**
   * 쪽 이동. 번호 목록을 두지 않는다 — 로그성 조회에서 「7쪽으로 점프」는 정상 경로가 아니고,
   * 조건을 좁히는 것이 정상 경로다.
   */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  empty: {
    noResultTitle: '조건에 맞는 기록이 없습니다',
    noResultDescription: '기간을 넓히거나 조건을 줄인 뒤 다시 조회하세요.',
    noPeriodTitle: '기간을 고르고 조회하세요',
    noPeriodDescription: '연계 기록은 기간을 정해야 조회할 수 있습니다.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
  },
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
  },
} as const;

/**
 * W-06-02 검사기준 등록. 버전 마스터 형 화면의 두 번째 벌이라 문구 구조는 `routing`과 같다.
 *
 * **샘플 크기의 라벨과 검증 문구는 단위 `%`를 담는다.** 받는 값이 비율이라 단위를 적지 않으면
 * 30을 30개로 읽는다. 「수량」·「개수」로 되돌리지 않는다 — 수량은 검사 시점에 로트 크기로
 * 환산되는 파생값이고 이 화면이 정하는 것이 아니다(#201).
 */
const inspectionStandard = {
  title: '검사기준 등록',
  breadcrumbRoot: '기준정보',
  panes: {
    plan: '검사기준',
    version: '버전 목록',
    planForm: '기준 정보',
    versionForm: '버전 정보',
    items: '검사 항목',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    excelUpload: '엑셀 올리기',
    addPlan: '기준 추가',
    approve: '승인',
    createVersion: '버전 등록',
    newRevision: '신규 버전 발행',
    confirm: '확정',
    obsolete: '폐기',
    compareVersions: '버전 비교',
    changeHistory: '변경 이력',
    addItem: '항목 추가',
    /*
     * 행 안의 아이콘 버튼은 보이는 글자가 없어 접근 이름이 곧 이름이다.
     * 표시 번호를 함께 넣어야 「수정」이 행마다 되풀이되지 않는다.
     */
    editItem: (displayNo: number): string => `${String(displayNo)}번 항목 수정`,
    removeItem: (displayNo: number): string => `${String(displayNo)}번 항목 삭제`,
  },
  actionReasons: {
    excelUploadUnavailable:
      '엑셀 올리기는 아직 할 수 없습니다. 양식이 정해지면 이 버튼을 쓸 수 있습니다.',
    /*
     * 계약의 라우팅 조회가 품목을 필수 쿼리로 둔다 — 품목을 비운 「전 품목 공통 기준」에는
     * 고를 수 있는 라우팅 자체가 없다. 값을 고를 수 없는 칸을 활성으로 두면
     * 사용자가 무엇이 막혔는지 모르고, 감추면 「이 화면에는 없는 항목」으로 오해한다.
     */
    routingNeedsItem: '라우팅은 품목을 고른 뒤에 고를 수 있습니다. 먼저 품목을 고르세요.',
    approveAlreadyDone: '승인은 이미 승인된 기준에 다시 할 수 없습니다.',
    approveNeedsPlan: '승인은 기준을 먼저 등록해야 할 수 있습니다.',
    deactivateAlreadyDone: '사용 중지는 이미 미사용인 기준에 다시 할 수 없습니다.',
    deactivateNeedsPlan: '사용 중지는 기준을 먼저 등록해야 할 수 있습니다.',
    /*
     * 발행하면 새 버전이 선택돼 지금 버전을 떠난다 — 저장하지 않은 편집은 그때 사라진다.
     */
    newVersionBlockedByUnsaved:
      '신규 버전 발행은 저장하지 않은 변경이 있으면 할 수 없습니다. 먼저 저장하거나 취소하세요.',
    confirmNeedsDraft: '확정은 작성중 버전에만 할 수 있습니다. 변경하려면 신규 버전을 발행하세요.',
    /* 계약이 항목 1건 이상을 요구한다(위반 시 400 LINE_REQUIRED) — 화면이 먼저 막고 사유를 밝힌다. */
    confirmNeedsItems: '확정은 검사 항목을 1건 이상 저장해야 할 수 있습니다.',
    /*
     * 확정하면 그 버전은 더 이상 수정할 수 없다 — 저장하지 않은 편집은 되돌릴 길 없이 사라진다.
     */
    confirmBlockedByUnsaved:
      '확정은 저장하지 않은 변경이 있으면 할 수 없습니다. 먼저 저장하거나 취소하세요.',
    obsoleteNeedsConfirmed: '폐기는 확정된 버전에만 할 수 있습니다. 먼저 확정하세요.',
    /** 여러 컨트롤이 공유하는 안내라 무엇에 대한 안내인지로 시작한다. */
    transitionNeedsVersion: '확정·폐기는 버전을 먼저 등록해야 할 수 있습니다.',
    compareVersionsUnavailable:
      '버전 비교는 아직 할 수 없습니다. 비교 기능이 준비되면 이 버튼을 쓸 수 있습니다.',
    changeHistoryUnavailable:
      '변경 이력은 아직 볼 수 없습니다. 조회 기능이 준비되면 이 버튼을 쓸 수 있습니다.',
    /*
     * 확정·폐기 버전에서는 검사 항목도 잠긴다. 여러 컨트롤(추가·수정·삭제·순서 이동·저장)이
     * 공유하는 안내라 컨트롤 이름이 아니라 무엇에 대한 안내인지로 시작한다(배치 규범 4의 이탈 조건).
     */
    versionLocked:
      '검사 항목은 작성중 버전에서만 편집할 수 있습니다. 변경하려면 신규 버전을 발행하세요.',
    /*
     * 항목을 저장하면 버전 정보도 다시 불러온다 — 그때 저장하지 않은 버전 편집이
     * 서버 값으로 되돌아간다. 조용히 잃지 않도록 먼저 막는다.
     */
    itemsSaveBlockedByHeader:
      '항목 저장은 버전 정보에 저장하지 않은 변경이 있으면 할 수 없습니다. 먼저 저장하거나 취소하세요.',
    itemsSaveBlockedByInvalid:
      '항목 저장은 저장할 수 없는 항목이 섞여 있으면 할 수 없습니다. 표에서 그 항목을 수정하세요.',
  },
  /**
   * 서버가 코드로만 알려 주는 거부 사유의 화면 문구.
   * **서버 문구가 비어 있어도 무엇을 하라는 안내가 남아야 한다** — 실제로 빈 문구가 온다.
   */
  serverErrors: {
    confirmedVersionRequired: '승인은 확정된 버전이 있어야 할 수 있습니다. 버전을 먼저 확정하세요.',
    lineRequired: '확정은 검사 항목을 1건 이상 저장해야 할 수 있습니다.',
  },
  /** 확정·폐기 버전의 편집 잠금 안내. 「어떻게 풀 것인가」를 함께 담는다. */
  stateLock: {
    title: '지금은 수정할 수 없는 버전입니다',
    confirmed: '확정된 버전은 수정할 수 없습니다. 변경하려면 신규 버전을 발행하세요.',
    obsolete: '폐기된 버전은 수정할 수 없습니다. 변경하려면 신규 버전을 발행하세요.',
  },
  dialog: {
    approveTitle: '이 검사기준을 승인할까요?',
    /* 계약이 승인 해제를 제공하지 않는다 — 되돌릴 수 없다는 사실을 먼저 밝힌다. */
    approveDescription:
      '승인하면 되돌릴 수 없습니다. 승인 해제는 제공되지 않습니다. 승인자와 승인 시각은 서버가 기록합니다.',
    deactivateTitle: '이 검사기준을 사용 중지할까요?',
    deactivateDescription:
      '삭제하지 않습니다. 사용 중지하면 새 검사에서 이 기준을 쓸 수 없게 됩니다.',
    confirmTitle: '이 버전을 확정할까요?',
    confirmDescription:
      '확정하면 이 버전은 더 이상 수정할 수 없습니다. 변경하려면 신규 버전을 발행해야 합니다.',
    obsoleteTitle: '이 버전을 폐기할까요?',
    obsoleteDescription: '삭제하지 않습니다. 폐기하면 새 검사에서 이 버전을 쓸 수 없게 됩니다.',
    itemCreateTitle: '검사 항목 추가',
    itemEditTitle: '검사 항목 수정',
    /*
     * 순서 컬럼에 유일 제약이 있어 행 단위 저장이 성립하지 않는다 —
     * 이 창의 확인은 표에만 반영되고 서버 반영은 「저장」 한 번뿐이다. 그 사실을 감추지 않는다.
     */
    itemLocalNote: '확인을 누르면 표에만 반영됩니다. 「저장」을 눌러야 서버에 반영됩니다.',
  },
  filters: {
    searchLabel: '검사기준 검색',
    searchPlaceholder: '기준코드 또는 기준명',
    inspectionType: '검사 유형',
    typeAll: '전체 유형',
    chipKeyword: (value: string): string => `검색어: ${value}`,
    chipInspectionType: (label: string): string => `검사 유형: ${label}`,
    chipRemoveKeyword: '검색어 조건 제거',
    chipRemoveInspectionType: '검사 유형 조건 제거',
    chipRemoveIncludeInactive: '미사용 포함 조건 제거',
  },
  loading: {
    plans: '검사기준 목록을 불러오는 중',
    planDetail: '기준 정보를 불러오는 중',
    versions: '버전 목록을 불러오는 중',
    versionDetail: '버전 정보를 불러오는 중',
    items: '검사 항목을 불러오는 중',
  },
  optionsTruncated: '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
  optionsLoadFailed: '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
  empty: {
    planNoneTitle: '등록된 검사기준이 없습니다',
    planNoneDescription: '「기준 추가」로 첫 검사기준을 등록하세요.',
    planNoMatchTitle: '조건에 맞는 검사기준이 없습니다',
    planNoMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
    /*
     * 결과는 있는데 **이 쪽에는** 없다. 주소를 손으로 고치거나 조건이 좁아졌을 때 생긴다 —
     * 「등록된 것이 없다」로 내면 사실과 다른 안내가 된다.
     */
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
    planNotSelected: '좌측에서 검사기준을 먼저 고르세요',
    versionNoneTitle: '등록된 버전이 없습니다',
    versionNoneDescription: '「버전 등록」으로 첫 버전을 만드세요.',
    versionNotSelected: '가운데에서 버전을 먼저 고르세요',
    itemNoneTitle: '등록된 검사 항목이 없습니다',
    itemNoneDescription: '「항목 추가」로 첫 항목을 등록하세요.',
  },
  fields: {
    inspectionPlanCode: '기준코드',
    inspectionPlanName: '기준명',
    inspectionType: '검사 유형',
    item: '품목',
    process: '공정',
    routing: '라우팅',
    approval: '승인',
    active: '사용',
    planVersion: '버전',
    status: '상태',
    effectiveFrom: '유효시작',
    effectiveTo: '유효종료',
    samplingMethod: '샘플링 방법',
    /*
     * **단위를 라벨에 박는다.** 받는 값이 백분율인데 라벨이 그것을 말하지 않으면
     * 30을 30개로 읽는다(#201).
     */
    samplingRatio: '샘플 비율(%)',
    aqlValue: 'AQL',
    acceptanceNumber: '합격판정개수',
    rejectionNumber: '불합격판정개수',
    inspectionFrequency: '검사 주기',
    frequencyIntervalValue: '주기 값',
    frequencyIntervalUom: '주기 단위',
    sequence: '순서',
    /** 표의 「항목」 열 — 코드와 이름을 한 칸에 담는다. `item`(품목)과 다른 것이다. */
    itemSpec: '항목',
    dataType: '자료형',
    targetRange: '목표·범위',
    measurementCount: '측정 횟수',
    judgment: '판정',
    /** 행 안의 수정·삭제 열. 머리글이 없으면 보조기술이 열의 뜻을 읽을 수 없다. */
    rowActions: '편집',
    inspectionItemCode: '항목코드',
    inspectionItemName: '항목명',
    uom: '단위',
    targetValue: '목표값',
    lowerLimit: '하한',
    upperLimit: '상한',
    inspectionMethod: '검사 방법',
    defaultInspectionEquipment: '지정 검사장비',
    requiredFlag: '필수',
    automaticJudgment: '자동판정',
  },
  /** 입력칸 아래 한 줄 보조 안내. */
  fieldNotes: {
    /* 상태 값 목록이 확정되지 않았다는 사실을 감추지 않는다. */
    statusTemporary: '상태 표시는 임시입니다 — 상태 값 목록이 확정되면 이 표시가 바뀔 수 있습니다.',
  },
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
    inactiveSuffix: ' (미사용)',
    /** 「전 품목 공통 기준」. 계약이 품목 널을 허용한다 — 빈 칸으로 두면 빠뜨린 것처럼 보인다. */
    allItems: '전 품목 공통',
    /*
     * 승인자 **이름을 만들지 않는다.** 계약이 주는 것은 사용자 번호이고
     * 이름을 만들려면 이 화면의 관심사가 아닌 사용자 조회가 필요하다 — 시각만 낸다.
     */
    approvedAt: (at: string): string => `승인됨 · ${at}`,
    notApproved: '미승인',
    active: '사용',
    inactive: '미사용',
    routingOption: (code: string, version: number): string => `${code} · Rev ${String(version)}`,
    version: (planVersion: number): string => `버전 ${String(planVersion)}`,
    draft: '작성중',
    confirmed: '확정',
    obsolete: '폐기',
    none: '없음',
    /** 「코드 · 이름」. 코드가 앞에 온다 — 중복 검증의 대상이라 훑을 수 있어야 한다. */
    itemLabel: (code: string, name: string): string => `${code} · ${name}`,
    /** 목표·하한~상한·단위를 한 칸에 담는다. 없는 값은 지어내지 않고 자리를 비워 표기한다. */
    range: (lower: string, upper: string): string => `${lower}~${upper}`,
  },
  validation: {
    required: '필수 입력 항목입니다.',
    planCodeBlank: '기준코드는 공백만으로 지정할 수 없습니다.',
    planNameBlank: '기준명은 공백만으로 지정할 수 없습니다.',
    effectiveRangeReversed: '유효종료는 유효시작과 같거나 그 뒤여야 합니다.',
    /* 계약이 짝을 요구하나 데이터베이스 CHECK 가 없다 — 화면이 먼저 막는다. */
    frequencyPairRequired: '주기 값과 주기 단위는 함께 채우거나 함께 비워야 합니다.',
    /* 계약 CHECK > 0 — 0 은 「없음」이 아니라 위반이다. */
    rejectionNumberInvalid: '불합격판정개수는 0보다 큰 숫자여야 합니다.',
    /* 계약 CHECK ≥ 0 — 0 은 허용된다. 불합격판정개수와 규칙이 다르다. */
    acceptanceNumberInvalid: '합격판정개수는 0 이상의 숫자여야 합니다.',
    /*
     * 계약 exclusiveMinimum: 0 · maximum: 100. 라벨과 같은 말을 쓴다 —
     * 단위 `%`가 문구에 없으면 무엇을 고쳐야 하는지 알 수 없다.
     */
    samplingRatioInvalid: '샘플 비율(%)은 0보다 크고 100 이하인 값이어야 합니다.',
    /*
     * 계약이 버전 내 유일 제약을 두지 않았다 — 막는 곳이 화면과 서버뿐이다.
     * 중복이 저장되면 측정 기록이 어느 항목의 것인지 가릴 수 없다.
     */
    itemCodeDuplicated: '같은 항목코드가 이 버전에 이미 있습니다. 다른 코드를 입력하세요.',
    /* 계약 ck_inspection_limits — 데이터베이스가 막는다. 먼저 막는 것이 사용자에게 이롭다. */
    limitsReversed: '상한은 하한과 같거나 그보다 커야 합니다.',
    /* 계약 CHECK > 0. 측정 횟수는 표본 번호의 상한이라 정수여야 한다. */
    measurementCountInvalid: '측정 횟수는 1 이상의 정수여야 합니다.',
    /*
     * **경고이지 차단이 아니다.** 계약이 목표값 범위 밖을 데이터베이스로 막지 않고
     * 서버가 경고 등급으로 다룬다 — 관리 한계와 규격 한계가 다른 경우가 업무상 정상이다.
     */
    targetOutOfRange: '목표값이 하한~상한 밖입니다. 의도한 값인지 확인하세요.',
  },
  /**
   * 쪽 이동. 번호 목록을 두지 않는다 — 조건을 좁히는 것이 정상 경로다.
   * 좌 목록에만 둔다. 버전 목록에는 계약이 페이지네이션을 두지 않았다.
   */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
} as const;

/**
 * W-06-06 공통코드·조직·작업자. 마스터 형 화면의 세 번째 벌이라 문구 구조는 `inspectionStandard`와 같다.
 *
 * **`codeValue` 묶음은 통째로 옮겨질 것을 전제로 모아 둔다.** 코드값 편집 부분을 다른 화면이
 * 그대로 다시 쓰게 되어 있어(omf-mes#13), 그 부분의 문구가 다른 자원의 문구와 섞이면
 * 옮길 때 어느 열쇠가 딸려 가야 하는지 가릴 수 없다.
 */
const commonCode = {
  title: '공통코드·조직·작업자',
  breadcrumbRoot: '기준정보',
  /** 탭 라벨. **만든 탭만 둔다** — 없는 탭의 라벨을 미리 두면 무엇이 렌더되는지 흐려진다. */
  tabs: {
    label: '공통코드·조직·작업자',
    code: '공통코드',
    org: '조직(부서)',
    worker: '작업자',
    /* 탭 이름이 「거래처」가 아니라 「거래처 역할」이다 — 이 탭이 다루는 것은 역할뿐이고 거래처 본체는 읽기만 한다. */
    partner: '거래처 역할',
  },
  panes: {
    codeGroup: '코드그룹',
    codeGroupForm: '코드그룹 정보',
    department: '부서',
    departmentForm: '부서 정보',
    worker: '작업자',
    workerDetail: '작업자 기본 정보',
    partner: '거래처',
    partnerDetail: '거래처 기본 정보',
    partnerRoles: '거래처 역할',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    addCodeGroup: '그룹 추가',
    addDepartment: '부서 추가',
  },
  /** 비활성 사유는 배치 규범 4의 문형을 따른다 — 컨트롤 이름으로 시작한다. */
  actionReasons: {
    /*
     * 세 자원이 같은 문형을 쓰되 대상 이름이 달라 함수로 둔다 —
     * 「사용 중지」가 어느 자원의 것인지 밝히지 않으면 사유가 붙은 대상을 복원할 단서가 없다.
     */
    deactivateAlreadyDone: (target: string): string =>
      `사용 중지는 이미 미사용인 ${target}에 다시 할 수 없습니다.`,
    deactivateNeedsSaved: (target: string): string =>
      `사용 중지는 ${target}을 먼저 등록해야 할 수 있습니다.`,
  },
  /**
   * 사용 중지 확인 창. 세 자원이 제목만 바꿔 쓰고 본문은 공유한다.
   *
   * **참조 건수를 내지 않는다**(결정 10) — 화면이 쓸 수 있는 건수는 「코드 필드를 고칠 수 있는지」의
   * 근거이지 「이 행을 참조하는 자료의 수」가 아니다. 두 뜻을 섞으면 화면이 지어낸다.
   */
  dialog: {
    deactivateCodeGroupTitle: '이 코드그룹을 사용 중지할까요?',
    deactivateDepartmentTitle: '이 부서를 사용 중지할까요?',
    deactivateDescription:
      '사용 중지하면 새 선택지에서 빠지고 이미 쓰인 자료는 그대로 남습니다. 되돌리는 경로가 없습니다.',
  },
  /*
   * 선택 목록이 잘리거나 실패했다는 사실을 감추지 않는다 —
   * 알리지 않으면 이름이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다.
   */
  optionsTruncated: '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
  optionsLoadFailed: '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
  /**
   * 쪽 이동. 번호 목록을 두지 않는다 — 조건을 좁히는 것이 정상 경로다.
   * 좌 목록과 코드값 목록 둘 다 계약에 쪽 나눔이 있다.
   */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  filters: {
    codeGroupSearchLabel: '코드그룹 검색',
    codeGroupSearchPlaceholder: '그룹코드 또는 그룹명',
    departmentSearchLabel: '부서 검색',
    departmentSearchPlaceholder: '부서코드 또는 부서명',
    businessUnit: '사업부',
    /* 선택지에 빈 값을 두어 고른 사업부를 다시 「전체」로 되돌릴 수 있게 한다. */
    businessUnitAll: '전체 사업부',
    /*
     * 공장·사업부 필터를 두지 않는다 — 좌 페인에 필터 컨트롤 넷을 놓으면 표가 짓눌린다.
     * 검색어(사번·성명) + 부서 + 미사용 포함 셋으로 좁힌다.
     */
    workerSearchLabel: '작업자 검색',
    workerSearchPlaceholder: '사번 또는 성명',
    department: '부서',
    departmentAll: '전체 부서',
    /*
     * 거래처 탭에는 선택 축 필터가 없다 — **역할로 좁히지 않는다.**
     * 이 탭은 역할을 붙이는 곳이라 역할이 아직 없는 거래처가 반드시 보여야 한다.
     */
    partnerSearchLabel: '거래처 검색',
    partnerSearchPlaceholder: '거래처코드 또는 거래처명',
    chipKeyword: (value: string): string => `검색어: ${value}`,
    chipRemoveKeyword: '검색어 조건 제거',
    chipRemoveIncludeInactive: '미사용 포함 조건 제거',
    chipBusinessUnit: (label: string): string => `사업부: ${label}`,
    chipRemoveBusinessUnit: '사업부 조건 제거',
    chipDepartment: (label: string): string => `부서: ${label}`,
    chipRemoveDepartment: '부서 조건 제거',
  },
  loading: {
    codeGroups: '코드그룹 목록을 불러오는 중',
    codeGroupDetail: '코드그룹 정보를 불러오는 중',
    departments: '부서 목록을 불러오는 중',
    departmentDetail: '부서 정보를 불러오는 중',
    workers: '작업자 목록을 불러오는 중',
    workerDetail: '작업자 정보를 불러오는 중',
    partners: '거래처 목록을 불러오는 중',
    partnerDetail: '거래처 정보를 불러오는 중',
    partnerRoles: '거래처 역할을 불러오는 중',
  },
  /** 자원 이름 — 여러 자원이 공유하는 문구에 끼워 넣는다. */
  targets: {
    codeGroup: '코드그룹',
    department: '부서',
  },
  empty: {
    /*
     * 결과는 있는데 **이 쪽에는** 없다. 주소를 손으로 고치거나 조건이 좁아졌을 때 생긴다 —
     * 「등록된 것이 없다」로 내면 사실과 다른 안내가 된다.
     */
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
  },
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
    /*
     * 좁은 좌 페인에서 「사용 여부」 열을 따로 두면 이름 열이 짓눌린다 —
     * 이름 뒤 접미로 붙여 열을 늘리지 않는다.
     */
    inactiveSuffix: ' (미사용)',
    /*
     * 값은 있는데 그 번호를 선택 목록에서 찾지 못했다. **번호를 그대로 내지 않는다** —
     * 내부 식별자라 사용자가 쓸 수 없고, 보이면 자료로 읽힌다.
     */
    unknown: '알 수 없음',
  },
  codeGroup: {
    /*
     * 결정 6 — 코드 체계 정의가 표준화 작업 중이라 기대 목록이 비어 있다.
     * 그 사실을 감추지 않고 목록 위에 한 번 낸다.
     */
    provisionalCatalog:
      '임시 목록입니다. 코드 체계가 확정되면 여기 보이는 코드그룹의 구성이 바뀔 수 있습니다.',
    fields: {
      groupCode: '그룹코드',
      groupName: '그룹명',
      description: '설명',
    },
    empty: {
      noneTitle: '등록된 코드그룹이 없습니다',
      noneDescription: '「그룹 추가」로 첫 코드그룹을 등록하세요.',
      noMatchTitle: '조건에 맞는 코드그룹이 없습니다',
      noMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
      /*
       * 코드값 구획도 같은 자리에서 「먼저 고르세요」를 낸다 — 같은 문장을 두 번 쌓으면
       * 무엇을 하라는 안내인지 오히려 흐려진다. 이 구획은 무엇이 채워지는지로 말한다.
       */
      notSelected: '좌측에서 코드그룹을 고르면 여기에 그 그룹의 정보가 보입니다',
    },
    validation: {
      required: '필수 입력 항목입니다.',
      groupCodeBlank: '그룹코드는 공백만으로 지정할 수 없습니다.',
      groupNameBlank: '그룹명은 공백만으로 지정할 수 없습니다.',
      groupCodeTooLong: '그룹코드는 50자를 넘을 수 없습니다.',
      groupNameTooLong: '그룹명은 200자를 넘을 수 없습니다.',
    },
    actionReasons: {
      /*
       * **잠금 사유가 갈린다.** 「내 저장이 나가는 중」은 진행 표시가 말하고, 이 문구는
       * **다른 코드그룹의 저장이 나가는 중**이라는 다른 사실을 말한다 — 한 문구로 뭉개면
       * 사용자가 무엇을 기다리는지 알 수 없다. 저장이 하나뿐인 이유는 훅 하나에 요청 하나라
       * 두 번째를 내면 앞 저장의 성공·실패가 통째로 사라지기 때문이다.
       */
      saveLockedByOtherCodeGroup: '저장은 다른 코드그룹의 저장이 끝난 뒤에 할 수 있습니다.',
      /*
       * **같은 사실을 두 문면으로 두는 이유는 컨트롤 이름이 둘이기 때문이다.** 등록 폼의 주
       * 액션은 「그룹 추가」이고, 비활성 사유는 그 컨트롤의 이름으로 시작해야 한다(배치 규범 4-5) —
       * 사유가 시각적으로 끊겼을 때 어느 버튼의 것인지 복원할 단서가 이름뿐이다.
       */
      addLockedByOtherCodeGroup: '그룹 추가는 다른 코드그룹의 저장이 끝난 뒤에 할 수 있습니다.',
    },
  },
  department: {
    fields: {
      departmentCode: '부서코드',
      departmentName: '부서명',
      parentDepartment: '상위 부서',
      businessUnit: '사업부',
    },
    values: {
      /** 계층 그룹 머리글 — 그 그룹을 대표하는 부서. */
      groupHeader: (code: string, name: string): string => `${code} · ${name}`,
      /** 상위 부서를 비운 상태. 「없음」만으로는 무엇이 없는지 읽히지 않는다. */
      noParent: '없음 (뿌리 부서)',
    },
    /*
     * 상위를 이 쪽 목록에서 찾지 못한 행이 모이는 그룹. 쪽 나눔 때문에 상위가 다른 쪽에
     * 있을 수 있다 — 「없다」를 「뿌리다」로 읽지 않고 그 사실을 그대로 밝힌다.
     */
    groupHeaderOrphan: '상위 부서가 이 쪽에 없음',
    notices: {
      /*
       * 이슈 §6이 예고한 「2단 표시로는 부족한」 상태. 감추지 않는다 —
       * 계층을 다시 계산해 접으면 서버에 있는 관계와 화면이 어긋난다.
       */
      deepHierarchy:
        '3단 이상 계층이 있습니다. 이 목록은 상위–하위 2단까지만 묶어 보이므로 더 깊은 관계는 부서 정보의 상위 부서에서 확인하세요.',
    },
    empty: {
      noneTitle: '등록된 부서가 없습니다',
      noneDescription: '「부서 추가」로 첫 부서를 등록하세요.',
      noMatchTitle: '조건에 맞는 부서가 없습니다',
      noMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
      notSelected: '좌측에서 부서를 고르면 여기에 그 부서의 정보가 보입니다',
    },
    actionReasons: {
      /* 목록에 자기 하나뿐이면 상위로 고를 대상이 없다 — 감추지 않고 사유를 밝힌다. */
      parentNeedsOthers:
        '상위 부서는 고를 수 있는 다른 부서가 없어 지정할 수 없습니다. 부서를 하나 더 등록하면 이 칸을 쓸 수 있습니다.',
      /*
       * **잠금 사유가 갈린다.** 「내 저장이 나가는 중」은 진행 표시가 말하고, 이 문구는
       * **다른 부서의 저장이 나가는 중**이라는 다른 사실을 말한다 — 한 문구로 뭉개면
       * 사용자가 무엇을 기다리는지 알 수 없다. 저장이 하나뿐인 이유는 훅 하나에 요청 하나라
       * 두 번째를 내면 앞 저장의 성공·실패가 통째로 사라지기 때문이다.
       */
      saveLockedByOtherDepartment: '저장은 다른 부서의 저장이 끝난 뒤에 할 수 있습니다.',
      /*
       * **같은 사실을 두 문면으로 두는 이유는 컨트롤 이름이 둘이기 때문이다.** 등록 폼의 주
       * 액션은 「부서 추가」이고, 비활성 사유는 그 컨트롤의 이름으로 시작해야 한다(배치 규범 4-5) —
       * 사유가 시각적으로 끊겼을 때 어느 버튼의 것인지 복원할 단서가 이름뿐이다.
       */
      addLockedByOtherDepartment: '부서 추가는 다른 부서의 저장이 끝난 뒤에 할 수 있습니다.',
    },
    validation: {
      required: '필수 입력 항목입니다.',
      departmentCodeBlank: '부서코드는 공백만으로 지정할 수 없습니다.',
      departmentNameBlank: '부서명은 공백만으로 지정할 수 없습니다.',
      departmentCodeTooLong: '부서코드는 50자를 넘을 수 없습니다.',
      departmentNameTooLong: '부서명은 200자를 넘을 수 없습니다.',
    },
  },
  /**
   * 작업자 — **읽기 전용이다.** 계약에 쓰기 경로가 없다(POST·PUT 모두 없음).
   * 그래서 입력칸 라벨이 아니라 **값 표기의 이름**이며, 비활성 사유도 두지 않는다
   * (「언젠가 풀린다」는 뜻이 되는데 계약에 그 경로가 없다).
   */
  worker: {
    /*
     * `editability`가 아니라 **고정 문구**다 — 계약은 「항상 RECEIVED_FROM_ERP」라고 적었으나
     * 목 서버는 `reason:'EDITABLE'`을 준다. 쓰기 경로가 없다는 사실이 `editability`보다 강한 근거다.
     */
    readOnlyNotice:
      '외부 시스템에서 받은 자료라 여기서 수정할 수 없습니다. 원본 시스템에서 변경하세요.',
    fields: {
      workerNo: '사번',
      workerName: '성명',
      businessUnit: '사업부',
      plant: '공장',
      department: '부서',
      status: '상태',
      appUser: '계정 연결',
      isActive: '사용 여부',
    },
    values: {
      /*
       * 계정 연결은 **연결 여부만** 낸다 — `appUserId`는 내부 식별자이고 이름을 만들려면
       * 다른 화면 소관의 조회가 필요하다. 번호를 그대로 내면 사용자가 쓸 수 없다.
       */
      appUserLinked: '연결됨',
      appUserNotLinked: '연결 안 됨',
      active: '사용 중',
      inactive: '미사용',
    },
    empty: {
      noneTitle: '등록된 작업자가 없습니다',
      noneDescription: '작업자는 외부 시스템에서 받아 옵니다. 원본 시스템을 확인하세요.',
      noMatchTitle: '조건에 맞는 작업자가 없습니다',
      noMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
      notSelected: '좌측에서 작업자를 고르면 여기에 그 작업자의 정보가 보입니다',
    },
  },
  /**
   * 자격·인증 — **이 화면에서 편집 가능한 유일한 작업자 관련 자료**다.
   * 저장은 전체 치환이라 표의 최종 상태를 한 번에 보낸다.
   */
  qualification: {
    paneTitle: '자격·인증',
    fields: {
      qualificationType: '자격 유형',
      process: '공정',
      certificateNo: '인증번호',
      validPeriod: '유효기간',
      validFrom: '유효 시작',
      validTo: '유효 종료',
      certifiedBy: '인증자',
      edit: '편집',
    },
    values: {
      /** 공정을 비운 자격은 모든 공정에 걸린다 — 계약이 그 뜻을 널로 표현한다(A-7). */
      allProcesses: '(전체 공정)',
      period: (from: string, to: string): string => `${from} ~ ${to}`,
    },
    actions: {
      add: '자격 추가',
      /* 행 아이콘 버튼은 보이는 글자가 없다 — 어느 행의 것인지 이름에 담는다. */
      editRow: (label: string): string => `${label} 자격 수정`,
      removeRow: (label: string): string => `${label} 자격 삭제`,
    },
    actionReasons: {
      needsWorker: '자격 추가는 좌측에서 작업자를 고른 뒤에 할 수 있습니다.',
      /*
       * 서버가 준 목록에 이미 중복 짝이 있으면 그대로 보내도 서버가 거부한다 —
       * 사용자가 먼저 그 줄을 고쳐야 한다.
       */
      saveBlockedByInvalid:
        '저장은 자격 유형과 공정 짝이 겹치는 줄이 있어 할 수 없습니다. 그 줄을 고치거나 지우면 저장할 수 있습니다.',
      /*
       * **잠금 사유가 갈린다.** 「내 저장이 나가는 중」은 진행 표시가 말하고, 이 문구는
       * **다른 작업자의 저장이 나가는 중**이라는 다른 사실을 말한다 — 한 문구로 뭉개면
       * 사용자가 무엇을 기다리는지 알 수 없다. 저장이 하나뿐인 이유는 훅 하나에 요청 하나라
       * 두 번째를 내면 앞 저장의 성공·실패가 통째로 사라지기 때문이다.
       */
      saveLockedByOtherWorker: '저장은 다른 작업자의 저장이 끝난 뒤에 할 수 있습니다.',
    },
    /*
     * 창의 확인은 **저장이 아니다.** 표에만 반영되고 서버로는 「저장」에서 한 번에 나간다 —
     * 밝히지 않으면 사용자가 창을 닫는 순간 저장된 줄 안다.
     */
    dialog: {
      addTitle: '자격 추가',
      editTitle: '자격 수정',
      notSavedNotice:
        '이 창의 확인은 저장이 아닙니다. 표에 반영된 뒤 「저장」을 눌러야 서버에 반영됩니다.',
      confirm: '확인',
    },
    empty: {
      notSelected: '좌측에서 작업자를 고르면 그 작업자의 자격·인증이 보입니다',
      noneTitle: '등록된 자격·인증이 없습니다',
      noneDescription: '「자격 추가」로 첫 자격을 등록하세요.',
    },
    loading: {
      list: '자격·인증을 불러오는 중',
    },
    validation: {
      required: '필수 입력 항목입니다.',
      certificateNoTooLong: '인증번호는 100자를 넘을 수 없습니다.',
      /* 계약 ck_worker_qualification_dates — 있으면 유효 시작 이상. 한쪽만 있는 것은 허용된다. */
      validRangeReversed: '유효 종료는 유효 시작과 같거나 그 뒤여야 합니다.',
      /*
       * 계약 uq_worker_qualification이 `COALESCE(process_id,0)`으로 접는다 —
       * 공정을 비운 두 줄은 같은 짝이다.
       */
      duplicatePair:
        '자격 유형과 공정 짝이 이미 있습니다. 공정을 다르게 고르거나 그 줄을 고치세요.',
    },
  },
  /**
   * 거래처 — **본체는 읽기 전용이다.** ERP에서 받은 마스터라 계약에 쓰기 경로가 없고,
   * 이 탭이 고치는 것은 역할뿐이다. 고칠 수 없는 사유는 이미 있는 공통 문구
   * (`editability.receivedFromErp`)를 그대로 쓴다 — 이 화면 전용 문구를 새로 만들지 않는다.
   *
   * **내부 번호(`partnerId`)를 문구에 담지 않는다** — 주소와 조회에만 쓰는 식별자다.
   */
  partner: {
    fields: {
      partnerCode: '거래처코드',
      partnerName: '거래처명',
      country: '국가',
      erpPartnerCode: 'ERP 코드',
      isActive: '사용 여부',
    },
    values: {
      active: '사용 중',
      inactive: '미사용',
    },
    empty: {
      noneTitle: '등록된 거래처가 없습니다',
      /* 「거래처 추가」가 없다 — 없는 조치를 지시하지 않고 어디서 오는 자료인지만 밝힌다. */
      noneDescription: '거래처는 외부 시스템에서 받아 옵니다. 원본 시스템을 확인하세요.',
      noMatchTitle: '조건에 맞는 거래처가 없습니다',
      noMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
      notSelected: '좌측에서 거래처를 고르면 여기에 그 거래처의 역할이 보입니다',
      /*
       * 단건 조회가 **없다**고 답한 경우. 다시 시도해도 나타나지 않으므로 재시도를 권하지 않고
       * 다시 고르기로 안내한다 — 못 불러온 것과 없는 것은 할 수 있는 조치가 다르다.
       *
       * 「목록 밖 선택」 안내는 **정의째 없앴다**(#173 — 기본 정보가 목록에서 풀렸다). 조건과
       * 무관하게 그 한 건을 받으므로 그런 상태 자체가 생기지 않는다.
       */
      notFoundTitle: '고른 거래처를 찾을 수 없습니다',
      notFoundDescription:
        '원본 시스템에서 지워졌거나 주소의 번호가 잘못됐습니다. 좌측 목록에서 다시 고르세요.',
    },
  },
  /**
   * 거래처 역할 — **표시명이 사는 자리.**
   *
   * 코드 표기(영문)는 화면 슬라이스의 `partner-role-vocab.ts`가 갖는다. 이름을 코드 파일이
   * 들고 있으면 문구 정본이 둘이 된다. 반대로 **어휘 밖 코드의 이름은 서버가 준다** —
   * 화면이 모르는 값에 이름을 지어내지 않는다.
   */
  partnerRole: {
    names: {
      customer: '고객사',
      supplier: '공급사',
      subcontractor: '외주 제작사',
      disposal: '폐기 업체',
      other: '기타',
    },
    /*
     * 계약이 값 목록을 다섯으로 확정했지만(#173) 서버가 그 밖의 코드를 아직 들고 있을 수 있다 —
     * 계약은 구현보다 앞선다. **감추지 않는다** — 통째 교체 저장에서 목록에 없는 역할은
     * 조용히 해제되기 때문이다.
     */
    unknownBadge: '이 화면이 모르는 역할',
    /*
     * 어휘 밖 코드는 **저장하면 반드시 해제된다**(#173). 근거가 「화면이 모른다」에서
     * **「서버가 거절한다」**로 바뀌었다 — 계약이 다섯 밖의 값을 400으로 되돌리므로 화면이
     * 그것을 실은 요청을 만들 수 없다. 해제되면 이 화면에는 다시 붙일 수단이 없으므로
     * 그 비대칭을 미리 밝힌다.
     */
    unknownNote:
      '이 화면이 모르는 역할은 저장할 때 해제됩니다 — 서버가 정한 다섯 역할 밖의 값은 저장에서 거절되기 때문입니다. 해제되면 여기서는 다시 붙일 수 없습니다.',
    /*
     * 잠금 토큰을 얻지 못해 저장이 멈춘 경우 — **이 자원에서만 공통 문구를 쓰지 않는다.**
     *
     * 공통 문구(`save.staleToken`)는 「잠시 뒤 다시 저장하세요」인데, 그 말은 **다시 시도하면
     * 풀리는** 자원을 전제로 한다. 계약은 이 자원의 토큰 원천을 선언했으나 **서버가 아직 주지
     * 않는 동안**에는 토큰이 오지 않아 다시 눌러도 같은 자리에서 멈춘다 — 공통 문구를 그대로
     * 쓰면 **없는 조치를 지시하는** 안내가 된다.
     *
     * 이 화면에서 할 일을 시키지 않는다. 지금 상태가 무엇인지만 밝히고, 되풀이해도 달라지지
     * 않는다는 사실을 함께 적어 헛된 시도를 막는다. 공통 문구 자체는 고치지 않는다 —
     * 다시 시도가 실제로 통하는 형제 화면에서는 그 말이 참이다.
     *
     * **다만 출구는 남긴다.** 사용자가 이 화면에서 스스로 풀 수 없는 상태이므로 「달라지지
     * 않는다」에서 끝내면 다음에 할 일이 없어진다 — 저장소 선례가 같은 자리에 두는 한 문장을
     * 그대로 쓴다(`httpError.description`·`httpError.forbidden`).
     */
    saveTokenUnavailable:
      '저장에 필요한 정보가 서버에서 아직 제공되지 않아 지금은 저장할 수 없습니다. 다시 눌러도 같은 결과입니다. 반복되면 담당자에게 알려 주세요.',
    actionReasons: {
      saveNoChanges: '저장은 역할을 고친 뒤에 할 수 있습니다.',
      /*
       * **잠금 사유가 갈린다.** 「내 저장이 나가는 중」은 진행 표시가 말하고, 이 문구는
       * **다른 거래처의 저장이 나가는 중**이라는 다른 사실을 말한다 — 한 문구로 뭉개면
       * 사용자가 무엇을 기다리는지 알 수 없다. 저장이 하나뿐인 이유는 훅 하나에 요청 하나라
       * 두 번째를 내면 앞 저장의 성공·실패가 통째로 사라지기 때문이다.
       */
      saveLockedByOtherPartner: '저장은 다른 거래처의 저장이 끝난 뒤에 할 수 있습니다.',
    },
    /*
     * **잃는 것이 있을 때만 서는 확인 창**(결정 10). 추가만 하는 저장에까지 창을 세우면
     * 확인이 습관이 되어 정작 잃는 저장에서도 읽히지 않는다.
     *
     * 버튼 문구가 「확인/취소」가 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다.
     */
    dialog: {
      title: '해제되는 역할이 있습니다',
      lead: '저장하면 아래 역할이 해제됩니다.',
      /* 계약이 빈 배열을 「전부 해제」로 정의한다 — 실제로 만들 수 있는 상태라 미리 밝힌다. */
      noneLeft: '저장하면 이 거래처의 역할이 하나도 남지 않습니다.',
      confirm: '해제하고 저장',
      keepEditing: '계속 편집',
    },
    empty: {
      noneTitle: '지정된 역할이 없습니다',
    },
  },
  /**
   * **코드값 편집 한 벌의 문구.** 이 묶음은 통째로 옮겨질 것을 전제로 모아 둔다 —
   * 다른 자원의 문구와 섞으면 옮길 때 어느 열쇠가 딸려 가야 하는지 가릴 수 없다.
   *
   * 구획 이름·액션·쪽 이동 접근 이름까지 여기 둔다. 바깥에서 빌려 쓰는 것은
   * 자원 이름이 없는 공통 문구(`common`·`conflict`·`httpError`)뿐이다.
   */
  codeValue: {
    paneTitle: '코드값',
    formPaneTitle: '코드값 정보',
    pageNavLabel: '코드값 쪽 이동',
    actions: {
      add: '코드값 추가',
    },
    actionReasons: {
      /* 계약이 `codeGroupId`를 필수 쿼리로 두었다 — 그룹 없이는 만들 자리 자체가 없다. */
      addNeedsGroup: '코드값 추가는 좌측에서 코드그룹을 고른 뒤에 할 수 있습니다.',
      /*
       * 바깥 묶음의 같은 문형을 **대상을 코드값으로 고정해** 여기 둔다.
       * 한 벌이 바깥 열쇠를 빌려 쓰면 옮길 때 그 열쇠가 딸려 가지 않는다 —
       * 대상이 늘 코드값이라 매개변수도 필요 없다.
       */
      deactivateAlreadyDone: '사용 중지는 이미 미사용인 코드값에 다시 할 수 없습니다.',
    },
    loading: {
      list: '코드값 목록을 불러오는 중',
      detail: '코드값 정보를 불러오는 중',
    },
    /*
     * 정렬은 화면이 한다(계약이 목록의 정렬을 명시하지 않았다) — 그 한계를 감추지 않는다.
     * 겹친 정렬 순서는 서버가 허용하는 값이라 **막지 않고 알리기만** 한다.
     */
    notices: {
      sortWithinPage: '정렬은 현재 쪽 안에서만 적용됩니다.',
      duplicateDisplayOrder:
        '정렬 순서가 같은 코드값이 있습니다. 같은 값끼리는 코드 순으로 보입니다.',
    },
    fields: {
      code: '코드',
      codeName: '코드명',
      displayOrder: '정렬 순서',
      effectivePeriod: '유효기간',
      effectiveFrom: '유효 시작',
      effectiveTo: '유효 종료',
    },
    empty: {
      groupNotSelected: '좌측에서 코드그룹을 먼저 고르세요',
      noneTitle: '이 코드그룹에 등록된 코드값이 없습니다',
      noneDescription: '「코드값 추가」로 첫 코드값을 등록하세요.',
      noMatchTitle: '조건에 맞는 코드값이 없습니다',
      noMatchDescription: '「미사용 포함」을 켜면 미사용 코드값도 보입니다.',
      notSelected: '위 목록에서 코드값을 먼저 고르세요',
      /*
       * 결과는 있는데 **이 쪽에는** 없다. 바깥 묶음에 같은 문구가 있으나 여기 따로 둔다 —
       * 한 벌은 자기 묶음만 들고 옮겨진다.
       */
      beyondLastTitle: '이 쪽에는 결과가 없습니다',
      beyondLastDescription: '첫 쪽으로 이동하세요.',
    },
    values: {
      /** 유효기간 표기. 한쪽만 있는 것도 계약이 허용한다 — 없는 쪽을 지어내지 않는다. */
      period: (from: string, to: string): string => `${from} ~ ${to}`,
      /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
      empty: '—',
      /** 좁은 칸에서 「사용 여부」 열을 따로 두면 이름 열이 짓눌린다 — 이름 뒤 접미로 붙인다. */
      inactiveSuffix: ' (미사용)',
    },
    validation: {
      required: '필수 입력 항목입니다.',
      codeBlank: '코드는 공백만으로 지정할 수 없습니다.',
      codeNameBlank: '코드명은 공백만으로 지정할 수 없습니다.',
      codeTooLong: '코드는 50자를 넘을 수 없습니다.',
      codeNameTooLong: '코드명은 200자를 넘을 수 없습니다.',
      /* 계약이 정수를 받는다. 하한이 없어 음수는 막지 않는다. */
      displayOrderInvalid: '정렬 순서는 정수로 입력하세요.',
      /* 계약 ck_code_value_dates — 있으면 유효 시작 이상. 한쪽만 있는 것은 허용된다. */
      effectiveRangeReversed: '유효 종료는 유효 시작과 같거나 그 뒤여야 합니다.',
    },
    dialog: {
      deactivateTitle: '이 코드값을 사용 중지할까요?',
    },
  },
} as const;

/**
 * W-06-05 품목 확장속성.
 *
 * 이 화면의 문구는 **원본과 확장을 말로 갈라 놓는 것**이 목적이다 —
 * 한 화면에 「고칠 수 없는 자리」와 「고칠 수 있는 자리」가 붙어 있어,
 * 배치만으로는 어느 쪽이 어느 쪽인지 읽히지 않는다.
 *
 * **원본 구획의 안내는 여기서 만들지 않는다** — 이미 있는 `editability.receivedFromErp`를 그대로 쓴다.
 * 충돌·상태 잠금·권한 문구도 공통 규약 문구(`conflict.*`·`stateLocked.*`·`httpError.*`)를 그대로 쓴다.
 */
const itemExtendedAttrs = {
  title: '품목 확장속성',
  breadcrumbRoot: '기준정보',
  /** 탭 라벨. **만든 탭만 둔다** — 없는 탭의 라벨을 미리 두면 무엇이 렌더되는지 흐려진다. */
  tabs: {
    label: '품목 확장속성',
    attrs: '확장 속성',
    subsidiary: '부속 정보',
    bom: '자재 명세서',
  },
  /**
   * 부속 정보 안의 하위 탭. 계약이 인용한 화면 스펙의 구획 이름을 그대로 옮긴 것이다 —
   * 여기서 이름을 새로 지으면 설계 문서와 화면이 다른 말을 하게 된다.
   */
  subTabs: {
    label: '부속 정보',
    buMap: '사업부 매핑',
    uomConversion: '단위 환산',
    externalCode: '외부 코드',
  },
  panes: {
    item: '품목',
    itemOrigin: '품목 원본 정보',
    itemAttrs: '확장 속성',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
  },
  /** 쪽 이동. 번호 목록을 두지 않는다 — 조건을 좁히는 것이 정상 경로다. */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  filters: {
    itemSearchLabel: '품목 검색',
    itemSearchPlaceholder: '품목코드 또는 품목명',
    chipKeyword: (value: string): string => `검색어: ${value}`,
    chipRemoveKeyword: '검색어 조건 제거',
    chipRemoveIncludeInactive: '미사용 포함 조건 제거',
  },
  loading: {
    items: '품목 목록을 불러오는 중',
    itemDetail: '품목 정보를 불러오는 중',
  },
  /*
   * 선택 목록이 잘리거나 실패했다는 사실을 감추지 않는다 —
   * 알리지 않으면 이름이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다.
   */
  optionsTruncated: '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
  optionsLoadFailed: '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
  empty: {
    /*
     * 결과는 있는데 **이 쪽에는** 없다. 주소를 손으로 고치거나 조건이 좁아졌을 때 생긴다 —
     * 「등록된 것이 없다」로 내면 사실과 다른 안내가 된다.
     */
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
    /*
     * **여기서 만들 수 없는 자료다.** 품목은 외부 시스템이 소유하므로
     * 「추가하세요」가 아니라 「원본 시스템을 확인하세요」다.
     */
    noneTitle: '표시할 품목이 없습니다',
    noneDescription: '품목은 외부 시스템에서 받아옵니다. 원본 시스템에 자료가 있는지 확인하세요.',
    noMatchTitle: '조건에 맞는 품목이 없습니다',
    noMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
    notSelected: '좌측에서 품목을 고르면 여기에 그 품목의 정보가 보입니다',
  },
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
    /** 좁은 좌 페인에서 「사용 여부」 열을 따로 두면 이름 열이 짓눌린다 — 이름 뒤 접미로 붙인다. */
    inactiveSuffix: ' (미사용)',
    /*
     * 값은 있는데 그 번호를 선택 목록에서 찾지 못했다. **번호를 그대로 내지 않는다** —
     * 내부 식별자라 사용자가 쓸 수 없고, 보이면 자료로 읽힌다.
     */
    unknown: '알 수 없음',
    /*
     * 선택 목록을 아직 받지 못해 이름으로 옮길 수 없다. **「알 수 없음」과 가른다** —
     * 둘을 같은 문구로 내면 잠깐 보이는 「알 수 없음」을 자료가 잘못 담긴 것으로 읽고
     * 사용자가 원본 시스템을 확인하러 간다.
     */
    loading: '불러오는 중…',
  },
  /**
   * 원본 구획 — 외부 시스템이 소유하는 네 열. **여기에 입력칸도 저장도 없다.**
   * 안내 문구는 공통 `editability.receivedFromErp`를 쓴다.
   */
  origin: {
    fields: {
      itemCode: '품목코드',
      itemName: '품목명',
      /** 값 목록이 미정이라 코드 문자열을 그대로 낸다 — 이름을 지어내지 않는다. */
      itemType: '품목유형',
      baseUom: '기준 단위',
    },
  },
  /**
   * 확장 구획 — 이쪽이 소유해 편집하는 값. **원본 구획과 말이 갈려 있어야 한다.**
   *
   * 「유효기한 관리」는 계약 필드가 아니라 유효기한(일)의 널 여부를 사람이 다루는 형태로 옮긴 것이다.
   * 두 항목을 한 줄로 붙여 놓아 무엇이 무엇을 켜는지 보이게 한다.
   */
  attrs: {
    fields: {
      lotControlType: 'LOT 관리 유형',
      serialControlType: '시리얼 관리 유형',
      shelfLifeManaged: '유효기한 관리',
      shelfLifeDays: '유효기한(일)',
      inspectionRequired: '입고검사 대상',
      fifoPolicy: '선출 정책',
      negativeStockAllowed: '마이너스 재고 허용',
      storageCondition: '보관 조건',
      openedShelfLifeHours: '개봉 후 유효시간(시간)',
      isActive: '사용 여부',
    },
    values: {
      active: '사용 중',
      inactive: '미사용',
    },
    /**
     * 사용 여부에 컨트롤을 두지 않는 이유. **감추지 않고 밝힌다** —
     * 값만 있고 바꿀 수단이 없으면 사용자가 화면이 빠뜨린 것으로 읽는다.
     */
    isActiveNote: '사용 여부는 이 화면에서 바꾸지 않습니다. 저장해도 지금 값이 그대로 유지됩니다.',
    validation: {
      required: '필수 입력 항목입니다.',
      codeTooLong: '코드는 50자를 넘을 수 없습니다.',
      /* 계약 A-2 — 「유효기한 관리」가 켜져 있을 때만 필수다. */
      shelfLifeDaysRequired: '유효기한 관리를 켜면 유효기한(일)을 입력해야 합니다.',
      /* 계약 minimum: 0 — 0은 허용값이다. 「비었다」로 다루지 않는다. */
      shelfLifeDaysInvalid: '유효기한(일)은 0 이상의 정수로 입력하세요.',
      /* 계약 exclusiveMinimum: 0 — 유효기한(일)과 규칙이 다르다. 0을 받지 않는다. */
      openedShelfLifeHoursInvalid: '개봉 후 유효시간(시간)은 1 이상의 정수로 입력하세요.',
    },
  },
  /**
   * 대상 품목을 **검색해서 고르는** 묶음(결정 8).
   *
   * 품목이 수천 건일 수 있어 선택칸에 다 담을 수 없고, 번호를 입력받으면 사용자가
   * 알 수도 확인할 수도 없는 내부 식별자를 화면이 요구하게 된다.
   */
  itemPicker: {
    keywordLabel: '대상 품목 검색',
    keywordPlaceholder: '품목코드 또는 품목명',
    search: '찾기',
    resultLabel: '대상 품목',
    resultPlaceholder: '검색 결과에서 고르세요',
    /* 검색 전에는 선택칸이 비어 있는 것이 정상이다 — 그 사실을 밝히지 않으면 고장으로 읽힌다. */
    beforeSearch: '품목코드나 품목명을 넣고 찾기를 누르세요.',
    truncated: '검색 결과가 많아 일부만 표시합니다. 검색어를 좁히세요.',
    noResult: '검색어에 맞는 품목이 없습니다. 검색어를 바꿔 다시 찾아 보세요.',
    searchFailed: '품목을 검색하지 못했습니다. 잠시 뒤 다시 찾아 보세요.',
  },
  /**
   * 부속 하위 탭① — 사업부 매핑. 사업부 사이의 품목 대응을 담는다.
   *
   * **중복 안내 문구가 없다.** 계약이 이 표에 유일 제약을 적지 않았고,
   * 화면이 없는 제약을 흉내 내면 서버가 허용하는 값을 막는다(결정 7).
   */
  buMap: {
    paneTitle: '사업부 매핑',
    fields: {
      fromBusinessUnit: '보내는 사업부',
      toBusinessUnit: '받는 사업부',
      toItem: '대상 품목',
      validPeriod: '유효기간',
      effectiveFrom: '유효 시작',
      effectiveTo: '유효 종료',
      edit: '편집',
    },
    values: {
      period: (from: string, to: string): string => `${from} ~ ${to}`,
    },
    actions: {
      add: '매핑 추가',
      editRow: (name: string): string => `${name} 매핑 수정`,
      removeRow: (name: string): string => `${name} 매핑 삭제`,
    },
    loading: {
      list: '사업부 매핑을 불러오는 중',
    },
    empty: {
      noneTitle: '등록된 사업부 매핑이 없습니다',
      noneDescription: '「매핑 추가」로 줄을 만든 뒤 저장하세요.',
    },
    dialog: {
      addTitle: '사업부 매핑 추가',
      editTitle: '사업부 매핑 수정',
      confirm: '확인',
      /* 확인이 저장이라고 오해하면 창을 닫고 화면을 떠난다 — 전체 치환이라 저장이 따로 있다. */
      notSavedNotice: '확인을 눌러도 아직 저장되지 않습니다. 표를 확인한 뒤 저장하세요.',
    },
    /* 「대상 품목 이름을 못 받았다」는 저장을 막지 않는다 — 표시만의 문제다. */
    itemNamesLoadFailed: '대상 품목 이름을 불러오지 못했습니다. 저장에는 영향이 없습니다.',
    validation: {
      required: '필수 입력 항목입니다.',
      /* 계약 ck_item_bu_map_distinct */
      sameBusinessUnit: '보내는 사업부와 받는 사업부는 서로 달라야 합니다.',
      /* 계약 ck_item_bu_map_dates — 짝 제약이라 두 칸에 함께 낸다. */
      validRangeReversed: '유효 종료는 유효 시작과 같거나 뒤여야 합니다.',
    },
  },
  /**
   * 부속 하위 탭② — 단위 환산.
   *
   * 사업부 매핑과 달리 **유일 제약이 있다**(`uq_item_uom_conversion` 네 컬럼).
   * 서버가 준 목록에 이미 겹친 줄이 있을 수 있어 저장을 막는 사유 문구가 함께 있다.
   */
  uomConversion: {
    paneTitle: '단위 환산',
    fields: {
      fromUom: '변환 전 단위',
      toUom: '변환 후 단위',
      conversionRate: '환산 비율',
      validPeriod: '유효기간',
      effectiveFrom: '유효 시작',
      effectiveTo: '유효 종료',
      edit: '편집',
    },
    values: {
      period: (from: string, to: string): string => `${from} ~ ${to}`,
    },
    actions: {
      add: '환산 추가',
      editRow: (name: string): string => `${name} 환산 수정`,
      removeRow: (name: string): string => `${name} 환산 삭제`,
    },
    /* 「무엇이 막혔는지 + 어떻게 풀 수 있는지」를 담고 그 컨트롤의 이름으로 시작한다. */
    actionReasons: {
      saveBlockedByDuplicate:
        '저장할 수 없습니다. 변환 전·변환 후·유효 시작이 같은 줄이 둘 이상 있습니다. 겹친 줄을 고치거나 지운 뒤 저장하세요.',
    },
    loading: {
      list: '단위 환산을 불러오는 중',
    },
    empty: {
      noneTitle: '등록된 단위 환산이 없습니다',
      noneDescription: '「환산 추가」로 줄을 만든 뒤 저장하세요.',
    },
    dialog: {
      addTitle: '단위 환산 추가',
      editTitle: '단위 환산 수정',
      confirm: '확인',
      notSavedNotice: '확인을 눌러도 아직 저장되지 않습니다. 표를 확인한 뒤 저장하세요.',
    },
    validation: {
      required: '필수 입력 항목입니다.',
      /* 계약 ck_item_uom_distinct */
      sameUom: '변환 전 단위와 변환 후 단위는 서로 달라야 합니다.',
      /* 계약 exclusiveMinimum: 0 — 0은 허용값이 아니다. */
      conversionRateInvalid: '환산 비율은 0보다 큰 수로 입력하세요.',
      /* 계약 ck_item_uom_dates — 짝 제약이라 두 칸에 함께 낸다. */
      validRangeReversed: '유효 종료는 유효 시작과 같거나 뒤여야 합니다.',
      /* 계약 uq_item_uom_conversion — 유효 종료·환산 비율은 이 키에 들어가지 않는다. */
      duplicateKey: '변환 전·변환 후·유효 시작이 같은 줄이 이미 있습니다.',
      /* 표 위에 낸다 — 어느 줄이 문제인지 저장을 눌러야 알게 하지 않는다. */
      duplicateInList: '변환 전·변환 후·유효 시작이 같은 줄이 있습니다. 겹친 줄을 정리하세요.',
    },
  },
  /**
   * 부속 하위 탭③ — 외부 코드. 고객 바코드 체계의 저장처다.
   *
   * **중복 문구가 접힘을 밝힌다.** 계약의 유일 제약이 `COALESCE(partner_id,0)`으로 접혀
   * 거래처를 비운 두 줄이 서버에게 같은 짝이 되는데(A-7), 그 사실을 적지 않으면
   * 사용자가 「다른 줄인데 왜 막느냐」로 읽는다.
   */
  externalCode: {
    paneTitle: '외부 코드',
    fields: {
      externalSystem: '외부 시스템',
      partner: '거래처',
      externalItemCode: '외부 품목코드',
      edit: '편집',
    },
    values: {
      /* 계약이 「비우면 (전체)」로 정했다(A-7) — 빈 칸으로 두면 빠뜨린 것으로 읽힌다. */
      allPartners: '(전체)',
    },
    actions: {
      add: '외부 코드 추가',
      editRow: (name: string): string => `${name} 외부 코드 수정`,
      removeRow: (name: string): string => `${name} 외부 코드 삭제`,
    },
    actionReasons: {
      saveBlockedByDuplicate:
        '저장할 수 없습니다. 외부 시스템과 거래처가 같은 줄이 둘 이상 있습니다. 겹친 줄을 고치거나 지운 뒤 저장하세요.',
    },
    loading: {
      list: '외부 코드를 불러오는 중',
    },
    empty: {
      noneTitle: '등록된 외부 코드가 없습니다',
      noneDescription: '「외부 코드 추가」로 줄을 만든 뒤 저장하세요.',
    },
    dialog: {
      addTitle: '외부 코드 추가',
      editTitle: '외부 코드 수정',
      confirm: '확인',
      notSavedNotice: '확인을 눌러도 아직 저장되지 않습니다. 표를 확인한 뒤 저장하세요.',
    },
    /* 값 목록이 확정되지 않아 자유 입력으로 받는다(결정 4) — 그 사실을 밝힌다. */
    externalSystemNote: '코드 목록이 확정되지 않아 직접 입력합니다. 값은 서버가 확인합니다.',
    validation: {
      required: '필수 입력 항목입니다.',
      externalSystemCodeTooLong: '외부 시스템 코드는 50자를 넘을 수 없습니다.',
      externalItemCodeTooLong: '외부 품목코드는 100자를 넘을 수 없습니다.',
      /* 계약 uq_item_external_code — COALESCE(partner_id,0) 접기를 문구가 밝힌다(A-7). */
      duplicateKey:
        '외부 시스템과 거래처가 같은 줄이 이미 있습니다. 거래처를 비운 줄끼리도 같은 줄로 봅니다.',
      duplicateInList:
        '외부 시스템과 거래처가 같은 줄이 있습니다. 거래처를 비운 줄끼리도 같은 줄로 보므로 겹친 줄을 정리하세요.',
    },
  },
  /**
   * 탭③ — 자재 명세서(BOM). **헤더는 전부 원본이다.**
   *
   * 이 탭에서 바꿀 수 있는 것은 둘뿐이다 — 어느 자재 명세서가 기본인가(`:set-default`)와
   * 구성품의 확장 열 넷. 나머지는 외부 시스템이 소유하므로 원본 구획과 같은 말을 쓴다.
   *
   * **상태 문구를 만들지 않는다.** 상태 코드의 값 목록이 확정되지 않아 화면이 이름을 지어내면
   * 그 이름으로 읽힌 판단이 남는다 — 품목유형과 같은 처리로 코드 문자열을 그대로 낸다.
   */
  bom: {
    paneTitle: '자재 명세서 목록',
    detailPaneTitle: '자재 명세서 정보',
    fields: {
      bomCode: 'BOM 코드',
      bomVersion: 'Rev',
      status: '상태',
      isDefault: '기본',
      validPeriod: '유효기간',
      /* 수량과 단위를 한 칸에 담으므로 단위 라벨을 따로 두지 않는다 — 구성품 표의 소요량과 같다. */
      baseQty: '기준 수량',
      setDefault: '기본 지정',
    },
    values: {
      period: (from: string, to: string): string => `${from} ~ ${to}`,
      /** 기본인 줄에 붙이는 표식. 아닌 줄은 값 없음 표기(`values.empty`)를 쓴다 */
      isDefault: '기본',
      /** 「Rev 3」처럼 사람이 읽는 형태. 표의 숫자 열과 액션 이름이 함께 쓴다 */
      revision: (version: number): string => `Rev ${String(version)}`,
      /** 자재 명세서 하나를 한 줄로. 액션 이름과 확인 창이 같은 형태를 쓴다 */
      name: (code: string, version: number): string => `${code} · Rev ${String(version)}`,
    },
    actions: {
      setDefaultRow: (name: string): string => `${name} 기본으로 지정`,
    },
    actionReasons: {
      /* 「무엇이 막혔는지 + 어떻게 풀 수 있는지」 — 이 컨트롤의 이름으로 시작한다. */
      alreadyDefault:
        '기본 지정은 이 자재 명세서가 이미 기본이라 할 수 없습니다. 기본을 옮기려면 다른 줄에서 지정하세요.',
    },
    loading: {
      list: '자재 명세서를 불러오는 중',
    },
    empty: {
      /* **여기서 만들 수 없는 자료다** — 자재 명세서도 외부 정본이다. */
      noneTitle: '등록된 자재 명세서가 없습니다',
      noneDescription:
        '자재 명세서는 외부 시스템에서 받아옵니다. 원본 시스템에 자료가 있는지 확인하세요.',
      notSelected: '위에서 자재 명세서를 고르면 여기에 그 내용과 구성품이 보입니다',
    },
    dialog: {
      setDefaultTitle: '기본 자재 명세서 지정',
      /*
       * **사용자가 고르지 않은 다른 줄이 함께 바뀐다.** 그 사실을 창이 먼저 밝히지 않으면
       * 어느 줄이 왜 기본에서 내려갔는지 알 수 없다 — 서버 응답은 지정한 줄만 돌려준다.
       */
      setDefaultDescription: '같은 품목의 기존 기본 자재 명세서는 자동으로 해제됩니다.',
      setDefaultConfirm: '기본으로 지정',
    },
    actionsColumn: {
      /** 헤더 목록에서 이 자재 명세서의 내용·구성품을 연다 */
      open: (name: string): string => `${name} 구성품 보기`,
    },
  },
  /**
   * 구성품 — **한 행에 원본 열 여섯과 확장 열 넷이 섞여 있다.**
   *
   * 이 화면 전체가 걸린 함정이 여기서 가장 좁게 나타난다. 문구도 그 경계를 따라 갈라 둔다 —
   * 편집 창에 들어가는 라벨은 **확장 열 넷뿐**이고, 표의 원본 열에는 라벨만 있고 입력이 없다.
   *
   * **스크랩률에 퍼센트 기호를 쓰지 않는다.** 계약이 0~1 비율이라 못 박았다(A-8) —
   * 화면이 100을 곱하면 사용자가 넣지 않은 값이 보인다.
   */
  component: {
    paneTitle: '구성품',
    fields: {
      sequence: '순서',
      componentItem: '구성품',
      /** 수량과 단위를 한 칸에 담는다 — 둘은 따로 읽히지 않는다 */
      requiredQty: '소요량',
      scrapRate: '스크랩률',
      isMandatory: '필수',
      /** 「등록 공정 · 실사용 공정」을 한 칸에. 두 값이 같을 때가 많아 나란히 놓아야 비교된다 */
      process: '공정',
      /** 켜진 확장 표시만 칩으로 */
      extensions: '확장 표시',
      edit: '편집',
      routingOperation: '등록 공정',
      actualUseProcess: '실사용 공정',
      lotTraceRequired: 'LOT 추적 강제',
      backflushAllowed: '백플러시 허용',
    },
    values: {
      mandatory: '필수',
      optional: '선택',
      /** 소요량 한 칸 — 「수량 단위」 */
      quantity: (qty: string, uom: string): string => `${qty} ${uom}`,
      /** 공정 한 칸 — 「등록 · 실사용」 */
      process: (registered: string, actual: string): string => `${registered} · ${actual}`,
      lotTraceRequired: 'LOT 추적',
      backflushAllowed: '백플러시',
      /* 계약이 널을 허용한다 — 비우는 것이 정상 값이라 선택지로 둔다. */
      unassigned: '지정 안 함',
      /** 등록 공정 선택지 라벨. 순서는 **목록 내 위치**이며 서버 채번 값이 아니다 */
      routingOperation: (version: number, position: number, name: string): string =>
        `Rev ${String(version)} · ${String(position)}. ${name}`,
    },
    actions: {
      editRow: (name: string): string => `${name} 확장 열 수정`,
    },
    actionReasons: {
      /* 「무엇이 막혔는지 + 어떻게 풀 수 있는지」 — 이 컨트롤의 이름으로 시작한다. */
      routingOperationEmpty:
        '등록 공정은 이 품목에 등록된 공정 흐름이 없어 고를 수 없습니다. 공정 흐름을 먼저 등록한 뒤 다시 여세요.',
    },
    loading: {
      list: '구성품을 불러오는 중',
      /* 행 상세를 받는 동안. **이 조회가 끝나야 저장을 열 수 있다**(§5.3 6행). */
      detail: '구성품 정보를 불러오는 중',
    },
    dialog: {
      title: (name: string): string => `구성품 확장 열 수정 — ${name}`,
      /*
       * 창에 원본 열이 없다는 사실을 밝힌다 — 없는 것을 찾다가 「화면이 빠뜨렸다」로 읽지 않게 한다.
       * 서버가 이 경계를 막지 않으므로 화면이 지키는 자리라는 것도 이 문구가 대신한다.
       */
      originNotice:
        '원본 열은 외부 시스템이 소유해 여기서 바꿀 수 없습니다. 아래 네 가지만 저장됩니다.',
    },
    empty: {
      /* **여기서 만들 수 없는 자료다** — 계약에 구성품 추가·삭제 경로가 없다. */
      noneTitle: '등록된 구성품이 없습니다',
      noneDescription:
        '구성품은 외부 시스템에서 받아옵니다. 원본 시스템에 자료가 있는지 확인하세요.',
    },
    /* 「구성품 이름을 못 받았다」는 편집을 막지 않는다 — 표시만의 문제다. */
    itemNamesLoadFailed: '구성품 이름을 불러오지 못했습니다. 편집에는 영향이 없습니다.',
  },
} as const;

/**
 * W-06-11 마스터 변경관리. 이 저장소의 **첫 읽기 전용 조회 형** 화면이라 쓰기 어휘가 하나도 없다.
 *
 * **「Rev」를 사용자 문구에 쓰지 않는다** — 업계 약어라 화면에서는 「개정」으로 쓴다.
 *
 * **전후 값의 항목 이름 문구가 이 묶음에 없다.** 계약이 그 값의 키 구조를 정하지 않아
 * 키→우리말 대응표를 두면 화면이 뜻을 지어낸다. 받은 키를 그대로 낸다.
 */
const masterChange = {
  title: '마스터 변경관리',
  breadcrumbRoot: '기준정보',
  fields: {
    /*
     * 기간은 **한 컨트롤**이다(변경 통지 #63) — 시작·종료 두 칸이 `DatePicker mode="range"`
     * 하나로 합쳐졌다. 라벨도 하나여야 해서 두 칸 시절의 이름을 그대로 둘 수 없다.
     */
    period: '조회 기간',
    targetType: '대상 종류',
    targetId: '대상',
    eventType: '사건 종류',
    performedBy: '수행자',
    correlationId: '상관 식별자',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    viewDiff: '보기',
    /*
     * 행 안의 버튼은 보이는 글자가 행마다 같다. 접근 이름에 발생 시각을 넣어 어느 건인지 밝히되,
     * 보이는 글자를 그대로 담는다 — 담지 않으면 음성 조작이 「보기」로 이 버튼을 부를 수 없다.
     */
    viewDiffRow: (occurredAt: string): string => `${occurredAt} 변경 내용 보기`,
    newRevision: '신규 개정 발행',
  },
  /** 비활성 사유는 그 컨트롤의 이름으로 시작한다(배치 규범 4). */
  reasons: {
    searchNeedsPeriod: '조회는 기간을 모두 채운 뒤에 쓸 수 있습니다. 시작일과 종료일을 고르세요.',
    periodReversed: '기간 종료는 기간 시작보다 앞설 수 없습니다.',
    /*
     * 개정 발행은 「어느 마스터의 어느 판을 복사할 것인가」를 요구하는데 이 화면에는 그 대상이 없다.
     * 버튼을 감추지 않는 이유는 개정 발행이 어디서 이루어지는지를 여기서 알 수 있어야 해서다.
     * 이동 링크는 두지 않는다 — 대상 식별자가 어느 표를 가리키는지 데이터로 판정되지 않는다.
     */
    newRevisionElsewhere:
      '신규 개정 발행은 이 화면에서 할 수 없습니다. 개정은 각 마스터 화면에서 발행합니다.',
  },
  loading: {
    events: '변경 이력 목록을 불러오는 중',
  },
  /** 목록 표의 머리글. 열 구성의 근거는 screens/master-change/event-table.tsx에 있다. */
  table: {
    occurredAt: '발생 시각',
    targetType: '대상 종류',
    targetId: '대상',
    eventType: '사건 종류',
    performedBy: '수행자',
    /** 받은 키 이름을 그대로 이어 담는 흡수 열. 이름을 우리말로 바꾸지 않는다. */
    changedKeys: '바뀐 항목',
    diff: '변경 내용',
  },
  /**
   * 변경 내용 창. **항목 이름 문구가 없다** — 전후 값의 키는 받은 그대로 낸다.
   *
   * 전후 값을 받지 못한 경우는 계약이 허용하고 목 서버가 실제로 그렇게 내려준다.
   * 빈 표를 내거나 값을 지어내지 않고 받지 못했다는 사실을 밝힌다.
   */
  diff: {
    title: '변경 내용',
    auditEventId: '이력 번호',
    terminalId: '단말',
    reason: '사유',
    noValuesTitle: '전후 값을 받지 못했습니다',
    noValuesDescription: '이 건에는 변경 전후 항목이 담겨 있지 않습니다.',
  },
  /**
   * 조건 줄. 선택지는 조회한 기록에서 만들므로 그 한계를 문구가 함께 밝힌다 —
   * ① 아직 확정되지 않은 **임시 목록**이라는 것 ② 이 기간의 기록에서 만들어
   * 한 번도 기록되지 않았거나 기간 밖의 값은 빠진다는 것.
   */
  filters: {
    all: '전체',
    optionsNote:
      '대상 종류·사건 종류는 아직 확정되지 않은 임시 목록입니다. 조회한 기간의 기록에서 만들어, 한 번도 기록되지 않았거나 이 기간에 없는 값은 목록에 없습니다.',
    chipTargetType: (value: string): string => `대상 종류: ${value}`,
    chipTargetId: (value: string): string => `대상: ${value}`,
    chipEventType: (value: string): string => `사건 종류: ${value}`,
    chipPerformedBy: (value: string): string => `수행자: ${value}`,
    chipCorrelationId: (value: string): string => `상관 식별자: ${value}`,
    chipRemoveTargetType: '대상 종류 조건 제거',
    chipRemoveTargetId: '대상 조건 제거',
    chipRemoveEventType: '사건 종류 조건 제거',
    chipRemovePerformedBy: '수행자 조건 제거',
    chipRemoveCorrelationId: '상관 식별자 조건 제거',
  },
  /**
   * 쪽 이동. 번호 목록을 두지 않는다 — 로그성 조회에서 「7쪽으로 점프」는 정상 경로가 아니고,
   * 조건을 좁히는 것이 정상 경로다.
   */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  empty: {
    noResultTitle: '조건에 맞는 변경 이력이 없습니다',
    noResultDescription: '기간을 넓히거나 조건을 줄인 뒤 다시 조회하세요.',
    noPeriodTitle: '기간을 고르고 조회하세요',
    noPeriodDescription: '변경 이력은 기간을 정해야 조회할 수 있습니다.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
  },
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
  },
} as const;

/**
 * W-06-04 판정유형 코드 마스터.
 *
 * 이 화면은 공통코드 화면의 **코드값 편집기를 판정유형 코드 그룹으로 고정해 여는 진입점**이라,
 * 편집기 안의 문구(「코드값 추가」·「코드값 정보」)는 `commonCode.codeValue`가 그대로 쓴다.
 * 그 묶음을 여기서 다시 만들지 않는다 — 고치면 공통코드 화면의 같은 자리가 함께 바뀐다.
 *
 * 그래서 이 묶음에는 **편집기 바깥의 문구만** 있다 — 페이지 머리 · 그룹 해석 결과 · 안내 셋.
 *
 * **판정유형 값의 이름을 여기 적지 않는다.** 값 목록의 정본은 서버이고, 문구에 적으면
 * 화면이 서버와 다른 답을 낸다.
 */
const judgmentCode = {
  title: '판정유형 코드',
  breadcrumbRoot: '기준정보',
  loading: {
    group: '판정유형 코드 그룹을 확인하는 중',
  },
  /**
   * 그룹을 찾지 못한 것은 **오류가 아니라 정상 상태의 하나**다 —
   * 설명이 **찾던 그룹코드를 밝힌다.** 밝히지 않으면 무엇을 등록해야 하는지 알 수 없다.
   */
  empty: {
    groupNotFoundTitle: '판정유형 코드 그룹을 찾지 못했습니다',
    groupNotFoundDescription: (groupCode: string): string =>
      `그룹코드가 「${groupCode}」인 코드그룹이 없습니다. 공통코드 화면에서 이 코드그룹을 먼저 등록하세요.`,
  },
  notices: {
    /** 판정유형 목록이 확정되기 전까지 낸다. 값을 지어내지 않으므로 그 한계를 문구가 밝힌다. */
    provisionalList:
      '판정유형은 아직 확정되지 않은 임시 목록입니다. 지금 보이는 값이 전부가 아닐 수 있고, 확정되면 달라질 수 있습니다.',
    /* 그룹이 꺼져 있어도 값은 그대로 있다 — 편집을 막지 않고 사실과 조치할 곳을 함께 밝힌다. */
    groupInactive:
      '이 코드그룹은 미사용 상태입니다. 값은 그대로 고칠 수 있으나, 사용을 다시 열려면 공통코드 화면에서 코드그룹을 확인하세요.',
    /*
     * 값 추가 경고. **등록 폼이 열려 있는 동안에만** 낸다 —
     * 늘 보이는 경고는 읽히지 않아 정작 값을 늘릴 때 효력이 없다.
     */
    addAffectsOtherScreens:
      '여기서 추가한 판정유형은 판정유형을 쓰는 다른 화면에도 함께 나타납니다. 여러 업무가 같은 목록을 보므로 값을 늘리기 전에 담당자와 확인하세요.',
    /* 편집기 문구가 「코드값」으로 남는 이유를 밝힌다 — 화면 이름과 편집기 어휘가 다르다. */
    editorScope: '이 화면은 판정유형 코드 그룹의 코드값을 편집합니다.',
  },
} as const;

/**
 * W-CO-02 사용자·역할·권한 관리.
 *
 * **「관리자」라는 낱말을 쓰지 않는다.** 어느 역할이 관리자인지 판정할 근거가 계약에 없어
 * 화면이 그 판정을 하지 않기로 했다(계획 결정 4). 문구에 그 낱말이 있으면 화면이
 * 판정하는 것처럼 읽히고, 서버가 실제로 무엇을 막는지와 어긋난다.
 *
 * **역할·권한 탭의 문구는 아직 없다.** 만든 화면의 문구만 둔다 — 없는 화면의 라벨을 미리 두면
 * 무엇이 렌더되는지 흐려진다.
 */
const usersRoles = {
  title: '사용자·역할·권한',
  breadcrumbRoot: '시스템 관리',
  /** 탭 라벨. **만든 탭만 둔다** — 자리만 먼저 두면 「탭은 있는데 눌러도 빈 화면인」 상태가 된다. */
  tabs: {
    label: '사용자·역할·권한',
    users: '사용자',
    roles: '역할·권한',
  },
  panes: {
    userList: '사용자',
    userForm: '사용자 정보',
    roleAssign: '역할 부여',
    dataScope: '데이터 접근범위',
    roleList: '역할',
    roleForm: '역할 정보',
    permission: '기능 권한',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    addUser: '사용자 추가',
    addRole: '역할 추가',
  },
  /** 비활성 사유는 배치 규범 4의 문형을 따른다 — 그 컨트롤의 이름으로 시작한다. */
  actionReasons: {
    /*
     * 상태 코드의 값 목록이 확정되지 않았다. **값을 지어내지 않는다** —
     * 자리표시 값을 조회 조건으로 보내면 언제나 0건이 온다.
     */
    statusFilterPending:
      '상태 조건은 상태 코드 목록이 확정되지 않아 쓸 수 없습니다. 목록이 확정되면 이 조건으로 좁힐 수 있습니다.',
    statusFieldPending:
      '상태는 상태 코드 목록이 확정되지 않아 고를 수 없습니다. 지금 저장된 값이 그대로 유지됩니다.',
    statusFieldOnCreate:
      '상태는 사용자를 등록할 때 정해집니다. 상태 코드 목록이 확정되면 이 칸에서 고를 수 있습니다.',
    /*
     * 계약의 수정 요청 본문에 로그인 ID가 아예 없다 — 「언젠가 풀린다」가 아니라
     * 보낼 자리가 없다는 뜻이다. 그 사실을 그대로 밝힌다.
     */
    loginIdLocked:
      '로그인 ID는 등록할 때만 정할 수 있고 이후에는 바꿀 수 없습니다. 변경이 필요하면 담당자에게 문의하세요.',
    deactivateAlreadyDone: '사용 중지는 이미 미사용인 사용자에게 다시 할 수 없습니다.',
    deactivateRoleAlreadyDone: '사용 중지는 이미 미사용인 역할에 다시 할 수 없습니다.',
    /* 주 액션의 이름이 모드마다 달라 사유도 갈린다 — 규범 4는 컨트롤 이름으로 시작하라고 정한다. */
    saveNoChanges: '저장은 고친 내용이 있을 때 누를 수 있습니다.',
    addNoInput: '사용자 추가는 입력한 내용이 있을 때 누를 수 있습니다.',
    addRoleNoInput: '역할 추가는 입력한 내용이 있을 때 누를 수 있습니다.',
    /*
     * 계약이 두 축 중 하나 이상을 요구한다. **목 서버가 막지 않으므로** 화면이 저장 전에 막는다 —
     * 보내 놓고 되돌려 받으면 사용자가 두 번 기다린다.
     */
    dataScopeTargetRequired: '확인은 사업부와 공장 중 적어도 하나를 고른 뒤에 누를 수 있습니다.',
    /*
     * 유일 제약이 빈 축을 접어 판정한다 — 사업부만 고른 두 줄은 서버에게 같은 짝이다.
     * 화면이 다르게 세면 사용자가 만든 줄이 저장 시점에야 거부된다.
     */
    dataScopeDuplicate:
      '확인은 이미 있는 범위와 겹치지 않을 때 누를 수 있습니다. 비운 축은 「(전체)」로 봅니다.',
  },
  /**
   * 사용 중지 확인 창.
   *
   * **참조 건수·배정 건수를 내지 않는다**(계획 결정 12) — 화면이 쓸 수 있는 건수는
   * 「코드 필드를 고칠 수 있는지」의 근거이지 「이 사용자에게 배정된 수」가 아니다.
   * 두 뜻을 섞으면 화면이 지어낸다.
   */
  dialog: {
    deactivateUserTitle: '이 사용자를 사용 중지할까요?',
    deactivateUserDescription:
      '사용 중지하면 이 사용자는 시스템을 쓸 수 없게 되고 이미 쌓인 자료는 그대로 남습니다. 되돌리는 경로가 없습니다.',
    deactivateRoleTitle: '이 역할을 사용 중지할까요?',
    /*
     * 역할과 사용자는 **중지했을 때 일어나는 일이 다르다.** 사용자 문구를 그대로 쓰면
     * 「이 사용자는 시스템을 쓸 수 없게 됩니다」가 역할 창에 나와 사실과 다른 안내가 된다.
     * 건수는 여기서도 내지 않는다 — 화면이 낼 수 있는 건수가 없다.
     */
    deactivateRoleDescription:
      '사용 중지하면 이 역할을 새로 부여할 수 없고 이 역할로 열려 있던 권한이 사라집니다. 이미 쌓인 자료는 그대로 남습니다. 되돌리는 경로가 없습니다.',
  },
  /*
   * 선택 목록이 잘리거나 실패했다는 사실을 감추지 않는다 —
   * 알리지 않으면 이름이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다.
   */
  optionsTruncated: '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
  optionsLoadFailed: '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
  /** 쪽 이동. 번호 목록을 두지 않는다 — 조건을 좁히는 것이 정상 경로다. */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  filters: {
    userSearchLabel: '사용자 검색',
    userSearchPlaceholder: '로그인 ID 또는 이름',
    department: '부서',
    /* 선택지에 빈 값을 두어 고른 부서를 다시 「전체」로 되돌릴 수 있게 한다. */
    departmentAll: '전체 부서',
    status: '상태',
    chipKeyword: (value: string): string => `검색어: ${value}`,
    chipRemoveKeyword: '검색어 조건 제거',
    chipDepartment: (label: string): string => `부서: ${label}`,
    chipRemoveDepartment: '부서 조건 제거',
    chipRemoveIncludeInactive: '미사용 포함 조건 제거',
    roleSearchLabel: '역할 검색',
    roleSearchPlaceholder: '역할 코드 또는 역할명',
  },
  loading: {
    users: '사용자 목록을 불러오는 중',
    userDetail: '사용자 정보를 불러오는 중',
    roleAssign: '역할 부여분을 불러오는 중',
    dataScopes: '데이터 접근범위를 불러오는 중',
    roles: '역할 목록을 불러오는 중',
    roleDetail: '역할 정보를 불러오는 중',
    permissions: '기능 권한을 불러오는 중',
  },
  empty: {
    /*
     * 결과는 있는데 **이 쪽에는** 없다. 주소를 손으로 고치거나 조건이 좁아졌을 때 생긴다 —
     * 「등록된 것이 없다」로 내면 사실과 다른 안내가 된다.
     */
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
  },
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
    /*
     * 좁은 좌 페인에서 「사용 여부」 열을 따로 두면 이름 열이 짓눌린다 —
     * 이름 뒤 접미로 붙여 열을 늘리지 않는다.
     */
    inactiveSuffix: ' (미사용)',
    /*
     * 값은 있는데 그 번호를 선택 목록에서 찾지 못했다. **번호를 그대로 내지 않는다** —
     * 내부 식별자라 사용자가 쓸 수 없고, 보이면 자료로 읽힌다.
     */
    unknown: '알 수 없음',
    /*
     * 사용 여부를 **열로** 내는 자리에 쓴다. 역할에는 상태 코드가 없어(계약이 준 필드가
     * `isActive` 하나뿐이다) 상태 열이 사용 여부를 그대로 낸다 — 사용자 표처럼
     * 이름 뒤 접미로만 붙이면 역할 표의 상태 열에 낼 것이 없어진다.
     */
    active: '사용 중',
    inactive: '미사용',
  },
  user: {
    fields: {
      loginId: '로그인 ID',
      userName: '이름',
      department: '부서',
      email: '전자우편',
      status: '상태',
    },
    /* 부서를 고르지 않은 상태. 계약이 널을 허용하므로 비우는 것이 정상 값이다. */
    departmentNone: '지정하지 않음',
    empty: {
      noneTitle: '등록된 사용자가 없습니다',
      noneDescription: '「사용자 추가」로 첫 사용자를 등록하세요.',
      noMatchTitle: '조건에 맞는 사용자가 없습니다',
      noMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
      notSelected: '좌측에서 사용자를 고르면 여기에 그 사용자의 정보가 보입니다',
    },
    validation: {
      required: '필수 입력 항목입니다.',
      loginIdBlank: '로그인 ID는 공백만으로 지정할 수 없습니다.',
      userNameBlank: '이름은 공백만으로 지정할 수 없습니다.',
      loginIdTooLong: '로그인 ID는 100자를 넘을 수 없습니다.',
      userNameTooLong: '이름은 200자를 넘을 수 없습니다.',
      emailTooLong: '전자우편은 200자를 넘을 수 없습니다.',
      /* 계약이 「형식 검증은 화면 책임 — DB 제약 없음」이라고 명시한 유일한 칸이다. */
      emailFormat: '전자우편 형식이 아닙니다. 「이름@도메인」 형태로 입력하세요.',
    },
  },
  /**
   * 역할 — 사용자에게 부여하는 묶음이자 기능 권한을 담는 그릇.
   *
   * **역할 코드는 로그인 ID와 다르다.** 계약의 수정 본문에 그 키가 있고 참조 건수를 셀 수 있어
   * 잠금 판정이 정상으로 내려온다 — 화면이 따로 잠그지 않고 `editability`를 따른다.
   */
  role: {
    fields: {
      roleCode: '역할 코드',
      roleName: '역할명',
      description: '설명',
      status: '상태',
    },
    empty: {
      noneTitle: '등록된 역할이 없습니다',
      noneDescription: '「역할 추가」로 첫 역할을 등록하세요.',
      noMatchTitle: '조건에 맞는 역할이 없습니다',
      noMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
      notSelected: '좌측에서 역할을 고르면 여기에 그 역할의 정보가 보입니다',
    },
    validation: {
      required: '필수 입력 항목입니다.',
      roleCodeBlank: '역할 코드는 공백만으로 지정할 수 없습니다.',
      roleNameBlank: '역할명은 공백만으로 지정할 수 없습니다.',
      roleCodeTooLong: '역할 코드는 50자를 넘을 수 없습니다.',
      roleNameTooLong: '역할명은 200자를 넘을 수 없습니다.',
    },
  },
  /**
   * 기능 권한 격자 — **보는 것까지만 된다.**
   *
   * 권한 목록(어떤 권한이 있는지·메뉴 단위인지 조작 단위인지)이 확정되지 않아
   * 화면이 고를 수 있는 값이 하나도 없다. 격자는 그리되 누를 수 없게 두고,
   * 그 사실을 감추지 않고 **항상 보이는 안내**로 밝힌다(이슈 #17 §4).
   *
   * 안내 문구는 여러 컨트롤이 함께 보는 것이라 컨트롤 이름이 아니라
   * **무엇에 대한 안내인지**로 시작한다(배치 규범 4의 이탈 조건).
   */
  permission: {
    pendingNote:
      '기능 권한은 권한 목록이 확정된 뒤에 여기에서 바꿀 수 있습니다. 지금은 이 역할에 부여된 권한을 보는 것까지만 됩니다.',
    /*
     * 격자의 열 머리글이 곧 권한 코드다 — 이름 목록이 아직 없어 코드를 그대로 낸다.
     *
     * 셀의 접근 이름은 **양쪽 다 화면이 만든다.** 디자인 시스템은 상태가 `none`인 셀을
     * 「상태 없음」으로 정규화해 이름을 조합해 주지 않는다 — 그대로 두면 부여되지 않은 칸이
     * **이름도 내용도 없는 빈 칸**이 되어 보조기술에게 그 칸의 뜻이 닿지 않는다.
     */
    granted: '부여됨',
    notGranted: '부여되지 않음',
    empty: {
      none: '이 역할에 부여된 기능 권한이 없습니다',
      noneDescription: '권한 목록이 확정되면 여기에서 부여할 수 있습니다.',
    },
  },
  /**
   * 역할 부여 — **전체 치환이다.** 확인칸 하나마다 서버를 부르지 않고 최종 상태를 통째로 보낸다.
   *
   * **표의 선택 열을 쓰지 않는다**(계획 결정 11). 표 머리글의 전체 선택은 이 자리에서
   * 「이 사용자에게 모든 역할을 준다」가 되고, 한 번 눌리면 되돌리기 전까지 권한이 전부 열린다.
   *
   * **어떤 역할이 특별하다고 화면이 정하지 않는다**(계획 결정 4). 무엇을 줄 수 있고
   * 무엇을 뺄 수 없는지는 서버가 정하며, 화면은 그 거부를 그대로 옮기기만 한다.
   */
  assign: {
    empty: {
      none: '고를 수 있는 역할이 없습니다',
      noneDescription: '역할이 등록되면 여기에서 부여할 수 있습니다.',
    },
    /*
     * 미사용 역할은 **이미 부여돼 있을 때만** 목록에 남는다 — 빼 버리면 저장할 때
     * 그 부여가 조용히 사라진다. 여러 확인칸이 함께 보는 안내라 컨트롤 이름이 아니라
     * 무엇에 대한 안내인지로 시작한다(배치 규범 4의 이탈 조건).
     */
    lockedInactiveNote:
      '미사용 역할은 이미 부여돼 있어 목록에 남아 있습니다. 여기에서는 바꿀 수 없습니다.',
  },
  /**
   * 데이터 접근범위 — 이 사용자가 어느 사업부·공장의 자료를 볼 수 있는가.
   *
   * **빈 축은 「고르지 않음」이 아니라 고른 값이다** — 그 축 전체를 뜻한다.
   * 그래서 표에도 「(전체)」로 적고 저장 본문에도 널을 명시해 싣는다.
   */
  scope: {
    fields: {
      businessUnit: '사업부',
      plant: '공장',
      edit: '편집',
    },
    values: {
      all: '(전체)',
      pair: (businessUnit: string, plant: string): string => `${businessUnit} · ${plant}`,
    },
    actions: {
      add: '범위 추가',
      /* 「수정」이 여러 줄에 있으면 어느 줄을 고치는 것인지 알 수 없다. */
      editRow: (label: string): string => `${label} 범위 수정`,
      removeRow: (label: string): string => `${label} 범위 삭제`,
      confirm: '확인',
    },
    dialog: {
      addTitle: '접근범위 추가',
      editTitle: '접근범위 수정',
      /* 확인이 저장이라고 오해하면 창을 닫고 화면을 떠난다. */
      notSavedNotice:
        '확인을 눌러도 아직 저장되지 않습니다. 표에만 반영되고 「저장」을 눌러야 서버로 갑니다.',
    },
    empty: {
      none: '지정된 접근범위가 없습니다',
      noneDescription: '「범위 추가」로 이 사용자가 볼 수 있는 범위를 정하세요.',
    },
  },
} as const;

/**
 * W-01-09 입하 예정 조회. **자재창고 도메인의 첫 화면**이고 조회 전용이라 쓰기 어휘가 하나도 없다.
 *
 * **「ASN」을 사용자 문구에 쓰지 않는다** — 업계 약어라 화면에서는 「입하 예정」으로 쓴다.
 *
 * **「미입하」·「지연」을 쓰지 않는다.** 상태 값 집합이 확정되지 않아 입하 여부를 화면이 판정할 수 없다.
 * 도착 예정일이 지났다는 **사실만** 말한다.
 *
 * **참조 값(공급사·공장·품목·단위)의 표기가 세 갈래다** — 아직 오지 않음 · 목록에 없음 · 불러오기 실패.
 * 셋을 한 문구로 뭉개면 정상 값이 잠깐 「알 수 없음」으로 보여 뜻이 반대로 읽힌다.
 */
const inboundSchedule = {
  title: '입하 예정 조회',
  breadcrumbRoot: '자재창고',
  panes: {
    list: '입하 예정 목록',
    lines: '선택한 건의 라인',
  },
  fields: {
    periodFrom: '도착 예정일 시작',
    periodTo: '도착 예정일 종료',
    supplier: '공급사',
    status: '상태',
    item: '품목',
    q: '문서번호 검색',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    select: '선택',
    deselect: '선택 해제',
    /*
     * 행 안의 버튼은 보이는 글자가 행마다 같다. 접근 이름에 입하예정번호를 넣어 어느 건인지 밝히되,
     * 보이는 글자를 그대로 담는다 — 담지 않으면 음성 조작이 「선택」으로 이 버튼을 부를 수 없다.
     * **입하예정번호를 쓴다.** 내부 번호를 접근 이름에 넣으면 화면 밖으로 새어 나간다.
     */
    selectRow: (asnNo: string): string => `${asnNo} 선택`,
    deselectRow: (asnNo: string): string => `${asnNo} 선택 해제`,
  },
  /** 비활성 사유·실패 사유는 그 컨트롤이나 대상의 이름으로 시작한다(배치 규범 4). */
  reasons: {
    periodInvalid: '도착 예정일은 있는 날짜여야 합니다. 시작일과 종료일을 다시 고르세요.',
    periodReversed: '도착 예정일 종료는 시작보다 앞설 수 없습니다.',
    /*
     * 이름을 못 불러온 것이지 자료가 없는 것이 아니다 — 둘을 섞으면 목록이 비어 보인다.
     *
     * **문구에 적은 대상과 「다시 시도」가 다시 부르는 대상이 같아야 한다.** 다르면 눌러도
     * 한쪽은 실패인 채로 남는데 문구는 둘 다 고쳐질 것처럼 말한다.
     * 공장은 고른 건의 제목줄에서만 보이므로 아래 구획 안내가 맡는다.
     */
    referencesFailed: '공급사 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    lineReferencesFailed:
      '품목·단위·공장 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
  },
  loading: {
    asns: '입하 예정 목록을 불러오는 중',
    lines: '라인을 불러오는 중',
  },
  /** 목록 표의 머리글. 열 구성과 폭의 근거는 screens/inbound-schedule/asn-table.tsx에 있다. */
  table: {
    asnNo: '입하예정번호',
    supplier: '공급사',
    expectedArrivalDate: '도착 예정일',
    status: '상태',
    select: '선택',
  },
  /** 라인 표의 머리글. **진행 열과 P/O 라인 열이 없다** — 근거는 asn-line-table.tsx에 있다. */
  lineTable: {
    lineNo: '줄번호',
    item: '품목',
    expectedQty: '예정수량',
    uom: '단위',
    supplierLotNo: '공급사 LOT',
  },
  /** 고른 건의 제목줄. **위 표에 두지 않은 값(공장·비고)이 여기서 보인다.** */
  summary: {
    label: '고른 입하 예정',
    asnNo: '입하예정번호',
    supplier: '공급사',
    plant: '공장',
    expectedArrivalDate: '도착 예정일',
    deliveryNoteNo: '거래명세서번호',
    remarks: '비고',
  },
  /**
   * 조건 줄. 상태 선택지는 조회 결과에서 만들므로 그 한계를 문구가 함께 밝힌다 —
   * ① 아직 확정되지 않은 **임시 목록**이라는 것 ② 이번 결과에 없는 값은 빠진다는 것.
   */
  filters: {
    all: '전체',
    statusNote:
      '상태는 아직 확정되지 않은 임시 목록입니다. 이번 조회 결과에 나온 값으로 만들어, 결과에 없는 값은 목록에 없습니다.',
    /* 기간이 필수가 아니라는 사실은 화면에서 읽혀야 한다 — 비워 두면 「빠뜨렸다」로 읽힌다. */
    periodNote: '도착 예정일 기간은 비워 두어도 조회됩니다.',
    lookupTruncated: '선택지가 앞쪽 일부만 보입니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
    lookupFailed: '선택지를 불러오지 못했습니다.',
    chipSupplier: (value: string): string => `공급사: ${value}`,
    chipStatus: (value: string): string => `상태: ${value}`,
    chipItem: (value: string): string => `품목: ${value}`,
    chipQ: (value: string): string => `문서번호: ${value}`,
    chipRemoveSupplier: '공급사 조건 제거',
    chipRemoveStatus: '상태 조건 제거',
    chipRemoveItem: '품목 조건 제거',
    chipRemoveQ: '문서번호 조건 제거',
  },
  /** 쪽 이동. 번호 목록을 두지 않는 근거는 screens/inbound-schedule/page-nav.tsx에 있다. */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  empty: {
    noResultTitle: '조건에 맞는 입하 예정이 없습니다',
    noResultDescription: '기간을 넓히거나 조건을 줄인 뒤 다시 조회하세요.',
    /*
     * **조회하지 않은 것을 「없습니다」로 말하지 않는다.** 보낼 수 없는 기간(없는 날짜·뒤집힘)이면
     * 요청 자체가 나가지 않는데, 그때 결과 없음을 내면 사용자가 자료가 없는 줄 알고
     * 조건을 더 넓힌다 — 무엇을 해도 결과가 같다. 사유는 조건 줄이 밝히므로 여기서는
     * 되풀이하지 않고 어디를 고쳐야 하는지만 가리킨다.
     */
    notQueriedTitle: '아직 조회하지 않았습니다',
    notQueriedDescription: '조건 줄의 안내에 따라 도착 예정일을 고친 뒤 조회하세요.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
    noSelectionTitle: '입하 예정을 고르면 라인이 보입니다',
    noSelectionDescription: '위 목록에서 한 건을 골라 「선택」을 누르세요.',
    noLinesTitle: '이 건에는 라인이 없습니다',
    noLinesDescription: '입하 예정에 담긴 품목 줄이 하나도 없습니다.',
  },
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
    /** 이름 목록은 왔는데 그 안에 없다 — **값이 잘못됐다**는 신호다. */
    unknown: '알 수 없음',
    /** 이름 목록이 아직 오지 않았다. 「알 수 없음」으로 쓰면 정상 값이 잘못된 값으로 읽힌다. */
    referenceLoading: '이름 불러오는 중',
    /** 이름 목록 조회가 실패했다. 값이 없는 것과 다르다. */
    referenceFailed: '이름을 불러오지 못했습니다',
    /* 「미입하」라고 쓰지 않는다 — 상태 값 집합을 모르므로 입하 여부를 화면이 판정할 수 없다. */
    overdue: '도착 예정일 경과',
    /*
     * 미사용 참조에 붙이는 표식. **선택지에서 빼지 않는다** — 이 화면은 조회 전용이고
     * ERP 수신본에는 지금은 쓰지 않는 거래처·품목을 참조하는 과거 건이 있다.
     * 빼면 그 건들을 조건으로 찾을 방법이 사라진다. 표식만 붙여 고를 때 알 수 있게 한다.
     */
    inactiveSuffix: ' (미사용)',
  },
  notes: {
    /* 밝히지 않으면 사용자가 「전체가 정렬된 것」으로 읽는다. */
    sortScope:
      '정렬은 지금 보고 있는 쪽 안에서만 적용됩니다. 다른 쪽의 건은 함께 정렬되지 않습니다.',
  },
} as const;

/**
 * W-01-07 재고 현황·상태 조회. 조회 전용이라 쓰기 어휘가 하나도 없다.
 *
 * **「묶는 축」을 사용자 문구에 쓰지 않는다** — 계약의 낱말(`groupBy`)이고, 화면에서는
 * 「보기」와 그 이름(품목별·LOT별·위치별)으로 말한다.
 *
 * **참조 값(창고·위치·품목·LOT·단위·소유처)의 표기가 네 갈래다** — 아직 오지 않음 ·
 * 목록에 없음 · 불러오기 실패 · **`null`이 뜻을 갖는 자리**. 넷을 뭉개면 정상 값이
 * 「알 수 없음」으로 보여 뜻이 반대로 읽힌다.
 *
 * **「(LOT 무관)」·「(자사 소유)」는 빈 값이 아니라 확정된 뜻이다.** 대시나 「알 수 없음」으로
 * 두면 자료가 빠졌거나 값이 잘못됐다는 뜻이 되어 정반대로 읽힌다.
 *
 * **정렬 안내가 W-01-09와 반대다** — 그 화면은 「현재 쪽 안에서만」이고 이 화면은
 * 「전체 결과 기준」이다. 서버가 정렬해 쪽을 나눠 주기 때문이다.
 */
const stockStatus = {
  title: '재고 현황·상태 조회',
  breadcrumbRoot: '자재창고',
  panes: {
    list: '재고 잔액 목록',
    /*
     * **드로어도 창도 아닌 「아래 구획」이다**(계획 결정 2). 디자인 시스템에 드로어가 없고,
     * 창으로 대체하면 목록이 가려져 이 화면의 「고르고 돌아오는」 반복 조회가 매번 열고 닫는
     * 일이 된다.
     */
    detail: 'LOT 상세',
    /** 상세와 나란한 셋째 구획이다. 같은 LOT을 다른 질문(언제 얼마나 움직였나)으로 본다. */
    history: '수불 이력',
  },
  /** 보기 탭. 값은 주소 키 `view`와 같다. */
  views: {
    label: '보기',
    item: '품목별',
    lot: 'LOT별',
    location: '위치별',
  },
  fields: {
    warehouse: '창고',
    item: '품목',
    lot: 'LOT',
    location: '위치',
    qualityStatus: '품질 상태',
    inventoryStatus: '재고 상태',
    ownership: '소유 구분',
    includeZero: '잔액 0 포함',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    /** 같은 조회를 다시 한다. 조건·보기·정렬·쪽·선택을 하나도 바꾸지 않는다. */
    refresh: '새로고침',
    select: '선택',
    deselect: '선택 해제',
    /*
     * 접근 이름에 **LOT 이름**을 넣는다 — 「선택」이 행마다 되풀이되면 어느 줄인지 알 수 없다.
     * 내부 번호를 넣지 않는다(#44) — 이름을 못 풀면 표 칸과 같은 대체 표기가 들어간다.
     */
    selectRow: (lotName: string): string => `${lotName} 선택`,
    deselectRow: (lotName: string): string => `${lotName} 선택 해제`,
  },
  /** 비활성 사유·실패 사유는 그 컨트롤이나 대상의 이름으로 시작한다(배치 규범 4). */
  reasons: {
    /*
     * **창고 필수는 이 화면의 규칙이지 계약의 규칙이 아니다.** 문구도 그렇게 읽히게 쓴다 —
     * 「창고는 필수입니다」가 아니라 「창고를 고른 뒤 조회합니다」다.
     */
    warehouseRequired: '창고를 고른 뒤 조회합니다. 이 화면은 한 창고의 재고를 봅니다.',
    /*
     * LOT 이름을 풀 범위를 품목이 정한다 — 품목 없이 열면 LOT 칸이 거의 전부
     * 「알 수 없음」이 되어 정상 값이 잘못된 값으로 보인다.
     */
    lotViewNeedsItem: 'LOT별 보기는 품목을 고른 뒤에 열립니다. LOT 이름을 품목 범위에서 풉니다.',
    /*
     * **문구에 적은 대상과 「다시 시도」가 다시 부르는 대상이 같아야 한다.** 다르면 눌러도
     * 한쪽은 실패인 채로 남는데 문구는 둘 다 고쳐질 것처럼 말한다.
     */
    filterReferencesFailed:
      '창고·위치·품목·LOT 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    listReferencesFailed: '단위·소유처 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    /*
     * **성능이 아니라 가능·불가능의 문제다.** 계약이 영업일 범위를 필수로 두어 기간 없이
     * 부르면 거부된다 — 「기간을 줄이면 빨라집니다」가 아니라 「기간 없이는 조회할 수
     * 없습니다」로 적는다. 그렇게 적지 않으면 사용자가 기간을 비운 채 기다린다.
     */
    historyNeedsPeriod:
      '영업일 시작과 종료를 모두 채운 뒤 조회합니다. 수불 이력은 기간 없이는 조회할 수 없습니다.',
    historyPeriodReversed: '영업일 종료가 시작보다 앞섭니다. 두 날짜의 순서를 바꾸세요.',
  },
  loading: {
    balances: '재고 잔액을 불러오는 중',
    lotDetail: 'LOT 상세를 불러오는 중',
    history: '수불 이력을 불러오는 중',
    transactionLines: '거래 라인을 불러오는 중',
  },
  /** 잔액 표의 머리글. 열 구성과 폭의 근거는 screens/stock-status/balance-table.tsx에 있다. */
  table: {
    item: '품목',
    lot: 'LOT',
    location: '위치',
    onHandQty: '보유',
    availableQty: '가용',
    blockedQty: '보류',
    uom: '단위',
    qualityStatus: '품질 상태',
    inventoryStatus: '재고 상태',
    ownership: '소유',
    lastTransactionAt: '최근 거래',
    /** LOT별 보기에만 있는 열. 다른 보기의 줄은 LOT을 가리키지 않아 고를 대상이 없다. */
    select: '상세',
  },
  /** 1단 그룹 헤더. 무엇으로 묶였는지 이름 앞에 밝힌다 — 이름만 있으면 축을 알 수 없다. */
  groupHeader: {
    item: (name: string): string => `품목: ${name}`,
    location: (name: string): string => `위치: ${name}`,
  },
  /**
   * 조건 줄. 상태·소유 구분 선택지는 조회 결과에서 만들므로 그 한계를 문구가 함께 밝힌다 —
   * ① 아직 확정되지 않은 **임시 목록**이라는 것 ② 이번 결과에 없는 값은 빠진다는 것.
   */
  filters: {
    all: '전체',
    codeNote:
      '아직 확정되지 않은 임시 목록입니다. 이번 조회 결과에 나온 값으로 만들어, 결과에 없는 값은 목록에 없습니다.',
    lookupTruncated: '선택지가 앞쪽 일부만 보입니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
    lookupFailed: '선택지를 불러오지 못했습니다.',
    /* 위치·LOT 선택칸은 매달린 조건이 없으면 선택지가 비어 있다 — 그 사실을 밝힌다. */
    locationNeedsWarehouse: '창고를 고르면 위치 선택지가 채워집니다.',
    lotNeedsItem: '품목을 고르고 LOT별 보기로 바꾸면 LOT 선택지가 채워집니다.',
    chipWarehouse: (value: string): string => `창고: ${value}`,
    chipItem: (value: string): string => `품목: ${value}`,
    chipLot: (value: string): string => `LOT: ${value}`,
    chipLocation: (value: string): string => `위치: ${value}`,
    chipQualityStatus: (value: string): string => `품질 상태: ${value}`,
    chipInventoryStatus: (value: string): string => `재고 상태: ${value}`,
    chipOwnership: (value: string): string => `소유 구분: ${value}`,
    chipIncludeZero: '잔액 0 포함',
    chipRemoveWarehouse: '창고 조건 제거',
    chipRemoveItem: '품목 조건 제거',
    chipRemoveLot: 'LOT 조건 제거',
    chipRemoveLocation: '위치 조건 제거',
    chipRemoveQualityStatus: '품질 상태 조건 제거',
    chipRemoveInventoryStatus: '재고 상태 조건 제거',
    chipRemoveOwnership: '소유 구분 조건 제거',
    chipRemoveIncludeZero: '잔액 0 포함 해제',
  },
  /** 쪽 이동. 번호 목록을 두지 않는 근거는 screens/stock-status/page-nav.tsx에 있다. */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  empty: {
    /*
     * **조회하지 않은 것을 「없습니다」로 말하지 않는다.** 창고를 고르기 전에는 요청 자체가
     * 나가지 않는데, 그때 결과 없음을 내면 사용자가 자료가 없는 줄 알고 조건을 더 넓힌다 —
     * 무엇을 해도 결과가 같다. 사유는 조건 줄의 잠긴 버튼이 이미 밝힌다.
     */
    notQueriedTitle: '아직 조회하지 않았습니다',
    notQueriedDescription: '조건 줄에서 창고를 고른 뒤 조회하세요.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
    noResultTitle: '조건에 맞는 재고가 없습니다',
    noResultDescription: '조건을 줄이거나 「잔액 0 포함」을 켠 뒤 다시 조회하세요.',
    /* 목록이 계속 보이는 자리라 「무엇을 하면 채워지는가」만 말한다. */
    noSelectionTitle: '고른 LOT이 없습니다',
    noSelectionDescription: '위 표에서 LOT을 고르면 그 상태와 보류가 여기에 보입니다.',
  },
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
    /** 이름 목록은 왔는데 그 안에 없다 — **값이 잘못됐다**는 신호다. */
    unknown: '알 수 없음',
    /** 이름 목록이 아직 오지 않았다. 「알 수 없음」으로 쓰면 정상 값이 잘못된 값으로 읽힌다. */
    referenceLoading: '이름 불러오는 중',
    /** 이름 목록 조회가 실패했다. 값이 없는 것과 다르다. */
    referenceFailed: '이름을 불러오지 못했습니다',
    /*
     * **`null`이 뜻을 갖는 자리 둘.** 「알 수 없음」과 가른다 —
     * 품목별·위치별 보기에서 LOT이 비는 것은 정상이고, 소유처가 비는 것은 자사 소유라는 뜻이다.
     */
    noLot: '(LOT 무관)',
    ownedBySelf: '(자사 소유)',
    /*
     * 음수 보유를 **오류로 부르지 않는다** — 음수를 허용하는 품목인지 알 수 있는 필드가
     * 계약에 없다. 「음수」라는 사실만 말한다.
     */
    negativeOnHand: '음수 보유',
    /** 계약이 세어 준 값을 그대로 쓴다 — 화면이 보류 LOT을 따로 세지 않는다. */
    heldLotCount: (count: number): string => `보류 LOT ${String(count)}건`,
    /*
     * 미사용 참조에 붙이는 표식. **선택지에서 빼지 않는다** — 과거 재고가 미사용 창고·위치·
     * 품목을 참조할 수 있어, 빼면 그 재고를 조건으로 찾을 방법이 사라진다.
     * 표 칸에는 붙이지 않는다(`ReferenceState`가 사용 여부를 나르지 않는다 — 저장소 관례).
     */
    inactiveSuffix: ' (미사용)',
  },
  notes: {
    /*
     * **W-01-09와 반대다.** 그 화면은 쪽 안 정렬이라 「현재 쪽 안에서만」이고,
     * 이 화면은 서버 정렬이라 「전체 결과 기준」이다. 베껴 쓰면 사실과 어긋난다.
     *
     * 방향을 함께 밝힌다 — 계약의 `sort`가 열만 받고 방향을 받지 않아 한 방향뿐인데,
     * `aria-sort`는 「모름」을 표기할 수단이 없어 오름차순으로 적는다.
     */
    sortScope:
      '정렬은 서버가 전체 결과를 기준으로 합니다. 정렬 방향은 고를 수 없어 오름차순 한 방향입니다.',
    /* 밝히지 않으면 사용자가 「이 품목의 LOT은 이게 전부」로 읽는다 — 서버가 쪽을 나눠 준다. */
    groupScope: '그룹은 지금 보고 있는 쪽 안에서만 묶입니다. 다른 쪽의 행은 함께 묶이지 않습니다.',
  },
  /**
   * LOT 상세 구획 — 아래 구획이다(계획 결정 2). **조회만 한다** — 등록·수정·보류 해제 수단이
   * 하나도 없다. 그것은 품질 도메인 화면의 소관이다.
   */
  detail: {
    /*
     * **제목이 아니라 속성 묶음의 접근 이름이다.** 이 구획에는 이름·값 묶음이 둘 있고
     * (속성 · 수량) 보조기술이 둘을 가르는 근거가 이 이름이다 — 짝인 `quantities`와
     * 같은 자리에 있는 값이라 이름도 같은 결로 둔다.
     */
    attributes: (lotNo: string): string => `LOT ${lotNo}`,
    /*
     * **수량은 상세 조회가 아니라 고른 잔액 줄에서 온다.** 계약의 `Lot`은 만들어질 때의
     * 초기 수량만 갖는다. 그래서 「이 조건으로 조회한 줄의 수량」임을 밝힌다 —
     * 밝히지 않으면 사용자가 그 LOT의 전체 재고로 읽는다.
     */
    quantities: '지금 수량',
    quantitiesNote:
      '지금 걸린 조회 조건에 해당하는 줄의 수량입니다. 가용은 서버가 계산해 내려준 값입니다.',
    onHandQty: '보유',
    reservedQty: '예약',
    pickedQty: '피킹',
    blockedQty: '보류',
    availableQty: '가용',
    /** 수량 다섯이 모두 이 단위로 세어진다 — 줄마다 다르므로 수량 곁에 붙인다. */
    uom: '단위',
    lotType: 'LOT 유형',
    status: '상태',
    manufacturedAt: '제조 시각',
    expiryDate: '유효기한',
    initialQty: '초기 수량',
    remarks: '비고',
    /*
     * **표식일 뿐이다.** 기한이 지난 재고를 어떻게 할지가 아직 정해지지 않아
     * 자동으로 보류를 걸지 않는다(이슈 §4 미결 5). 임박 기준 일수도 미확정이라(미결 2)
     * 상수에서 받아 문구에 넣는다 — 문구에 숫자를 박으면 고칠 자리가 둘이 된다.
     */
    expiryPassed: '유효기한 경과',
    expirySoon: '유효기한 임박',
    expiryNote: (days: number): string =>
      `임박 기준은 ${String(days)}일이며 아직 확정되지 않았습니다. 기한이 지나도 보류가 자동으로 걸리지 않습니다.`,
    externalIdentifiers: '외부 식별자',
    identifierType: '식별자 유형',
    externalIdentifier: '식별자',
    issuedBy: '발급처',
    externalSystem: '외부 시스템',
    /* 발급처가 비어 있는 것이 정상이다 — 우리 쪽에서 붙인 번호다. */
    issuedBySelf: '(자체 부여)',
    noExternalIdentifiers: '등록된 외부 식별자가 없습니다.',
    /*
     * **문구에 적은 대상과 「다시 시도」가 다시 부르는 대상이 같아야 한다.**
     * 이 구획이 이름을 내는 참조는 단위와 발급처(거래처) 둘이다.
     */
    referencesFailed: '단위·발급처 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    holds: {
      title: '해제되지 않은 보류',
      reason: '사유',
      status: '상태',
      holdQty: '보류 수량',
      uom: '단위',
      heldAt: '보류 시각',
      releaseCondition: '해제 조건',
      remarks: '비고',
      /* 계약이 「비어 있으면 전량 보류」로 정했다. 빈칸이나 0으로 두면 정반대로 읽힌다. */
      wholeLot: '전량 보류',
      emptyTitle: '해제되지 않은 보류가 없습니다',
      emptyDescription: '이 LOT에 걸린 보류가 없거나 모두 해제되었습니다.',
      /*
       * **경로 안내이지 링크가 아니다.** 의심자재 등록은 품질 도메인 화면의 소관이고
       * 그 화면이 아직 없어 링크를 만들면 죽은 링크가 된다(이슈 §6).
       */
      suspectMaterialPath:
        '의심자재 등록은 품질관리 > 의심자재 등록(W-03-03)에서 합니다. 이 화면은 조회만 합니다.',
    },
  },
  /**
   * 수불 이력 구획 — LOT 상세와 나란한 셋째 구획이다. 같은 LOT에 대한 다른 질문
   * (「언제 얼마나 움직였나」)을 답한다.
   *
   * **기간을 성능 문제로 말하지 않는다.** 계약이 영업일 범위를 필수로 두어 기간 없이는
   * 조회 자체가 불가능하다 — 「기간을 줄이면 빨라집니다」로 적으면 사용자가 비운 채 기다린다.
   *
   * **이 구획에는 선택칸이 없다**(계획 결정 14). 거래 유형·원천 전표 유형은 값 목록이
   * 확정되지 않아 자리표시가 비고, 「조회해야 선택지가 생긴다」는 순환이 된다.
   */
  history: {
    periodFrom: '영업일 시작',
    periodTo: '영업일 종료',
    /** 왜 기간이 필요한지와 기본값을 함께 밝힌다 — 둘 다 없으면 사용자가 빈 칸을 의심한다. */
    periodNote:
      '수불 원장은 영업일로 나뉘어 있어 기간이 있어야 조회할 수 있습니다. LOT을 고르면 최근 1개월이 채워집니다.',
    table: {
      businessDate: '영업일',
      transactionNo: '거래 번호',
      transactionType: '거래 유형',
      sourceDocumentType: '원천 전표',
      status: '상태',
      /** 단말에서 행위가 일어난 시각이다. 서버가 받은 시각과 벌어질 수 있다. */
      occurredAt: '발생 시각',
      /** 고르면 그 거래의 라인이 아래에 열린다. 「상세」가 아니라 무엇이 열리는지 적는다. */
      select: '라인',
    },
    /*
     * 취소가 행을 지우지 않고 **역처리 행을 더한다**(계약). 그 사실만 표식으로 밝히고
     * 대상 거래의 번호는 내지 않는다 — 이름을 풀 참조가 이 화면에 없다.
     */
    reversal: '역처리',
    showLines: '보기',
    hideLines: '닫기',
    /* 접근 이름에 **거래 번호**를 넣는다 — 「보기」가 줄마다 되풀이되면 어느 거래인지 모른다. */
    showLinesRow: (transactionNo: string): string => `${transactionNo} 라인 보기`,
    hideLinesRow: (transactionNo: string): string => `${transactionNo} 라인 닫기`,
    empty: {
      /* 기간을 채우기 전에는 요청이 나가지 않는다 — 그것을 「없습니다」로 말하지 않는다. */
      notQueriedTitle: '아직 조회하지 않았습니다',
      notQueriedDescription: '영업일 범위를 채운 뒤 조회하세요.',
      beyondLastTitle: '이 쪽에는 이력이 없습니다',
      beyondLastDescription: '첫 쪽으로 이동하세요.',
      noResultTitle: '이 기간에 움직인 기록이 없습니다',
      noResultDescription: '영업일 범위를 넓힌 뒤 다시 조회하세요.',
      noSelectionTitle: '고른 거래가 없습니다',
      noSelectionDescription: '위 표에서 거래를 고르면 그 거래의 라인이 여기에 보입니다.',
    },
    lines: {
      title: '거래 라인',
      item: '품목',
      lot: 'LOT',
      qty: '수량',
      uom: '단위',
      fromWarehouse: '출발 창고',
      fromLocation: '출발 위치',
      toWarehouse: '도착 창고',
      toLocation: '도착 위치',
      /*
       * **위치 이름은 조건 줄에서 고른 창고의 것만 풀 수 있다** — 계약이 위치 목록을
       * 창고별로만 내려 준다. 다른 창고의 위치를 「알 수 없음」으로 적으면 *값이 잘못됐다*는
       * 뜻이 되어 정반대로 읽히므로(#47), 풀 수 없는 이유를 그대로 적는다.
       */
      otherWarehouseLocation: '(다른 창고의 위치)',
      scopeNote:
        '위치 이름은 조건 줄에서 고른 창고의 것만 풀립니다. 다른 창고로 오간 라인은 위치 이름 대신 그 사실을 적습니다.',
      emptyTitle: '이 거래에 라인이 없습니다',
      /** 문구가 적은 대상과 「다시 시도」가 다시 부르는 대상이 같아야 한다. */
      referencesFailed:
        '품목·LOT·창고·위치·단위 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    },
  },
  /** 조회 시점 스냅샷임을 밝힌다 — 집계는 언제나 이미 과거다. */
  asOf: (at: string): string => `기준 ${at}`,
} as const;

/**
 * W-01-03 초과 입하 분리. **자재창고 도메인의 첫 쓰기 화면**이다.
 *
 * PR ① 몫만 담는다 — 대상 발주를 고르고, 라인마다 이번 도착 수량을 넣고,
 * 정량분과 초과분이 갈리는 것까지다. 세 모드 등록·결과·실패 문구는 PR ②에서 더한다.
 *
 * **「정량분」과 「초과분」이 이 화면의 두 낱말이다.** 계약의 `normal`·`excess`를 그대로
 * 옮기지 않고 업무 낱말로 말한다 — 사용자가 만드는 것은 두 건의 입하 전표이지
 * 요청 본문의 두 갈래가 아니다.
 *
 * **정량·초과는 화면이 만든 값이다.** 서버가 내려준 값이 아니라는 사실을 안내가 밝힌다 —
 * 지금까지의 조회 화면은 서버 값을 그대로 그렸고, 이 화면이 처음으로 파생값을 그린다.
 *
 * **참조 값(공급사·공장·품목·단위)의 표기가 네 갈래다** — 아직 오지 않음 · 목록에 없음 ·
 * 불러오기 실패 · 정상. 넷을 뭉개면 정상 값이 「알 수 없음」으로 보여 뜻이 반대로 읽힌다.
 */
const overReceiptSplit = {
  title: '초과 입하 분리',
  breadcrumbRoot: '자재창고',
  panes: {
    list: '대상 발주 목록',
    lines: '고른 발주의 라인',
    /** 두 전표에 함께 실리는 머리 입력과 초과분에만 실리는 값이 한 구획에 있다. */
    register: '등록 정보',
    result: '등록 결과',
  },
  fields: {
    supplier: '공급사',
    q: '발주번호 검색',
    /** 계약의 `openOnly`를 업무 낱말로 옮긴다 — 「아직 입하가 끝나지 않은 발주만」이다. */
    openOnly: '미완료 발주만',
    /** 계약 필수. 두 전표에 같은 값이 실리고, 영업일도 이 값의 날짜에서 나온다. */
    receiptDatetime: '입하 일시',
    deliveryNoteNo: '거래명세서번호',
    remarks: '비고',
    /** 예외 유형·초과 사유는 **초과분 전표에만** 실린다(계약 설명). */
    exceptionType: '예외 유형',
    exceptionReason: '초과 사유',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    select: '선택',
    deselect: '선택 해제',
    /*
     * 세 버튼이 계약의 세 갈래와 1:1이다. **기본값이 없어** 버튼을 고르는 것이 곧 갈래를 고르는 것이다 —
     * 「저장」 하나로 합치면 무엇이 저장되는지 누르기 전에 알 수 없다.
     */
    registerBoth: '분리 등록',
    registerNormalOnly: '정량분만 저장',
    registerExcessOnly: '초과분만 저장',
    createPurchaseOrder: '신규 P/O 등록',
    /** 초안 파기 확인 창의 확인 버튼. 「확인」으로 두면 무엇이 확인되는지 창을 다시 읽어야 한다. */
    discardDraft: '입력을 버린다',
    keepEditing: '계속 입력',
    /*
     * 행 안의 버튼은 보이는 글자가 행마다 같다. 접근 이름에 발주번호를 넣어 어느 건인지 밝히되,
     * 보이는 글자를 그대로 담는다 — 담지 않으면 음성 조작이 「선택」으로 이 버튼을 부를 수 없다.
     * **발주번호를 쓴다.** 내부 번호를 접근 이름에 넣으면 화면 밖으로 새어 나간다.
     */
    selectRow: (purchaseOrderNo: string): string => `${purchaseOrderNo} 선택`,
    deselectRow: (purchaseOrderNo: string): string => `${purchaseOrderNo} 선택 해제`,
  },
  /** 실패 사유는 그 대상의 이름으로 시작한다(배치 규범 4). */
  reasons: {
    /*
     * **문구에 적은 대상과 「다시 시도」가 다시 부르는 대상이 같아야 한다.** 다르면 눌러도
     * 한쪽은 실패인 채로 남는데 문구는 둘 다 고쳐질 것처럼 말한다.
     * 공장은 고른 발주의 제목줄에서만 보이므로 아래 구획 안내가 맡는다.
     */
    referencesFailed: '공급사 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    lineReferencesFailed:
      '품목·단위·공장 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
  },
  /**
   * 등록 버튼이 잠긴 사유(배치 규범 4).
   *
   * **버튼 이름으로 시작한다** — 사유가 시각적으로 끊겼을 때 어느 버튼의 것인지 복원할 단서가 된다.
   * 다만 아직 아무 수량도 넣지 않은 상태는 **세 버튼이 함께 잠기므로** 무엇에 대한 안내인지로
   * 시작한다(규범 4의 이탈 조건) — 같은 사정을 세 번 되풀이하면 무엇을 해야 하는지 오히려 흐려진다.
   */
  actionReasons: {
    noQty: '아직 넣은 도착 수량이 없습니다. 라인에 이번 도착 수량을 넣으면 등록할 수 있습니다.',
    bothNeedsExcess:
      '분리 등록은 초과분이 없어 나눌 것이 없습니다. 「정량분만 저장」으로 등록하세요.',
    bothNeedsNormal:
      '분리 등록은 정량분이 없어 나눌 것이 없습니다. 「초과분만 저장」으로 등록하세요.',
    normalOnlyNeedsNormal:
      '정량분만 저장은 받을 정량분이 없습니다. 잔량과 허용치 안쪽으로 도착한 수량이 있으면 이 버튼을 쓸 수 있습니다.',
    excessOnlyNeedsExcess:
      '초과분만 저장은 초과분이 없습니다. 정량 한도를 넘게 도착한 수량이 있으면 이 버튼을 쓸 수 있습니다.',
    /*
     * **여기가 시작하는 자리가 아니다.** 화면은 이제 있지만 이 버튼에서 열지 않는다 —
     * 정산할 초과분 전표가 정해지기 전에 열면 「무엇을 정산하는지 모르는 발주 등록」이 되고,
     * 그것이 곧 일반 구매 발주 등록이다(착수 이슈 §6 ①).
     *
     * 그래서 잠금은 유지하고 **사유만 새 사실로 바꾼다** — 풀리는 조건이 「화면이 준비되면」이
     * 아니라 「초과분 입하를 먼저 등록하면」이고, 그 뒤에 이어지는 자리는 등록 결과 구획이다.
     */
    createPurchaseOrderUnavailable:
      '신규 P/O 등록은 여기서 시작하지 않습니다. 초과분 입하를 먼저 등록하면 등록 결과에서 이어집니다.',
  },
  loading: {
    purchaseOrders: '대상 발주 목록을 불러오는 중',
    lines: '발주 라인을 불러오는 중',
  },
  /** 목록 표의 머리글. 열 구성과 폭의 근거는 screens/over-receipt-split/po-table.tsx에 있다. */
  table: {
    purchaseOrderNo: '발주번호',
    supplier: '공급사',
    orderDate: '발주일',
    expectedReceiptDate: '입고 예정일',
    status: '상태',
    select: '선택',
  },
  /**
   * 라인 표의 머리글과 칸 문구.
   *
   * **수량 넷을 여섯 열이 아니라 네 열에 담는다** — 짝지어 한 칸에 넣으면 열이 줄고,
   * 줄지 않으면 표 하한(`58rem`)을 넘겨 표가 짓눌린다(계획 §5.5).
   */
  lineTable: {
    lineNo: '줄번호',
    item: '품목',
    ordered: '발주 · 기입하',
    remaining: '잔량 · 허용',
    arrivedQty: '이번 도착 수량',
    split: '정량 · 초과',
    /** 「발주 100 · 기입하 40」 */
    orderedPair: (orderedQty: number, receivedQty: number): string =>
      `발주 ${String(orderedQty)} · 기입하 ${String(receivedQty)}`,
    /** 「잔량 60 (+5)」 — 괄호 안이 초과 허용치다. 뜻은 표 아래 안내가 밝힌다. */
    remainingPair: (remainingQty: number, toleranceOverQty: number): string =>
      `잔량 ${String(remainingQty)} (+${String(toleranceOverQty)})`,
    /** 「정량 60 · 초과 5」 — 화면이 만든 값이다. */
    splitPair: (normalQty: number, excessQty: number): string =>
      `정량 ${String(normalQty)} · 초과 ${String(excessQty)}`,
    /*
     * 표 안의 입력칸이라 보이는 라벨을 둘 자리가 없다(배치 규범 3의 이탈 조건).
     * **줄번호를 접근 이름에 넣는다** — 「이번 도착 수량」이 줄마다 되풀이되면 어느 줄인지 알 수 없다.
     * 내부 번호를 쓰지 않는 이유는 그것이 화면 밖으로 새는 또 하나의 경로이기 때문이다.
     */
    arrivedQtyLabel: (lineNo: number): string => `${String(lineNo)}번 줄 이번 도착 수량`,
    /** 입력칸 아래의 단위 표기. 단위 열을 따로 두지 않고 수량을 치는 자리에 붙인다. */
    uomNote: (uom: string): string => `단위 ${uom}`,
  },
  /** 고른 발주의 제목줄. **목록 표에 두지 않은 값(공장)이 여기서 보인다.** */
  summary: {
    label: '고른 발주',
    purchaseOrderNo: '발주번호',
    supplier: '공급사',
    plant: '공장',
    orderDate: '발주일',
    expectedReceiptDate: '입고 예정일',
    status: '상태',
  },
  filters: {
    all: '전체',
    lookupTruncated: '선택지가 앞쪽 일부만 보입니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
    lookupFailed: '선택지를 불러오지 못했습니다.',
    /* 기본이 켬이라는 사실을 밝힌다 — 끄면 이미 입하가 끝난 발주도 함께 나온다. */
    openOnlyNote: '기본은 아직 입하가 끝나지 않은 발주만 봅니다. 끄면 끝난 발주도 함께 나옵니다.',
    chipSupplier: (value: string): string => `공급사: ${value}`,
    chipQ: (value: string): string => `발주번호: ${value}`,
    chipRemoveSupplier: '공급사 조건 제거',
    chipRemoveQ: '발주번호 조건 제거',
  },
  /** 쪽 이동. 번호 목록을 두지 않는 근거는 screens/over-receipt-split/page-nav.tsx에 있다. */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  empty: {
    noResultTitle: '조건에 맞는 발주가 없습니다',
    noResultDescription: '조건을 줄이거나 「미완료 발주만」을 끈 뒤 다시 조회하세요.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
    noSelectionTitle: '발주를 고르면 라인이 보입니다',
    noSelectionDescription: '위 목록에서 초과 도착이 생긴 발주를 골라 「선택」을 누르세요.',
    /*
     * 주소에 고른 발주가 있는데 **목록 조회가 실패한** 자리. 골격(「불러오는 중」)을 내면
     * 기다리라고 말하는데 기다려서 풀리지 않는다 — 빈 상태로 내는 것보다 나쁘다.
     * 라인 값은 받을 수 있어도 **제목줄에 낼 발주의 값이 목록 응답에만 있어** 구획을 열 수 없다.
     */
    listFailedTitle: '대상 발주를 불러오지 못해 이 발주를 열 수 없습니다',
    listFailedDescription: '위의 「다시 시도」로 목록을 불러온 뒤 다시 고르세요.',
    noLinesTitle: '이 발주에는 라인이 없습니다',
    noLinesDescription: '발주에 담긴 품목 줄이 하나도 없어 받을 것을 정할 수 없습니다.',
  },
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
    /** 이름 목록은 왔는데 그 안에 없다 — **값이 잘못됐다**는 신호다. */
    unknown: '알 수 없음',
    /** 이름 목록이 아직 오지 않았다. 「알 수 없음」으로 쓰면 정상 값이 잘못된 값으로 읽힌다. */
    referenceLoading: '이름 불러오는 중',
    /** 이름 목록 조회가 실패했다. 값이 없는 것과 다르다. */
    referenceFailed: '이름을 불러오지 못했습니다',
    /** 수량을 넣지 않았거나 넣은 값이 수량이 아니어서 아직 가를 것이 없다. */
    notSplit: '—',
    inactiveSuffix: ' (미사용)',
  },
  /** 라인 입력의 형식 오류. 계약이 `exclusiveMinimum: 0`이라 0도 보낼 수 없다. */
  errors: {
    qtyNotNumber: '수량은 숫자로 넣으세요.',
    qtyNotPositive: '수량은 0보다 커야 합니다.',
    /*
     * 머리 입력의 오류는 **등록을 누른 뒤에** 세운다 — 치는 도중에 붉은 글씨를 띄우면
     * 아직 다 넣지도 않은 칸이 잘못된 것처럼 보인다(저장소 전례).
     */
    receiptDatetimeRequired: '입하 일시를 넣으세요.',
    deliveryNoteNoTooLong: (max: number): string =>
      `거래명세서번호는 ${String(max)}자를 넘을 수 없습니다.`,
    exceptionReasonRequired: '예외 유형을 골랐으면 초과 사유를 함께 넣으세요.',
    /*
     * 사유가 붙은 줄을 그대로 두고 등록하면 **그 줄만 빠진 전표**가 만들어진다.
     * 되돌릴 수 없는 쓰기라 빠뜨린 줄을 나중에 알아채면 고칠 방법이 없다.
     */
    qtyInvalidBlocked:
      '고치지 않은 도착 수량이 있어 등록하지 않았습니다. 사유가 붙은 줄을 고친 뒤 다시 등록하세요.',
  },
  notes: {
    /*
     * **화면이 만든 값이라는 사실을 밝힌다.** 서버가 내려준 값으로 읽히면 사용자가
     * 「시스템이 이미 그렇게 정했다」고 받아들여 수량을 다시 보지 않는다.
     */
    splitDerived:
      '정량 · 초과는 이 화면이 계산한 값입니다. 잔량에 초과 허용치(+)를 더한 값까지가 정량분이고, 그보다 많이 도착한 몫이 초과분입니다.',
    /* 빈 칸이 오류가 아니라는 사실은 화면에서 읽혀야 한다 — 비워 두면 「빠뜨렸다」로 읽힌다. */
    arrivedQtyOptional: '이번에 받지 않는 줄은 수량을 비워 두세요.',
    /*
     * **영업일은 입하 일시에서 파생한 값이다.** 입력칸을 두지 않으므로 그 사실을 밝히지 않으면
     * 사용자는 영업일이 무엇으로 정해졌는지 화면 어디에서도 읽을 수 없다.
     */
    businessDateDerived:
      '영업일은 입하 일시의 날짜로 함께 보냅니다. 야간에 받은 자재의 영업일이 다르게 잡혀야 한다면 담당자에게 알려 주세요.',
    /* 머리 입력 한 벌이 두 전표에 같이 실린다는 사실. 밝히지 않으면 초과분만 따로 적는 줄 안다. */
    headerSharedByBoth: '입하 일시·거래명세서번호·비고는 만들어지는 전표 모두에 같이 실립니다.',
    /* 반대쪽 — 이 둘은 초과분 전표에만 붙는다. 밝히지 않으면 정량분에도 붙는 줄 안다. */
    excessOnlyFields: '예외 유형과 초과 사유는 초과분 전표에만 실립니다.',
    /*
     * 초과분의 수입검사 대상 여부는 **보낼 자리가 요청에 없다.** 지어내지 않고 사실만 밝힌다.
     */
    excessInspection:
      '초과분의 수입검사 대상 여부는 이 화면에서 함께 보내지 않습니다. 확인이 필요하면 담당자에게 알려 주세요.',
    /*
     * 응답을 받지 못한 실패에만 붙인다. 맹목적으로 다시 누르면 같은 도착이 전표 두 벌로 남는다 —
     * 되돌리려면 승인을 거쳐야 해서 화면이 되돌릴 수 없다.
     */
    registerRecheck:
      '등록됐는지 확인한 뒤 다시 시도하세요. 확인하지 않고 다시 보내면 같은 입하가 두 번 등록될 수 있습니다.',
  },
  /**
   * 등록 결과.
   *
   * **전표 번호는 사용자 대면 업무 번호라 낸다.** 내부 번호는 어느 갈래에도 내지 않는다.
   * 사라지는 알림(토스트)으로 내지 않는 이유도 그것이다 — 나중에 조회할 때 쓸 번호를
   * 몇 초 뒤에 없애면 적어 둘 틈이 없다.
   */
  result: {
    count: (count: number): string => `전표 ${String(count)}건을 만들었습니다.`,
    receiptNo: '전표번호',
    status: '상태',
    /* 응답이 어느 건이 정량분인지 알려 주지 않는다. 순서로 추측해 라벨을 붙이지 않는다. */
    unlabeled: '정량분과 초과분 중 어느 전표인지는 표시하지 않습니다.',
    /*
     * 다음 화면(W-01-11)으로 가는 길. **만들어진 전표마다 선다** — 두 건일 때 하나로 합치면
     * 어느 전표를 정산하는지 화면이 지어내야 하는데, 응답은 그것을 알려 주지 않는다.
     *
     * **전표번호를 보이는 글자에 담는다.** 링크가 둘 나란히 서므로 글자가 같으면 어느 전표의
     * 것인지 가릴 수 없고, 숨은 이름(`aria-label`)으로만 가르면 눈으로 보는 사람이 구분하지
     * 못한다 — 보이는 글자와 접근 이름을 같게 두는 편이 둘 다 만족한다.
     * **내부 번호를 쓰지 않는다** — 그것이 번호가 화면 밖으로 새는 또 하나의 경로다.
     */
    registerPo: (inboundReceiptNo: string): string => `${inboundReceiptNo} 입하로 P/O 등록`,
  },
  dialog: {
    /* 초안 파기 확인. 본문은 공통 문구(`common.discardChangesConfirm`)를 쓴다. */
    discardTitle: '입력한 도착 수량을 버립니다',
  },
} as const;

/**
 * W-01-10(정상품 입하 처리).
 *
 * **낱말을 가려 쓴다.** 「입하」는 자재가 도착한 사실이고 「입고」는 창고 재고로 받아들이는 것이다.
 * 이 화면이 고르는 대상은 **입하 전표**이고 만드는 것은 **입고 전표**다 — 둘을 뭉개면
 * 무엇을 고르고 무엇을 만드는지 화면에서 읽을 수 없다.
 *
 * **「전송 완료」라는 낱말을 쓰지 않는다.** 계약이 내려주는 `erpMessageQueued`는 「송신 대기열에
 * 적재됐다」이지 「상대 시스템으로 보냈다」가 아니다 — 뭉개면 승인자가 반영된 줄로 오해한다.
 */
const goodsReceipt = {
  title: '정상품 입하 처리',
  breadcrumbRoot: '자재창고',
  panes: {
    list: '대상 입하 전표 목록',
    lines: '고른 전표의 라인',
    post: '입고 처리 입력',
  },
  fields: {
    supplier: '공급사',
    /** 계약의 `receiptDateFrom`·`receiptDateTo`. **기본 기간을 심지 않는다**(W-01-09가 세운 규칙). */
    receiptDateFrom: '입하일 시작',
    receiptDateTo: '입하일 종료',
    /** 값 목록이 확정되지 않아 선택지가 비어 있다 — 안내는 `pendingCode`가 맡는다. */
    status: '상태',
    q: '입하번호·거래명세서번호 검색',
    /* 아래는 확정 입력. **사용자가 고르는 것은 이 여덟뿐이다** — 수량·품목·단위·자재 LOT은
     * 고른 입하 라인의 값을 그대로 싣는다(전량 입고라 수량 입력칸이 없다). */
    warehouse: '입고 창고',
    location: '적치 위치',
    receiptType: '입고 유형',
    sourceDocumentType: '원천 문서 유형',
    qualityStatus: '품질 상태',
    inventoryStatus: '재고 상태',
    reason: '사유',
    receiptDatetime: '입고 일시',
    remarks: '비고',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    select: '선택',
    deselect: '선택 해제',
    /*
     * 행 안의 버튼은 보이는 글자가 행마다 같다. 접근 이름에 입하번호를 넣어 어느 건인지 밝히되,
     * 보이는 글자를 그대로 담는다 — 담지 않으면 음성 조작이 「선택」으로 이 버튼을 부를 수 없다.
     * **내부 번호를 접근 이름에 넣지 않는다** — 그것이 화면 밖으로 새는 또 하나의 경로다.
     */
    selectRow: (inboundReceiptNo: string): string => `${inboundReceiptNo} 선택`,
    deselectRow: (inboundReceiptNo: string): string => `${inboundReceiptNo} 선택 해제`,
    /** 라인에는 사용자 대면 번호가 줄번호뿐이다 — 입하 라인 번호는 내부 번호라 쓰지 않는다. */
    selectLine: (lineNo: number): string => `${String(lineNo)}번 줄 선택`,
    deselectLine: (lineNo: number): string => `${String(lineNo)}번 줄 선택 해제`,
    /** 이 화면의 유일한 쓰기. 누르면 곧바로 나가지 않고 확인 창이 먼저 뜬다. */
    post: '입고 처리',
    confirmPost: '입고 처리 실행',
    keepEditing: '계속 입력',
    discardDraft: '입력 버리기',
    viewSourceDocument: '원천 문서 보기',
  },
  /**
   * 비활성 사유. **버튼 이름으로 시작한다**(배치 규범 4) — 사유가 시각적으로 끊겼을 때
   * 무엇에 대한 안내인지 복원할 단서가 그것뿐이다.
   */
  actionReasons: {
    /*
     * 코드 목록이 확정되지 않아 **입고 처리 자체가 열리지 않는** 상태.
     *
     * 계약이 입고 유형·원천 문서 유형·품질 상태·재고 상태를 **전부 필수**로 요구하는데 값 집합이
     * 아직 없다. 화면이 그럴듯한 값을 지어내면 사용자는 고를 수 있다고 믿는데 서버는 그 값을
     * 모르고, 되돌릴 수 없는 전표에 그 코드가 실린다 — 그래서 고르지 못하게 두고 사유를 밝힌다.
     */
    postCodeListPending:
      '입고 처리: 입고 유형·원천 문서 유형·품질 상태·재고 상태의 코드 목록이 아직 확정되지 않아 지금은 입고 처리를 할 수 없습니다. 코드 목록이 준비되면 이 화면에서 고를 수 있습니다.',
    postNeedsWarehouse: '입고 처리: 입고 창고를 고르세요.',
    postNeedsLocation: '입고 처리: 적치 위치를 고르세요.',
    postNeedsCodes: '입고 처리: 필수 코드를 모두 고르세요.',
    postNeedsReceiptDatetime: '입고 처리: 입고 일시를 넣으세요.',
    /** 위치 선택칸이 잠기는 이유. 계약이 창고를 고른 뒤에만 위치를 조회하게 한다. */
    locationNeedsWarehouse: '적치 위치: 입고 창고를 먼저 고르면 그 창고의 위치를 고를 수 있습니다.',
    /*
     * 원천 문서로 넘어갈 수 없는 이유. 유형 코드와 대상의 대응 규약이 아직 없어 무엇을 가리키는지
     * 화면이 알 수 없다 — 짐작해서 열면 다른 문서를 연다.
     */
    sourceDocumentUnavailable:
      '원천 문서 보기: 원천 문서 유형과 대상의 대응 규약이 아직 정해지지 않아 문서를 열 수 없습니다. 유형 코드와 입하번호만 보입니다.',
  },
  /** 입력칸 옆에 붙는 오류. 서버가 준 필드 오류도 같은 자리에 낸다. */
  errors: {
    /** 계약의 코드 길이 상한. 고른 값이 상한을 넘으면 보내지 않는다. */
    codeTooLong: (max: number): string => `코드는 ${String(max)}자를 넘을 수 없습니다.`,
  },
  /** 실패·비활성 사유는 그 대상으로 시작한다(배치 규범 4). */
  reasons: {
    /*
     * **문구에 적은 대상과 「다시 시도」가 다시 부르는 대상이 같아야 한다.** 다르면 눌러도
     * 한쪽은 실패인 채로 남는데 문구는 둘 다 고쳐질 것처럼 말한다.
     */
    referencesFailed: '공급사 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    lineReferencesFailed:
      '품목·단위·자재 LOT·공장 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    /*
     * **잘림은 실패와 다르다.** 이름 목록이 앞쪽만 오면 그 뒤의 정상 값이 「알 수 없음」으로 찍히는데,
     * 그 문구는 *값이 잘못됐다*는 뜻이라 사용자가 반대로 읽는다. 특히 **자재 LOT은 다섯 참조 중
     * 유일한 거래 기록**이라 시간이 갈수록 쌓여 가장 잘리기 쉽다.
     * 다시 시도로 풀리지 않으므로 복구 버튼을 붙이지 않고 사실만 밝힌다.
     */
    lineReferencesTruncated:
      '품목·단위·자재 LOT·공장 이름 목록이 일부만 왔습니다. 이름 자리의 「알 수 없음」은 값이 잘못된 것이 아니라 이 목록에 아직 없다는 뜻일 수 있습니다.',
    /*
     * 고를 수 없는 줄의 사유. **값 자체를 설명한다** — 상태 코드로 판정하지 않는다(공유계약 G-2).
     * 여러 줄이 함께 쓰는 문구라 컨트롤 이름이 아니라 무엇에 대한 안내인지로 시작한다(규범 4의 이탈 조건).
     */
    /** 입고 창고·적치 위치 선택지를 못 받았다. 이 둘이 없으면 어디에 넣을지 정할 수 없다. */
    postOptionsFailed: '입고 창고·적치 위치 선택지를 불러오지 못했습니다.',
    lineNoLot:
      '이 줄은 자재 LOT이 아직 없어 입고할 수 없습니다. 자재 LOT이 만들어지면 이 줄을 고를 수 있습니다.',
    lineQtyNotPositive:
      '이 줄은 입하 수량이 0 이하라 입고할 수 없습니다. 입하 수량이 0보다 크면 이 줄을 고를 수 있습니다.',
  },
  loading: {
    inboundReceipts: '대상 입하 전표 목록을 불러오는 중',
    lines: '입하 라인을 불러오는 중',
  },
  /** 목록 표의 머리글. 열 구성과 폭의 근거는 screens/goods-receipt/ir-table.tsx에 있다. */
  table: {
    inboundReceiptNo: '입하번호',
    supplier: '공급사',
    receiptDatetime: '입하일시',
    deliveryNoteNo: '거래명세서번호',
    status: '상태',
    select: '선택',
  },
  /** 라인 표의 머리글과 칸 문구. 폭의 근거는 screens/goods-receipt/ir-line-table.tsx에 있다. */
  lineTable: {
    lineNo: '줄번호',
    item: '품목',
    receivedQty: '입하 수량',
    lot: '자재 LOT',
    expiryDate: '유효기한',
    select: '선택',
    /** 「100 SAMPLE-EA」 — 단위 열을 따로 두지 않고 수량 표기에 붙인다(W-01-03이 세운 처리). */
    receivedQtyPair: (receivedQty: number, uom: string): string => `${String(receivedQty)} ${uom}`,
  },
  /** 고른 입하 전표의 제목줄. **목록 표에 두지 않은 값(공장)이 여기서 보인다.** */
  summary: {
    label: '고른 입하 전표',
    inboundReceiptNo: '입하번호',
    supplier: '공급사',
    plant: '공장',
    receiptDatetime: '입하일시',
    deliveryNoteNo: '거래명세서번호',
    status: '상태',
  },
  /**
   * 고른 입하 라인의 제목줄.
   *
   * **검사 대상·상태를 열로 두지 않고 여기서 보인다** — 열을 늘리는 것보다 줄이는 것이 먼저다.
   * 고른 한 줄에서만 필요한 값이라 표 전체에 열을 낼 이유가 없다(계획 §5.5).
   */
  lineSummary: {
    label: '고른 입하 라인',
    lineNo: '줄번호',
    item: '품목',
    receivedQty: '입하 수량',
    lot: '자재 LOT',
    expiryDate: '유효기한',
    inspectionRequired: '수입검사 대상',
    status: '상태',
    inspectionYes: '대상',
    inspectionNo: '대상 아님',
  },
  filters: {
    all: '전체',
    lookupTruncated: '선택지가 앞쪽 일부만 보입니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
    lookupFailed: '선택지를 불러오지 못했습니다.',
    /**
     * **「없다」와 구분한다.** 목록이 오는 동안 선택칸은 선택지 0건으로 그려지는데, 그 모습은
     * 「이 창고에는 위치가 없다」와 글자가 같다 — 이 화면이 참조 표기에서 지키는 구분
     * (미도착을 「알 수 없음」으로 내지 않는다)을 선택지 목록에서도 지킨다.
     */
    lookupLoading: '선택지를 불러오는 중입니다.',
    /* 기본 기간을 심지 않는다는 사실은 화면에서 읽혀야 한다 — 비어 있는 것이 고장으로 읽히지 않게 한다. */
    periodNote: '입하일을 비워 두면 기간을 좁히지 않고 전체를 봅니다.',
    chipSupplier: (value: string): string => `공급사: ${value}`,
    /** 한쪽만 넣은 기간도 조건이다 — 그 사실이 칩에서 읽혀야 한다. */
    chipPeriodBoth: (from: string, to: string): string => `입하일: ${from} ~ ${to}`,
    chipPeriodFrom: (from: string): string => `입하일: ${from}부터`,
    chipPeriodTo: (to: string): string => `입하일: ${to}까지`,
    chipStatus: (value: string): string => `상태: ${value}`,
    chipQ: (value: string): string => `검색어: ${value}`,
    chipRemoveSupplier: '공급사 조건 제거',
    chipRemovePeriod: '입하일 조건 제거',
    chipRemoveStatus: '상태 조건 제거',
    chipRemoveQ: '검색어 조건 제거',
  },
  /** 쪽 이동. 번호 목록을 두지 않는 근거는 screens/goods-receipt/page-nav.tsx에 있다. */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  /** 빈 상태는 **네 갈래**다. 사용자가 할 조치가 서로 다르다(완료 조건 C07). */
  empty: {
    noResultTitle: '조건에 맞는 입하 전표가 없습니다',
    noResultDescription: '조건을 줄이거나 입하일 범위를 넓힌 뒤 다시 조회하세요.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
    noSelectionTitle: '입하 전표를 고르면 라인이 보입니다',
    noSelectionDescription: '위 목록에서 창고로 받아들일 입하 전표를 골라 「선택」을 누르세요.',
    noLinesTitle: '이 입하 전표에는 라인이 없습니다',
    noLinesDescription: '전표에 담긴 품목 줄이 하나도 없어 입고할 것을 정할 수 없습니다.',
    /*
     * 주소에 고른 전표가 있는데 **목록 조회가 실패한** 자리. 골격(「불러오는 중」)을 내면
     * 기다리라고 말하는데 기다려서 풀리지 않는다. 라인 값을 받아도 구획을 열 수 없다 —
     * **제목줄이 쓰는 전표의 값이 목록 응답에만 있다**(W-01-03이 세운 형태).
     */
    listFailedTitle: '대상 입하 전표를 불러오지 못해 이 전표를 열 수 없습니다',
    listFailedDescription: '위의 「다시 시도」로 목록을 불러온 뒤 다시 고르세요.',
  },
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
    /** 이름 목록은 왔는데 그 안에 없다 — **값이 잘못됐다**는 신호다. */
    unknown: '알 수 없음',
    /** 이름 목록이 아직 오지 않았다. 「알 수 없음」으로 쓰면 정상 값이 잘못된 값으로 읽힌다. */
    referenceLoading: '이름 불러오는 중',
    /** 이름 목록 조회가 실패했다. 값이 없는 것과 다르다. */
    referenceFailed: '이름을 불러오지 못했습니다',
    inactiveSuffix: ' (미사용)',
    /** 아직 고르지 않은 선택칸의 트리거 문구. 값 목록이 준비되지 않은 칸은 `pendingCode`가 맡는다. */
    selectPlaceholder: '고르세요',
  },
  notes: {
    /*
     * 한 줄만 고를 수 있다는 사실. 밝히지 않으면 둘째 줄을 골랐을 때 앞 선택이 풀리는 것이
     * 고장으로 읽힌다(계약이 라인마다 위치를 받으므로 나중에 여러 줄로 늘 수 있다 — 이슈 §4).
     */
    singleLineSelect: '한 번에 한 줄만 고를 수 있습니다. 다른 줄을 고르면 앞 선택이 풀립니다.',
    /** 입력칸이 없는 값이 무엇에서 정해지는지 밝힌다 — 밝히지 않으면 화면 어디에서도 읽을 수 없다. */
    businessDateDerived: '영업일은 입고 일시의 날짜로 정합니다. 따로 넣는 칸을 두지 않습니다.',
    qtyFromInboundLine:
      '입고 수량·품목·단위·자재 LOT은 고른 입하 라인의 값을 그대로 싣습니다. 나눠 받는 입력은 두지 않습니다.',
    plantFromInboundReceipt: '공장은 고른 입하 전표의 값을 싣습니다.',
    /** 고른 창고의 공장을 함께 보인다 — 전표의 공장과 다르면 눈으로 보인다. 막지는 않는다. */
    warehousePlant: (plant: string): string => `고른 창고의 공장: ${plant}`,
    warehousePlantDiffers:
      '고른 창고의 공장이 입하 전표의 공장과 다릅니다. 입고 전표에는 입하 전표의 공장을 싣습니다.',
    /*
     * **응답을 받지 못한 실패에만 붙인다.** 공통 문구는 「다시 시도하세요」로 끝나는데,
     * 확인 없이 다시 보내면 같은 입하가 입고 전표 두 벌이 될 수 있다.
     */
    postRecheck:
      '입고 전표가 이미 만들어졌는지 확인한 뒤 다시 시도하세요. 확인 없이 다시 보내면 같은 입하가 두 번 입고될 수 있습니다.',
  },
  /**
   * 확인 창.
   *
   * **되돌릴 수 없는 쓰기 앞에 한 겹을 더 둔다.** 확정 한 번에 다섯 가지가 함께 움직이는데
   * 이 화면에는 되돌리는 수단이 없다 — 무엇을 보내는지 한 번 더 보이는 값이 그만큼 크다.
   */
  dialog: {
    submitTitle: '이 내용으로 입고 처리할까요?',
    submitLead: '아래 값으로 입고 전표를 만듭니다. 보내기 전에 한 번 더 확인하세요.',
    /** 이슈 §6 — 한 번의 확정으로 함께 움직이는 것을 문장으로 밝힌다. */
    submitEffects:
      '입고 처리 한 번에 입고 전표 생성·전기, 자재 LOT 상태 전이, 수불 원장 기록, 재고 잔액 반영, ERP 송신 대기열 적재가 함께 일어납니다. 이 화면에서는 되돌릴 수 없습니다.',
    discardTitle: '입력한 값을 버릴까요?',
  },
  /**
   * 입고 처리 결과.
   *
   * **확인한 것과 확인하지 않은 것을 가려 밝힌다.** 한 트랜잭션으로 다섯 가지가 움직이는데
   * 화면이 증거를 갖는 것은 그중 일부뿐이다 — 나머지를 말하지 않으면 사용자가 「다 됐다」로 읽는다.
   */
  result: {
    label: '입고 처리 결과',
    receiptNo: '입고번호',
    status: '상태',
    sourceDocument: '원천 문서',
    /** 유형 코드와 **입하번호**를 낸다 — 원천 식별자는 내부 번호라 내지 않는다. */
    sourceDocumentPair: (typeCode: string, inboundReceiptNo: string): string =>
      `${typeCode} · ${inboundReceiptNo}`,
    lotStatus: '자재 LOT 상태',
    lotStatusLoading: '자재 LOT 상태를 다시 불러오는 중',
    lotStatusFailed: '자재 LOT 상태를 다시 불러오지 못했습니다.',
    /* 응답에 LOT 상태가 없어 다시 조회한 값이다. 값 자체로 분기하지 않고 그대로 보인다. */
    lotStatusNote:
      '입고 처리 뒤 자재 LOT을 다시 조회해 받은 값입니다. 화면은 이 값을 해석하지 않고 그대로 보입니다.',
    /* 원장·ERP는 라벨 없이 문장으로 낸다 — 라벨 키를 미리 세우지 않는다(쓰이지 않는 문구가
     * 먼저 서 있으면 어느 것이 화면에 실제로 나오는지 읽을 수 없다). 라벨이 붙는 형태로
     * 바꾸게 되면 그때 함께 세운다. */
    ledgerAll: '입고 라인마다 수불 원장 라인이 함께 만들어졌습니다.',
    ledgerSome: '일부 입고 라인에만 수불 원장 라인이 있습니다.',
    ledgerNone: '응답에 수불 원장 라인이 담기지 않았습니다.',
    /** 확인하지 않은 것을 밝힌다 — 이 화면은 재고 잔액을 조회하지 않는다. */
    balanceNote: '재고 잔액은 이 화면이 확인하지 않습니다. 잔액은 재고 현황 화면에서 확인하세요.',
    /*
     * **세 갈래다.** 참·거짓뿐 아니라 **응답에 값이 오지 않은 경우**를 따로 가른다 —
     * 없음을 참으로 읽으면 이 화면에서 가장 나쁜 오해가 생긴다.
     * 어느 갈래에도 「전송 완료」를 쓰지 않는다(이슈 §6).
     */
    erpQueued:
      'ERP 송신 대기열에 적재됐습니다. 아직 상대 시스템에 반영된 것은 아니라 지금 조회하면 없을 수 있습니다.',
    erpNotQueued:
      'ERP 송신 대기열에 적재되지 않았습니다. 상대 시스템 반영 여부는 연계 동기화 현황 화면에서 확인하세요.',
    erpUnknown: 'ERP 송신 대기열 적재 여부를 알 수 없습니다. 응답에 그 값이 오지 않았습니다.',
  },
} as const;

/**
 * W-01-04(재고실사).
 *
 * **낱말을 가려 쓴다.** 「장부 수량」은 시스템이 아는 수량이고 「실물 수량」은 현장에서 센 수량이며
 * 「차이」는 그 둘의 차다 — **차이는 서버가 계산한다.** 화면이 세거나 빼지 않는다.
 *
 * **「마감됨」·「진행 중」 같은 상태말을 화면 문구로 만들지 않는다.** 상태 코드의 값 집합이
 * 확정되지 않아(공유계약 G-2) 화면이 값을 해석하면 값이 정해질 때 조용히 틀린다 —
 * 서버가 준 코드를 그대로 낸다.
 *
 * **「미실사」는 요약이 준 건수를 부를 때만 쓴다.** 줄 하나를 두고 미실사인지 판정하는 문구를
 * 만들지 않는다 — 화면은 그것을 판정할 수 없다(착수 이슈 §4).
 */
const stocktaking = {
  title: '재고실사',
  breadcrumbRoot: '자재창고',
  panes: {
    list: '실사 목록',
    open: '실사 개시',
    detail: '고른 실사',
  },
  fields: {
    warehouse: '창고',
    /** 계약의 `plannedDateFrom`·`plannedDateTo`. **기본 기간을 심지 않는다**(W-01-09가 세운 규칙). */
    plannedDateFrom: '계획일 시작',
    plannedDateTo: '계획일 종료',
    /** 값 목록이 확정되지 않아 선택지가 비어 있다 — 안내는 `pendingCode`가 맡는다. */
    countType: '실사 유형',
    status: '상태',
    inProgressOnly: '진행 중만',
    /*
     * 아래는 **개시 입력**. 사용자가 정하는 것은 이 넷뿐이다 — 라인은 서버가 장부에서 만들고
     * 실사번호·상태는 서버가 붙인다. 조회 조건의 「창고」·「실사 유형」과 이름이 같지만
     * 자리가 달라 뜻이 갈리지 않는다(한쪽은 좁히는 조건, 한쪽은 만들 값이다).
     */
    plannedDate: '계획일',
    blindCount: '블라인드 실사',
    /*
     * **결과 등록의 축**. 치환은 위치 단위라(계약) 이 칸을 고르기 전에는 라인이 보이지 않는다 —
     * 조회 조건이 아니라 **무엇을 저장할지 정하는 칸**이라 조건 줄이 아니라 아래 구획에 선다.
     */
    location: '위치',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    select: '선택',
    deselect: '선택 해제',
    /*
     * 행 안의 버튼은 보이는 글자가 행마다 같다. 접근 이름에 실사번호를 넣어 어느 건인지 밝히되,
     * 보이는 글자를 그대로 담는다 — 담지 않으면 음성 조작이 「선택」으로 이 버튼을 부를 수 없다.
     * **내부 번호를 접근 이름에 넣지 않는다** — 그것이 화면 밖으로 새는 또 하나의 경로다.
     */
    selectRow: (inventoryCountNo: string): string => `${inventoryCountNo} 선택`,
    deselectRow: (inventoryCountNo: string): string => `${inventoryCountNo} 선택 해제`,
    /** 목록과 고른 실사를 **함께** 다시 부른다 — 한쪽만 부르면 낡은 값과 새 값이 섞인다. */
    refresh: '다시 조회',
    /** 이 화면의 첫째 쓰기. 누르면 곧바로 나가지 않고 **확인 창이 먼저** 뜬다. */
    open: '실사 개시',
    confirmOpen: '실사 개시 실행',
    keepEditing: '계속 입력',
    discardDraft: '입력 버리기',
    /*
     * 이 화면의 **둘째 쓰기**. 「저장」이 아니라 「이 위치 실사 완료」인 것이 치환의 뜻이다 —
     * 보내는 것은 친 줄이 아니라 **그 위치의 전 줄**이고, 여기 없는 줄은 미실사로 되돌아간다.
     * 「저장」이라 적으면 사용자가 친 것만 반영되는 줄 안다.
     */
    saveLocation: '이 위치 실사 완료',
    /*
     * 이 화면의 **셋째 쓰기이자 마지막 단계**. 「완료」가 아니라 「마감」인 것이 그 뜻이다 —
     * 되돌릴 수 없고, 다시 여는 오퍼레이션이 계약에 없다. 누르면 곧바로 나가지 않고
     * 확인 창이 먼저 뜬다.
     */
    close: '마감',
    confirmClose: '실사 마감 실행',
    /**
     * 마감 확인 창을 닫는 버튼.
     *
     * **개시 창의 「계속 입력」을 재사용하지 않는다.** 마감 창에는 고칠 입력이 하나도 없어
     * (보내는 값은 영업일 하나이고 화면이 파생한다) 「계속 입력」은 없는 입력칸을 가리킨다.
     */
    keepCounting: '마감하지 않음',
    /**
     * **이제 실제로 이동한다**(W-01-12 개방 · D-18). 자리표시 시절에는 비활성 버튼과
     * 「아직 나가지 않았다」 사유였는데, 갈 곳이 생겨 **링크**가 됐다.
     *
     * **버튼이 아니라 링크의 이름이다** — 주소를 갖는 이동이라 새 탭·주소 복사가 그대로 되고
     * 히스토리가 한 칸만 늘어 뒤로가기 한 번으로 이 결과에 돌아온다.
     */
    adjustment: '조정 등록',
  },
  /**
   * 비활성 사유. **버튼 이름으로 시작한다**(배치 규범 4) — 사유가 시각적으로 끊겼을 때
   * 무엇에 대한 안내인지 복원할 단서가 그것뿐이다.
   */
  actionReasons: {
    /*
     * 코드 목록이 확정되지 않아 **개시 자체가 열리지 않는** 상태.
     *
     * 계약이 실사 유형을 필수로 요구하는데 값 집합이 아직 없다. 화면이 그럴듯한 값을 지어내면
     * 사용자는 고를 수 있다고 믿는데 서버는 그 값을 모르고, **되돌릴 수 없는 전표**에 그 코드가
     * 실린다 — 그래서 고르지 못하게 두고 사유를 밝힌다.
     */
    openCodeListPending:
      '실사 개시: 실사 유형의 코드 목록이 아직 확정되지 않아 지금은 실사를 개시할 수 없습니다. 코드 목록이 준비되면 이 화면에서 고를 수 있습니다.',
    openNeedsCountType: '실사 개시: 실사 유형을 고르세요.',
    openNeedsWarehouse: '실사 개시: 창고를 고르세요.',
    openNeedsPlannedDate: '실사 개시: 계획일을 넣으세요.',
    /*
     * 아래는 **결과 등록**이 막히는 사유. 차례가 뜻을 정한다 —
     * 못 받았다(잘림) → 보낼 것이 없다 → 아직 안 쳤다 → 잘못 쳤다 → 고를 값이 없다 → 안 골랐다.
     * 앞선 사유가 참인 동안 뒤의 사유를 내면 사용자가 할 수 없는 조치를 가리킨다.
     */
    saveTruncated:
      '이 위치 실사 완료: 이 위치의 라인을 전부 받지 못해 저장할 수 없습니다. 받지 못한 줄이 미실사로 되돌아가므로 저장을 막습니다.',
    saveNoLines: '이 위치 실사 완료: 이 위치에 저장할 라인이 없습니다.',
    /** 「이 위치 실사 완료」의 뜻이 전 줄이라는 사실이 이 사유에서 읽혀야 한다. */
    saveIncompleteQty: (remaining: number): string =>
      `이 위치 실사 완료: 실물 수량을 넣지 않은 줄이 ${String(remaining)}줄 남았습니다. 이 위치의 전 줄을 채워야 저장할 수 있습니다.`,
    saveInvalidQty: (invalid: number): string =>
      `이 위치 실사 완료: 실물 수량을 다시 넣어야 하는 줄이 ${String(invalid)}줄 있습니다.`,
    /*
     * 차이 사유의 코드 목록이 확정되지 않아 **차이가 있는 위치만** 저장이 막힌다(승인 G1).
     * 차이가 없는 위치는 그대로 저장된다 — 그 갈림이 필수도로 갈라 적용한다는 결정의 요점이다.
     */
    saveReasonListPending:
      '이 위치 실사 완료: 차이가 있는 줄이 있는데 차이 사유의 코드 목록이 아직 확정되지 않아 저장할 수 없습니다. 차이가 없는 위치는 지금도 저장할 수 있습니다.',
    saveNeedsReason: (remaining: number): string =>
      `이 위치 실사 완료: 실물 수량이 장부와 달라 차이 사유가 필요한 줄이 ${String(remaining)}줄 있습니다.`,
    saveInvalidReason: '이 위치 실사 완료: 차이 사유를 다시 골라야 하는 줄이 있습니다.',
    /*
     * 아래는 **마감**이 막히는 사유. 차례가 뜻을 정한다 —
     * 이미 마감했다 → 요약을 못 읽었다 → 미실사가 남았다 → 차이가 남았다.
     *
     * **「이미 마감했다」가 가장 앞이다.** 그 상태에서는 미실사·차이를 아무리 정리해도 열리지
     * 않으므로, 건수를 먼저 내면 사용자가 **할 수 없는 조치**를 가리킨다.
     */
    closeAlreadyClosed:
      '마감: 이미 마감했습니다. 마감한 실사를 다시 여는 오퍼레이션이 계약에 없습니다.',
    /*
     * 요약 4칸이 마감 판정의 **유일한 근거**인데 그 값을 읽지 못했다(계약은 필수라 하지만
     * 응답에서 빠질 수 있다 — 라인의 `systemQty`에서 이미 겪은 어긋남이다). 판정할 수 없을
     * 때는 **막는 쪽에 선다** — 열어 두면 되돌릴 수 없는 마감이 근거 없이 나간다.
     */
    closeSummaryUnavailable:
      '마감: 실사 진행 요약을 읽지 못해 마감 조건을 판정할 수 없습니다. 다시 조회한 뒤에 시도하세요.',
    /** 요약이 준 건수를 그대로 인용한다 — 화면이 세지 않는다(착수 이슈 §6 ⭐). */
    closeUncounted: (remaining: number): string =>
      `마감: 미실사 ${String(remaining)}건이 남아 있어 마감할 수 없습니다.`,
    /*
     * 착수 이슈 §4가 「차이가 남으면 마감을 막는다. **우회 경로를 두지 않는다**」로 정했다 —
     * 그래서 이 사유에는 「그래도 마감」 같은 다른 길이 붙지 않는다.
     */
    closeVariance: (remaining: number): string =>
      `마감: 차이 ${String(remaining)}건이 남아 있어 마감할 수 없습니다. 차이를 조정한 뒤에 마감할 수 있습니다.`,
    /** 이력은 표시 규약이 정해지지 않아 자리만 둔다(착수 이슈 §4 · `omf-mes#68`). */
    historyPending:
      '실물 수량 수정 이력: 이력의 표시 규약이 아직 정해지지 않아 지금은 볼 수 없습니다. 규약이 정해지면 이 자리에서 볼 수 있습니다.',
  },
  /** 입력칸 옆에 붙는 오류. 서버가 준 필드 오류도 같은 자리에 낸다. */
  errors: {
    /** 계약의 코드 길이 상한. 고른 값이 상한을 넘으면 보내지 않는다. */
    codeTooLong: (max: number): string => `코드는 ${String(max)}자를 넘을 수 없습니다.`,
    /** 자릿수만 맞고 달력에 없는 날(2월 31일 등)도 여기서 걸린다. */
    plannedDateInvalid: '계획일을 실제로 있는 날짜로 넣으세요. 예: 2026-08-06',
    /** 표 안 실물 수량 칸. **0은 오류가 아니다** — 계약이 `minimum: 0`이라 0은 정상 값이다. */
    qtyNotNumber: '실물 수량을 숫자로 넣으세요.',
    qtyNegative: '실물 수량은 0보다 작을 수 없습니다.',
  },
  /** 화면이 밝히지 않으면 어디에서도 읽을 수 없는 사실들. */
  notes: {
    /**
     * 개시 구획이 목록 아래에 따로 서는 이유를 겸한다 — 여기서 만드는 것은 **새 실사**이지
     * 위 목록에서 고른 실사를 고치는 것이 아니다.
     */
    openLead: '창고 하나를 대상으로 새 실사를 개시합니다. 실사 라인은 서버가 장부에서 만듭니다.',
    /*
     * **블라인드는 개시할 때만 정할 수 있다**(계획 결정 4). 실사 헤더를 고치는 수단이 이
     * 화면에 없으므로 그 사실을 고르는 자리에서 미리 밝힌다.
     */
    blindOnlyAtOpen:
      '블라인드 실사에서는 장부 수량이 보이지 않습니다. 개시한 뒤에는 바꿀 수 없으니 지금 정하세요.',
    /*
     * **응답을 받지 못한 실패에만 붙인다.** 공통 문구는 「다시 시도하세요」로 끝나는데,
     * 확인 없이 다시 보내면 같은 창고에 실사 전표가 두 벌 생길 수 있다.
     */
    openRecheck:
      '실사가 이미 개시됐는지 목록에서 확인한 뒤 다시 시도하세요. 확인 없이 다시 보내면 같은 창고에 실사 전표가 두 벌 생길 수 있습니다.',
    /*
     * **치환의 뜻을 표 위에서 늘 밝힌다**(계획 결정 15). 저장 확인 창을 두지 않는 대신
     * 이 안내가 항상 보인다 — 파괴 경로(부분 저장)는 전 줄 필수와 잘림 차단이 구조로 막으므로
     * 창이 지킬 것이 없고, 위치마다 되풀이되는 조작에 마찰만 더한다.
     */
    replaceSemantics:
      '이 위치의 전 줄을 통째로 바꿉니다. 표에 없는 줄은 미실사로 되돌아가므로 위치를 좁혀 보는 조건을 두지 않습니다.',
    /*
     * **빈 칸으로 시작하는 이유를 밝힌다**(승인 13-4). 밝히지 않으면 이미 센 위치를 다시 열었을 때
     * 「값이 사라졌다」로 읽는다 — 미실사 줄도 계약상 0으로 내려와 미리 채우면 세지 않은 줄이
     * 「0개를 셌다」로 바뀐다.
     */
    countedQtyEmptyStart:
      '실물 수량은 늘 빈 칸으로 시작합니다. 서버가 준 수량을 미리 채우면 세지 않은 줄이 「0개를 셌다」로 저장될 수 있습니다.',
    /** 응답을 받지 못한 저장. 같은 위치를 다시 치환하면 되돌아가므로 개시만큼 위험하지는 않다. */
    saveRecheck:
      '저장됐는지 다시 조회로 확인한 뒤 시도하세요. 같은 위치를 다시 보내면 그 위치가 다시 통째로 바뀝니다.',
    /*
     * **응답을 받지 못한 마감.** 개시와 같은 무게다 — 다시 여는 오퍼레이션이 없어 두 번
     * 마감되면 되돌릴 수 없다. 저장(치환)과 갈리는 자리이며, 그 갈림이 문구에 있어야 한다.
     */
    closeRecheck:
      '실사가 이미 마감됐는지 다시 조회로 확인한 뒤 시도하세요. 마감한 실사를 다시 여는 오퍼레이션이 계약에 없습니다.',
  },
  dialog: {
    openTitle: '이 내용으로 실사를 개시할까요?',
    openLead: '아래 값으로 실사 전표를 만듭니다. 보내기 전에 한 번 더 확인하세요.',
    /** 되돌릴 수 없다는 사실을 창이 밝힌다 — 개시한 실사를 지우거나 취소할 수단이 없다. */
    openIrreversible:
      '개시한 실사는 이 화면에서 지우거나 되돌릴 수 없습니다. 창고와 계획일을 다시 확인하세요.',
    discardTitle: '입력한 값을 버릴까요?',
    closeTitle: '이 실사를 마감할까요?',
    /**
     * 마감 창은 **보낼 값이 아니라 마감할 대상과 그 진행 상황**을 다시 보인다.
     *
     * 보내는 값은 영업일 하나이고 그것마저 화면이 파생한다 — 값을 확인시켜야 할 것이 없다.
     * 대신 「무엇을 마감하는가」와 「지금 어디까지 됐는가」가 확인의 실질이다.
     */
    closeLead: '아래 실사를 마감합니다. 마감 시점의 진행 요약을 한 번 더 확인하세요.',
    /** 되돌릴 수 없다는 사실을 창이 밝힌다 — 다시 여는 오퍼레이션이 계약에 없다(실측). */
    closeIrreversible:
      '마감하면 이 실사를 더 고칠 수 없습니다. 마감한 실사를 다시 여는 오퍼레이션이 계약에 없습니다.',
  },
  /**
   * 쓰기 결과. **한 자리에 갈래 하나만 보인다** — 개시·저장·마감 결과를 따로 두면
   * 셋이 동시에 보이는 상태가 생긴다(계획 결정 14).
   */
  result: {
    label: '실사 개시 결과',
    openedNo: '실사번호',
    /**
     * 개시 뒤 무엇이 달라졌는지. **성공을 단정하는 말을 쓰지 않는다** — 화면이 증거를 갖는
     * 것은 응답이 준 실사번호와 아래 구획의 요약뿐이다.
     */
    openedNote:
      '개시한 실사를 아래에서 고른 상태로 두었습니다. 진행 요약은 아래 구획에서 확인하세요.',
    /** 저장 갈래. 라벨이 갈래마다 다른 것이 「한 자리에 갈래 하나」의 실물이다. */
    savedLabel: '위치 저장 결과',
    savedLocation: '위치',
    savedLineCount: '치환한 줄',
    /**
     * **서버가 되돌려 준 줄 수를 낸다** — 화면이 센 숫자가 아니다. 둘이 갈리면 그 자리가
     * 「보낸 것과 저장된 것이 다르다」는 사실을 드러낸다.
     */
    savedCount: (lineCount: number): string => `${String(lineCount)}줄`,
    savedNote: '이 위치의 라인을 통째로 바꿨습니다. 진행 요약은 위 구획에서 다시 조회한 값입니다.',
    /** 마감 갈래. 라벨이 갈래마다 다른 것이 「한 자리에 갈래 하나」의 실물이다. */
    closedLabel: '실사 마감 결과',
    closedNo: '실사번호',
    /**
     * **서버가 준 상태 코드를 그대로 낸다**(공유계약 G-2 · 계획 결정 12).
     *
     * 화면이 「마감됨」이라 단정하지 않는 근거가 실측에 있다 — 목 서버의 `:close` 200 응답이
     * `IN_PROGRESS`를 되돌려 준다. 값으로 판정했다면 그 자리에서 거짓말을 한다.
     */
    closedStatus: '마감 뒤 상태',
    closedNote:
      '서버가 되돌려 준 상태 코드와 진행 요약을 그대로 보입니다. 화면이 「마감됨」을 판정하지 않습니다.',
    /**
     * 조정 등록 링크 옆 안내 — **차이가 남은 마감에만 선다**(D-18).
     *
     * **건수를 서버가 준 요약에서 그대로 인용한다**(착수 이슈 §6 ⭐ — 화면이 세지 않는다).
     * 건수를 밝히지 않으면 「왜 이 마감에만 링크가 있는가」가 화면에서 읽히지 않는다.
     *
     * 자리표시 시절의 `actionReasons.adjustmentPending`(「아직 이어서 할 수 없다」)을 대신한다 —
     * 그 문구는 도착 화면이 생겨 참이 아니게 됐고, 남기면 다음 사본이 잠긴 버튼을 되살린다.
     */
    adjustmentNote: (varianceCount: number): string =>
      `차이 ${String(varianceCount)}건이 남아 있습니다. 재고조정에서 이어서 처리하세요.`,
  },
  loading: {
    counts: '실사 목록을 불러오는 중',
    detail: '고른 실사를 불러오는 중',
    lines: '고른 위치의 라인을 불러오는 중',
  },
  /** 목록 표의 머리글. 열 구성과 폭의 근거는 screens/stocktaking/count-table.tsx에 있다. */
  table: {
    inventoryCountNo: '실사번호',
    warehouse: '창고',
    countType: '실사 유형',
    plannedDate: '계획일',
    blindCount: '블라인드',
    status: '상태',
    select: '선택',
  },
  /**
   * 고른 위치의 라인 표. 열 구성과 폭의 근거는 screens/stocktaking/count-line-table.tsx에 있다.
   *
   * **장부·차이 두 열은 블라인드에서 함께 사라진다**(계획 결정 4). 차이만 보여도
   * 실물 − 차이 = 장부로 역산되어 블라인드가 무의미해진다.
   *
   * **카운트 시각·담당자 머리글이 없다**(결정 9). 착수 이슈 §4가 「카운트 시각 컬럼이 비지
   * 않도록 설계돼 있어 미실사를 판정할 수 없다」고 밝힌 값이라, 표에 내면 사용자가 실사 여부로
   * 읽는다. 문구에 자리를 두지 않으면 열이 생길 경로도 없다.
   */
  lineTable: {
    lineNo: '줄번호',
    item: '품목',
    lot: '자재 LOT',
    systemQty: '장부 수량',
    countedQty: '실물 수량',
    variance: '차이',
    reason: '차이 사유',
    /*
     * 표 안 입력칸에는 보이는 라벨을 둘 자리가 없어 접근 이름으로 준다(배치 규범 3의 이탈 조건).
     * **줄번호로 가른다** — 「실물 수량」이 줄마다 되풀이되면 어느 줄인지 알 수 없다.
     * 내부 번호를 넣지 않는 것은 그것이 화면 밖으로 새는 또 하나의 경로이기 때문이다.
     */
    countedQtyLabel: (lineNo: number): string => `${String(lineNo)}번 줄 실물 수량`,
    reasonLabel: (lineNo: number): string => `${String(lineNo)}번 줄 차이 사유`,
    /** 단위 열을 따로 두지 않고 수량 표기에 붙인다(W-01-03이 세운 처리). */
    qtyWithUom: (qty: string, uom: string): string => `${qty} ${uom}`,
    /*
     * **차이 칸이 낡았다.** 친 실물 수량이 저장된 값과 다른데 차이는 서버가 계산한다 —
     * 화면이 다시 계산하지 않으면서도 낡음을 숨기지 않는 유일한 형태다(계획 결정 7).
     */
    varianceStale: '저장하면 다시 계산됩니다',
  },
  /**
   * 고른 실사의 제목줄과 **요약 4칸**.
   *
   * **요약은 서버가 계산해 내려준다**(착수 이슈 §6 ⭐). 창고 하나의 라인이 수백~수천 건이라
   * 화면이 전 라인을 받아 세면 쪽과 어긋난다 — 그 사실을 안내로 밝힌다.
   */
  detail: {
    label: '고른 실사',
    inventoryCountNo: '실사번호',
    countType: '실사 유형',
    warehouse: '창고',
    plannedDate: '계획일',
    blindCount: '블라인드 실사',
    status: '상태',
    summaryLabel: '실사 진행 요약',
    planned: '계획 라인',
    counted: '카운트',
    uncounted: '미실사',
    variance: '차이',
    /** 요약 4칸의 단위. 넷 다 「건」이다. */
    countUnit: '건',
    /**
     * 요약 건수를 **문장 밖에서 낼 때**의 표기(마감 확인 창 · 마감 결과).
     *
     * 요약 4칸의 `StatCard`는 값과 단위를 따로 받지만 창과 결과 구획은 짝 목록이라 한 덩어리로
     * 낸다 — 표기를 두 자리에서 따로 만들면 한쪽만 「40」이 되어 단위가 사라진다.
     */
    countValue: (value: number): string => `${String(value)}건`,
    summaryNote: '요약 건수는 서버가 계산해 함께 내려준 값입니다. 화면이 라인을 세지 않습니다.',
    /*
     * **블라인드는 개시 폼에만 컨트롤을 둔다**(계획 결정 4). 실사 헤더를 고치는 오퍼레이션이
     * 계약에 없어(실측) 비활성 컨트롤을 두면 「언젠가 켜질 것」으로 읽힌다 — 읽기 전용 표기로 낸다.
     */
    blindNote:
      '블라인드 실사에서는 장부 수량이 내려오지 않아 장부·차이 수량이 보이지 않습니다. 개시한 뒤에는 바꿀 수 없습니다.',
  },
  /**
   * 실물 수량 수정 이력 — **자리만 두고 비활성으로 시작한다**(착수 이슈 §4 · `omf-mes#68`).
   *
   * 범용 이력 테이블의 사용 규약이 없어 무엇을 어떻게 보일지 정해지지 않았다. 구획 자체를
   * 만들지 않으면 「이력이 없다」로 읽히고, 활성으로 두면 눌러도 아무 일이 없다 —
   * **자리와 사유를 함께** 두는 것이 지금 사실을 가장 정확히 옮긴다.
   */
  history: {
    label: '실물 수량 수정 이력',
    action: '이력 보기',
  },
  filters: {
    all: '전체',
    lookupTruncated: '선택지가 앞쪽 일부만 보입니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
    lookupFailed: '선택지를 불러오지 못했습니다.',
    /* 기본 기간을 심지 않는다는 사실은 화면에서 읽혀야 한다 — 비어 있는 것이 고장으로 읽히지 않게 한다. */
    periodNote: '계획일을 비워 두면 기간을 좁히지 않고 전체를 봅니다.',
    chipWarehouse: (value: string): string => `창고: ${value}`,
    /** 한쪽만 넣은 기간도 조건이다 — 그 사실이 칩에서 읽혀야 한다. */
    chipPeriodBoth: (from: string, to: string): string => `계획일: ${from} ~ ${to}`,
    chipPeriodFrom: (from: string): string => `계획일: ${from}부터`,
    chipPeriodTo: (to: string): string => `계획일: ${to}까지`,
    chipCountType: (value: string): string => `실사 유형: ${value}`,
    chipStatus: (value: string): string => `상태: ${value}`,
    chipInProgress: '진행 중만',
    chipRemoveWarehouse: '창고 조건 제거',
    chipRemovePeriod: '계획일 조건 제거',
    chipRemoveCountType: '실사 유형 조건 제거',
    chipRemoveStatus: '상태 조건 제거',
    chipRemoveInProgress: '진행 중만 조건 제거',
  },
  /** 쪽 이동. 번호 목록을 두지 않는 근거는 screens/stocktaking/page-nav.tsx에 있다. */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  /** 빈 상태는 **세 갈래**다. 사용자가 할 조치가 서로 다르다(완료 조건 C07). */
  empty: {
    noResultTitle: '조건에 맞는 실사가 없습니다',
    noResultDescription: '조건을 줄이거나 계획일 범위를 넓힌 뒤 다시 조회하세요.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
    noSelectionTitle: '실사를 고르면 진행 상황이 보입니다',
    noSelectionDescription: '위 목록에서 실사를 골라 「선택」을 누르세요.',
    /*
     * 상세가 404다. **주소에 남은 실사 번호를 화면이 스스로 정리한다** — 남겨 두면
     * 아래 구획이 없는 실사를 가리킨 채 주소만 남는다(수명 표 6행).
     */
    notFoundTitle: '고른 실사를 찾을 수 없습니다',
    notFoundDescription: '지워졌거나 주소의 번호가 잘못됐습니다. 위 목록에서 다시 고르세요.',
    /** 실사는 골랐는데 위치를 아직 안 골랐다. 「그 위치에 라인이 없다」와 다른 사정이다. */
    noLocationTitle: '위치를 고르면 실사 라인이 보입니다',
    noLocationDescription: '치환은 위치 단위라 한 번에 한 위치의 라인만 다룹니다.',
    noLinesTitle: '이 위치에는 실사 라인이 없습니다',
    noLinesDescription: '다른 위치를 고르거나 실사 계획을 확인하세요.',
    /*
     * **이번 세션에서 마감한 실사**(단계 S3). 위치 선택과 결과 등록 구획이 통째로 닫히므로
     * 그 자리가 왜 비었는지 여기서 밝힌다 — 밝히지 않으면 화면이 고장으로 읽힌다.
     */
    closedTitle: '마감한 실사는 더 고칠 수 없습니다',
    closedDescription:
      '위치 선택과 결과 등록이 닫혔습니다. 다른 실사를 고르면 이어서 진행할 수 있습니다.',
  },
  /** 실패·비활성 사유는 그 대상으로 시작한다(배치 규범 4). */
  reasons: {
    /*
     * **문구에 적은 대상과 「다시 시도」가 다시 부르는 대상이 같아야 한다.** 다르면 눌러도
     * 한쪽은 실패인 채로 남는데 문구는 둘 다 고쳐질 것처럼 말한다.
     */
    warehouseReferenceFailed: '창고 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    /**
     * **위치는 복구 버튼이 따로 선다.** 위치를 고르지 못하면 라인 표 자체가 열리지 않아,
     * 표 아래에 두면 **보이지도 않는 실패의 복구 버튼**이 된다(W-01-10이 공장에서 겪은 자리).
     */
    locationReferenceFailed:
      '위치 목록을 불러오지 못했습니다. 위치를 고를 수 없어 라인을 열 수 없습니다.',
    /** 라인 표가 이름을 내는 참조 셋(품목·단위·자재 LOT) 중 하나라도 실패했다. */
    lineReferencesFailed:
      '품목·단위·자재 LOT의 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    /*
     * **잘림은 경고가 아니라 차단이다**(계획 결정 8). 못 받은 줄이 치환에 실리지 않으면
     * 그 줄이 미실사로 되돌아간다 — 이 표식과 저장 차단 사유가 같은 사실을 두 자리에서 말한다.
     */
    linesTruncated: '이 위치의 라인을 전부 받지 못했습니다. 받지 못한 줄이 있어 저장을 막습니다.',
  },
  /*
   * **쓰이는 값만 세운다.** 「값 없음(—)」 표기는 이 PR의 두 구획에 자리가 없다 —
   * 실사 헤더에는 nullable 필드가 하나도 없다(계약 실측). 라인 표의 자재 LOT처럼 그 표기가
   * 실제로 필요한 자리는 PR ③에서 생기며, 그때 함께 세운다. 쓰이지 않는 문구가 먼저 서 있으면
   * 어느 것이 화면에 실제로 나오는지 읽을 수 없다.
   */
  values: {
    /** 이름 목록은 왔는데 그 안에 없다 — **값이 잘못됐다**는 신호다. */
    unknown: '알 수 없음',
    /** 이름 목록이 아직 오지 않았다. 「알 수 없음」으로 쓰면 정상 값이 잘못된 값으로 읽힌다. */
    referenceLoading: '이름 불러오는 중',
    /** 이름 목록 조회가 실패했다. 값이 없는 것과 다르다. */
    referenceFailed: '이름을 불러오지 못했습니다',
    inactiveSuffix: ' (미사용)',
    /** 블라인드 여부. **읽히는 말로 낸다** — `true`·`false`를 그대로 내면 값이 읽히지 않는다. */
    blindYes: '예',
    blindNo: '아니오',
    /**
     * 위치 선택칸의 빈 선택지.
     *
     * **조건 줄의 「전체」를 재사용하지 않는다.** 위치 칸에서 「전체」는 「**전체 위치**」로
     * 읽히는데, 그것은 위치 칸을 조건 줄에서 떼어 낸 이유가 없애려던 바로 그 독법이다 —
     * 치환은 좁혀 받은 목록을 그대로 덮어써 **보이지 않던 줄을 미실사로 되돌리므로**,
     * 파괴적인 이 화면에서 「전체 위치를 대상으로 한다」는 오독은 값이 비싸다.
     */
    locationNotChosen: '고르지 않음',
    /**
     * 값이 **없는** 자리. 라인 표의 자재 LOT이 nullable이라 이 PR에서 처음 쓰인다 —
     * **참조 실패가 아니다**(W-01-10 전례). 비워 두면 자료가 없는 것인지 화면이 빠뜨린
     * 것인지 구분되지 않는다.
     */
    empty: '—',
    /**
     * 계약은 필수라는데 응답에 오지 않은 수량. **「알 수 없음」과 다르다** —
     * 그쪽은 이름 목록에 없다는 뜻이라 값이 잘못됐다는 신호로 읽힌다.
     * 블라인드에서는 열 자체가 없으므로 이 표기가 서는 자리는 계약과 런타임이 어긋난 때뿐이다.
     */
    qtyNotProvided: '내려오지 않음',
  },
} as const;

/**
 * W-01-05 공급사 반품 처리.
 *
 * **이 묶음은 「무엇을 얼마나 되돌려 보낼지 정하는 것」까지 왔다** — 대상 입고 전표를 조건으로
 * 찾고, 한 건을 골라 그 라인을 읽고, **반품할 줄과 수량을 고르는** 데까지다.
 * 반품 정보·확인 창·결과·실패 문구는 뒤따르는 회차에서 이 묶음에 더해진다.
 *
 * **상태말을 화면 문구로 만들지 않는다.** 입고 유형·상태 코드의 값 집합이 확정되지 않아
 * 화면이 값을 해석하면 값이 정해질 때 조용히 틀린다 — 서버가 준 코드를 그대로 낸다.
 *
 * **화면이 확인하지 못한 것을 말하지 않는다.** 보유 수량을 못 구한 줄에는 「0이다」도
 * 「무제한이다」도 아닌 **「확인하지 못함」**이라 적고, 그 줄의 저장을 막지 않는다는 사실을
 * 함께 밝힌다 — 막는 쪽이 더 안전해 보이지만 LOT이 많은 창고에서 정당한 반품을 영영 막는다.
 */
const supplierReturn = {
  title: '공급사 반품 처리',
  breadcrumbRoot: '자재창고',
  panes: {
    list: '대상 입고 전표 목록',
    lines: '고른 입고 전표의 라인',
    /** 반품 정보 — 라인 표 **아래** 구획이다. 창에 넣지 않는다(창 안 펼침 목록 잘림 회피). */
    form: '반품 정보',
    result: '반품 처리 결과',
  },
  fields: {
    warehouse: '창고',
    /**
     * 계약의 `receiptDateFrom`·`receiptDateTo`를 **한 컨트롤**이 함께 고른다.
     * **기본 기간을 심지 않는다**(W-01-09가 세운 규칙).
     */
    period: '입고일',
    /** 값 목록이 확정되지 않아 선택지가 비어 있다 — 안내는 `pendingCode`가 맡는다. */
    receiptType: '입고 유형',
    status: '상태',
    q: '입고번호 검색',
    /**
     * 반품 정보의 칸 이름 여덟.
     *
     * **도착지 유형·원천 문서 유형은 사용자가 고를 성질이 아니다** — 원천이 입고 전표임을,
     * 도착지가 공급사임을 가리키는 구조 값이다. 그런데도 칸을 두는 이유는 **그 값이 무엇이어야
     * 하는지도 아직 확정되지 않았기** 때문이다(계획 결정 10). 화면이 정해 심으면 지어내는 것이다.
     */
    supplier: '공급사',
    issueType: '출고 유형',
    sourceDocumentType: '원천 문서 유형',
    destinationType: '도착지 유형',
    reason: '반품 사유',
    /**
     * 출고 일시를 **날짜와 시각 두 칸**으로 받는다. 날짜는 달력 컨트롤이고 시각은 시각 입력칸이다 —
     * 한 칸짜리 `datetime-local`을 쓰지 않는 것은 날짜 입력을 달력으로 통일한 판올림 결정 때문이다.
     */
    issuedDate: '출고 일자',
    issuedTime: '출고 시각',
    /** 확인 창과 결과가 쓰는 **합친 표기**. 두 칸이 한 값(`issuedAt`)이라는 사실이 여기서 보인다. */
    issuedAt: '출고 일시',
    /** 화면이 파생해 함께 보내는 값. **사용자가 넣는 칸이 없다.** */
    businessDate: '영업일',
    replacementExpected: '대체입고 예정',
    sendToErp: 'ERP 송신',
    remarks: '비고',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    /** 화면이 보고 있는 조회를 전부 다시 한다 — 목록만 다시 부르면 낡은 값과 새 값이 섞인다. */
    refresh: '다시 조회',
    select: '선택',
    deselect: '선택 해제',
    /*
     * 행 안의 버튼은 보이는 글자가 행마다 같다. 접근 이름에 입고번호를 넣어 어느 건인지 밝히되,
     * 보이는 글자를 그대로 담는다 — 담지 않으면 음성 조작이 「선택」으로 이 버튼을 부를 수 없다.
     * **내부 번호를 접근 이름에 넣지 않는다** — 그것이 화면 밖으로 새는 또 하나의 경로다.
     */
    selectRow: (goodsReceiptNo: string): string => `${goodsReceiptNo} 선택`,
    deselectRow: (goodsReceiptNo: string): string => `${goodsReceiptNo} 선택 해제`,
    /**
     * 되돌릴 수 없는 조작의 이름. **한 버튼이다** — 등록과 전기가 한 요청이라 두 단계로 나누면
     * 전기되지 않은 전표가 이 화면에서 손댈 수 없는 채 남는다(착수 이슈 §6).
     */
    submit: '반품 처리',
    /** 두 초안(줄·수량 / 반품 정보)을 함께 버린다. 서버를 부르지 않는다. */
    discardDrafts: '입력 지우기',
    /** 창의 버튼은 「확인/취소」가 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */
    keepEditing: '계속 입력',
    /**
     * **창 안의 확인 버튼은 이름이 다르다.** 구획의 「반품 처리」와 글자가 같으면 사용자가
     * 어느 것을 눌렀는지 되짚을 수 없고, 음성 조작이 둘 중 무엇을 가리키는지도 정해지지 않는다.
     */
    confirmSubmit: '반품 처리 실행',
    confirmDiscard: '입력 지우기 실행',
  },
  /** 컨트롤이 잠긴 사유. **잠근 자리 옆에서 읽혀야 한다**(배치 규범 4). */
  actionReasons: {
    /**
     * 「고르세요」가 아니라 **「고를 값이 아직 없습니다」**다. 고를 것이 없는데 고르라고 하면
     * 사용자가 자기가 놓친 것을 찾다가 화면을 고장으로 읽는다(계획 결정 10).
     */
    codeListPending:
      '출고 유형·원천 문서 유형·도착지 유형·반품 사유의 값 목록이 아직 정해지지 않아 반품을 처리할 수 없습니다. 대상 조회와 줄·수량 입력까지는 지금도 쓸 수 있습니다.',
    needsSupplier: '되돌려 보낼 공급사를 고르세요.',
    needsCodes: '반품 정보의 코드를 모두 고르세요.',
    needsIssuedDate: '출고 일자를 고르세요.',
    needsIssuedTime: '출고 시각을 적으세요.',
    /** 버릴 것이 없는데 눌리면 아무 일도 하지 않는 버튼이 된다 — 잠그고 사유를 밝힌다. */
    nothingToDiscard: '지울 입력이 없습니다.',
  },
  /** 반품 수량 칸의 오류. **줄마다 그 칸 아래에 선다** — 어느 줄이 잘못됐는지 표에서 읽힌다. */
  errors: {
    qtyNotNumber: '반품 수량은 숫자로 적어 주세요.',
    /**
     * 계약이 `exclusiveMinimum: 0`이라 **0도 보낼 수 없다**. 「0개를 반품한다」는 뜻이 없고
     * 서버가 400으로 되돌린다 — 재고실사(`minimum: 0`)와 갈리는 자리다.
     */
    qtyNotPositive: '반품 수량은 0보다 커야 합니다.',
    /**
     * 상한을 **확인한 줄에서만** 뜬다. 확인하지 못한 줄은 이 오류를 내지 않는다 —
     * 모르는 것을 근거로 막으면 화면이 확인하지 않은 것을 말하는 것이 된다.
     */
    qtyOverOnHand: (onHandQty: number): string =>
      `보유 수량 ${String(onHandQty)}보다 많이 되돌려 보낼 수 없습니다.`,
    /**
     * 코드 길이 상한(계약 `maxLength: 50`). 선택지에서 고른 값이 넘는 일은 드물지만,
     * 값 목록이 확정돼 배열이 채워질 때 그 값의 길이를 화면이 정하지 않는다 —
     * 되돌릴 수 없는 요청이 나간 뒤 400을 받는 것보다 나가기 전에 막는 편이 싸다.
     */
    codeTooLong: (max: number): string => `${String(max)}자를 넘을 수 없습니다.`,
  },
  filters: {
    all: '전체',
    /** 기본 기간이 없다는 사실은 화면에서 읽혀야 한다 — 빈 칸이 고장으로 읽히지 않게 한다. */
    periodNote:
      '기간을 정하지 않으면 서버가 정한 기본 범위가 보입니다. 좁히려면 입고일을 고르세요.',
    /**
     * 기간 칩에만 해제 버튼이 없는 이유.
     *
     * 날짜 컨트롤이 한 번 고른 값을 개별로 비우는 수단을 아직 주지 않아, 기간을 푸는 길이
     * 「초기화」뿐이다. 사용자가 ×를 찾다가 못 찾는 것보다 왜 없는지를 밝히는 편이 낫다.
     */
    periodClearNote: '입고일은 「초기화」로만 비울 수 있습니다. 다른 조건은 조건표의 ×로 풉니다.',
    lookupFailed: '이름 목록을 불러오지 못했습니다. 다시 시도해 주세요.',
    lookupTruncated:
      '이름 목록이 일부만 왔습니다. 찾는 값이 목록에 없을 수 있습니다 — 없어진 것이 아닙니다.',
    chipWarehouse: (name: string): string => `창고: ${name}`,
    chipPeriodBoth: (from: string, to: string): string => `입고일: ${from} ~ ${to}`,
    chipPeriodFrom: (from: string): string => `입고일: ${from}부터`,
    chipPeriodTo: (to: string): string => `입고일: ${to}까지`,
    chipReceiptType: (code: string): string => `입고 유형: ${code}`,
    chipStatus: (code: string): string => `상태: ${code}`,
    chipQ: (q: string): string => `검색어: ${q}`,
    chipRemoveWarehouse: '창고 조건 해제',
    chipRemoveReceiptType: '입고 유형 조건 해제',
    chipRemoveStatus: '상태 조건 해제',
    chipRemoveQ: '검색어 조건 해제',
  },
  loading: {
    goodsReceipts: '대상 입고 전표 목록을 불러오는 중',
    detail: '고른 입고 전표를 불러오는 중',
  },
  empty: {
    noResultTitle: '조건에 맞는 입고 전표가 없습니다',
    noResultDescription: '기간을 넓히거나 조건을 풀어 다시 조회해 보세요.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '앞 쪽으로 돌아가면 결과를 볼 수 있습니다.',
    noSelectionTitle: '아직 입고 전표를 고르지 않았습니다',
    noSelectionDescription: '위 목록에서 되돌려 보낼 자재가 들어 있는 입고 전표를 고르세요.',
    noLinesTitle: '이 입고 전표에는 라인이 없습니다',
    noLinesDescription: '다른 입고 전표를 고르거나 담당자에게 확인해 주세요.',
    /**
     * 고른 번호가 서버에 없다. **다시 시도로 풀리지 않는다** — 다시 고르라고 말한다.
     *
     * 「목록을 못 불러와 고른 전표를 열 수 없다」는 갈래는 두지 않는다 — 아래 구획이 쓰는
     * 값이 전부 상세 응답에서 오므로 목록이 실패해도 고른 전표는 그대로 열린다.
     */
    notFoundTitle: '고른 입고 전표를 찾을 수 없습니다',
    notFoundDescription: '이미 지워졌거나 주소의 번호가 잘못됐습니다. 목록에서 다시 고르세요.',
  },
  /** 실패·한계 안내는 그 대상으로 시작한다(배치 규범 4). */
  reasons: {
    /**
     * **문구에 적은 대상과 「다시 시도」가 다시 부르는 대상이 같아야 한다.** 다르면 눌러도
     * 한쪽은 실패인 채로 남는데 문구는 둘 다 고쳐질 것처럼 말한다.
     */
    referencesFailed: '창고 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    lineReferencesFailed:
      '품목·단위·자재 LOT·위치 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    /**
     * **잘림은 실패와 다르다.** 이름 목록이 앞쪽만 오면 그 뒤의 정상 값이 「알 수 없음」으로
     * 찍히는데, 그 문구는 *값이 잘못됐다*는 뜻이라 사용자가 반대로 읽는다.
     * 다시 불러도 같은 쪽이 오므로 복구 버튼을 붙이지 않고 사실만 밝힌다.
     */
    lineReferencesTruncated:
      '품목·단위·자재 LOT·위치 이름 목록이 일부만 왔습니다. 이름 자리의 「알 수 없음」은 값이 잘못된 것이 아니라 이 목록에 아직 없다는 뜻일 수 있습니다.',
    /**
     * 줄을 고를 수 없는 사유 둘. **상태 코드로 판정하지 않는다**(공유계약 G-2) —
     * 계약이 반품 라인에 요구하는 값이 실제로 있는가만 본다.
     */
    lineMissingValues: '이 줄에는 반품에 필요한 값(품목·자재 LOT·단위·위치)이 빠져 있습니다.',
    lineQtyNotPositive: '입고 수량이 0 이하라 되돌려 보낼 것이 없습니다.',
    /** 다음 단계로 갈 수 없는 사유 셋. **판정은 한 곳에서 나온다**(return-selection.ts). */
    selectNone: '반품할 줄을 하나 이상 고르세요.',
    selectQtyMissing: '고른 줄의 반품 수량을 채우세요.',
    selectQtyInvalid: '반품 수량에 오류가 있는 줄이 있습니다. 그 줄부터 고치세요.',
    /**
     * 보유 수량 조회의 실패·잘림. **이름 참조와 따로 낸다** — 이름은 「누구인가」이고
     * 보유 수량은 「얼마까지 보낼 수 있는가」라, 못 받았을 때 사용자가 할 판단이 다르다.
     */
    balancesFailed: '보유 수량을 불러오지 못했습니다. 그 줄의 보유 수량 자리에 사유가 표시됩니다.',
    balancesTruncated:
      '보유 수량 목록이 일부만 왔습니다. 합계가 실제보다 적을 수 있어 그 줄의 상한으로 쓰지 않습니다.',
    /**
     * **막지 않는다는 사실을 밝힌다**(계획 결정 9 · 승인 13-6). 상한은 보조 정보이고 최종
     * 판정은 서버가 한다 — 확인하지 못했다고 막으면 LOT이 많은 창고에서 정당한 반품이
     * 영영 불가능해진다. 초과분은 서버가 400으로 되돌리며 그 실패는 되돌릴 수 있다.
     */
    onHandUnknownNote:
      '보유 수량을 확인하지 못한 줄은 화면이 상한으로 막지 않습니다. 보낸 뒤 서버가 최종 판정합니다.',
    /**
     * 거래처(공급사) 목록의 실패·잘림. **한 건을 번호로 받는 경로가 계약에 없어**(실측)
     * 목록이 잘리면 그 공급사를 고를 길이 화면에 없다 — 그 사실을 감추지 않는다(계획 §5.4-7).
     */
    partnersFailed: '공급사 목록을 불러오지 못했습니다. 다시 시도해 주세요.',
    partnersTruncated:
      '공급사 목록이 일부만 왔습니다. 찾는 공급사가 목록에 없으면 담당자에게 알려 주세요 — 없어진 것이 아닙니다.',
  },
  /** 목록 표의 머리글. 열 구성과 폭의 근거는 screens/supplier-return/gr-table.tsx에 있다. */
  table: {
    goodsReceiptNo: '입고번호',
    warehouse: '창고',
    receiptType: '입고 유형',
    receiptDatetime: '입고 일시',
    status: '상태',
    select: '선택',
  },
  /** 라인 표의 머리글과 칸 문구. 폭의 근거는 screens/supplier-return/gr-line-table.tsx에 있다. */
  lineTable: {
    select: '선택',
    item: '품목',
    lot: '자재 LOT',
    location: '위치',
    receiptQty: '입고 수량',
    onHandQty: '보유 수량',
    returnQty: '반품 수량',
    /** 「100 SAMPLE-EA」 — 단위 열을 따로 두지 않고 수량 표기에 붙인다(W-01-03이 세운 처리). */
    receiptQtyPair: (receiptQty: number, uom: string): string => `${String(receiptQty)} ${uom}`,
    /**
     * 보유 수량 표기. **입고 수량과 글자 모양이 같아도 뜻이 다르다** — 이쪽은 지금 창고에
     * 남아 있는 양이고 반품 수량의 상한이다. 키를 갈라 두면 한쪽 문구만 고칠 수 있다.
     */
    onHandQtyPair: (onHandQty: number, uom: string): string => `${String(onHandQty)} ${uom}`,
    /**
     * 확인 창과 결과 구획이 쓰는 **반품 수량 표기**. 입고·보유 수량과 글자 모양이 같아도 뜻이
     * 다르다 — 이쪽은 **실제로 나가는 양**이다. 키를 갈라 두면 한쪽 문구만 고칠 수 있다.
     */
    returnQtyPair: (issueQty: number, uom: string): string => `${String(issueQty)} ${uom}`,
    /**
     * 표 안 컨트롤의 접근 이름. 보이는 글자가 줄마다 같으므로 **어느 줄인지**를 이름에 넣는다.
     *
     * **표시 순번을 쓴다.** 이 표에는 줄번호 열이 없고(계획 §5.5) 품목·LOT은 이름이 아직
     * 안 풀렸거나 줄끼리 겹칠 수 있어 줄을 가르지 못한다. 내부 번호를 넣지 않는 것은
     * 그것이 화면 밖으로 새는 또 하나의 경로이기 때문이다(#44).
     */
    selectLabel: (ordinal: number): string => `${String(ordinal)}번째 줄 선택`,
    returnQtyLabel: (ordinal: number): string => `${String(ordinal)}번째 줄 반품 수량`,
  },
  /**
   * 고른 줄의 요약. **서버에 보낼 것과 같은 수를 낸다** — 화면이 따로 세면 둘이 갈린다.
   */
  selection: {
    none: '아직 고른 줄이 없습니다.',
    summary: (count: number, totalQty: number, uom: string): string =>
      `고른 ${String(count)}줄 · 반품 수량 합계 ${String(totalQty)} ${uom}`,
    /**
     * **단위가 섞이면 합계를 내지 않는다.** 100 개와 5 상자를 더한 105는 어떤 뜻도 없고,
     * 화면이 확인하지 않은 것을 말하는 것이 된다. 줄 수는 그대로 낸다.
     */
    summaryMixedUom: (count: number): string =>
      `고른 ${String(count)}줄 · 단위가 섞여 합계를 내지 않습니다`,
  },
  /** 고른 입고 전표의 제목줄. */
  summary: {
    label: '고른 입고 전표',
    goodsReceiptNo: '입고번호',
    warehouse: '창고',
    receiptDatetime: '입고 일시',
    receiptType: '입고 유형',
    status: '상태',
  },
  /**
   * 창 둘의 문구. **둘 다 안에 선택칸이 없다** — 창 본문이 펼침 목록을 자르는 결함이 아직
   * 고쳐지지 않았고, 고칠 수 없는 결함은 **걸릴 자리를 만들지 않는 것**으로 피한다.
   */
  dialog: {
    submitTitle: '이 내용으로 반품을 처리할까요?',
    submitLead: '아래 내용으로 반품 전표를 만들고 곧바로 전기합니다.',
    /** 줄별 요약. 「품목 · 자재 LOT · 수량 단위」 — 확인 창에서 처음 보는 값이 없어야 한다. */
    linePair: (item: string, lot: string, qty: string): string => `${item} · ${lot} · ${qty}`,
    lineCount: (count: number): string => `고른 줄 ${String(count)}줄`,
    /** **파생값임을 밝힌다** — 사용자가 넣은 적 없는 값이 전표에 실리기 때문이다. */
    businessDateDerived: (businessDate: string): string =>
      `${businessDate} (출고 일자에서 나온 값입니다)`,
    /**
     * 되돌릴 수 없다는 **사실을 정확히** 말한다. 「계약에 없다」가 아니다 —
     * 취소 오퍼레이션은 계약에 있고 승인을 타며 다른 화면 소관이다. 사실과 다르게 적으면
     * 사용자가 잘못된 판단을 한다(계획 §5.4-1).
     */
    submitEffects: '이 조작은 재고를 차감하며, 등록과 전기가 한 번에 일어납니다.',
    submitNoUndoHere: '이 화면에는 되돌리는 수단이 없습니다.',
    /** 착수 이슈 §6 — 「반출됐다고 해제하지 마세요」. 그 사실을 사용자가 확인 창에서 읽는다. */
    submitLotHoldKept: '반품해도 자재 LOT의 보류는 그대로 유지됩니다.',
    /**
     * 상한을 확인하지 못한 줄이 **섞여 있을 때만** 낸다(위험 10). 늘 세워 두면 전부 확인된
     * 화면에서도 사용자가 상한이 없는 줄 안다.
     */
    submitOnHandUnknown:
      '보유 수량을 확인하지 못한 줄이 있습니다. 상한을 넘으면 서버가 400으로 되돌립니다.',
    discardTitle: '입력을 지울까요?',
  },
  /**
   * 결과 구획 — **화면이 확인한 것만 말한다**(계획 결정 13).
   *
   * 응답에 수불·잔액 정보가 없고, 목이 `postImmediately: true`에도 `DRAFT`를 되돌려 준다(실측).
   * 그래서 「재고가 차감됐습니다」·「전기 완료」라는 낱말이 이 묶음에 없다.
   */
  result: {
    label: '반품 처리 결과',
    goodsIssueNo: '반품 전표 번호',
    status: '상태',
    lines: '반품한 줄',
    linePair: (item: string, lot: string, qty: string): string => `${item} · ${lot} · ${qty}`,
    created: '반품 전표를 만들고 전기 요청을 함께 보냈습니다.',
    /** 상태 코드는 **값으로 분기하지 않고** 그대로 보인다(공유계약 G-2). */
    statusNote: '상태 코드는 서버가 준 값을 그대로 보입니다.',
    /** **적재이지 전송이 아니다**(계약이 못 박았다). 세 갈래의 문구가 서로 다르다. */
    erpQueued: 'ERP 송신 대기열에 적재했습니다 — 적재이지 전송이 아닙니다.',
    erpNotQueued: 'ERP 송신 대기열에 적재하지 않았습니다.',
    erpUnknown: 'ERP 송신 대기열에 적재됐는지는 응답이 알려 주지 않았습니다.',
    /** **확인하지 않은 것을 밝힌다** — 말하지 않으면 「다 됐다」로 읽힌다. */
    notConfirmed:
      '재고가 얼마나 줄었는지와 전기가 실제로 끝났는지는 이 화면이 확인하지 않았습니다 — 응답에 그 정보가 없습니다.',
    /** 줄 목록은 **서버가 되돌려 준 배열**에서 나온다 — 화면이 센 줄 수를 쓰지 않는다. */
    linesNote: '아래 줄 목록은 서버가 되돌려 준 반품 전표의 내용입니다.',
  },
  notes: {
    /**
     * 보류 표식이 뜻하는 것. **해제 수단을 두지 않는다** — 보류를 걸고 푸는 것은 품질 쪽
     * 소관이고, 되돌려 보냈다고 보류가 풀리지도 않는다.
     */
    lotHold: '「보류」 표식이 붙은 자재 LOT은 품질 보류 중입니다. 이 화면에서 풀 수 없습니다.',
    /**
     * 반품 수량 칸이 **빈 칸으로 시작하는 이유**를 밝힌다(승인 13-7). 입고 수량으로 미리
     * 채우면 전량 반품이 기본값처럼 보이고, 사용자가 그대로 확인하면 받은 전부가 나간다.
     */
    returnQtyEmptyStart: '반품 수량은 빈 칸으로 시작합니다. 되돌려 보낼 양을 줄마다 직접 적으세요.',
    /**
     * **응답을 받지 못한 실패에만** 덧붙인다. 공통 문구는 「다시 시도하세요」로 끝나는데,
     * 이 화면에서 확인 없이 다시 보내면 같은 반품이 전표 두 벌로 남는다 — 공통 쓰기 훅이
     * 호출마다 새 멱등 키를 만들어 서버가 재전송으로 보지 못한다.
     */
    submitRecheck:
      '서버에 전달됐는지 확인할 수 없습니다. 목록을 다시 조회해 반품 전표가 생겼는지 확인한 뒤 다시 시도하세요.',
    /** 영업일이 파생값임을 폼에서도 밝힌다 — 사용자가 넣지 않은 값이 전표에 실린다. */
    businessDateDerived: '영업일은 출고 일자에서 나온 값으로 함께 보냅니다.',
    /**
     * ERP 송신 토글의 한계. **설정 화면으로 잇지 않는다**(착수 이슈 §4 미결) —
     * 연계 설정 테이블이 아직 없어 이을 곳이 없다.
     */
    sendToErpNote: 'ERP 송신 설정은 이 화면에서 바꿀 수 없습니다. 보낼지 여부만 정합니다.',
    /**
     * 대체입고 예정의 한계. **입력만 받아 저장한다**(착수 이슈 §4 미결) — 예정 목록으로
     * 넘어가는 링크를 두지 않는다. 두 화면을 잇는 설계가 아직 없다.
     */
    replacementExpectedNote:
      '대체입고 예정은 전표에 표시로만 남습니다. 입하 예정 목록으로 이어지지 않습니다.',
  },
  values: {
    /** 이름 목록에 그 번호가 없다. **값이 잘못됐다는 뜻이 아니다** — 목록이 잘렸을 수도 있다. */
    unknown: '알 수 없음',
    referenceLoading: '이름 불러오는 중',
    referenceFailed: '이름 불러오기 실패',
    /**
     * 보유 수량의 두 갈래. **이름 참조의 문구를 돌려쓰지 않는다** — 「알 수 없음」은
     * *값이 잘못됐다*는 신호로 이 화면이 이미 정의해 두었는데, 보유 수량을 못 구한 것은
     * 값이 잘못된 것이 아니라 **화면이 확인하지 못한 것**이다.
     */
    onHandLoading: '불러오는 중',
    onHandUnknown: '확인하지 못함',
    /*
     * 「값이 없는 자리」 표기(「—」)를 두지 않는다 — 이 화면이 그리는 값에 nullable이 하나도
     * 없다. 계획 §4.1의 PR ②·③ 표에도 그런 자리가 없다. 쓰이지 않는 문구를 미리 두면
     * 나중에 「없음」과 「못 풀었음」이 같은 글자로 뭉개진다.
     */
    inactiveSuffix: ' (미사용)',
    /** 자재 LOT이 보류 중임을 밝히는 표식. **색에만 기대지 않는다** — 글자로 낸다. */
    lotHeld: '보류',
    /**
     * 확인 창이 참·거짓을 글자로 낸다. **체크 표시만으로 내지 않는다** — 되돌릴 수 없는
     * 조작을 확인하는 자리라 「켜져 있음」이 눈에 읽혀야 한다.
     */
    yes: '예',
    no: '아니요',
    /** 값이 없는 칸. 비워 두면 빠뜨린 것인지 없는 것인지 구분되지 않는다. */
    empty: '없음',
  },
  pageNav: {
    label: '쪽 이동',
    range: (from: number, to: number, total: number): string =>
      `${String(from)}–${String(to)} / 전체 ${String(total)}건`,
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
} as const;

/**
 * W-01-06 폐기 품의·기타출고. **이 회차(PR ②)는 고른 전표의 어느 줄을 얼마나 폐기할지
 * 정하는 데까지다** — 처리 이력·품의 등록·상신·기타출고 처리의 문구는 뒤 회차가 더한다.
 * 지금 없는 어휘가 있는 것이 이 블록의 정확한 상태다.
 *
 * **코드 값을 지어내지 않는다.** 입고 유형·상태·창고 유형의 값 목록이 확정되지 않아 선택지가
 * 비어 있고, 왜 비었는지는 공용 `pendingCode`가 말한다. 계약의 예시값도 문구로 옮기지 않는다.
 *
 * **내부 번호를 문구로 만들지 않는다.** 창고 이름을 못 풀면 그 사실을 적고 번호를 대신 내지
 * 않는다 — 번호를 담을 자리가 문구에도 없어야 새는 경로가 없다.
 *
 * **화면이 아는 것만 말한다.** 「이 창고가 불량창고입니다」라고 말하지 않는다 — 창고 유형의
 * 값 목록이 아직 없어 화면이 그것을 판정할 근거가 없다.
 */
const disposalIssue = {
  title: '폐기 품의·기타출고',
  breadcrumbRoot: '자재창고',
  panes: {
    list: '폐기 대상 입고 전표 목록',
    /** 고른 전표의 제목줄과 라인 표가 함께 서는 구획. 폐기 정보 구획은 뒤 회차에 생긴다. */
    lines: '고른 입고 전표',
    /** 「처리 이력」 탭의 조건 줄과 출고 전표 목록. */
    historyList: '처리 이력 목록',
    /** 고른 폐기 요청의 제목줄·라인 표·결재 진행이 함께 서는 구획. */
    historyDetail: '고른 폐기 요청',
  },
  /**
   * 탭 둘. **차례가 곧 업무 차례다** — 폐기를 요청하고, 올라간 요청을 나중에 처리한다.
   *
   * **탭 줄에 「결재는 결재함에서 합니다」를 밝힌다.** 이 화면은 승인·반려를 하지 않고
   * 결재 진행을 읽기만 한다 — 밝히지 않으면 사용자가 여기서 결재할 수 있다고 믿고
   * 있지도 않은 승인 버튼을 찾아 헤맨다.
   *
   * **탭 줄의 접근 이름을 화면 제목에서 짓지 않는다.** 제목은 설계 정본의 이름이라 이 회차가
   * 바꾸지 않는데(결정 D-2), 그 이름을 여기 되풀이하면 본문이 쓰는 낱말과 갈린다 — 이 줄이
   * 무엇을 가르는지는 **탭 둘의 이름**이 가장 정확히 말한다.
   *
   * **「탭」으로 끝내지 않는다.** 이 값은 `role="tablist"`의 접근 이름으로 실리고 역할은
   * 스크린리더가 스스로 읽는다 — 접미사를 붙이면 「… 탭, 탭 목록」으로 두 번 들린다.
   * 이 저장소의 다른 탭 줄 이름 넷도 전부 접미사가 없다(실측).
   */
  tabs: {
    label: '폐기 요청·처리 이력',
    disposal: '폐기 요청',
    history: '처리 이력',
    note: '결재는 결재함에서 합니다. 이 화면은 폐기 요청을 올리고, 승인이 끝난 요청을 기타출고로 처리합니다.',
  },
  fields: {
    warehouse: '창고',
    /**
     * 계약의 `receiptDateFrom`·`receiptDateTo`를 **한 컨트롤**이 함께 고른다.
     * **기본 기간을 심지 않는다**(W-01-09가 세운 규칙).
     */
    period: '입고일',
    /** 값 목록이 확정되지 않아 선택지가 비어 있다 — 안내는 `pendingCode`가 맡는다. */
    receiptType: '입고 유형',
    status: '상태',
    q: '입고번호 검색',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    /** 화면이 보고 있는 조회를 전부 다시 한다 — 목록만 다시 부르면 낡은 값과 새 값이 섞인다. */
    refresh: '다시 조회',
    select: '선택',
    deselect: '선택 해제',
    /*
     * 행 안의 버튼은 보이는 글자가 행마다 같다. 접근 이름에 입고번호를 넣어 어느 건인지 밝히되,
     * 보이는 글자를 그대로 담는다 — 담지 않으면 음성 조작이 「선택」으로 이 버튼을 부를 수 없다.
     * **내부 번호를 접근 이름에 넣지 않는다** — 그것이 화면 밖으로 새는 또 하나의 경로다.
     */
    selectRow: (goodsReceiptNo: string): string => `${goodsReceiptNo} 선택`,
    deselectRow: (goodsReceiptNo: string): string => `${goodsReceiptNo} 선택 해제`,
    /** 이력 목록 행의 버튼. 같은 이유로 **출고번호**를 접근 이름에 넣는다. */
    selectIssueRow: (goodsIssueNo: string): string => `${goodsIssueNo} 선택`,
    deselectIssueRow: (goodsIssueNo: string): string => `${goodsIssueNo} 선택 해제`,
    /**
     * **버튼 하나가 요청 둘을 잇는다**(승인 기록 정정 1-1) — 전표를 만들고 곧바로 승인을
     * 요청한다. 「등록」과 「요청」으로 나누어 적지 않는 이유는 사용자의 목적이 하나이기
     * 때문이고, 둘 중 하나만 이루어진 중간 상태는 **결과 구획이 정확히 말한다.**
     *
     * **MES는 품의서를 기안하지 않는다**(변경 통지 #124) — 이 화면의 승인 축은
     * 「작업자 요청 → 권한자 승인」이고 버튼 이름이 그 사실을 그대로 적는다.
     */
    submitDisposal: '승인 요청',
    /**
     * 이력 탭의 미요청 전표를 이어서 올린다. **「요청」이 아니라 「재요청」이다** —
     * 이 자리에 오는 전표는 전표 생성까지는 끝났고 승인 요청만 남은 것이라, 사용자가 무엇을
     * 되풀이하는지 낱말이 밝힌다.
     */
    resubmit: '재요청',
    /**
     * 승인이 끝난 폐기 요청을 실제 출고로 처리한다 — **이 화면에서 재고를 움직이는 유일한 조작**이다.
     * 「처리」로만 적지 않는 이유는 무엇으로 처리하는지가 낱말에 있어야 하기 때문이다.
     */
    postIssue: '기타출고 처리',
    /** 처리 확인 창의 바닥 버튼. 「확인」으로 적지 않는다 — 무엇을 누르는지가 낱말에 있어야 한다. */
    confirmPost: '처리',
    /** 되돌릴 수 없는 조작의 창에서 물러나는 길. 요청 창의 「계속 작성」과 쓰임이 다르다. */
    keepReviewing: '다시 확인',
    discardDrafts: '입력 지우기',
    /** 창의 바닥 버튼. 「확인/취소」로 적지 않는다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */
    keepEditing: '계속 작성',
    confirmSubmit: '요청',
    confirmDiscard: '지우기',
    /** 만들어진 요청을 이력 탭에서 연다. **탭을 말없이 바꾸지 않는다**(계획 결정 6). */
    openIssue: '이 요청 열기',
  },
  /** 폐기 수량 칸의 오류. **줄마다 그 칸 아래에 선다** — 어느 줄이 잘못됐는지 표에서 읽힌다. */
  errors: {
    qtyNotNumber: '폐기 수량은 숫자로 적어 주세요.',
    /**
     * 계약이 `issueQty`에 `exclusiveMinimum: 0`을 두어 **0도 보낼 수 없다.** 「0개를 폐기한다」는
     * 뜻이 없고 서버가 400으로 되돌린다 — 재고실사(`minimum: 0`)와 갈리는 자리다.
     */
    qtyNotPositive: '폐기 수량은 0보다 커야 합니다.',
    /**
     * 상한을 **확인한 줄에서만** 뜬다. 확인하지 못한 줄은 이 오류를 내지 않는다 —
     * 모르는 것을 근거로 막으면 화면이 확인하지 않은 것을 말하는 것이 된다.
     */
    qtyOverOnHand: (onHandQty: number): string =>
      `보유 수량 ${String(onHandQty)}보다 많이 폐기할 수 없습니다.`,
    /**
     * 코드 길이 상한. **보낼 값의 길이를 잰다** — 요청 조립이 앞뒤 공백을 떼고 보내므로
     * 재는 값도 뗀 값이어야 「50자로 보내는데 화면은 51자라고 막는」 어긋남이 없다.
     */
    codeTooLong: (max: number): string => `${String(max)}자 이내로 적어 주세요.`,
    /**
     * 요청 사유가 비었다. **공백만도 여기 온다** — 목이 공백만인 사유를 202로 통과시키므로
     * (실측) 막는 곳이 화면뿐이다. 인라인으로 내는 이유는 고칠 자리가 그 칸이기 때문이다.
     */
    reasonRequired: '요청 사유를 적어 주세요. 공백만으로는 승인을 요청할 수 없습니다.',
  },
  filters: {
    all: '전체',
    /**
     * 기본 기간을 심지 않는다는 사실은 화면에서 읽혀야 한다 — 비어 있는 것이 고장으로
     * 읽히지 않게 한다.
     *
     * **화면이 확인한 것만 말한다.** 계약의 입고 목록에서 입고일 두 조건은 기본값이 선언되지
     * 않은 순수 선택 파라미터이고(같은 오퍼레이션의 쪽·쪽 크기에는 기본값이 적혀 있다),
     * 화면은 기간이 비면 날짜 키를 아예 싣지 않는다 — 「서버가 정한 기본 범위」가 실재하는지
     * 화면도 계약도 말할 수 없다. 있지도 않은 범위를 적으면 사용자가 결과가 잘린 줄 알고
     * 조건을 잘못 넓힌다. 저장소가 이미 쓰고 있는 표현(입하 예정·생산 계획)에 맞춘다.
     */
    periodNote: '입고일을 비워 두면 기간을 좁히지 않고 전체를 봅니다.',
    /**
     * 기간 칩에만 해제 버튼이 없는 이유.
     *
     * 날짜 컨트롤이 한 번 고른 값을 개별로 비우는 수단을 아직 주지 않아, 기간을 푸는 길이
     * 「초기화」뿐이다. 사용자가 ×를 찾다가 못 찾는 것보다 왜 없는지를 밝히는 편이 낫다.
     */
    periodClearNote: '입고일은 「초기화」로만 비울 수 있습니다. 다른 조건은 조건표의 ×로 풉니다.',
    lookupFailed: '이름 목록을 불러오지 못했습니다. 다시 시도해 주세요.',
    lookupTruncated:
      '이름 목록이 일부만 왔습니다. 찾는 값이 목록에 없을 수 있습니다 — 없어진 것이 아닙니다.',
    /**
     * **창고를 화면이 좁히지 못한다는 사실을 밝힌다.**
     *
     * 폐기 대상은 불량 판정을 받아 들어온 자재이고 그것이 놓이는 창고가 정해져 있으나,
     * 창고 유형의 값 목록이 아직 없어 「이 창고가 그 창고인가」를 화면이 판정할 수 없다.
     * 감추고 전체를 보이면 사용자는 목록이 좁혀진 것으로 읽는다 — **좁히지 못했다는 사실이
     * 화면에 있어야** 사용자가 자기 눈으로 고른다.
     */
    warehouseTypePending:
      '폐기 대상 창고를 화면이 가려내지 못해 모든 창고를 보입니다. 폐기할 자재가 놓인 창고를 직접 고르세요.',
    chipWarehouse: (name: string): string => `창고: ${name}`,
    chipPeriodBoth: (from: string, to: string): string => `입고일: ${from} ~ ${to}`,
    chipPeriodFrom: (from: string): string => `입고일: ${from}부터`,
    chipPeriodTo: (to: string): string => `입고일: ${to}까지`,
    chipReceiptType: (code: string): string => `입고 유형: ${code}`,
    chipStatus: (code: string): string => `상태: ${code}`,
    chipQ: (q: string): string => `검색어: ${q}`,
    chipRemoveWarehouse: '창고 조건 해제',
    chipRemoveReceiptType: '입고 유형 조건 해제',
    chipRemoveStatus: '상태 조건 해제',
    chipRemoveQ: '검색어 조건 해제',
  },
  /**
   * 「처리 이력」 탭의 조회 조건.
   *
   * **대상 조건과 키를 갈라 둔다**(`historyFields` ↔ `fields`). 두 탭이 같은 낱말을 쓰면
   * 한쪽 문구만 고치는 순간 다른 탭이 조용히 따라 바뀐다 — 「입고일」과 「출고일」이 그 자리다.
   *
   * **창고 조건이 없다.** 계약의 출고 목록에 `sourceWarehouseId`가 있으나 이 탭의 조건 축은
   * **폐기 사유**다(계획 §5.5) — 창고는 열로만 보인다. 조건을 늘리는 것보다 줄이는 것이 먼저다.
   */
  historyFields: {
    period: '출고일',
    issueType: '출고 유형',
    reason: '폐기 사유',
    status: '상태',
    q: '출고번호 검색',
  },
  historyFilters: {
    periodNote: '출고일을 비워 두면 기간을 좁히지 않고 전체를 봅니다.',
    periodClearNote: '출고일은 「초기화」로만 비울 수 있습니다. 다른 조건은 조건표의 ×로 풉니다.',
    chipPeriodBoth: (from: string, to: string): string => `출고일: ${from} ~ ${to}`,
    chipPeriodFrom: (from: string): string => `출고일: ${from}부터`,
    chipPeriodTo: (to: string): string => `출고일: ${to}까지`,
    chipIssueType: (code: string): string => `출고 유형: ${code}`,
    chipReason: (code: string): string => `폐기 사유: ${code}`,
    chipStatus: (code: string): string => `상태: ${code}`,
    chipQ: (q: string): string => `검색어: ${q}`,
    chipRemoveIssueType: '출고 유형 조건 해제',
    chipRemoveReason: '폐기 사유 조건 해제',
    chipRemoveStatus: '상태 조건 해제',
    chipRemoveQ: '검색어 조건 해제',
  },
  loading: {
    goodsReceipts: '폐기 대상 입고 전표 목록을 불러오는 중',
    detail: '고른 입고 전표를 불러오는 중',
    goodsIssues: '처리 이력 목록을 불러오는 중',
    issueDetail: '고른 폐기 요청을 불러오는 중',
    /** 결재 진행만 늦게 오는 일이 흔하다 — 그 구획 안에서만 뼈대를 세운다. */
    approvalRequest: '결재 진행을 불러오는 중',
  },
  empty: {
    noResultTitle: '조건에 맞는 입고 전표가 없습니다',
    noResultDescription: '기간을 넓히거나 조건을 풀어 다시 조회해 보세요.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '앞 쪽으로 돌아가면 결과를 볼 수 있습니다.',
    noSelectionTitle: '아직 입고 전표를 고르지 않았습니다',
    noSelectionDescription: '위 목록에서 폐기할 자재가 들어 있는 입고 전표를 고르세요.',
    noLinesTitle: '이 입고 전표에는 라인이 없습니다',
    noLinesDescription: '다른 입고 전표를 고르거나 담당자에게 확인해 주세요.',
    /**
     * 고른 번호가 서버에 없다. **다시 시도로 풀리지 않는다** — 다시 고르라고 말한다.
     *
     * 「목록을 못 불러와 고른 전표를 열 수 없다」는 갈래는 두지 않는다 — 아래 구획이 쓰는
     * 값이 전부 상세 응답에서 오므로 목록이 실패해도 고른 전표는 그대로 열린다.
     */
    notFoundTitle: '고른 입고 전표를 찾을 수 없습니다',
    notFoundDescription: '이미 지워졌거나 주소의 번호가 잘못됐습니다. 목록에서 다시 고르세요.',
    /**
     * 「처리 이력」 탭의 빈 상태. **대상 탭의 문구를 돌려쓰지 않는다** — 「입고 전표가 없다」와
     * 「폐기 요청이 없다」는 사용자가 할 조치가 다르고, 한쪽 낱말을 고칠 때 다른 탭이 따라
     * 바뀌면 안 된다.
     */
    historyNoResultTitle: '조건에 맞는 폐기 요청이 없습니다',
    historyNoResultDescription: '기간을 넓히거나 조건을 풀어 다시 조회해 보세요.',
    historyBeyondLastTitle: '이 쪽에는 결과가 없습니다',
    historyBeyondLastDescription: '앞 쪽으로 돌아가면 결과를 볼 수 있습니다.',
    historyNoSelectionTitle: '아직 폐기 요청을 고르지 않았습니다',
    historyNoSelectionDescription: '위 목록에서 내용과 결재 진행을 볼 폐기 요청을 고르세요.',
    noIssueLinesTitle: '이 폐기 요청에는 라인이 없습니다',
    noIssueLinesDescription: '다른 폐기 요청을 고르거나 담당자에게 확인해 주세요.',
    issueNotFoundTitle: '고른 폐기 요청을 찾을 수 없습니다',
    issueNotFoundDescription: '이미 지워졌거나 주소의 번호가 잘못됐습니다. 목록에서 다시 고르세요.',
  },
  /** 실패·한계 안내는 그 대상으로 시작한다(배치 규범 4). */
  reasons: {
    /**
     * **문구에 적은 대상과 「다시 시도」가 다시 부르는 대상이 같아야 한다.** 다르면 눌러도
     * 한쪽은 실패인 채로 남는데 문구는 둘 다 고쳐질 것처럼 말한다.
     */
    referencesFailed: '창고 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    lineReferencesFailed:
      '품목·단위·자재 LOT·위치 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    /**
     * **잘림은 실패와 다르다.** 이름 목록이 앞쪽만 오면 그 뒤의 정상 값이 「알 수 없음」으로
     * 찍히는데, 그 문구는 *값이 잘못됐다*는 뜻이라 사용자가 반대로 읽는다.
     * 다시 불러도 같은 쪽이 오므로 복구 버튼을 붙이지 않고 사실만 밝힌다.
     */
    lineReferencesTruncated:
      '품목·단위·자재 LOT·위치 이름 목록이 일부만 왔습니다. 이름 자리의 「알 수 없음」은 값이 잘못된 것이 아니라 이 목록에 아직 없다는 뜻일 수 있습니다.',
    /**
     * 줄을 고를 수 없는 사유 둘. **상태 코드로 판정하지 않는다**(공유계약 G-2) —
     * 계약이 폐기 라인에 요구하는 값이 실제로 있는가만 본다.
     */
    lineMissingValues: '이 줄에는 폐기에 필요한 값(품목·자재 LOT·단위·위치)이 빠져 있습니다.',
    lineQtyNotPositive: '입고 수량이 0 이하라 폐기할 것이 없습니다.',
    /** 다음 단계로 갈 수 없는 사유 셋. **판정은 한 곳에서 나온다**(disposal-selection.ts). */
    selectNone: '폐기할 줄을 하나 이상 고르세요.',
    selectQtyMissing: '고른 줄의 폐기 수량을 채우세요.',
    selectQtyInvalid: '폐기 수량에 오류가 있는 줄이 있습니다. 그 줄부터 고치세요.',
    /**
     * 보유 수량 조회의 실패·잘림. **이름 참조와 따로 낸다** — 이름은 「누구인가」이고
     * 보유 수량은 「얼마까지 폐기할 수 있는가」라, 못 받았을 때 사용자가 할 판단이 다르다.
     */
    balancesFailed: '보유 수량을 불러오지 못했습니다. 그 줄의 보유 수량 자리에 사유가 표시됩니다.',
    balancesTruncated:
      '보유 수량 목록이 일부만 왔습니다. 합계가 실제보다 적을 수 있어 그 줄의 상한으로 쓰지 않습니다.',
    /**
     * **막지 않는다는 사실을 밝힌다**(계획 결정 4). 상한은 보조 정보이고 최종 판정은 서버가
     * 한다 — 확인하지 못했다고 막으면 LOT이 많은 창고에서 정당한 폐기가 영영 불가능해진다.
     * 초과분은 서버가 400으로 되돌리며 그 실패는 되돌릴 수 있다.
     */
    onHandUnknownNote:
      '보유 수량을 확인하지 못한 줄은 화면이 상한으로 막지 않습니다. 보낸 뒤 서버가 최종 판정합니다.',
  },
  /** 목록 표의 머리글. 열 구성과 폭의 근거는 screens/disposal-issue/gr-table.tsx에 있다. */
  table: {
    goodsReceiptNo: '입고번호',
    warehouse: '창고',
    receiptType: '입고 유형',
    receiptDatetime: '입고 일시',
    status: '상태',
    select: '선택',
  },
  /**
   * 라인 표의 머리글과 칸 문구. 폭의 근거는 screens/disposal-issue/gr-line-table.tsx에 있다.
   *
   * **품목·자재 LOT·보유 수량 세 열이 여기 있는 것이 이 표의 요점이다.** 대상 표(6열)는
   * 전표 한 건을 고르는 자리이고, 「무엇을·어느 LOT을·얼마나」는 전표에 매인 라인 수준의
   * 값이라 전표 목록 응답에 없다 — 두 표가 함께 그 셋을 실현한다(승인 기록 정정 2).
   */
  lineTable: {
    select: '선택',
    item: '품목',
    lot: '자재 LOT',
    location: '위치',
    receiptQty: '입고 수량',
    onHandQty: '보유 수량',
    disposalQty: '폐기 수량',
    /** 「100 SAMPLE-EA」 — 단위 열을 따로 두지 않고 수량 표기에 붙인다(W-01-03이 세운 처리). */
    receiptQtyPair: (receiptQty: number, uom: string): string => `${String(receiptQty)} ${uom}`,
    /**
     * 보유 수량 표기. **입고 수량과 글자 모양이 같아도 뜻이 다르다** — 이쪽은 지금 창고에
     * 남아 있는 양이고 폐기 수량의 상한이다. 키를 갈라 두면 한쪽 문구만 고칠 수 있다.
     */
    onHandQtyPair: (onHandQty: number, uom: string): string => `${String(onHandQty)} ${uom}`,
    /**
     * 표 안 컨트롤의 접근 이름. 보이는 글자가 줄마다 같으므로 **어느 줄인지**를 이름에 넣는다.
     *
     * **표시 순번을 쓴다.** 이 표에는 줄번호 열이 없고(계획 §5.5) 품목·LOT은 이름이 아직
     * 안 풀렸거나 줄끼리 겹칠 수 있어 줄을 가르지 못한다. 내부 번호를 넣지 않는 것은
     * 그것이 화면 밖으로 새는 또 하나의 경로이기 때문이다(`omf-mes#44`).
     */
    selectLabel: (ordinal: number): string => `${String(ordinal)}번째 줄 선택`,
    disposalQtyLabel: (ordinal: number): string => `${String(ordinal)}번째 줄 폐기 수량`,
  },
  /** 고른 줄의 요약. **서버에 보낼 것과 같은 수를 낸다** — 화면이 따로 세면 둘이 갈린다. */
  selection: {
    none: '아직 고른 줄이 없습니다.',
    summary: (count: number, totalQty: number, uom: string): string =>
      `고른 ${String(count)}줄 · 폐기 수량 합계 ${String(totalQty)} ${uom}`,
    /**
     * **단위가 섞이면 합계를 내지 않는다.** 100 개와 5 상자를 더한 105는 어떤 뜻도 없고,
     * 화면이 확인하지 않은 것을 말하는 것이 된다. 줄 수는 그대로 낸다.
     */
    summaryMixedUom: (count: number): string =>
      `고른 ${String(count)}줄 · 단위가 섞여 합계를 내지 않습니다`,
  },
  /** 고른 입고 전표의 제목줄. */
  summary: {
    label: '고른 입고 전표',
    goodsReceiptNo: '입고번호',
    warehouse: '창고',
    receiptDatetime: '입고 일시',
    receiptType: '입고 유형',
    status: '상태',
  },
  /**
   * 폐기 요청 정보 폼의 칸 이름.
   *
   * **조회 조건의 `fields`와 갈라 둔다** — 낱말이 겹쳐도 고치는 자리가 다르다. 조건 줄의
   * 「상태」를 고치면서 폼의 라벨이 함께 바뀌면 안 된다.
   *
   * **「요청 사유」와 「폐기 사유」가 다른 값이다.** 앞은 결재에 올리는 문장(계약의
   * `ApprovalRequestCreate.reason`)이고 뒤는 전표의 사유 코드(`reasonCode`)다 — 낱말이 비슷해
   * 사용자가 헷갈리는 자리라 라벨과 보조 문구가 그 차이를 말한다.
   *
   * **「폐기 계정」·「도착지 유형」 라벨이 없다**(변경 통지 #124·#128). 회계 계정은 MES 밖의
   * 값이라 자리째 없앴고, 도착지 유형은 짝인 도착지 식별자를 공급할 자리가 함께 사라져
   * 한쪽만 실린 전표가 만들어지지 않게 같이 없앴다.
   */
  formFields: {
    issueType: '출고 유형',
    sourceDocumentType: '원천 문서 유형',
    reason: '폐기 사유',
    issuedDate: '출고 일자',
    issuedTime: '출고 시각',
    /** 확인 창에만 나오는 라벨 — 폼에는 칸이 없다(출고 일자에서 파생한다). */
    businessDate: '영업일',
    remarks: '비고',
    /**
     * 폐기한 물건을 **누가 가져갔는가**(변경 통지 #128). ⭐ #124로 뺀 「폐기 계정」과 다른
     * 것이다 — 회계 계정은 여전히 MES 밖이고, 이것은 **거래처**다.
     *
     * 체크와 선택칸이 **짝으로** 서는 이유: 나가는 본문에서 「아직 안 골랐다」와 「자체
     * 폐기라 없다」가 똑같이 「도착지 두 키 없음」으로 보여, 체크가 없으면 화면이 그 둘을
     * 가를 수 없다.
     */
    selfDisposal: '자체 폐기(외부 업체 없음)',
    disposalPartner: '폐기 거래처',
    /** 확인 창의 도착지 한 줄 라벨 — 체크와 선택칸 **둘의 결과**를 한 값으로 보인다. */
    destination: '도착지',
    submitReason: '요청 사유',
  },
  form: {
    label: '폐기 요청 정보',
    /**
     * 사유 형식을 **유도한다**(공유계약 A-12 · 착수 이슈 §6). 길이를 강제하지 않는 대신
     * 예시와 보조 문구로 이끈다 — 두 글자짜리 사유는 결재함에서 아무 정보가 아니지만,
     * 몇 글자여야 하는지를 화면이 정하면 그것도 지어내는 것이다(승인 기록 §13-6).
     */
    reasonPlaceholder: '예) 불량 판정분 폐기 — 입고 검사 부적합 12박스',
    reasonHelper:
      '첫 줄이 결재함 목록의 요약이 됩니다. 무엇을·얼마나·왜 폐기하는지 첫 줄에 적으세요.',
    /** 사용자가 넣지 않은 값이 전표에 실린다 — 그 사실을 폼에서 밝힌다. */
    businessDateDerived: '영업일은 출고 일자에서 만들어 함께 보냅니다 — 따로 적는 칸이 없습니다.',
    /**
     * 자체 폐기를 체크했을 때 선택칸이 잠긴 사유. **선택지 준비 중과 갈라 둔다** — 이쪽은
     * 사용자가 정한 결과이고 저쪽은 화면의 사정이다. 같은 문구를 쓰면 체크를 풀어도 열리지
     * 않는 칸으로 읽는다.
     */
    selfDisposalChosen: '자체 폐기를 골라 폐기 거래처를 고르지 않습니다.',
    /**
     * 폐기 거래처 선택칸이 **비어 있는 사정**의 글자들(리뷰 Major B1).
     *
     * **안내(칸 아래 문장)와 자리표시(트리거에 서는 글자)가 한 사정에서 함께 나온다.** 둘을
     * 따로 정하면 한 컨트롤이 두 사실을 동시에 말한다 — 얼굴은 「준비 중」(기다리면 열린다)인데
     * 설명은 「불러오지 못했다」(다시 해야 한다)가 되는 형태가 실제로 있었다.
     *
     * **트리거 글자는 짧게, 안내는 문장으로.** 트리거는 폭에 갇혀 잘리는 자리라 사정만 적고,
     * 무엇을 할 수 있는지는 칸 아래 안내가 말한다(값 미확정 갈래의 `pendingCode` 짝과 같은 규칙).
     *
     * **불러오는 중에는 「없다」고 말하지 않는다** — 그 갈래의 글자는 참조 표기의 낱말
     * (`values.referenceLoading`)을 그대로 쓴다. **조회 실패는 다르다** — 이 칸은 안내도
     * 자리표시도 **전용 문면**을 갖는다(바로 아래 `partnerFailedNote`). 조건 줄의
     * `filters.lookupFailed`를 돌려쓰지 않기로 한 이유는 그 문면의 주석에 적혀 있다.
     */
    partnerFailedPlaceholder: '선택지를 불러오지 못함',
    /**
     * 조회가 실패했을 때의 안내 — **조건 줄의 「이름 목록」 문구를 돌려쓰지 않는다**(리뷰 R-M1).
     *
     * ⛔ 그 문구는 「**다시 시도해 주세요**」로 끝나는데 **이 칸에는 다시 시도가 없다**
     * (`PartnerLookupResult`가 `refetch`를 타입째 내지 않는다 · 참조 표의 복구 칸이
     * 「없음(전표 재선택)」이다). 할 수 없는 조치를 지시하면 사용자는 찾지 못할 버튼을 찾는다.
     * 그래서 **실제로 할 수 있는 것**(자체 폐기)을 가리키고, 낱말도 같은 컨트롤의 자리표시와
     * 맞춰 **「선택지」**로 통일한다 — 한 칸이 두 이름으로 같은 것을 부르지 않는다.
     */
    partnerFailedNote: '선택지를 불러오지 못했습니다. 자체 폐기로는 올릴 수 있습니다.',
    /**
     * 목록이 **앞쪽 일부만** 온 갈래. 계약에 번호로 한 건을 받는 경로가 없어 뒤쪽 거래처는 고를
     * 길이 아예 없다 — 감추면 사용자가 「그런 거래처가 없다」로 결론짓는다. **칸은 열려 있다.**
     *
     * 같은 이유로 조건 줄의 「이름 목록」 문구를 돌려쓰지 않는다 — 낱말을 「선택지」로 맞춘다.
     */
    partnerTruncatedNote:
      '선택지가 앞쪽 일부만 왔습니다. 찾는 거래처가 없으면 담당자에게 알려 주세요.',
    /**
     * 목록은 **왔는데 0건**인 갈래. 「준비 중」과 갈라 둔다 — 이쪽은 기다려도 열리지 않는다.
     * 그때도 자체 폐기로는 올릴 수 있다는 사실을 함께 적는다(#128 §3 ⭐).
     */
    partnerEmptyNote: '고를 수 있는 폐기 거래처가 없습니다. 자체 폐기로는 올릴 수 있습니다.',
    partnerEmptyPlaceholder: '고를 수 있는 거래처 없음',
    /**
     * **도착지를 발의 시점에 정한다는 사실을 밝힌다.**
     *
     * 계약에 전표 헤더를 고치는 경로가 없어(실측) 도착지는 **전표를 만들 때만** 실린다 —
     * 승인 뒤에 바꿀 수 있다고 믿으면 사용자는 지금 고르지 않고 넘어간다.
     */
    destinationNote:
      '도착지는 승인 요청 때 전표와 함께 보냅니다 — 승인 뒤에는 이 화면에서 바꿀 수 없습니다.',
    /**
     * ERP 송신 토글을 두지 않는다(계획 결정 5 · 승인 기록 13-9). 폐기 출고를 ERP로 보내는지
     * 착수 이슈가 말하지 않아 화면이 정하지 않는다 — 정하지 않았다는 사실을 적는다.
     */
    sendToErpNote: 'ERP 송신 여부는 이 화면이 정하지 않습니다 — 서버 기본을 따릅니다.',
    /**
     * **한 번 눌러 요청이 둘 나간다**는 사실을 버튼 앞에서 밝힌다. 밝히지 않으면 「승인을
     * 요청했는데 전표만 생겼다」는 중간 실패가 사용자에게는 까닭 없는 일이 된다.
     */
    chainNote:
      '「승인 요청」을 누르면 폐기 요청 전표를 만들고 이어서 결재에 올립니다. 이때는 재고가 움직이지 않습니다 — 승인이 끝난 뒤 「기타출고 처리」에서 움직입니다.',
  },
  /**
   * 잠긴 액션의 사유. **사유 없이 잠그지 않는다**(배치 규범 4) — 무엇을 해야 풀리는지
   * 잠근 자리 옆에서 읽혀야 한다.
   *
   * **차례가 뜻을 정한다.** 값 목록이 없다는 사정이 가장 앞이다 — 그 상태에서는 나머지를
   * 아무리 채워도 열리지 않으므로, 다른 사유를 먼저 내면 할 수 없는 조치를 가리키게 된다.
   */
  actionReasons: {
    codeListPending:
      '폐기 요청에 필요한 코드 값이 아직 확정되지 않아 승인을 요청할 수 없습니다. 대상 확인까지는 지금도 할 수 있습니다.',
    needsCodes: '폐기 요청 정보의 코드를 모두 고르세요.',
    needsIssuedDate: '출고 일자를 고르세요.',
    needsIssuedTime: '출고 시각을 적으세요.',
    /**
     * 도착지를 정하지 않았고 **선택칸은 열려 있다**(변경 통지 #128 §4 ⛔의 문면 그대로).
     *
     * 「아직 안 골랐다」와 「자체 폐기라 없다」를 가르기 위한 잠금이라 두 길을 함께 가리킨다 —
     * 한쪽만 적으면 자체 폐기로 올리려는 사용자가 없는 거래처를 찾는다.
     */
    needsDisposalDestination: '폐기 거래처를 고르거나 자체 폐기를 체크하십시오.',
    /**
     * 같은 잠금이되 **선택칸이 잠겨 있을 때**의 사유. 역할 코드가 확정되지 않아 고를 것이
     * 하나도 없는 상태다.
     *
     * **고를 것이 없는 사용자에게 「고르세요」라고 말하지 않는다** — 사용자는 자기가 놓친 것을
     * 찾다가 화면을 고장으로 읽는다. 그래서 지금 실제로 할 수 있는 조치(자체 폐기 체크)만
     * 가리킨다. 선택지가 차면 위 문구로 저절로 바뀐다.
     */
    disposalPartnerPending:
      '폐기 거래처 선택지가 아직 준비되지 않았습니다. 자체 폐기를 체크하면 올릴 수 있습니다.',
    /**
     * 같은 잠금의 **셋째 갈래** — 목록을 부르기는 했으나 **지금 고를 것이 없다**(불러오지
     * 못했거나 · 오는 중이거나 · 0건이거나).
     *
     * 「아직 준비되지 않았습니다」와 갈라 둔다: 저쪽은 **값 목록이 확정되면** 열린다는 뜻이라
     * 기다리면 된다고 읽히는데, 이쪽은 기다린다고 열린다는 보장이 없다. 왜 없는지는 그 칸의
     * 안내·자리표시가 갈라 말하고(`form.partner*`), 버튼 옆 사유는 **지금 할 수 있는
     * 조치**(자체 폐기 체크)만 가리킨다.
     */
    disposalPartnerUnavailable:
      '지금 고를 수 있는 폐기 거래처가 없습니다. 자체 폐기를 체크하면 올릴 수 있습니다.',
    needsReason: '요청 사유를 적으세요.',
    nothingToDiscard: '지울 입력이 없습니다.',
    /**
     * 이미 올라간 요청에는 재요청을 열지 않는다 — 되풀이하면 결재 요청이 두 벌이 된다.
     *
     * 문서를 가리키는 명사는 **「전표」**다. 「건」은 이 블록에서 세는 단위로만 쓰고
     * (`보낼 줄 3건`), 옆 사유(`postNeedsSubmission`)와 명사를 맞춘다.
     */
    alreadySubmitted:
      '이미 승인을 요청한 전표입니다. 아래 결재 진행에서 어디까지 왔는지 볼 수 있습니다.',
    /**
     * 승인 요청 여부를 확인할 수 없는 전표(`approval-progress.ts`의 셋째 갈래). **미요청으로
     * 접지 않는다** — 값이 실려 온 이상 이미 올라갔을 수 있고, 그때 재요청하면 결재 요청이
     * 두 벌이 된다.
     */
    submissionUnknown:
      '승인 요청 여부를 확인할 수 없어 재요청을 열지 않습니다. 담당자에게 확인해 주세요.',
    /**
     * 보내는 동안에는 만들어진 요청을 열지 않는다. 대상을 바꾸는 길이 전부 **한 문**을
     * 지나므로 이 조작도 그 문에서 막히는데, 잠그지 않으면 **눌러도 아무 일이 없는 버튼**이
     * 된다 — 이 저장소가 되풀이해 결함으로 부르는 형태다.
     */
    openIssueLocked: '보내는 동안에는 다른 자리로 옮길 수 없습니다. 끝나면 열립니다.',
    /**
     * 승인 요청조차 올리지 않은 전표는 승인이 있을 수 없다 — **화면이 값 유무로 확실히 아는
     * 사실**이라 여기서는 잠근다(완료 조건 C69). 「승인이 끝났는가」를 모르는 것과 성질이 다르다.
     */
    postNeedsSubmission:
      '아직 승인을 요청하지 않은 전표입니다. 위에서 승인을 요청하면 결재가 시작되고, 승인이 끝나야 처리할 수 있습니다.',
    /**
     * **자리표시가 채워졌을 때만 나오는 사유**(전환 감지기 M64). 그전까지 화면은 승인 여부를
     * 판정하지 못해 잠그지 않는다.
     */
    postNotApproved: '아직 승인이 끝나지 않았습니다. 승인이 끝나면 이 자리에서 처리할 수 있습니다.',
    /** 보내는 동안에는 다시 누르지 못한다 — 멱등 키가 호출마다 새로 만들어져 두 번 나가면 두 번 움직인다. */
    postLocked: '보내는 동안에는 다시 누를 수 없습니다. 끝나면 열립니다.',
  },
  /**
   * 확인 창 셋.
   *
   * **되돌릴 수 없는 조작 앞의 마지막 층이다.** 승인 요청은 되돌릴 수 없고(반려된 뒤 다시
   * 올리는 것은 **새 요청**이다) 그 뒤의 기타출고 처리는 재고를 움직인다 — 무엇이 나가는지
   * 여기서 한 번 더 보인다. **창 안에 선택칸을 두지 않는다**(`omf-mes#45`) — 고칠 것이 있으면
   * 닫고 폼에서 고친다.
   */
  dialog: {
    submitTitle: '폐기 요청을 올릴까요?',
    submitLead: '아래 내용으로 폐기 요청 전표를 만들고 이어서 결재에 올립니다.',
    resubmitTitle: '이 폐기 요청을 결재에 올릴까요?',
    resubmitLead: '이미 만들어진 폐기 요청 전표를 결재에 올립니다. 전표를 새로 만들지 않습니다.',
    discardTitle: '입력한 것을 지울까요?',
    /** 줄마다 다시 보인다 — 합계만 보이면 어느 줄이 얼마인지 확인할 수 없다. */
    lineCount: (count: number): string => `보낼 줄 ${String(count)}건`,
    /**
     * **단위가 섞이면 합계를 내지 않는다.** 100 개와 5 상자를 더한 105는 어떤 뜻도 없고,
     * 화면이 확인하지 않은 것을 말하는 것이 된다 — 줄 수는 그대로 보인다.
     */
    mixedUom: '단위가 섞여 합계를 내지 않습니다',
    linePair: (item: string, lot: string, qty: string): string => `${item} · ${lot} · ${qty}`,
    /** 파생값임을 **값 자체가** 밝힌다 — 라벨만으로는 사용자가 자기가 넣은 값으로 읽는다. */
    businessDateDerived: (businessDate: string): string => `${businessDate} (출고 일자에서 만듦)`,
    /** 사유 전문과 첫 줄을 **나눠** 보인다(완료 조건 C62) — 요약이 될 줄이 어느 것인지 보여야 한다. */
    reasonFull: '요청 사유 전문',
    reasonFirstLine: '결재함 목록에 요약으로 보일 첫 줄',
    reasonSummaryNote: '첫 줄이 결재함 목록의 요약이 됩니다.',
    submitEffects: '지금은 재고가 움직이지 않습니다. 승인 뒤 「기타출고 처리」에서 움직입니다.',
    /**
     * **승인 요청은 되돌릴 수 없다.** 계약의 출고 취소는 다시 결재를 타며 이 화면에 없다 —
     * 반려된 뒤 다시 올리는 것도 **새 요청**이다(스펙 §6).
     */
    submitNoUndo:
      '승인 요청은 되돌릴 수 없습니다. 반려되면 다시 올릴 수 있으나 그때는 새 요청이 됩니다.',
    /** 상한을 확인하지 못한 줄이 **보낼 줄에 섞여 있을 때만** 밝힌다. */
    submitOnHandUnknown:
      '보유 수량을 확인하지 못한 줄이 섞여 있습니다. 수량은 서버가 최종 판정합니다.',
    /**
     * 기타출고 처리 확인 — **이 화면에서 재고를 움직이는 유일한 창이다.**
     *
     * 상시 문구와 **낱말을 갈라 둔다.** 같은 문장을 두 자리에 두면 사용자가 창을 문구의
     * 되풀이로 읽고 넘긴다 — 여기서 말하는 것은 「지금 누르면」이고, 상시 문구가 말하는 것은
     * 「이 버튼이 하는 일」이다.
     */
    postTitle: '기타출고로 처리할까요?',
    postLead: '아래 폐기 요청을 실제 출고로 처리합니다.',
    postDeducts: '확인을 누르면 이 전표의 수량만큼 재고가 차감됩니다.',
    postNoUndo:
      '이 화면에는 되돌리는 수단이 없습니다. 되돌리려면 출고 취소가 필요하고 그것은 다시 결재를 탑니다.',
    /** 자리표시가 비어 있을 때만 선다 — 화면이 확인하지 못한 것을 창에서 한 번 더 밝힌다. */
    postJudgePending:
      '승인 여부를 화면이 판정하지 못했습니다. 승인 전이면 서버가 처리를 거절합니다.',
    /** 결재 진행을 못 읽은 채 처리하는 갈래(403·404·네트워크·부르는 중). */
    postProgressUnread: '결재 진행을 확인하지 못한 채 처리합니다.',
    /**
     * **이미 원장에 간 줄이 있는 전표**(값 유무로 판정 — `inventoryTransactionLineId`).
     * 막지는 않는다: 서버가 정본이고 화면이 지어낸 잠금은 정당한 조작까지 막는다. 다만
     * **한 번 더 움직일 수 있다는 사실**은 되돌릴 수 없는 조작 앞에서 반드시 읽혀야 한다.
     */
    postAlreadyPosted:
      '이 전표에는 이미 전기된 줄이 있습니다. 다시 처리하면 재고가 한 번 더 움직일 수 있습니다.',
    /** 요청 사유 첫 줄. **결재 진행에서 읽은 값이다** — 못 읽었으면 이 자리가 서지 않는다. */
    postReasonFirstLine: '요청 사유 첫 줄',
  },
  /**
   * 결과 구획 — **화면이 확인한 것만 말한다**(계획 결정 15).
   *
   * 이 구획의 중심은 **중간 상태를 숨기지 않는 것**이다(승인 기록 정정 1-1). 요청이 둘이라
   * 「전표는 만들어졌고 승인 요청이 실패했다」가 실재하는 상태이며, 그때 화면은 통째로
   * 실패라고도 통째로 성공이라고도 말하지 않는다 — 그 전표는 **이력 탭에서 이어서 요청**할 수 있다.
   */
  result: {
    label: '요청 결과',
    createdTitle: (goodsIssueNo: string): string => `폐기 요청 전표 ${goodsIssueNo}를 만들었습니다`,
    submittedTitle: (goodsIssueNo: string): string => `${goodsIssueNo}를 결재에 올렸습니다`,
    submittedDescription:
      '결재가 시작됐습니다. 승인이 끝나면 「기타출고 처리」로 재고를 차감합니다.',
    /** 요청 결과에 **승인 요청 번호를 내지 않는다** — 응답이 내부 식별자 하나뿐이다(`omf-mes#44`). */
    submittedNoRequestNo: '승인 요청번호는 「처리 이력」 탭의 결재 진행에서 볼 수 있습니다.',
    /**
     * **부분 실패**(감지기 M57). 전표는 서버에 남았고 승인 요청만 실패했다 — 통째로 실패로
     * 말하면 사용자가 처음부터 다시 만들어 **전표가 두 벌** 남는다.
     */
    partialTitle: (goodsIssueNo: string): string =>
      `전표 ${goodsIssueNo}는 만들어졌고 승인 요청이 실패했습니다`,
    partialDescription:
      '전표를 다시 만들 필요가 없습니다. 「이 요청 열기」로 「처리 이력」 탭에서 이어서 요청하세요.',
    /** 서버가 되돌려 준 라인. **화면이 보낸 줄을 되비추지 않는다**(계획 결정 15). */
    lineCount: (count: number): string => `전표에 실린 줄 ${String(count)}건`,
    linePair: (item: string, lot: string, qty: string): string => `${item} · ${lot} · ${qty}`,
    /**
     * 처리 결과의 상태 — **방금 받은 응답의 값**이라 그 시점을 따로 밝힐 것이 없다.
     */
    statusCode: '상태',
    /**
     * 요청 결과의 상태 — **전표를 만들 때 서버가 준 값**이다(리뷰 t5 M2).
     *
     * 이 구획은 「이번 세션에 내가 만든 전표의 기록」이고, 그 뒤에 승인 요청·전기가 일어나면
     * **서버의 상태는 달라진다.** 라벨이 시점을 밝히지 않으면 같은 전표를 두 탭이 서로 다른
     * 상태로 말하는 것처럼 읽힌다 — 값을 지우는 대신(완료 조건이 상태를 요구한다) **어느
     * 시점의 값인지**를 라벨이 말한다. 지금 상태는 「처리 이력」 탭의 제목줄이 낸다.
     */
    createdStatusCode: '만들 때의 상태',
    /** 등록만 끝난 전표는 아직 결재에 올라가지 않았다 — 그 사실을 결과에서 적는다. */
    notSubmittedYet: '아직 승인을 요청하지 않았습니다.',
    submitting: '결재에 올리는 중입니다.',
    /**
     * 처리 결과 — **서버가 되돌려 준 것만 말한다**(계획 결정 15).
     *
     * **상태 코드로 「전기 완료」를 판정하지 않는다.** 목이 전기 200에도 초안 상태를 그대로
     * 주는 것이 실측됐다(계획 §5.4-20) — 그 값으로 완료를 말하면 **그 자리에서 거짓말**이 된다.
     * 화면이 아는 것은 **서버가 이 조작을 200으로 받아들였다**는 사실이고 그것만 적는다.
     */
    postLabel: '처리 결과',
    postedTitle: (goodsIssueNo: string): string => `${goodsIssueNo}를 기타출고로 처리했습니다`,
    postedDescription:
      '서버가 전기를 받아들였습니다. 아래 값은 서버가 되돌려 준 것이며, 전표의 줄은 다시 부른 상세가 채웁니다.',
    /** **화면이 센 줄 수를 적지 않는다** — 전기 응답에 라인이 없다(계약 실측). */
    postedNoLines: '전기 응답에는 줄이 실려 오지 않습니다. 위 라인 표의 전기 표식으로 확인하세요.',
  },
  /**
   * 이력 탭의 재요청 구획 — **승인 요청이 올라가지 않은 전표를 이어서 올리는 자리다.**
   *
   * 전표 생성에 성공하고 승인 요청에 실패한 전표가 실재하므로(요청이 둘이다) 그 전표를 되살릴
   * 길이 화면에 있어야 한다. **요청 규칙은 「폐기 요청」 탭의 자리와 같은 파일에서 나온다**
   * (`reason-draft.ts`) — 자리가 둘이어도 규칙이 둘이 되지 않는다.
   *
   * **구획 이름과 그 안 버튼이 짝을 이룬다** — 「승인 재요청」 구획 / 「재요청」 버튼. 구획을
   * `actions.submitDisposal`과 같은 글자(「승인 요청」)로 두면 서로 다른 키 둘이 한 문구를
   * 갖게 되고, 한쪽을 고칠 때 다른 쪽이 조용히 따라 바뀐다. 왜 이 자리에 「재」요청이 서는지도
   * 구획 이름이 말해야 한다.
   */
  resubmit: {
    label: '승인 재요청',
    lead: '이 폐기 요청은 아직 결재에 올라가지 않았습니다. 사유를 적고 결재에 올리세요.',
    submittedLead: '이 폐기 요청은 이미 결재에 올라가 있습니다.',
  },
  /**
   * 기타출고 처리 구획 — **이 화면에서 재고가 실제로 움직이는 유일한 자리다.**
   *
   * **《처리하면 일어나는 일》 세 문장이 버튼 위 상시 자리에 선다**(계획 결정 14의 첫째 겹).
   * 버튼이 잠겨 있을 때도 보인다 — 잠긴 동안 읽어 두어야 열렸을 때 무엇을 누르는지 안다.
   * **성공 뒤에 사라지는 자리(토스트)로 옮기지 않는다**: 사라지는 글자는 되돌릴 수 없는 조작
   * 앞에서 아무것도 막지 못한다.
   *
   * **승인이 끝났는지 화면이 판정하지 못한다**(승인 기록 §13-2 안 1 · `omf-mes#64`). 잠글
   * 근거가 계약에 없어 **잠그지 않고 밝히며**, 막는 것은 서버다(승인 전이면 400).
   */
  post: {
    label: '기타출고 처리',
    lead: '승인이 끝난 폐기 요청을 실제 출고로 처리하는 자리입니다.',
    /**
     * 그 전표가 **어디로 가는가**(변경 통지 #128). 발의 폼과 확인 창의 같은 낱말과 **키를
     * 갈라 둔다** — 낱말이 겹쳐도 고치는 자리가 다르다: 저쪽은 사용자가 **정하는** 값의
     * 라벨이고 이쪽은 이미 정해진 값을 **읽어 보이는** 자리다.
     */
    destinationLabel: '도착지',
    /** 상시 문구 묶음의 **접근 이름**. 잠긴 버튼 옆이 아니라 그 위에 선다. */
    effectsLabel: '처리하면 일어나는 일',
    /** 세 문장 ① — 이 조작의 결과를 가장 먼저 적는다. */
    effectDeducts: '이 조작은 재고를 차감합니다.',
    /** 세 문장 ② — 착수 이슈 §6이 못 박은 사실이다. 승인만 받아 놓고 잊는 일을 막는다. */
    effectApprovalIsNotPosting:
      '승인은 재고를 차감하지 않습니다 — 승인 뒤 이 버튼을 눌러야 출고가 일어납니다.',
    /** 세 문장 ③ — 되돌리는 길이 이 화면에 **없다**는 사실. 있는 척하지 않는다. */
    effectNoUndoHere:
      '되돌리려면 출고 취소가 필요하고 취소는 다시 결재를 탑니다 — 이 화면에는 그 수단이 없습니다.',
    /**
     * 승인 완료를 뜻하는 상태 코드가 확정되기 전까지 화면이 못 하는 판정과, **그래서 무엇이
     * 막아 주는지**를 함께 적는다. 자리표시가 채워지면 이 안내가 사라지고 잠금이 살아난다.
     */
    unjudgeableNote:
      '승인이 끝났는지 화면이 판정하지 못해 이 버튼을 잠그지 않습니다. 승인 전이면 서버가 처리를 거절합니다.',
  },
  notes: {
    /**
     * 폐기 수량 칸이 **빈 칸으로 시작하는 이유**를 밝힌다(완료 조건 C26). 입고 수량으로 미리
     * 채우면 전량 폐기가 기본값처럼 보이고, 사용자가 그대로 확인하면 받은 전부가 장부에서 빠진다.
     */
    disposalQtyEmptyStart: '폐기 수량은 빈 칸으로 시작합니다. 폐기할 양을 줄마다 직접 적으세요.',
    /**
     * **응답을 받지 못한 실패에만** 한 줄을 더한다(계획 결정 14의 다섯째 겹). 공통 문구는
     * 「다시 시도하세요」로 끝나는데, 확인 없이 다시 보내면 같은 요청이 전표 두 벌로 남는다 —
     * 공통 쓰기 훅이 호출마다 새 멱등 키를 만들어 서버가 재전송으로 보지 못한다.
     */
    submitRecheck:
      '전달됐는지 확인할 수 없습니다. 「처리 이력」 탭에서 전표가 만들어졌는지 확인한 뒤 다시 시도하세요.',
    /**
     * 「최신 불러오기」가 실패했다. **저장 충돌을 푸는 유일한 길**이라 실패를 삼키면 사용자에게는
     * 「눌러도 아무 일이 없다」로 나타난다 — 무엇이 안 됐는지와 다음에 무엇을 할지 적는다.
     */
    reloadFailed:
      '최신 상태를 불러오지 못했습니다. 잠시 뒤 다시 시도하거나 「처리 이력」 탭에서 이어서 요청하세요.',
    /**
     * **응답을 받지 못한 처리에만** 한 줄을 더한다(다섯째 겹 · 감지기 M73). 승인 요청의 같은 자리와
     * **문구를 갈라 둔다** — 확인할 것이 「전표가 만들어졌는가」가 아니라 **재고가 움직였는가**다.
     */
    postRecheck:
      '전달됐는지 확인할 수 없습니다. 다시 조회해 이 전표의 줄이 전기됐는지 확인한 뒤 다시 시도하세요.',
    /**
     * 보류 표식이 뜻하는 것. **해제 수단을 두지 않는다** — 보류를 걸고 푸는 것은 품질 쪽
     * 소관이고, 폐기했다고 보류가 풀리지도 않는다. **막지도 않는다**(계획 결정 4와 같은 논거).
     */
    lotHold: '「보류」 표식이 붙은 자재 LOT은 품질 보류 중입니다. 이 화면에서 풀 수 없습니다.',
  },
  values: {
    /** 참조를 못 푼 네 갈래 중 셋. **어느 갈래에도 번호를 담지 않는다**(`omf-mes#44`). */
    unknown: '알 수 없음',
    referenceLoading: '불러오는 중',
    referenceFailed: '이름을 불러오지 못했습니다',
    /**
     * 보유 수량의 두 갈래. **이름 참조의 문구를 돌려쓰지 않는다** — 「알 수 없음」은
     * *값이 잘못됐다*는 신호로 이 화면이 이미 정의해 두었는데, 보유 수량을 못 구한 것은
     * 값이 잘못된 것이 아니라 **화면이 확인하지 못한 것**이다.
     */
    onHandLoading: '불러오는 중',
    onHandUnknown: '확인하지 못함',
    /** 자재 LOT이 보류 중임을 밝히는 표식. **색에만 기대지 않는다** — 글자로 낸다. */
    lotHeld: '보류',
    /** 미사용 값을 목록에서 빼지 않고 표식만 붙인다 — 빼면 과거 입고를 조건으로 찾을 수 없다. */
    inactiveSuffix: ' (미사용)',
    /**
     * 확인 창의 빈 칸. **비워 두지 않는다** — 빠뜨린 것인지 없는 것인지 구분되지 않는다.
     * 「알 수 없음」과 갈라 둔다: 이쪽은 **넣지 않은 값**이고 저쪽은 못 푼 이름이다.
     */
    empty: '없음',
    /**
     * 도착지 표기의 한 갈래 — **외부 업체 없이 직접 폐기한다**(변경 통지 #128).
     *
     * 「없음」과 갈라 둔다: 이쪽은 사용자가 **정한 사실**이고 저쪽은 넣지 않은 값이다.
     * 나가는 본문에서는 둘 다 「도착지 두 키가 없음」으로 나타나므로, 화면에서까지 같은 글자로
     * 적으면 「아직 안 골랐다」와 「자체 폐기라 없다」를 사용자도 가를 수 없게 된다.
     */
    selfDisposal: '자체 폐기',
    /**
     * 아직 결재에 올라가지 않은 폐기 요청의 표식. **`approvalRequestId`가 있는가로만 갈린다**
     * (계획 결정 7) — 상태 코드를 읽지 않는다. 이 표식이 붙은 전표는 등록에는 성공하고
     * 승인 요청에는 이르지 못한 중간 상태이며, 이 탭이 그것을 **숨기지 않고 보이는 자리**다.
     */
    notSubmitted: '미요청',
    /**
     * 전기 표식 두 갈래. **라인의 원장 라인 번호가 있는가로만 갈린다**(계획 결정 7) —
     * 계약이 그 필드를 「전기로 생긴 원장 라인」이라 적었다. 상태 코드로 판정하지 않는다:
     * 목이 전기 뒤에도 초안 상태를 그대로 주는 것이 실측됐다.
     */
    posted: '전기됨',
    notPosted: '전기 전',
    /**
     * ERP 적재 표기 세 갈래. **「전송됨」이라 적지 않는다** — 계약이 「적재이지 전송이 아니다」라고
     * 못 박았다. 값이 아예 오지 않는 갈래를 따로 두는 이유는 계약이 이 필드를 선택으로 두어서다.
     */
    erpQueued: 'ERP 대기열에 적재됨',
    erpNotQueued: 'ERP 대기열에 적재되지 않음',
    erpUnknown: 'ERP 적재 여부가 오지 않았습니다',
    /** 사유 코드가 비어 온 폐기 요청. **코드를 지어내지 않는다** — 없다는 사실을 적는다. */
    noReasonCode: '사유 코드 없음',
    /** 이름이 비어 오면 **번호를 대신 내지 않는다**(`omf-mes#44`). */
    unknownRequester: '요청자 이름을 확인할 수 없습니다',
    unknownApprover: '승인자 이름을 확인할 수 없습니다',
    emptyReason: '사유가 비어 있습니다',
  },
  /**
   * 처리 이력 목록 표의 머리글. 열 구성과 폭의 근거는 screens/disposal-issue/gi-table.tsx에 있다.
   *
   * **출고 유형 열이 없다.** 이 화면의 이력은 전부 기타 출고라 값이 한 가지이고, 조건 축인
   * **폐기 사유**가 더 많은 것을 말한다(계획 §5.5).
   */
  historyTable: {
    goodsIssueNo: '출고번호',
    warehouse: '창고',
    reason: '폐기 사유',
    issuedAt: '출고 일시',
    status: '상태',
    select: '선택',
  },
  /**
   * 폐기 요청 라인 표의 머리글. 폭의 근거는 screens/disposal-issue/issue-line-table.tsx에 있다.
   *
   * **줄번호·단위 열을 두지 않는다** — 서버가 부여한 순번은 사용자에게 뜻이 적고, 단위는
   * 수량 표기에 붙인다(W-01-03이 세운 처리).
   */
  issueLineTable: {
    item: '품목',
    lot: '자재 LOT',
    location: '위치',
    issueQty: '폐기 수량',
    posted: '전기',
    issueQtyPair: (issueQty: number, uom: string): string => `${String(issueQty)} ${uom}`,
  },
  /** 고른 폐기 요청의 제목줄. */
  issueSummary: {
    label: '고른 폐기 요청',
    goodsIssueNo: '출고번호',
    issueType: '출고 유형',
    reason: '폐기 사유',
    issuedAt: '출고 일시',
    status: '상태',
    warehouse: '창고',
    erp: 'ERP 적재',
  },
  /**
   * 결재 진행 구획.
   *
   * **이 화면은 결재하지 않는다.** 결재함(W-CO-09)이 쓰는 「내 차례입니다」·「내 단계」 표기를
   * 여기 두지 않는다 — 두면 이 화면이 결재함처럼 읽히고, 사용자는 있지도 않은 승인 버튼을
   * 찾는다. 여기서 말하는 것은 **어디까지 왔는가**뿐이다.
   */
  progress: {
    label: '결재 진행',
    /** 「2 / 3 단계」·「결재 종료 · 전체 2단계」 — **서버가 준 두 수 그대로다.** */
    position: (current: number, total: number): string =>
      `${String(current)} / ${String(total)} 단계`,
    finished: (total: number): string => `결재 종료 · 전체 ${String(total)}단계`,
    noSteps: '결재 단계가 아직 없습니다.',
    /** 결재 전 단계의 **보이는 글자**. 디자인 시스템의 상태 낱말은 스크린리더 전용이다. */
    waitingCurrent: '결재를 기다리는 중',
    waitingPending: '앞 단계가 끝나기를 기다리는 중',
    requestNo: '승인 요청번호',
    approvalType: '승인 유형',
    status: '상태',
    requester: '요청자',
    requestedAt: '요청일',
    reason: '요청 사유',
    /**
     * 사유 구획의 **접근 이름**. 보이는 라벨과 갈라 둔다 — 같은 문자열을 쓰면 스크린리더가
     * 「요청 사유 … 요청 사유, 그룹」으로 두 번 읽는다(전례 `iqc-skip-approval`과 같은 처리).
     */
    reasonPane: '요청 사유 전문',
    /**
     * 아직 승인 요청이 올라가지 않은 폐기 요청(계획 결정 6·7 · 승인 기록 정정 1-1).
     *
     * **등록에는 성공하고 승인 요청에는 이르지 못한 전표가 실제로 남는다.** 이 탭이 그것을 찾아
     * 이어서 올리는 자리이며, 그 수단 자체는 뒤따르는 회차가 이 구획에 붙인다.
     * **지금 없는 것을 있다고 적지 않는다** — 무엇이 안 된 상태인지만 밝힌다.
     */
    notSubmittedTitle: '아직 승인을 요청하지 않았습니다',
    notSubmittedDescription:
      '이 폐기 요청은 결재에 올라가지 않았습니다. 승인을 요청해야 결재가 시작되고, 승인이 끝난 뒤에 기타출고로 처리할 수 있습니다.',
    /**
     * 전표에 승인 요청 값이 실려 왔는데 조회할 수 있는 값이 아니다.
     * **없는 값을 0으로 메워 부르지 않는다** — 그러면 남의 요청을 열거나 헛도는 요청이 나간다.
     */
    unusableTitle: '승인 요청 여부를 확인할 수 없습니다',
    unusableDescription:
      '이 전표에 실려 온 승인 요청 값이 조회할 수 있는 값이 아닙니다. 담당자에게 확인해 주세요.',
    loadFailedTitle: '결재 진행을 불러오지 못했습니다',
    forbiddenTitle: '이 요청의 결재 진행을 볼 권한이 없습니다',
    forbiddenDescription:
      '승인자도 요청자도 아니면 결재 진행이 열리지 않습니다. 담당자에게 확인해 주세요.',
    notFoundTitle: '결재 진행을 찾을 수 없습니다',
    notFoundDescription: '승인 요청이 지워졌거나 이 전표와 이어지지 않습니다.',
    /**
     * **못 읽어도 이 폐기 요청으로 할 수 있는 일은 달라지지 않는다**(계획 결정 3·9).
     * 결재 진행은 판단을 돕는 자료이지 처리의 전제가 아니다 — 막는 것은 서버다.
     */
    loadFailedNote: '결재 진행을 읽지 못해도 이 폐기 요청으로 할 수 있는 일은 달라지지 않습니다.',
    /**
     * **계약이 못 박은 사실**이라 화면이 지어내는 것이 아니다 — 승인은 상태만 바꾸고
     * 재고는 전기가 움직인다. 승인만 받아 놓고 잊는 일을 막는 자리다.
     */
    postSeparateNote:
      '승인은 재고를 차감하지 않습니다. 승인이 끝난 뒤 「기타출고 처리」를 따로 진행해야 출고가 일어납니다.',
    /** 승인 완료를 뜻하는 상태 코드가 확정되기 전까지 화면이 못 하는 판정을 밝힌다. */
    unjudgeableNote:
      '승인이 끝났는지 화면이 판정하지 못합니다. 위 단계와 상태 코드를 보고 판단하세요.',
    /**
     * 자리표시가 채워졌고, 그 요청이 승인 상태이며, **아직 한 줄도 전기되지 않았을 때만** 선다
     * (승인 기록 정정 1-4). 셋 중 하나라도 어긋나면 화면이 확인하지 않은 것을 말하게 된다.
     */
    approvedNotPostedNote:
      '승인되었습니다. 재고는 아직 차감되지 않았습니다 — 「기타출고 처리」를 진행하세요.',
  },
  pageNav: {
    label: '쪽 이동',
    range: (from: number, to: number, total: number): string =>
      `${String(from)}–${String(to)} / 전체 ${String(total)}건`,
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
} as const;

/**
 * W-06-15 결재선 정의. **이 회차(PR ②)는 읽기뿐이다** — 등록·수정·사용 전환·단계 편집의
 * 문구는 뒤 회차가 더한다. 지금 없는 어휘가 있는 것이 이 블록의 정확한 상태다.
 *
 * **승인 유형 값을 지어내지 않는다.** 값 목록이 확정되지 않아 선택지가 비어 있고, 왜 비었는지는
 * 공용 `pendingCode`가 말한다. 계약의 예시값도 문구로 옮기지 않는다.
 *
 * **내부 번호를 문구로 만들지 않는다.** 사업부도 승인자도 이름을 못 풀면 그 사실을 적고
 * 번호를 대신 내지 않는다 — 번호를 담을 자리가 문구에도 없어야 새는 경로가 없다.
 *
 * **화면이 아는 것만 말한다.** 「이 결재선이 지금 상신에 쓰입니다」라고 말하지 않는다 —
 * 같은 유형·사업부로 사용 중인 결재선이 둘 이상일 수 있고 고르는 규칙은 서버가 갖는다.
 */
const approvalRoute = {
  title: '결재선 정의',
  breadcrumbRoot: '시스템 관리',
  panes: {
    list: '결재선 목록',
    detail: '고른 결재선',
    /** 등록 폼은 고른 결재선과 **다른 구획**이다 — 이름이 같으면 어느 쪽을 고치는지 가릴 수 없다. */
    create: '새 결재선',
    steps: '결재 단계',
  },
  fields: {
    approvalTypeCode: '승인 유형',
    businessUnit: '사업부',
    /**
     * 값 구간은 **두 칸이다.** 한 칸의 요약 표기(「100 ~ 500」)를 두지 않는다 —
     * 고른 결재선의 그 자리가 곧 입력칸이라, 같은 값을 읽기용으로 한 번 더 그리면
     * 어느 쪽이 정본인지 흐려진다.
     */
    minValue: '값 구간 하한',
    maxValue: '값 구간 상한',
    /** 목록 열 이름. 폼의 「사용 여부」와 달리 한 낱말이라야 64px 칸에서 접히지 않는다. */
    status: '사용',
    stepCount: '단계',
    inProgressCount: '진행 중',
    stepNo: '순서',
    approver: '승인자',
    approverStatus: '상태',
    /**
     * 단계 표의 삭제 열 이름. 열 이름을 「작업」으로 두지 않는다 —
     * 이 열에 서는 것이 삭제 하나뿐이라 무엇을 하는 열인지 그대로 적는 편이 짧고 정확하다.
     */
    stepRowActions: '삭제',
    /**
     * 추가 줄의 승인자 구분 선택칸. 1차에는 「사용자」만 고를 수 있고 나머지는 잠긴 채 보인다 —
     * 감추면 사용자는 역할·부서 결재가 **없는 기능**이라고 읽는다(`omf-mes#69`).
     */
    approverType: '승인자 구분',
    q: '승인 유형 검색',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    /** 목록·상세·단계를 **함께** 다시 부른다. 목록만 부르면 갱신된 값과 낡은 값이 섞인다. */
    reload: '다시 조회',
    /** 등록 폼을 여는 자리. 「추가」가 아니라 무엇을 만드는지 적는다 — 화면에 만들 것이 둘이다(결재선·단계). */
    create: '새 결재선',
    /** 등록의 주 액션. 수정의 「저장」과 갈라 적는다 — 없던 것이 생기는 일이다. */
    submitCreate: '등록',
    /** 사용 중지의 반대. `messages.common.deactivate`와 짝이다. */
    activate: '다시 사용',
    /**
     * 활성 중복으로 등록·수정이 막혔을 때 기존 결재선으로 옮겨 가는 길.
     * **추가 조회를 하지 않는다** — 조준 조회가 이미 그 행을 실어 왔다.
     */
    openExisting: '기존 결재선 보기',
    keepEditing: '계속 편집',
    discardDraft: '변경 파기',
    /*
     * 행 안의 버튼은 보이는 글자가 행마다 같을 수 있다 — 같은 승인 유형의 사업부 지정본과
     * 전 사업부 공통본이 함께 서기 때문이다. 그래서 사업부 **이름**을 함께 담는다.
     * 보이는 글자(승인 유형)를 그대로 담아 음성 조작이 그 말로 이 버튼을 부를 수 있게 하고,
     * **내부 번호는 접근 이름에도 넣지 않는다.**
     */
    selectRow: (approvalTypeCode: string, businessUnitLabel: string): string =>
      `${approvalTypeCode} · ${businessUnitLabel} 선택`,
    /**
     * 단계 추가. **표 아래 줄의 버튼이다** — 표 셀 안에 선택칸을 두면 표를 감싼 넘침 상자가
     * 펼침 목록을 자른다(이 저장소 이슈 #45와 같은 형태의 자리).
     */
    addStep: '단계 추가',
    /**
     * 행 안의 삭제. 디자인 시스템의 순서 이동 버튼은 접근 이름이 행마다 같지만(그쪽은 표 구조와
     * 이동 뒤 라이브 안내가 맥락을 준다) **이 버튼은 우리가 이름을 정하므로 순서를 담는다.**
     */
    removeStep: (stepNo: number): string => `${String(stepNo)}번째 단계 삭제`,
    /** 단계 치환. 「저장」이 아니라 무엇을 저장하는지 적는다 — 이 화면에는 저장이 둘이다. */
    saveSteps: '결재 단계 저장',
  },
  loading: {
    list: '결재선 목록 불러오는 중',
    detail: '결재선 상세 불러오는 중',
    steps: '결재 단계 불러오는 중',
  },
  filters: {
    all: '전체',
    lookupTruncated: '선택지가 앞쪽 일부만 보입니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
    lookupFailed: '선택지를 불러오지 못했습니다.',
    /**
     * 「미사용 포함」의 방향은 화면 어휘이고 계약 파라미터는 그 반대다. 뒤집는 자리는
     * `filters.ts` 한 곳이며 문구는 다른 화면과 같은 말(`common.includeInactive`)을 쓴다.
     */
    chipApprovalType: (value: string): string => `승인 유형: ${value}`,
    chipBusinessUnit: (value: string): string => `사업부: ${value}`,
    chipKeyword: (value: string): string => `검색어: ${value}`,
    chipRemoveApprovalType: '승인 유형 조건 제거',
    chipRemoveBusinessUnit: '사업부 조건 제거',
    chipRemoveKeyword: '검색어 조건 제거',
    chipRemoveIncludeInactive: '미사용 포함 조건 제거',
  },
  /** 쪽 이동. 번호 목록을 두지 않는 근거는 screens/approval-route/page-nav.tsx에 있다. */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  /** 빈 상태는 **네 갈래**다. 사용자가 할 조치가 서로 다르다(완료 조건 C15). */
  empty: {
    noResultTitle: '조건에 맞는 결재선이 없습니다',
    noResultDescription: '조건을 줄이거나 「미사용 포함」을 켠 뒤 다시 조회하세요.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
    noSelectionTitle: '결재선을 고르면 내용과 결재 단계가 보입니다',
    noSelectionDescription: '왼쪽 목록에서 승인 유형을 누르세요.',
    /*
     * 상세가 404다. **주소에 남은 결재선 번호를 화면이 스스로 정리한다** — 남겨 두면
     * 오른쪽 구획이 없는 결재선을 가리킨 채 주소만 남는다(수명 표 **5행**).
     */
    notFoundTitle: '고른 결재선을 찾을 수 없습니다',
    notFoundDescription: '지워졌거나 주소의 번호가 잘못됐습니다. 왼쪽 목록에서 다시 고르세요.',
    /**
     * 결재선은 골랐는데 단계가 0이다. 「아직 안 골랐다」와 다른 사정이다.
     *
     * **등록 직후가 늘 이 상태다** — 계약이 등록 본문에 단계를 받지 않고 신규는 항상 사용
     * 중이라, 만든 그 순간 「사용 중인데 단계가 0인 결재선」이 생긴다(계획 결정 15).
     * 그래서 사실만 적지 않고 **무엇을 하면 열리는지**까지 적는다.
     */
    noStepsTitle: '이 결재선에는 결재 단계가 없습니다',
    noStepsDescription:
      '단계가 없으면 이 유형의 상신이 거부됩니다. 단계를 하나 이상 추가하면 열립니다.',
  },
  values: {
    /** 이름 목록은 왔는데 그 안에 없다 — **값이 잘못됐다**는 신호다. */
    unknown: '알 수 없음',
    /** 이름 목록이 아직 오지 않았다. 「알 수 없음」으로 쓰면 정상 값이 잘못된 값으로 읽힌다. */
    referenceLoading: '이름 불러오는 중',
    /** 이름 목록 조회가 실패했다. 값이 없는 것과 다르다. */
    referenceFailed: '이름을 불러오지 못했습니다',
    inactiveSuffix: ' (미사용)',
    /**
     * 사업부를 비운 결재선. **빈 값이 아니라 확정된 뜻이다** — 「알 수 없음」이나 대시로 두면
     * 자료가 빠진 것으로 읽혀 정반대가 된다. 참조 조회가 실패해도 이 뜻은 흔들리지 않는다.
     */
    allBusinessUnits: '전 사업부 공통',
    active: '사용 중',
    inactive: '사용 안 함',
    /** 단계가 0인 결재선. 색이 아니라 글자로 낸다. */
    noSteps: '단계 없음',
    /**
     * 계약이 승인자 이름을 필수로 두지 않았다. **번호를 대신 내지 않는다** —
     * 내부 번호는 사용자가 쓰지 않는 값이고, 한 번 화면에 서면 그것이 식별자로 읽힌다.
     */
    approverUnknown: '승인자 정보를 확인할 수 없습니다',
    approverActive: '사용 중',
    approverInactive: '사용 중지됨',
    /**
     * 승인자 구분의 이름. **계약 enum 값의 뜻을 옮긴 것이지 화면이 지어낸 코드가 아니다** —
     * 승인 유형(값 목록 미확정)과 달리 이 셋은 계약이 값과 뜻을 함께 못 박았다.
     */
    approverTypeUser: '사용자',
    approverTypeRole: '역할',
    approverTypeDepartment: '부서',
  },
  notes: {
    /**
     * 값 구간은 입력만 받고 1차에서는 아무것도 고르지 않는다. 밝히지 않으면 사용자가
     * 이 구간으로 결재선이 갈린다고 믿는다.
     */
    valueRangeUnused: '1차에서는 이 값 구간으로 결재선을 고르지 않습니다.',
    /**
     * **진행 중 건수는 상시 자리에 둔다.** 사용 중지 확인 창에만 두면, 결재선을 고치는
     * 사람은 자기가 무엇에 영향을 주지 *않는지*를 끝내 모른다.
     *
     * **소급하지 않는다는 사실을 여기서 되풀이하지 않는다.** 단계 구획의 상시 세 줄이 그것을
     * 늘 말하고 있어, 건수가 0일 때는 가리킬 대상도 없는 문장이 바로 아래 줄과 겹쳐 선다.
     * 이 자리의 고유 정보는 **건수**다.
     */
    inProgressSome: (count: number): string =>
      `진행 중인 요청 ${String(count)}건이 있습니다. 이 요청들은 지금의 결재선으로 끝납니다.`,
    inProgressNone: '진행 중인 요청이 없습니다.',
    /**
     * 단계 구획의 **상시 안내 세 줄**. 성공 알림에 붙이지 않는다 — 알림은 사라지고,
     * 이 셋은 결재선을 보는 내내 참인 사실이다.
     */
    stepGuideApproverAbsent: '승인자가 자리를 비우면 그 단계에서 요청이 멈춥니다.',
    stepGuideNotRetroactive: '결재선을 고쳐도 진행 중인 요청에는 반영되지 않습니다.',
    stepGuideRejectResubmit:
      '진행 중인 요청에 바뀐 결재선을 태우려면 반려한 뒤 다시 상신해야 합니다.',
    /** 승인자가 사용 중지 상태다. 색에만 기대지 않도록 글자로 함께 낸다. */
    approverInactiveWarning: '이 승인자는 사용 중지 상태입니다 — 결재가 멈춥니다.',
    /**
     * 같은 승인자가 두 단계에 서 있다. **막지 않는다** — 같은 사람이 다른 자격으로 두 번
     * 결재하는 것은 업무상 정당할 수 있고, 계약도 이슈도 그것을 금지하지 않았다.
     * 화면이 없는 규칙을 지어내는 대신 **보이기만 한다.**
     */
    approverDuplicateWarning: '같은 승인자가 다른 단계에도 있습니다. 그대로 저장할 수 있습니다.',
    /**
     * 이 저장이 **전체 교체**라는 사실. 저장 버튼 옆에 **늘** 세운다 —
     * 계약에 개별 추가·삭제 경로가 없어 보내는 배열이 곧 최종 순서 전체다.
     */
    stepReplaceWholeList: '저장하면 지금 보이는 순서 그대로 결재 단계를 전부 바꿉니다.',
    /**
     * 역할·부서 승인자는 1차에서 열지 않는다(`omf-mes#69`) — 상신 시 사람을 고를 입력이
     * 물리 모델에 없다는 것이 계약의 근거다. **선택지를 감추지 않고 잠근 채 사유를 붙인다.**
     */
    approverTypePending:
      '역할·부서 승인자는 1차에서 열지 않습니다 — 승인자는 사용자만 고를 수 있습니다.',
    /**
     * 승인자 선택지가 잘렸다. 밝히지 않으면 사용자는 **불완전한 목록을 완전한 것으로 읽고**
     * 찾는 사람이 없으면 「그런 사용자가 없다」로 결론짓는다.
     */
    approverListTruncated:
      '승인자 선택지가 앞쪽 일부만 보입니다. 찾는 사람이 없으면 담당자에게 알려 주세요.',
    approverListFailed: '승인자 선택지를 불러오지 못했습니다.',
    /**
     * 수정 폼에 승인 유형 입력칸이 없는 이유. 계약의 수정 본문에 그 키가 아예 없다 —
     * 밝히지 않으면 「왜 이 칸만 못 고치나」가 결함으로 읽힌다.
     */
    approvalTypeFixed: '승인 유형은 바꿀 수 없습니다 — 바꾸면 다른 결재선입니다.',
    /**
     * **비운 칸의 뜻을 저장 전에 말한다.** 이 저장은 전체 교체라 비운 칸이 「그대로 둔다」가
     * 아니라 「비운다」로 나간다. 창이 아니라 그 칸 옆에서 읽히는 것이 정확하다(계획 §13-4).
     *
     * **비웠을 때만 낸다.** 늘 세워 두면 안내가 배경이 되어 정작 비운 순간에 읽히지 않는다.
     */
    businessUnitEmpty: '사업부를 비우면 전 사업부에 적용됩니다.',
    valueRangeEmpty: '값 구간을 비우면 전 구간에 적용됩니다.',
    /**
     * 활성 중복 선검사를 하지 못했다(불러오는 중·실패·잘림).
     *
     * **막지 않는다.** 계약이 같은 조건을 400으로 다시 검사하므로 화면의 선검사는
     * 「저장을 누르기 전에 이유를 아는 것」이 목적이지 마지막 방어가 아니다.
     * 조회 하나가 실패했다고 마스터 관리 전체가 멈추면 안 된다.
     */
    duplicateUnknown:
      '같은 승인 유형·사업부로 사용 중인 결재선이 있는지 확인하지 못했습니다. 저장은 할 수 있으며 서버가 다시 검사합니다.',
    /**
     * **응답이 오지 않은 요청은 「실패」가 아니다.**
     *
     * 공통 쓰기 훅이 호출마다 새 멱등 키를 만든다(이 저장소 이슈 #55) — 응답 없는 요청을
     * 그대로 다시 보내면 서버에는 **다른 요청**으로 보여 같은 결재선이 둘 만들어질 수 있고,
     * 결재선에는 물리 삭제가 없어 지울 수도 없다. 화면이 할 수 있는 것은 그 사실을 말하는 것뿐이다.
     *
     * **네트워크 갈래에만 붙인다.** 서버가 거절한 요청(400·403·409)은 전달된 것이 확실하다 —
     * 전 갈래에 붙이면 확실한 것까지 불확실하게 만든다.
     */
    networkUnconfirmed:
      '요청이 전달됐는지 확인할 수 없습니다. 다시 저장하기 전에 「다시 조회」로 결과를 확인하세요.',
  },
  /** 보내기 전에 화면이 잡는 것. 서버가 잡는 것과 겹쳐도 지우지 않는다 — 목적이 다르다. */
  validation: {
    approvalTypeRequired: '승인 유형을 고르세요.',
    /**
     * `Number()`는 빈 문자열과 공백을 `0`으로, `Infinity`를 숫자로 읽는다 — 둘 다 걸러 낸다.
     * 거르지 않으면 요청 본문에 `0`이나 `null`(직렬화한 `Infinity`)이 실린다.
     */
    valueNotNumber: '숫자만 넣을 수 있습니다.',
    /** 계약이 **둘 다 있을 때만** 검사한다(ck_approval_route_range). 한쪽만 있는 구간은 정상이다. */
    maxLessThanMin: '상한은 하한보다 크거나 같아야 합니다.',
  },
  /** 비활성 액션의 사유(배치 규범 4). 「무엇이 막혔는가 + 어떻게 푸는가」를 함께 적는다. */
  actionReasons: {
    /**
     * 승인 유형 값 목록이 확정되기 전이다(`omf-mes#64`). **잠기는 것은 등록뿐이라는 사실을
     * 함께 적는다** — 적지 않으면 사용자가 화면 전체가 막힌 줄 안다.
     */
    createPendingCode:
      '등록: 승인 유형 값 목록이 아직 확정되지 않아 새 결재선을 만들 수 없습니다. 이미 있는 결재선은 고치고 끄고 켤 수 있습니다.',
    createNoType: '등록: 승인 유형을 고르면 등록할 수 있습니다.',
    saveNoChanges: '저장: 고친 내용이 없습니다. 값을 바꾸면 저장할 수 있습니다.',
    /**
     * 활성 중복 — 계약이 400으로 막는 자리를 화면이 먼저 막는다.
     * **기존 것을 고치라고 말한다**(정정 1-3) — 결재선에는 물리 삭제가 없어 잘못 만들면 지울 수 없다.
     */
    duplicateActive:
      '같은 승인 유형·사업부로 사용 중인 결재선이 이미 있습니다. 기존 결재선을 수정하세요.',
    activateNoSteps: '다시 사용: 결재 단계가 없습니다. 단계를 하나 이상 추가한 뒤 다시 사용하세요.',
    activateDuplicate:
      '다시 사용: 같은 승인 유형·사업부로 사용 중인 결재선이 이미 있습니다. 그 결재선을 먼저 중지하세요.',
    /**
     * 단계 저장이 막힌 사유 넷. **한 함수가 이 넷을 고른다**(`step-draft.ts`) —
     * 버튼의 잠금 사유와 보내는 자리의 재판정이 같은 값을 봐야 「버튼은 눌리는데 아무 일이
     * 없는」 자리나 그 반대가 생기지 않는다.
     *
     * **결재선 폼이 더러울 때를 먼저 낸다.** 두 저장이 한 벌의 잠금 토큰을 나눠 쓰므로,
     * 폼을 저장하면 단계 저장이 싣고 있던 토큰이 낡는다 — 순서가 있는 일이다.
     */
    stepSaveFormDirty:
      '결재 단계 저장: 결재선에 저장하지 않은 변경이 있습니다. 먼저 저장하거나 취소하세요.',
    stepSaveNoSteps:
      '결재 단계 저장: 단계가 하나도 없습니다. 단계를 하나 이상 추가하면 저장할 수 있습니다.',
    /**
     * 서버가 준 단계에 승인자 번호가 없다(계약이 그 필드를 선택으로 둔다). 화면이 번호를
     * 지어낼 수 없으므로 **그 행을 지우고 다시 넣어야** 전체 교체가 성립한다.
     */
    stepSaveApproverMissing:
      '결재 단계 저장: 승인자를 확인할 수 없는 단계가 있습니다. 그 단계를 지우고 다시 넣으세요.',
    stepSaveNoChanges: '결재 단계 저장: 고친 내용이 없습니다.',
    stepAddNoApprover: '단계 추가: 승인자를 고르세요.',
    /**
     * 마지막 한 단계는 지울 수 없다. 저장 잠금(단계 0)보다 **한 걸음 앞선 방어**다 —
     * 지운 뒤에 「저장할 수 없다」고 말하면 사용자는 이미 화면에서 그것을 잃은 뒤다.
     */
    stepRemoveLast:
      '삭제: 마지막 한 단계는 지울 수 없습니다. 단계가 없으면 이 유형의 상신이 거부됩니다.',
  },
  dialog: {
    /**
     * 사용 중지 확인. **되돌리는 데 다른 사람의 업무가 걸린 유일한 조작이라** 창을 둔다 —
     * 비움 경고는 폼 안 인라인이고 창은 여기와 다시 사용에만 있다(계획 §13-4).
     *
     * 계약에 이 오퍼레이션의 400 응답이 아예 없다 — **화면 경고가 유일한 방어다.**
     */
    deactivateTitle: '이 결재선을 사용 중지할까요?',
    deactivateBlocks: (approvalTypeCode: string): string =>
      `중지하면 「${approvalTypeCode}」 유형의 상신이 거부됩니다.`,
    /** 건수는 결재선 응답이 실어 온 파생값이다 — 화면이 세지 않는다. */
    deactivateInProgress: (count: number): string =>
      `진행 중인 요청 ${String(count)}건은 그대로 진행됩니다.`,
    deactivateInProgressNone: '지금 진행 중인 요청은 없습니다.',
    deactivateReversible: '나중에 「다시 사용」으로 되돌릴 수 있습니다.',
    /** 다시 사용 확인. 계약이 단계 0·활성 중복을 400으로 막으므로 화면이 **먼저** 막는다. */
    activateTitle: '이 결재선을 다시 사용할까요?',
    activateOpens: (approvalTypeCode: string): string =>
      `「${approvalTypeCode}」 유형의 상신이 다시 열립니다.`,
    activateStepCount: (count: number): string => `결재 단계는 ${String(count)}개입니다.`,
    /** 초안 파기. 문구가 「확인/취소」가 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */
    discardTitle: '변경을 파기할까요?',
  },
} as const;

/**
 * W-CO-09 결재함. 올라온 승인 요청을 모아 보고 결재하는 자리다.
 *
 * **판정을 화면이 다시 말하지 않는다.** 「지금 몇 단계인가」·「내 차례인가」는 서버가 판정해
 * 내려 주므로 문구도 그 값을 그대로 옮기는 형태만 둔다 — 화면이 사유를 지어내면
 * 서버와 갈리는 순간 사용자에게 거짓 확신을 준다.
 */
const approvalInbox = {
  title: '결재함',
  breadcrumbRoot: '승인',
  panes: {
    list: '승인 요청 목록',
    detail: '고른 요청',
    /** 아래 구획 안의 세 덩어리. 차례는 「무엇을 결재하는가 → 어디에 있는가 → 어디까지 왔는가」다. */
    request: '요청 정보',
    target: '대상',
    progress: '결재 진행',
    /** 사유 **전문**이 서는 자리. 줄마다 한 칸이라 값 하나짜리 칸과 구조가 다르다. */
    reason: '사유 전문',
    /**
     * 결재 액션이 서는 자리. **진행 구획 바로 아래**다 — 의견은 내 단계에 남는 말이라
     * 단계 목록 옆이 가장 가깝고, 위의 둘(사유·대상)은 「무엇을 결재하는가」로 축이 다르다.
     */
    decision: '결재',
  },
  /**
   * 탭은 **조회 조건 그 자체**다. 이름이 곧 그 탭이 무엇을 보여 주는지여야 한다 —
   * 「내 결재 대기」와 「내가 올린 것」은 걸러 내는 축이 서로 다르다(내가 승인자인가 / 내가 올렸는가).
   */
  tabs: {
    label: '결재함 보기',
    pending: '내 결재 대기',
    requested: '내가 올린 것',
    all: '전체',
    /**
     * 대기 건수 뱃지의 접근 이름. 수치만 읽히면 무엇의 수인지 알 수 없다.
     * **탭이 보여 주는 목록의 건수가 아니라 「지금 내가 결재할 수 있는」 건수다.**
     */
    pendingBadge: (count: number): string => `대기 ${String(count)}건`,
  },
  fields: {
    approvalRequestNo: '요청번호',
    reason: '사유',
    requestedByName: '상신자',
    /** 목록 열 이름. 계약이 이 값을 시각까지 실어 주고 목록도 시각까지 보인다. */
    requestedAt: '상신 일시',
    status: '상태',
    approvalTypeCode: '승인 유형',
    /**
     * 조건 줄의 기간 라벨. **열 이름과 낱말이 다른 것이 맞다** — 계약의 두 조건
     * (`requestedAtFrom`·`requestedAtTo`)이 `format: date`라 **날짜 단위로** 좁힌다.
     * 여기에 「일시」를 쓰면 시각까지 지정할 수 있다고 읽힌다.
     */
    period: '상신일',
    q: '요청번호 검색',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    /** 목록과 대기 건수를 **함께** 다시 부른다. 한쪽만 부르면 갱신된 값과 낡은 값이 섞인다. */
    reload: '다시 조회',
    /*
     * 요청번호 하나로 이름이 선다 — 계약이 그 값을 UNIQUE로 두었다.
     * 보이는 글자를 그대로 담아 음성 조작이 그 말로 이 버튼을 부를 수 있게 하고,
     * **내부 번호는 접근 이름에도 넣지 않는다.**
     */
    selectRow: (approvalRequestNo: string): string => `${approvalRequestNo} 선택`,
  },
  loading: {
    list: '승인 요청 목록 불러오는 중',
    detail: '고른 요청 불러오는 중',
  },
  /**
   * 대상 구획. **결재함은 대상 문서의 내용을 그리지 않는다** — 계약이 그렇게 적었고
   * 상세 응답에 대상 본문이 아예 없다. 표시명과 「열기」뿐이다.
   */
  target: {
    open: '열기',
    /**
     * 「열기」가 잠기는 **세 갈래**. 사유가 서로 다른 이유는 사용자가 할 조치가 다르기 때문이다 —
     * ①은 대상 자체가 열 화면이 없는 것이고, ②는 규약이 아직 정해지지 않은 것이며,
     * ③은 그 화면이 이 앱에 아직 없는 것이다. 한 문구로 뭉개면 셋을 구분할 수 없다.
     */
    blockedNotOpenable: '열기: 이 대상은 열 수 있는 화면이 없습니다',
    blockedNoScreenId: '열기: 이 대상을 여는 화면이 정해지지 않았습니다',
    blockedUnmapped: '열기: 이 화면은 아직 관리웹에 없습니다',
    /** 결재함이 무엇을 하지 않는지 밝힌다 — 여기서 문서를 읽을 수 있다고 오해하지 않게. */
    note: '내용은 원 화면에서 확인합니다',
  },
  /**
   * 결재 진행. **여기 있는 값은 전부 서버가 준 것을 그대로 옮긴 것이다** —
   * 단계 배열을 훑어 다시 계산하지 않는다(계획 결정 7).
   */
  progress: {
    /** 몇 단계 중 몇 번째인가. **`currentStepNo`·`totalStepNo` 그대로다.** */
    position: (current: number, total: number): string =>
      `${String(current)} / ${String(total)} 단계`,
    /** 기다리는 단계가 없다(`currentStepNo`가 비었다). **0으로 메우지 않는다.** */
    finished: (total: number): string => `결재 종료 · 전체 ${String(total)}단계`,
    /**
     * 지금 이 요청을 결재할 수 있는가 — **`isMyTurn` 그대로다.**
     *
     * **왜 아닌지는 말하지 않는다.** 앞 단계가 안 끝난 것인지, 내가 승인자가 아닌 것인지,
     * 이미 끝난 요청인지 화면은 판정할 수 없다 — 아는 것만 말하고 이유를 지어내지 않는다.
     */
    myTurn: '지금 이 요청을 결재할 차례입니다',
    notMyTurn: '지금은 이 요청을 결재할 차례가 아닙니다',
    /**
     * 아직 결재되지 않은 단계의 보조 라벨. **디자인 시스템의 상태 낱말이 스크린리더 전용**이라
     * 보이는 글자를 이 자리가 맡는다 — 색·아이콘에만 기대지 않는다.
     */
    waitingCurrent: '지금 결재를 기다리는 단계입니다',
    waitingPending: '아직 결재하지 않은 단계입니다',
    /** 로그인 사용자가 승인자인 단계(`isMine`). */
    mine: '내 단계',
    /** 단계 배열이 비어 왔다. 계약이 배열을 필수로 두었으나 빈 배열은 스키마를 통과한다. */
    noSteps: '결재 단계가 오지 않았습니다',
  },
  filters: {
    all: '전체',
    chipApprovalType: (value: string): string => `승인 유형: ${value}`,
    chipStatus: (value: string): string => `상태: ${value}`,
    chipPeriod: (from: string, to: string): string => `상신일: ${from} ~ ${to}`,
    chipPeriodFrom: (from: string): string => `상신일: ${from}부터`,
    chipPeriodTo: (to: string): string => `상신일: ${to}까지`,
    chipKeyword: (value: string): string => `요청번호: ${value}`,
    chipRemoveApprovalType: '승인 유형 조건 제거',
    chipRemoveStatus: '상태 조건 제거',
    chipRemovePeriod: '상신일 조건 제거',
    chipRemoveKeyword: '요청번호 조건 제거',
  },
  /** 쪽 이동. 번호 목록을 두지 않는 근거는 screens/approval-inbox/page-nav.tsx에 있다. */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  /** 빈 상태는 **세 갈래**다. 사용자가 할 조치가 서로 다르다(완료 조건 C12). */
  empty: {
    noResultTitle: '조건에 맞는 승인 요청이 없습니다',
    noResultDescription: '조건을 줄이거나 다른 탭에서 다시 조회하세요.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
    noSelectionTitle: '요청을 고르면 자세한 내용이 보입니다',
    noSelectionDescription: '위 목록에서 요청번호를 누르세요.',
    /**
     * 상세가 **404**. 「없는 것」이라 주소에서 고른 번호를 정리한다 —
     * 남겨 두면 새로고침·공유가 같은 빈자리로 되돌아온다.
     */
    notFoundTitle: '고른 요청을 찾을 수 없습니다',
    notFoundDescription: '이미 처리되었거나 지워진 요청입니다. 목록에서 다시 고르세요.',
    /**
     * 상세가 **403**. 「있는데 내 것이 아닌 것」이라 고른 번호를 **정리하지 않는다** —
     * 지우면 사용자가 무엇을 열려 했는지 잃는다. **다시 시도를 두지 않는다**:
     * 같은 권한으로 다시 불러도 같은 답이 온다.
     */
    forbiddenTitle: '이 요청을 볼 권한이 없습니다',
    forbiddenDescription: '승인자나 상신자만 볼 수 있습니다. 담당자에게 문의하세요.',
  },
  /**
   * 결재(승인·반려) — **되돌릴 수 없는 조작이라 문구가 겹으로 선다.**
   *
   * 계약에 수정·취소 오퍼레이션이 없다. 잘못 누른 승인을 되돌리는 길이 화면에도 서버에도
   * 없으므로, 사용자가 무엇을 하는지 **누르기 전에** 알아야 한다.
   */
  decision: {
    /**
     * **버튼 위 상시 자리에 서는 문장.** 성공 알림에 넣지 않는다 — 알림은 사라지지만
     * 이 문장은 결재함을 보는 내내 참인 사실이고, 버튼이 잠겨 있을 때도 참이다.
     *
     * 계약이 승인 오퍼레이션 설명에 그대로 적었다: 승인은 요청의 상태만 바꾸고
     * 전기·출고 반영은 대상 화면이 따로 한다.
     */
    lockNote: '승인은 자물쇠를 풀 뿐 실행하지 않습니다. 전기·출고는 대상 화면에서 따로 합니다.',
    /**
     * 의견 입력칸 — **하나뿐이다.**
     *
     * 승인이면 선택이고 반려면 필수라 라벨에 필수 표시를 붙이지 않는다(붙이면 승인에는
     * 거짓말이 된다). 어느 쪽에 무엇이 필요한지는 도움말과 반려 버튼의 사유가 말한다.
     */
    commentLabel: '결재 의견',
    commentHelp: '승인은 의견을 적지 않아도 되고, 반려는 의견이 있어야 보낼 수 있습니다.',
    /**
     * 내 차례가 아니면 입력칸도 잠근다 — 보낼 수 없는 말을 적어 두는 자리가 아니다.
     * **결재 진행 구획의 같은 뜻 문장과 글자가 다르다**: 저기는 요청의 상태를 말하고
     * 여기는 **이 컨트롤이 왜 잠겼는지**를 말한다(배치 규범 4 — 사유는 컨트롤 이름으로 시작한다).
     */
    commentDisabledReason: '결재 의견: 지금은 이 요청을 결재할 차례가 아닙니다',
    /** 전송 중 잠금 사유. 같은 잠금을 여러 컨트롤이 나눠 쓰므로 무엇이 도는 중인지 밝힌다. */
    commentSendingReason: '결재 의견: 결재를 보내는 중입니다',
    /**
     * **보내는 자리가 다시 본 결과.** 버튼이 이미 막지만, 확인 창이 열린 사이 값이 비면
     * 여기서 걸린다 — 서버 목이 공백만인 의견을 그대로 받아 주므로 막는 곳이 화면뿐이다.
     */
    commentRequired: '반려 의견을 적어 주세요',
    approve: '승인',
    reject: '반려',
    /** 비활성 사유는 **그 컨트롤의 이름으로 시작한다**(배치 규범 4). */
    blockedNotMyTurn: (action: string): string =>
      `${action}: 지금은 이 요청을 결재할 차례가 아닙니다`,
    /**
     * **뒤에 조작 이름을 되풀이하지 않는다.** 이 함수의 유일한 호출이 반려라 「반려: 반려
     * 의견을…」로 어절이 겹쳤다. 앞머리가 이미 어느 컨트롤의 사유인지 말하므로 뒤는 무엇이
     * 모자란지만 말한다.
     */
    blockedNoComment: (action: string): string => `${action}: 의견을 적어야 보낼 수 있습니다`,
    /**
     * **네트워크가 끊긴 갈래에만** 덧붙인다. 요청이 서버에 닿았는지 화면이 알 수 없고,
     * 다시 누르면 **새 요청으로 나가** 두 번 결재될 수 있다는 사실을 숨기지 않는다.
     */
    deliveryUnknown:
      '전달됐는지 확인할 수 없습니다. 다시 조회해 결재 진행을 확인한 뒤 다시 시도하세요.',
  },
  /**
   * 확인 창 — **입력받지 않고 확인만 한다.** 의견은 아래 구획에서 이미 적었고,
   * 이 창은 「정말 보낼 것인가」만 묻는다.
   */
  dialog: {
    approveTitle: '이 요청을 승인하시겠습니까?',
    rejectTitle: '이 요청을 반려하시겠습니까?',
    /** 무엇을 결재하는지 창 안에서도 밝힌다. 업무 번호라 그대로 낸다 — 내부 번호가 아니다. */
    subject: (approvalRequestNo: string): string => `요청번호 ${approvalRequestNo}`,
    commentHeading: '적어 둔 결재 의견',
    /** 승인은 의견이 선택이라 비어 있을 수 있다. 빈 칸 대신 그 사실을 적는다. */
    noComment: '의견 없이 승인합니다.',
    /** 계약 문면 그대로 — 이 값은 결재 기록(그 단계의 의견)에 남는다. */
    commentRecorded: '이 의견은 결재 기록에 남습니다.',
    /** **되돌릴 수 없음을 명시한다**(계약에 수정·취소 오퍼레이션이 없다). */
    irreversible: '결재는 되돌릴 수 없습니다. 번복하려면 새 요청을 올려야 합니다.',
  },
  /**
   * 결재 성공 알림. **자물쇠 문구를 여기에 넣지 않는다** — 사라지는 자리에 두면
   * 그 사실을 다시 확인할 방법이 없다.
   */
  toast: {
    approved: '승인했습니다',
    rejected: '반려했습니다',
  },
  values: {
    /** 이름이 오지 않았다. **번호를 대신 내지 않는다.** */
    unknownRequester: '상신자를 확인할 수 없습니다',
    /** 사유는 필수 값이라 빈 경우가 정상은 아니다. 그래도 빈 칸을 내지 않고 사실을 적는다. */
    emptyReason: '사유가 비어 있습니다',
    /** 승인자 이름이 오지 않았다. 같은 규율 — **`approverId`를 대신 내지 않는다**. */
    unknownApprover: '승인자를 확인할 수 없습니다',
    /** 대상 표시명이 비어 왔다. 서버가 만드는 값이라 화면이 지어낼 근거가 없다. */
    unknownTarget: '대상 이름을 확인할 수 없습니다',
  },
} as const;

/**
 * W-01-02 긴급 IQC 생략 한도승인.
 *
 * **결재함(W-CO-09)과 같은 계약을 소비하지만 문구를 나눠 갖는다** — 한 묶음을 두 화면이
 * 함께 쓰면 한쪽의 문구 변경이 다른 화면을 조용히 끌고 간다. 형태가 같은 문장이 있어도
 * 그것은 같은 결론에 따로 이른 것이지 공유물이 아니다.
 *
 * 지금까지의 회차(목록·조건 · 상세·결재 진행·대상)가 쓰는 것만 둔다. 대상 처리 현황과
 * 결재의 문구는 그 회차가 이 묶음에 더한다 — **쓰이지 않는 문구를 미리 두지 않는다**
 * (무엇이 렌더되는지 흐려진다).
 */
const iqcSkipApproval = {
  /**
   * 화면 이름은 **설계 스펙의 이름 그대로**다. 화면 안에 한도 구간이 그려지지 않지만
   * (그릴 값이 요청에 없다 — `omf-mes#88`) 이름을 고칠 권한은 클라이언트에 없다.
   */
  title: '긴급 IQC 생략 한도승인',
  /** 스펙의 breadcrumb가 정본이다 — 이 화면은 자재창고 업무의 승인 자리다. */
  breadcrumbRoot: '자재창고',
  panes: {
    list: '승인 요청 목록',
    detail: '고른 요청',
    /**
     * 아래 구획 안의 세 덩어리. 차례는 「무엇을 결재하는가 → 어디에 붙는가 → 어디까지 왔는가」다.
     * 대상 구획은 **잠정**이다 — 수량·현재 상태·입하·공급사는 그 값을 얻는 길이 정해진 뒤에 온다.
     */
    request: '요청 정보',
    target: '대상',
    progress: '결재 진행',
    /** 사유 **전문**이 서는 자리. 줄마다 한 칸이라 값 하나짜리 칸과 구조가 다르다. */
    reason: '사유 전문',
    /**
     * 결재 액션이 서는 자리. **진행 구획 바로 아래**다 — 의견은 내 단계에 남는 말이라
     * 단계 목록 옆이 가장 가깝고, 위의 둘(사유·대상)은 「무엇을 결재하는가」로 축이 다르다.
     */
    decision: '결재',
    /**
     * **《승인 시 결과》 — 결재 버튼 위 상시 구획.**
     *
     * 이 화면의 승인은 이름이 「한도승인」이라 **입고까지 처리된다고 읽히기 쉽다.** 실제로는
     * 요청의 상태만 바뀌고 전표도 상태 전이도 일어나지 않는다 — 그 사실을 결재 전에,
     * 그리고 결재할 수 없을 때에도 말해야 해서 구획으로 세운다(문장 하나짜리 주석이 아니다).
     */
    approvalOutcome: '승인 시 결과',
    /** 확인 창 안의 대상 요약. 「무엇을 결재하는가」를 창에서 다시 세는 자리다. */
    decisionSubject: '결재 대상',
  },
  /**
   * **승인 유형 코드가 확정되기 전까지 상시로 서는 안내**(`omf-mes#64`).
   *
   * 이 화면이 자기 대상을 좁히는 축은 승인 유형 하나인데 그 값이 아직 없다. 그래서 지금은
   * **내가 승인자인 요청이 전부** 보이고, 화면은 그 사실을 감추지 않는다 — 감추면 사용자가
   * 「여기 있는 것은 전부 IQC 생략 건」이라고 믿고 남의 유형을 결재한다.
   *
   * **값이 오면 이 안내는 사라진다.** 안내를 남기면 화면이 거짓말을 한다.
   */
  typePendingNote:
    '승인 유형 코드가 아직 정해지지 않아 이 화면은 내가 승인자인 요청을 모두 보입니다. 유형 열과 사유로 긴급 IQC 생략 건인지 확인하세요.',
  fields: {
    approvalRequestNo: '요청번호',
    approvalTypeCode: '승인 유형',
    /** 대상 문서의 **표시명**. 서버가 만든 이름이라 화면이 짓지 않는다. */
    target: '대상',
    reason: '사유',
    requestedByName: '상신자',
    /**
     * 목록 열 이름. **조건 줄의 「상신일」과 낱말이 다른 것이 맞다** — 계약이 이 값을
     * `date-time`으로 내려 목록도 시각까지 보이지만, 좁히는 조건은 `format: date`라
     * 날짜 단위다. 같은 낱말을 쓰면 시각까지 지정할 수 있다고 읽힌다.
     */
    requestedAt: '상신 일시',
    status: '상태',
    /** 조건 줄의 기간 라벨. 위 주석의 뒤쪽 근거가 이 자리다. */
    period: '상신일',
    q: '요청번호 검색',
    /**
     * 계약 파라미터(`pendingOnly`)를 그대로 드러낸 확인칸이다. **기본이 켜짐**이라
     * 이 화면에 들어오면 결재 대기부터 보이고, 끄면 끝난 건까지 함께 보인다.
     */
    pendingOnly: '결재 대기만 보기',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    /** 목록을 다시 부른다. 회차가 늘면 그때 늘어난 조회도 **함께** 부른다. */
    reload: '다시 조회',
    /*
     * 요청번호 하나로 이름이 선다 — 계약이 그 값을 UNIQUE로 두었다.
     * 보이는 글자를 그대로 담아 음성 조작이 그 말로 이 버튼을 부를 수 있게 하고,
     * **내부 번호는 접근 이름에도 넣지 않는다.**
     */
    selectRow: (approvalRequestNo: string): string => `${approvalRequestNo} 선택`,
  },
  loading: {
    list: '승인 요청 목록 불러오는 중',
    detail: '고른 요청 불러오는 중',
  },
  /**
   * 대상 구획 — **지금은 표시명과 「열기」뿐이다.**
   *
   * 스펙이 이 자리에 수량·현재 상태·입하·공급사를 그리라고 적었으나 **그 값을 얻는 길이
   * 계약에 정해지지 않았다**(질문 게시 중). 없는 값을 그리려면 화면이 대상 유형을 보고
   * 부를 곳을 고르는 매핑표를 만들어야 하는데 그것이 계약이 금지한 일이다. 그래서 지금은
   * **결재함과 같은 수준**으로 두고, 길이 정해지면 이 구획에 값이 붙는다.
   */
  target: {
    open: '열기',
    /**
     * 「열기」가 잠기는 **세 갈래**. 사유가 서로 다른 이유는 사용자가 할 조치가 다르기 때문이다 —
     * ①은 대상 자체가 열 화면이 없는 것이고, ②는 규약이 아직 정해지지 않은 것이며,
     * ③은 그 화면이 이 앱에 아직 없는 것이다. 한 문구로 뭉개면 셋을 구분할 수 없다.
     */
    blockedNotOpenable: '열기: 이 대상은 열 수 있는 화면이 없습니다',
    blockedNoScreenId: '열기: 이 대상을 여는 화면이 정해지지 않았습니다',
    blockedUnmapped: '열기: 이 화면은 아직 관리웹에 없습니다',
    /** 이 구획이 무엇을 하지 않는지 밝힌다 — 여기서 문서를 읽을 수 있다고 오해하지 않게. */
    note: '내용은 원 화면에서 확인합니다',
  },
  /**
   * 결재 진행. **여기 있는 값은 전부 서버가 준 것을 그대로 옮긴 것이다** —
   * 단계 배열을 훑어 다시 계산하지 않는다(계획 결정 7).
   */
  progress: {
    /** 몇 단계 중 몇 번째인가. **`currentStepNo`·`totalStepNo` 그대로다.** */
    position: (current: number, total: number): string =>
      `${String(current)} / ${String(total)} 단계`,
    /** 기다리는 단계가 없다(`currentStepNo`가 비었다). **0으로 메우지 않는다.** */
    finished: (total: number): string => `결재 종료 · 전체 ${String(total)}단계`,
    /**
     * 지금 이 요청을 결재할 수 있는가 — **`isMyTurn` 그대로다.**
     *
     * **왜 아닌지는 말하지 않는다.** 앞 단계가 안 끝난 것인지, 내가 승인자가 아닌 것인지,
     * 이미 끝난 요청인지 화면은 판정할 수 없다 — 아는 것만 말하고 이유를 지어내지 않는다.
     */
    myTurn: '지금 이 요청을 결재할 차례입니다',
    notMyTurn: '지금은 이 요청을 결재할 차례가 아닙니다',
    /**
     * 아직 결재되지 않은 단계의 보조 라벨. **디자인 시스템의 상태 낱말이 스크린리더 전용**이라
     * 보이는 글자를 이 자리가 맡는다 — 색·아이콘에만 기대지 않는다.
     */
    waitingCurrent: '지금 결재를 기다리는 단계입니다',
    waitingPending: '아직 결재하지 않은 단계입니다',
    /** 로그인 사용자가 승인자인 단계(`isMine`). */
    mine: '내 단계',
    /** 단계 배열이 비어 왔다. 계약이 배열을 필수로 두었으나 빈 배열은 스키마를 통과한다. */
    noSteps: '결재 단계가 오지 않았습니다',
    /**
     * **화면 이름에는 「한도」가 있는데 화면 안에 한도 구간이 없다** — 그 사실을 밝힌다.
     *
     * 구간은 결재선의 값이고 요청에서 결재선으로 가는 길이 계약에 없다(`omf-mes#88`).
     * 아무 말도 하지 않으면 사용자가 없는 것을 찾는다. **구간을 지어내지 않고 사실만 적는다.**
     */
    limitRangeNote:
      '한도 구간은 아직 화면에 표시되지 않습니다. 결재선 단계로 승인 범위를 확인하세요.',
  },
  filters: {
    all: '전체',
    chipStatus: (value: string): string => `상태: ${value}`,
    chipPeriod: (from: string, to: string): string => `상신일: ${from} ~ ${to}`,
    chipPeriodFrom: (from: string): string => `상신일: ${from}부터`,
    chipPeriodTo: (to: string): string => `상신일: ${to}까지`,
    chipKeyword: (value: string): string => `요청번호: ${value}`,
    chipRemoveStatus: '상태 조건 제거',
    chipRemovePeriod: '상신일 조건 제거',
    chipRemoveKeyword: '요청번호 조건 제거',
  },
  /** 쪽 이동. 번호 목록을 두지 않는 근거는 screens/iqc-skip-approval/page-nav.tsx에 있다. */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  /** 빈 상태는 **세 갈래**다. 사용자가 할 조치가 서로 다르다. */
  empty: {
    noResultTitle: '조건에 맞는 승인 요청이 없습니다',
    /** **이 화면에는 탭이 없다** — 넓히는 수단이 확인칸 하나라 그것을 가리킨다. */
    noResultDescription: '조건을 줄이거나 「결재 대기만 보기」를 꺼 보세요.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
    noSelectionTitle: '요청을 고르면 자세한 내용이 보입니다',
    noSelectionDescription: '위 목록에서 요청번호를 누르세요.',
    /**
     * 상세가 **404**. 「없는 것」이라 주소에서 고른 번호를 정리한다 —
     * 남겨 두면 새로고침·공유가 같은 빈자리로 되돌아온다.
     */
    notFoundTitle: '고른 요청을 찾을 수 없습니다',
    notFoundDescription: '이미 처리되었거나 지워진 요청입니다. 목록에서 다시 고르세요.',
    /**
     * 상세가 **403**. 「있는데 내 것이 아닌 것」이라 고른 번호를 **정리하지 않는다** —
     * 지우면 사용자가 무엇을 열려 했는지 잃는다. **다시 시도를 두지 않는다**:
     * 같은 권한으로 다시 불러도 같은 답이 온다.
     */
    forbiddenTitle: '이 요청을 볼 권한이 없습니다',
    forbiddenDescription: '승인자나 상신자만 볼 수 있습니다. 담당자에게 문의하세요.',
  },
  /**
   * 결재(승인·반려) — **되돌릴 수 없는 조작이라 문구가 겹으로 선다.**
   *
   * 계약에 수정·취소 오퍼레이션이 없다. 잘못 누른 승인을 되돌리는 길이 화면에도 서버에도
   * 없으므로, 사용자가 무엇을 하는지 **누르기 전에** 알아야 한다.
   */
  decision: {
    /**
     * **《승인 시 결과》 세 문장.** 버튼 위 상시 구획이며 **성공 알림에 넣지 않는다** —
     * 알림은 사라지지만 이 셋은 화면을 보는 내내 참인 사실이고, **버튼이 잠겨 있을 때도 참이다.**
     *
     * 세 문장이 서로 다른 오해를 하나씩 막는다. 한 문장으로 뭉치면 어느 오해가 남았는지
     * 알 수 없고, 줄이면 「그래서 입고는 됐나」가 결재 뒤에 남는다.
     *
     * | 문장 | 막는 오해 |
     * | :-: | --- |
     * | ① | 승인이 곧 **검사 생략의 실행**이라는 오해 |
     * | ② | 승인이 **입고 전표·ERP 송신**을 낸다는 오해 |
     * | ③ | 승인으로 **검사가 끝나고 Lot 상태가 넘어간다**는 오해 |
     */
    outcome: {
      statusOnly:
        '승인은 이 요청을 승인 상태로 바꿀 뿐입니다. 검사 생략이 이 승인으로 실행되지 않습니다.',
      /** 전표가 나가는 자리는 이 화면이 아니고, 거기서도 **합격품에 한해서만** 나간다. */
      noErpDocument:
        '승인해도 입고 전표와 ERP 송신은 일어나지 않습니다. 그 처리는 「정상품 입하 처리」 화면에서 합격품에 한해 합니다.',
      inspectionPending:
        '검사는 여전히 끝나지 않은 상태입니다. Lot Status 전이와 입고 처리는 「정상품 입하 처리」 화면에서 따로 합니다.',
    },
    /**
     * 의견 입력칸 — **하나뿐이다.**
     *
     * 승인이면 선택이고 반려면 필수라 라벨에 필수 표시를 붙이지 않는다(붙이면 승인에는
     * 거짓말이 된다). 어느 쪽에 무엇이 필요한지는 도움말과 반려 버튼의 사유가 말한다.
     */
    commentLabel: '결재 의견',
    commentHelp: '승인은 의견을 적지 않아도 되고, 반려는 의견이 있어야 보낼 수 있습니다.',
    /**
     * **반려 의견의 형식을 유도한다.** 계약이 반려 의견을 필수로 둔 목적이 「상신자가 무엇을
     * 고쳐야 하는지 알게 하는 것」이라 적었다 — 필수로만 두면 한 글자짜리 반려가 기록에 남고
     * 상신자는 같은 요청을 그대로 다시 올린다.
     *
     * **도움말과 갈라 둔다.** 위는 「언제 보낼 수 있는가」이고 이것은 「무엇을 적는가」다.
     */
    commentRejectGuide:
      '반려한다면 무엇을 고쳐야 다시 올릴 수 있는지 적으세요. 결재는 되돌릴 수 없고 번복은 새 요청입니다.',
    /**
     * 내 차례가 아니면 입력칸도 잠근다 — 보낼 수 없는 말을 적어 두는 자리가 아니다.
     * **결재 진행 구획의 같은 뜻 문장과 글자가 다른 것이 맞다**: 저기는 요청의 상태를 말하고
     * 여기는 **이 컨트롤이 왜 잠겼는지**를 말한다(배치 규범 4 — 사유는 컨트롤 이름으로 시작한다).
     */
    commentDisabledReason: '결재 의견: 지금은 이 요청을 결재할 차례가 아닙니다',
    /** 전송 중 잠금 사유. 같은 잠금을 여러 컨트롤이 나눠 쓰므로 무엇이 도는 중인지 밝힌다. */
    commentSendingReason: '결재 의견: 결재를 보내는 중입니다',
    /**
     * **보내는 자리가 다시 본 결과.** 버튼이 이미 막지만, 확인 창이 열린 사이 값이 비면
     * 여기서 걸린다 — 서버 목이 공백만인 의견을 그대로 받아 주므로 막는 곳이 화면뿐이다.
     */
    commentRequired: '반려 의견을 적어 주세요',
    approve: '승인',
    reject: '반려',
    /** 비활성 사유는 **그 컨트롤의 이름으로 시작한다**(배치 규범 4). */
    blockedNotMyTurn: (action: string): string =>
      `${action}: 지금은 이 요청을 결재할 차례가 아닙니다`,
    /** 앞머리가 이미 어느 컨트롤의 사유인지 말하므로 뒤는 무엇이 모자란지만 말한다. */
    blockedNoComment: (action: string): string => `${action}: 의견을 적어야 보낼 수 있습니다`,
    /**
     * **네트워크가 끊긴 갈래에만** 덧붙인다. 요청이 서버에 닿았는지 화면이 알 수 없고,
     * 다시 누르면 **새 요청으로 나가** 두 번 결재될 수 있다는 사실을 숨기지 않는다.
     */
    deliveryUnknown:
      '전달됐는지 확인할 수 없습니다. 다시 조회해 결재 진행을 확인한 뒤 다시 시도하세요.',
  },
  /**
   * 확인 창 — **입력받지 않고 확인만 한다.** 의견은 아래 구획에서 이미 적었고,
   * 이 창은 「정말 보낼 것인가」만 묻는다.
   *
   * **이 화면의 창은 결재함의 것보다 대상 요약이 넓다.** 승인 유형 코드가 미확정이라
   * 목록에 다른 유형의 요청이 섞여 오고(`omf-mes#64`), 오결재를 막는 마지막 자리가 여기다.
   */
  dialog: {
    approveTitle: '이 요청을 승인하시겠습니까?',
    rejectTitle: '이 요청을 반려하시겠습니까?',
    commentHeading: '적어 둔 결재 의견',
    /** 승인은 의견이 선택이라 비어 있을 수 있다. 빈 칸 대신 그 사실을 적는다. */
    noComment: '의견 없이 승인합니다.',
    /** 이 값은 결재 기록(그 단계의 의견)에 남는다. */
    commentRecorded: '이 의견은 결재 기록에 남습니다.',
    /** **되돌릴 수 없음을 명시한다**(계약에 수정·취소 오퍼레이션이 없다). */
    irreversible: '결재는 되돌릴 수 없습니다. 번복하려면 새 요청을 올려야 합니다.',
  },
  /**
   * 결재 성공 알림. **《승인 시 결과》를 여기에 넣지 않는다** — 사라지는 자리에 두면
   * 그 사실을 다시 확인할 방법이 없다(그 구획이 상시로 서는 이유).
   */
  toast: {
    approved: '승인했습니다',
    rejected: '반려했습니다',
  },
  values: {
    /** 이름이 오지 않았다. **번호를 대신 내지 않는다**(`omf-mes#44`). */
    unknownRequester: '상신자를 확인할 수 없습니다',
    /** 승인자 이름이 오지 않았다. 같은 규율 — **`approverId`를 대신 내지 않는다**. */
    unknownApprover: '승인자를 확인할 수 없습니다',
    /** 대상 표시명이 비어 왔다. 서버가 만드는 값이라 화면이 지어낼 근거가 없다. */
    unknownTarget: '대상 이름을 확인할 수 없습니다',
    /** 사유는 필수 값이라 빈 경우가 정상은 아니다. 그래도 빈 칸을 내지 않고 사실을 적는다. */
    emptyReason: '사유가 비어 있습니다',
  },
} as const;

/**
 * W-01-11 신규 P/O 등록. **초과 입하분을 사후에 정산하기 위한 등록 전용 화면이다.**
 *
 * 이 회차 몫만 담는다 — 넘어온 초과분을 읽고, 그 줄을 승계한 발주 정보·라인을 치는 데까지다.
 * 등록·승인 요청·결과 문구는 뒤따르는 회차에서 더한다.
 *
 * **「일반 구매 발주를 만드는 곳이 아니다」가 이 화면의 첫 문장이다.** 일반 발주는 바깥에서
 * 발행돼 들어오고 이 화면은 그 규칙의 예외라, 예외라는 사실을 화면 안에서 늘 밝힌다.
 *
 * **상태·승인 유형의 값 목록을 화면이 정하지 않는다.** 서버가 준 값을 그대로 보이고
 * 값 자체로 분기하지 않는다(공유계약 G-2).
 */
const poRegister = {
  title: '신규 P/O 등록',
  breadcrumbRoot: '자재창고',
  panes: {
    source: '대상 초과분',
    header: '발주 정보',
    lines: '발주 라인',
  },
  /**
   * 화면 맨 위에 늘 서는 범위 안내. **맥락이 있든 없든 접지 않는다** —
   * 이 화면을 일반 발주 등록으로 읽는 것이 이 화면에서 가장 비싼 오해다.
   */
  scope: {
    title: '초과 입하분을 사후에 등록하는 화면입니다',
    description:
      '초과 입하 분리에서 넘어온 초과분을 정산할 P/O를 만듭니다. 일반 구매 발주는 이 화면에서 만들지 않습니다.',
  },
  fields: {
    supplier: '공급사',
    businessUnit: '사업부',
    plant: '공장',
    orderDate: '발주일',
    expectedReceiptDate: '입고 예정일',
  },
  /** 넘어온 초과분 — **읽기 전용이다.** 값을 고치는 자리가 아니라 무엇을 정산하는지 밝히는 자리다. */
  source: {
    label: '대상 초과분',
    inboundReceiptNo: '입하번호',
    supplier: '공급사',
    plant: '공장',
    status: '상태',
    lineNo: '줄번호',
    item: '품목',
    receivedQty: '입하수량',
    uom: '단위',
    choose: '대상 선택',
    /** 고른 줄에 붙는 표식. 고른 뒤에는 버튼 자리를 이 표식이 대신한다 */
    chosen: '대상',
    /**
     * 줄마다 같은 글자가 되풀이되므로 접근 이름에 줄번호를 넣되 **보이는 글자를 그대로 담는다** —
     * 담지 않으면 음성 조작이 「대상 선택」으로 이 버튼을 부를 수 없다.
     * **내부 번호를 쓰지 않는다** — 그것이 화면 밖으로 새는 또 하나의 경로다.
     */
    chooseRow: (lineNo: number): string => `${String(lineNo)}번 줄 대상 선택`,
    inheritNote:
      '고른 줄이 발주 라인 1행으로 승계됩니다. 발주수량 기본값은 입하수량이고, 그보다 적게 발주할 수 없습니다.',
    singleLineNote: '입하 라인이 한 줄이라 그 줄이 대상으로 확정됐습니다.',
  },
  /**
   * 발주 라인 표. **표 안의 입력칸이라 보이는 라벨을 둘 자리가 없다**(배치 규범 3의 이탈 조건) —
   * 줄번호를 접근 이름에 넣어 어느 줄의 칸인지 밝힌다.
   */
  lineTable: {
    lineNo: '줄번호',
    item: '품목',
    orderedQty: '발주수량',
    uom: '단위',
    toleranceOver: '초과 허용',
    toleranceUnder: '부족 허용',
    rowActions: '행 조작',
    /** 승계된 줄이라는 표식. 품목·단위를 고를 수 없는 사정을 이 표식이 밝힌다. */
    inherited: '승계',
    itemLabel: (lineNo: number): string => `${String(lineNo)}번 줄 품목`,
    orderedQtyLabel: (lineNo: number): string => `${String(lineNo)}번 줄 발주수량`,
    uomLabel: (lineNo: number): string => `${String(lineNo)}번 줄 단위`,
    toleranceOverLabel: (lineNo: number): string => `${String(lineNo)}번 줄 초과 허용`,
    toleranceUnderLabel: (lineNo: number): string => `${String(lineNo)}번 줄 부족 허용`,
    /** 승계 줄의 하한. 오류가 나기 전에 얼마 이상인지 읽히게 한다. */
    minNote: (sourceQty: number): string => `초과분 ${String(sourceQty)} 이상`,
  },
  actions: {
    addLine: '라인 추가',
    removeLine: (lineNo: number): string => `${String(lineNo)}번 줄 삭제`,
    register: '등록',
    cancel: '취소',
    /**
     * 확인 창의 실행 버튼. **화면의 「등록」과 글자를 갈라 둔다** — 같은 글자면 창이 열린 동안
     * 두 버튼이 같은 이름으로 서고, 무엇을 누르는지 창을 다시 읽어야 알게 된다.
     */
    confirmRegister: '등록 실행',
    keepEditing: '계속 입력',
    discardDraft: '입력 버리기',
    /**
     * 상신. **등록과 별개 동작이다**(착수 이슈 §6 ③ · 계획 결정 9) — 등록을 마친 전표가
     * 있어야 이 버튼이 서고, 한 번의 조작이 두 요청을 잇지 않는다.
     */
    requestApproval: '승인 요청',
    /** 확인 창의 실행 버튼. **화면의 「승인 요청」과 글자를 갈라 둔다**(등록 쪽과 같은 규율). */
    confirmSubmit: '승인 요청 실행',
  },
  /**
   * 상신 사유 칸.
   *
   * **첫 줄이 결재함 목록의 요약을 겸한다**(공유계약 A-12) — 보조 문구가 그 사실을 밝혀
   * 사용자가 첫 줄을 요약으로 쓰게 유도한다. **글자 수를 강제하지 않는다**(계약이 정한 것은
   * 「한 글자 이상」뿐이다) — 유도는 막는 것이 아니라 보이는 것으로 한다.
   */
  submit: {
    reason: '요청 사유',
    reasonPlaceholder: '첫 줄에 요약을 적고, 다음 줄부터 근거를 적으세요.',
    reasonHelper: '첫 줄이 결재함 목록의 요약이 됩니다.',
  },
  /**
   * 비활성 사유는 **그 컨트롤의 이름으로 시작한다**(배치 규범 4).
   *
   * **이탈 조건 — 한 사정이 여러 조작을 한꺼번에 잠글 때는 사정을 주어로 삼는다.** 나가는 중과
   * 이미 등록한 뒤는 등록·취소·대상 선택을 함께 잠그므로, 자리마다 컨트롤 이름을 앞세우면 같은
   * 사실이 여러 말로 읽힌다.
   */
  actionReasons: {
    noContext:
      '등록은 넘어온 초과분이 있어야 할 수 있습니다. 초과 입하 분리에서 초과분을 등록한 뒤 그 결과에서 이어 오세요.',
    /** 아직 못 받았거나 못 받게 된 두 사정을 **한 문장이 함께 맡는다** — 사용자가 할 일이 같다. */
    sourceNotLoaded: '등록은 대상 초과분을 불러온 뒤에 할 수 있습니다.',
    sourceLineNotChosen:
      '등록은 대상 초과분을 고른 뒤에 할 수 있습니다. 위 구획에서 줄을 하나 고르세요.',
    /**
     * **고를 줄이 하나도 없는 갈래를 따로 맡는다.** 「줄을 하나 고르세요」로 뭉개면 고를 것이
     * 없는 화면에서 풀 수 없는 조치를 지시하게 되고, 규범 4-5가 요구하는 「풀리는 조건」이
     * 거짓이 된다.
     */
    noSourceLines:
      '등록은 승계할 줄이 있어야 할 수 있습니다. 이 입하 전표에는 줄이 없으니 대상 전표를 다시 확인하세요.',
    headerIncomplete: '등록은 발주 정보의 필수 항목을 채운 뒤에 할 수 있습니다.',
    lineInvalid: '등록은 발주 라인의 오류를 고친 뒤에 할 수 있습니다.',
    /**
     * 나가는 중. **한 문장이 화면의 모든 조작을 맡는다** — 등록·취소·대상 선택·입력칸이 같은
     * 사정으로 함께 잠기므로, 자리마다 다른 문구를 두면 같은 사실이 여러 말로 읽힌다.
     */
    saving: '등록을 보내는 중입니다. 응답이 오면 다시 쓸 수 있습니다.',
    /**
     * 이미 만들었다. **되돌릴 경로를 지어내지 않고 다시 시작할 자리를 가리킨다** —
     * 만들어진 전표를 이 화면에서 취소할 수 없고(취소는 승인을 탄다), 폼을 열어 두면
     * 한 번 더 누르는 것이 그대로 전표 두 벌이 된다.
     */
    alreadyRegistered:
      '이미 등록했습니다. 다른 초과분을 등록하려면 초과 입하 분리에서 다시 시작하세요.',
    /** 되돌릴 것이 없다. 「취소」가 무엇을 하는 버튼인지 이 문장이 함께 말한다. */
    nothingToDiscard: '취소로 되돌릴 입력이 없습니다. 친 값이 있으면 승계된 값으로 되돌립니다.',
    /**
     * 사유가 비었거나 **공백만**이다(완료 조건 C27). 목이 공백만인 사유를 202로 통과시키므로
     * (실측) 막는 곳이 화면뿐이고, 통과하면 결재함 목록의 요약이 빈 요청이 올라간다.
     */
    reasonRequired: '승인 요청은 사유를 적은 뒤에 할 수 있습니다. 공백만으로는 보낼 수 없습니다.',
    /** 상신이 나가는 중. **등록의 「보내는 중」과 갈라 둔다** — 무엇이 나가는지가 다르다. */
    submitting: '승인 요청을 보내는 중입니다. 응답이 오면 다시 쓸 수 있습니다.',
  },
  errors: {
    supplierRequired: '공급사를 고르세요.',
    businessUnitRequired: '사업부를 고르세요.',
    plantRequired: '공장을 고르세요.',
    orderDateRequired: '발주일을 고르세요.',
    itemRequired: '품목을 고르세요.',
    uomRequired: '단위를 고르세요.',
    qtyRequired: '발주수량을 넣으세요.',
    qtyNotNumber: '발주수량은 숫자로 넣으세요.',
    qtyNotPositive: '발주수량은 0보다 커야 합니다.',
    /** **수량을 문구에 채운다** — 얼마까지 내릴 수 있는지 화면에서 읽혀야 고칠 수 있다. */
    qtyBelowSource: (sourceQty: number): string =>
      `초과분 ${String(sourceQty)}보다 적게 발주할 수 없습니다.`,
    toleranceNotNumber: '허용치는 숫자로 넣으세요.',
    toleranceNegative: '허용치는 0보다 작을 수 없습니다.',
  },
  /** 경고는 **막지 않는다.** 그대로 등록할 수 있고, 다만 무엇이 뒤따르는지 알린다. */
  warnings: {
    toleranceOverPositive: '초과 허용치를 크게 두면 다음 초과 입하도 같은 처리가 필요해집니다.',
    supplierChanged:
      '승계된 공급사와 다른 곳을 골랐습니다. 초과분을 보낸 곳과 발주를 받는 곳이 갈립니다.',
  },
  /**
   * 확인 창 둘.
   *
   * **등록 확인은 되돌릴 수 없는 조작 앞의 마지막 층이다** — 무엇을 만드는지 되보이고 되돌릴
   * 수 없다는 사실을 적는다. **버리기 확인은 반대쪽이다** — 잃는 것이 친 값뿐이다.
   */
  dialog: {
    registerTitle: '이 내용으로 P/O를 등록할까요?',
    registerLead: '아래 내용으로 발주 전표 한 건을 만듭니다.',
    lineCount: (count: number): string => `발주 라인 ${String(count)}행`,
    totalOrderedQty: '합계 발주수량',
    /**
     * 합계를 낼 수 없는 갈래. **0으로 접지 않는다** — 읽을 수 없는 수량이 섞여 있다는 사실과
     * 「합계가 0」은 다른 말이고, 뒤쪽으로 접으면 사용자가 빈 발주를 만드는 것으로 읽는다.
     */
    totalUnreadable: '합계를 낼 수 없습니다',
    /** 단위가 여러 줄에 걸쳐 갈리면 합계가 한 단위의 수량이 아니다 — 그 사실을 적는다. */
    mixedUom: '줄마다 단위가 달라 합계가 한 단위의 수량이 아닙니다.',
    /** 무엇이 일어나는지가 실행 버튼 바로 위에 선다. */
    registerNoUndo: '등록 뒤에는 이 화면에서 되돌릴 수 없습니다. 취소는 승인을 거쳐야 합니다.',
    /** 등록과 승인 요청이 **별개 동작**이라는 사실(착수 이슈 §6 ③). */
    registerIsNotApproval: '등록만 합니다. 결재 상신은 별개 동작입니다.',
    discardTitle: '친 내용을 버릴까요?',
    discardLead:
      '발주 정보와 라인에 친 내용이 사라지고 넘어온 초과분에서 승계된 값으로 돌아갑니다.',
    submitTitle: '이 사유로 결재에 올릴까요?',
    submitLead: '아래 사유로 이 발주의 승인을 요청합니다.',
    /** 사유는 **전문과 첫 줄을 나눠** 보인다 — 어느 줄이 남들에게 요약으로 보일지 알려야 한다. */
    reasonFull: '사유 전문',
    reasonFirstLine: '결재함 목록에 요약으로 보일 첫 줄',
    reasonSummaryNote: '결재함 목록에서는 이 첫 줄만 보입니다.',
    /**
     * **승인 주체를 화면이 정하지 않는다**(착수 이슈 §6 ④ · 계획 결정 8).
     *
     * 계약의 승인 요청 본문은 사유 한 칸이라 승인 유형·승인자·결재선을 보낼 자리가 없다 —
     * 그 사실을 창이 적어야 사용자가 「여기서 결재선을 고르지 않았다」를 결함으로 읽지 않는다.
     */
    submitApprover: '승인자와 결재선은 이 화면이 정하지 않습니다. 결재선 정의대로 전개됩니다.',
    /** 반려된 뒤 다시 올리는 것은 **새 요청**이다 — 「취소할 수 있습니다」로 읽히지 않게 적는다. */
    submitNoUndo:
      '올린 뒤에는 이 화면에서 되돌릴 수 없습니다. 반려된 뒤 다시 올리는 것은 새 요청입니다.',
  },
  /**
   * 등록 결과 — **화면이 확인한 것만 말한다.**
   *
   * | 말한다 | 말하지 않는다 |
   * | --- | --- |
   * | 만들어진 전표번호 · **서버가 준 상태 코드 그대로** · 서버가 저장한 라인 수 | 「발주가 확정됐습니다」 — 상태를 화면이 옮겨 적지 않는다(공유계약 G-2) |
   * | ERP 발주번호가 **비어 있다는 사실**과 언제 채워지는지 | 「ERP 연계에 실패했습니다」 — 아직 매칭 시점이 아닌 것과 실패는 다른 말이다(`omf-mes#72`) |
   */
  result: {
    label: '등록 결과',
    createdTitle: (purchaseOrderNo: string): string =>
      `발주 전표 ${purchaseOrderNo}를 만들었습니다`,
    createdDescription: '초과 입하분을 정산할 발주가 등록됐습니다.',
    purchaseOrderNo: '전표번호',
    /**
     * **어느 시점의 값인지를 라벨이 밝힌다.** 이 코드는 **전표를 만들 때** 서버가 준 것이고
     * 그 뒤 상신·승인으로 달라진다 — 밝히지 않으면 지금 상태로 읽힌다.
     */
    createdStatusCode: '등록 시점의 상태',
    erpPurchaseOrderNo: 'ERP 발주번호',
    /** 값이 비어 있다는 사실. **결함이 아니라 순서다** — MES가 먼저 만들고 매칭은 나중이다. */
    erpUnmatched: 'ERP 미매칭',
    erpUnmatchedNote: '연계 후 채워집니다.',
    /** 서버가 되돌려 준 줄을 센다 — 화면이 보낸 줄을 되비추면 무엇이 저장됐는지가 아니다. */
    lineCount: (count: number): string => `발주 라인 ${String(count)}행이 저장됐습니다.`,
    /** 상신이 나가는 중. **전표는 이미 만들어졌다**는 사실이 배너 제목에 그대로 남는다. */
    submitting: '결재에 올리는 중입니다.',
    submittedTitle: (purchaseOrderNo: string): string =>
      `발주 전표 ${purchaseOrderNo}를 결재에 올렸습니다`,
    /**
     * **진행 상태는 이 화면이 말하지 않는다**(착수 이슈 §6 ③ · 계획 결정 11).
     *
     * 결재 대기 목록·진행 단계를 여기에 두지 않고 결재함(W-CO-09 · 사이드바 「결재함」)을
     * 가리킨다 — 실재하고 사용자가 갈 수 있는 자리라 이 안내가 할 수 있는 조치를 지시한다.
     */
    submittedDescription: '진행 상태는 결재함에서 확인하세요.',
    /**
     * 응답이 **내부 식별자 하나뿐**이라 화면에 낼 업무 번호가 없다(`omf-mes#44`).
     *
     * **번호를 누가 매기는지는 말하지 않는다** — 화면이 아는 것은 「여기에 낼 값이 없다」와
     * 「결재함이 그 번호를 보인다」 둘뿐이고(결재함 화면이 실제로 요청번호를 그린다), 그 밖은
     * 서버의 일이라 지어내면 거짓이 된다.
     */
    submittedNoRequestNo:
      '승인 요청 번호는 이 화면에 낼 값이 없습니다. 번호는 결재함에서 볼 수 있습니다.',
    /**
     * **전표는 남고 상신만 실패했다**(완료 조건 C31).
     *
     * 통째로 실패라고 말하면 사용자가 처음부터 다시 만들어 **전표가 두 벌** 남고, 통째로
     * 성공이라고 말하면 결재에 올라가지 않은 발주를 올라간 것으로 믿는다. 화면은 **첫 응답을
     * 받았다** — 확인한 사실이라 말할 수 있다.
     */
    submitFailedTitle: (purchaseOrderNo: string): string =>
      `발주 전표 ${purchaseOrderNo}는 만들어졌고 결재에는 올라가지 않았습니다`,
    submitFailedDescription:
      '전표는 그대로 남아 있습니다. 아래에서 다시 올릴 수 있으니 같은 내용을 다시 등록하지 마세요.',
  },
  values: {
    unknown: '알 수 없음',
    referenceLoading: '이름 불러오는 중',
    referenceFailed: '이름 불러오기 실패',
    inactiveSuffix: ' (미사용)',
  },
  lookups: {
    truncated: '선택지가 앞쪽 일부만 보입니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
    failed: '선택지를 불러오지 못했습니다.',
  },
  loading: {
    sourceReceipt: '대상 초과분을 불러오는 중',
  },
  empty: {
    noContextTitle: '넘어온 초과분이 없습니다',
    noContextDescription:
      '초과 입하 분리에서 초과분을 등록하면 그 결과에서 이 화면으로 올 수 있습니다.',
    noSourceLinesTitle: '이 입하 전표에는 라인이 없습니다',
    noSourceLinesDescription:
      '승계할 줄이 없어 발주를 만들 수 없습니다. 대상 전표를 다시 확인하세요.',
    noTargetTitle: '아직 대상 초과분을 고르지 않았습니다',
    noTargetDescription: '위 구획에서 줄을 하나 고르면 그 줄이 발주 라인 1행으로 승계됩니다.',
  },
  reasons: {
    referencesFailed:
      '공급사·사업부·공장·품목·단위 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
  },
  notes: {
    /** 줄번호를 화면이 정하지 않는다는 사실(공유계약 A-5). 표의 번호는 위치일 뿐이다. */
    lineNoAssignedByServer: '줄번호는 등록할 때 배열 순서대로 매겨집니다.',
    /**
     * **응답이 오지 않은 요청은 「실패」가 아니다** — 멱등 완화의 마지막 층(공유계약 C-1).
     *
     * 쓰기 훅이 호출마다 새 멱등 키를 만들어, 그대로 다시 보내면 서버에는 다른 요청으로 보인다.
     * 이 화면의 요청은 전표를 만드는 것이라 두 번 전달되면 전표가 두 벌 남는다.
     * **네트워크 갈래에만 붙인다** — 서버가 거절한 요청은 전달된 것이 확실하다.
     *
     * **없는 화면을 가리키지 않는다.** 이 제품에는 아직 발주를 조회할 화면이 없고(P/O 목록은
     * 별도 화면 소관 · 아직 착수되지 않았다) 이 화면은 메뉴에도 없다 — 확인하러 갈 자리를
     * 지어내면 「할 수 없는 조치」를 지시하게 되고, 그 순간 이 완화가 무력해진다. 그래서
     * **확인할 수 없다는 사실과 하지 말아야 할 일**을 말한다.
     *
     * ⚠ **발주를 조회하는 화면이 서면 이 문구를 그 화면을 가리키도록 갱신한다.**
     */
    networkUnconfirmed:
      '응답을 받지 못해 등록됐는지 이 화면에서 확인할 수 없습니다. 발주가 이미 만들어졌을 수 있으니 같은 내용을 바로 다시 등록하지 마세요.',
  },
} as const;

/**
 * W-CO-01 계정 로그인 — **관리웹에서 셸을 쓰지 않는 유일한 화면**의 문구다.
 *
 * 이 블록의 문구는 **어느 칸이 틀렸는지 지목하지 않는다.** 로그인 화면에서 칸을 지목하는 말은
 * 곧 「그 아이디는 있다」를 흘리는 말이 된다 — 아직 아무것도 보내지 않은 활성 조건 안내에서도
 * 같은 규율을 지킨다. 여기서 한 번 지목하기 시작하면 그 형태가 실패 문구로 그대로 옮아간다.
 */
const login = {
  title: '로그인',
  fields: {
    loginId: '아이디',
    password: '비밀번호',
  },
  actions: {
    submit: '로그인',
  },
  actionReasons: {
    /**
     * 로그인 버튼이 잠긴 사유. **컨트롤 이름으로 시작하고 「어떻게 풀 것인가」를 담는다**
     * (이 파일의 작성 규칙 · 배치 규범 4-5 · 공유계약 G-3).
     *
     * 규범 4의 「값과 근거」가 **예로 든** 두 마디 문형(「…없습니다. …이면 이 버튼을 쓸 수
     * 있습니다」)까지는 따르지 않는다. 규범이 규칙으로 못 박은 것은 「컨트롤 이름으로 시작한다」
     * 하나이고 문형은 그 아래에 붙은 예시다. 이 화면에서는 **막힌 사정과 푸는 방법이 같은
     * 사실**(칸이 비었다)이라 두 마디로 나누면 같은 말을 두 번 하게 된다.
     *
     * **어느 칸이 비었는지 가르지 않는다.** 세 갈래(아이디만·비밀번호만·둘 다 공백만)가 같은
     * 문장을 쓴다.
     */
    incomplete: '로그인은 아이디와 비밀번호를 모두 입력하면 쓸 수 있습니다.',
    /**
     * 나가는 중인 사유. **어느 칸도 지목하지 않는다** — 지금 막고 있는 것은 값이 아니라 시간이다.
     *
     * 잠그는 이유는 연타가 그대로 요청 두 벌이 되기 때문이다. 시도마다 새 멱등 키를 만들므로
     * 서버에는 서로 다른 시도로 보이고, 그만큼 실패 횟수가 쌓인다.
     */
    submitting: '로그인은 응답을 기다리는 중입니다. 답이 오면 다시 쓸 수 있습니다.',
  },
  /**
   * 실패 안내. **화면 수준 배너로만 낸다** — 칸 옆에 붙은 오류는 문구를 아무리 뭉뚱그려도
   * **붙은 자리가 어느 칸이 문제인지 말한다**(공유계약 G-1 · F-7).
   */
  banner: {
    failureTitle: '로그인하지 못했습니다',
    /**
     * ⛔ **아이디가 틀렸는지 비밀번호가 틀렸는지 말하지 않는다.** 「없는 아이디입니다」류의
     * 문구는 계정이 있는지를 흘려, 아이디 목록을 만드는 사람에게 그대로 답이 된다.
     * 두 칸을 함께 말하는 것이 그 규율의 표현이다.
     */
    mismatch: '아이디 또는 비밀번호가 맞지 않습니다.',
    /**
     * 남은 시도 횟수 안내 — **뭉뚱그린 문구 아래 둘째 줄**이다.
     *
     * ⚠ **줄바꿈 없는 공백을 쓰지 않는다.** 괄호 앞은 보통 공백이다 — 비가시 문자를 심으면
     * 문구를 다듬는 사람이 그것을 지웠는지 알 수 없고, 지워져도 아무 감지기가 울리지 않는다.
     */
    lockWarning: (used: number, threshold: number): string =>
      `${String(threshold)}회 틀리면 계정이 잠깁니다 (${String(used)}/${String(threshold)})`,
    /**
     * 임계값을 말하지 않는 되물림 문장.
     *
     * 화면이 드는 임계값은 **설계가 확정하지 않은 자리표시 값**이라 서버와 어긋날 수 있다.
     * 어긋나면 누적(`임계값 − 남은 횟수`)이 0 이하가 되는데, 그때 임계값을 말하면 「(0/5)」·
     * 「(-4/5)」 같은 표시가 사용자에게 간다. **아는 것만 말한다** — 남은 횟수는 서버가 준 값이다.
     */
    lockWarningWithoutThreshold: (remaining: number): string =>
      `앞으로 ${String(remaining)}번 더 틀리면 계정이 잠깁니다.`,
    /**
     * 잠긴 계정 — **스스로 풀 수 없다.** 그래서 문구가 해결 경로(관리자 요청)를 담는다.
     *
     * ⛔ 수치를 담지 않는다. 몇 번 만에 잠겼는지를 화면이 말하면 잠금 정책을 밖에서 셀 수 있다.
     */
    locked: '계정이 잠겼습니다. 관리자에게 비밀번호 초기화를 요청하세요.',
  },
} as const;

/**
 * W-01-12 재고조정.
 *
 * **이 블록에서 가장 조심할 것은 낱말이다.** 이 화면은 잔량을 직접 고치는 자리가 아니라
 * **차이 수량**을 받는 자리라, 「보유 수량」·「재고 수량」·「현재 수량」처럼 *결과 수량*을 뜻하는
 * 말을 한 번이라도 쓰면 사용자가 덮어쓰기 화면으로 읽는다. 그래서 수량을 부르는 말은
 * **장부 · 실물 · 차이** 셋뿐이다.
 *
 * **승인·반려를 말하지 않는다.** 결재는 결재함(W-CO-09)이 소유한다 — 이 화면은 조정을 세워
 * 올리는 쪽이고, 그 사실을 상단 안내가 상시 밝힌다.
 */
const stockAdjust = {
  title: '재고조정',
  breadcrumbRoot: '자재창고',
  panes: {
    source: '조정 원천',
    lines: '조정 대상',
    register: '조정 등록',
    /** 처리 이력 탭의 두 구획. **목록과 상세를 가른다** — 고른 전표의 라인은 아래 구획이 맡는다. */
    history: '처리 이력',
    historyDetail: '조정 전표 상세',
  },
  /**
   * 탭 둘 — **조정 등록 · 처리 이력.**
   *
   * ⛔ **승인 대기 탭을 두지 않는다**(조심 ① · D-3). 계약의 조정 목록 조회에 그 조건이 남아
   * 있으나 승인·반려는 결재함(W-CO-09)이 소유한다. 셋째 탭의 이름을 이 블록에 두지 않는 것이
   * 그 규율의 자리다 — 문구가 먼저 생기면 그 탭이 곧 생긴다.
   *
   * 탭 줄 위의 안내를 따로 두지 않는다 — 「결재는 결재함에서 합니다」 배너가 **두 탭 위**에
   * 상시로 서서 같은 말을 이미 한다(C42). 같은 사실을 두 자리에서 말하면 한쪽만 고쳐진다.
   */
  tabs: {
    label: '재고조정 보기',
    register: '조정 등록',
    history: '처리 이력',
  },
  /**
   * 등록 머리 — **계약이 등록에서 받는 두 값**이다.
   *
   * 상신 사유는 여기 없다. 헤더 사유는 **코드**이고 상신 사유는 **자유 텍스트**라 서로 다른
   * 값이고, 결재함 목록에서 요약을 겸하는 것은 상신 사유 쪽이다.
   */
  fields: {
    reasonCode: '조정 사유',
    reasonCodePlaceholder: '사유를 고르세요',
    sendToErp: 'ERP 송신',
  },
  /**
   * 상신 사유 — **헤더 사유와 다른 값이다**(D-8 · 이 화면에서 가장 오독하기 쉬운 자리).
   *
   * 헤더 사유는 **코드**(고객의 공통코드 마스터에서 고르는 값 · #36 회신)이고 이것은
   * **자유 텍스트**(쓰는 글)다.
   * 결재함 목록에서 요약을 겸하는 것은 **이쪽의 첫 줄**이라(공유계약 A-12), 자리표시 문구와
   * 보조 문구로 형식을 유도하는 것도 이쪽뿐이다.
   *
   * ⚠ **이룰 수 없는 조치를 지시하지 않는다.** 이 칸은 **한 줄 입력**이다 — 디자인 시스템의
   * `TextField`가 `<input>`이라 붙여넣어도 줄바꿈이 지워진다(인벤토리에 여러 줄 입력 원시 요소가
   * 없다). 그래서 「다음 줄부터 근거를 적으세요」로 유도하지 않는다. **여러 줄 입력이 붙는 날
   * 이 두 문구를 함께 갱신한다** — 그때 첫 줄 분리(`reason-draft.ts`)는 이미 서 있다.
   */
  submit: {
    reason: '상신 사유',
    reasonPlaceholder: '무엇을 왜 조정하는지 한 줄로 적으세요.',
    reasonHelper: '적은 사유의 첫 줄이 결재함 목록의 요약이 됩니다.',
  },
  /**
   * 화면 맨 위에 늘 서는 범위 안내. **접지 않는다** — 이 화면을 「잔량을 고치는 화면」으로
   * 읽는 것이 여기서 가장 비싼 오해다.
   */
  scope: {
    title: '조정은 수불 원장에 기록됩니다',
    description:
      '잔량을 직접 고치지 않습니다. 이 화면이 받는 값은 장부와 실물의 차이 수량이고, 실물은 장부에 차이를 더해 보여 줍니다.',
  },
  /** 결재는 결재함이 소유한다. 이 화면에는 승인·반려 조작이 없다. */
  approvalNotice: {
    title: '결재는 결재함에서 합니다',
    description: '이 화면은 조정을 세우고 올리는 자리입니다. 승인과 반려는 결재함에서 처리합니다.',
  },
  /**
   * 조정 원천. **라디오는 둘이고 자료의 출처는 셋이다** — 실사 차이 · 현장 실측 · 직접 등록.
   * 뒤의 둘은 실사를 거치지 않으므로 같은 갈래로 들어온다.
   */
  source: {
    kindLabel: '조정 원천',
    count: '실사 차이',
    direct: '직접 등록',
    countField: '대상 실사',
    countPlaceholder: '실사를 고르세요',
    warehouseField: '대상 창고',
    warehousePlaceholder: '창고를 고르세요',
    /** 직접 등록 갈래에서 실사 참조 자리에 서는 라벨. 값은 「—」다. */
    countRefLabel: '대상 실사',
    /**
     * **실사 참조가 비어 있는 것이 정상이다.** 경고로 읽히지 않게 사실만 적는다 —
     * 현장 실측과 직접 등록은 실사를 거치지 않는 정상 경로다.
     */
    directNote: '현장 실측·직접 등록에는 대상 실사가 없습니다.',
    loadedNote: (lineCount: number): string =>
      `실사 차이 ${String(lineCount)}행을 조정 대상으로 가져왔습니다.`,
    /** 불러온 결과가 0행인 갈래. 「불러오지 못했다」와 다른 말이다. */
    loadedEmptyNote: '이 실사에는 차이가 있는 줄이 없습니다.',
    /**
     * **앞쪽 일부만 왔다**(계약이 이 조회에 페이지네이션을 못 박았다).
     *
     * 「N행을 가져왔습니다」로만 말하면 사용자가 그것을 **전부**로 읽고, 조정되지 않은 차이가
     * 남은 채로 전표가 올라간다 — 되돌릴 수 없는 쓰기 앞의 조용한 누락이다. 그래서 받은 수와
     * **전체 수를 함께** 말하고, 무엇이 빠졌는지 사용자가 알 수 있게 한다.
     */
    loadedTruncatedNote: (lineCount: number, total: number): string =>
      `차이가 있는 줄 ${String(total)}행 가운데 앞쪽 ${String(lineCount)}행만 가져왔습니다. 나머지는 아직 조정 대상이 아닙니다.`,
    /** 원천을 바꾸면 세운 대상이 사라진다 — 바꾸기 전에 읽히게 상시 세운다. */
    changeDiscardNote: (lineCount: number): string =>
      `원천을 바꾸면 지금 세운 조정 대상 ${String(lineCount)}행이 사라집니다.`,
    /**
     * 주소가 가리킨 실사를 목록에서 찾지 못해 주소에서 지웠다.
     * **목록이 잘렸을 때는 이 판정을 하지 않는다** — 못 본 것과 없는 것은 다르다.
     */
    countNotFoundNote:
      '주소가 가리킨 실사를 목록에서 찾지 못해 대상에서 뺐습니다. 아래에서 실사를 고르세요.',
  },
  /**
   * 조정 라인 표 — **입력칸은 「차이」 하나뿐이다.**
   *
   * 「실물」은 장부에 차이를 더한 **파생 값**이라 읽기 전용이다. 실물을 입력칸으로 두면
   * 그것이 곧 결과 수량 입력이 되어 이 화면이 덮어쓰기 화면으로 읽힌다.
   */
  lineTable: {
    location: '위치',
    item: '품목',
    lot: '자재 LOT',
    bookQty: '장부',
    actualQty: '실물',
    adjustmentQty: '차이',
    rowActions: '행 조작',
    locationLabel: (lineNo: number): string => `${String(lineNo)}번 줄 위치`,
    itemLabel: (lineNo: number): string => `${String(lineNo)}번 줄 품목`,
    lotLabel: (lineNo: number): string => `${String(lineNo)}번 줄 자재 LOT`,
    uomLabel: (lineNo: number): string => `${String(lineNo)}번 줄 단위`,
    adjustmentQtyLabel: (lineNo: number): string => `${String(lineNo)}번 줄 차이 수량`,
    /** 실사에서 승계한 줄이라는 표식. 위치·품목·LOT을 고를 수 없는 사정을 이 표식이 밝힌다. */
    inherited: '실사 승계',
    /** 차이가 0인 줄. **오류가 아니라 제외다** — 막지 않고 표식만 붙인다. */
    excluded: '제외',
    /**
     * 실사에서 실려 온 차이 사유. **읽기 전용 표기이고 이 화면이 보내지 않는다** —
     * 조정 라인에 사유를 담을 자리가 아직 없다.
     */
    countReason: (code: string): string => `실사 사유 ${code}`,
    qtyWithUom: (qty: string, uom: string): string => `${qty} ${uom}`,
  },
  /**
   * 처리 이력 조회 조건 — **계약이 받는 넷뿐이다**(실측: 실사 · 사유 · 상태 · 전기일 구간).
   *
   * ⛔ **승인 대기 조건을 두지 않는다**(D-3 · C41). 계약에 그 조건이 남아 있으나 이 화면에는
   * 그 탭이 없다 — 칸을 만들면 그 조건이 요청에 실린다.
   *
   * **전표번호 검색칸이 없다.** 계약의 조정 목록 조회에 검색어 조건이 **없어서**(실측)
   * 만들 수 없다 — 만들면 쳐도 아무것도 좁혀지지 않는 칸이 된다.
   */
  historyFields: {
    period: '전기일',
    count: '대상 실사',
    reason: '조정 사유',
    status: '상태',
  },
  historyFilters: {
    /** 조건을 걸지 않은 상태의 선택지 문구. 값 목록이 비어 있으면 이것도 붙이지 않는다. */
    all: '전체',
    /**
     * 값 목록이 확정되지 않은 코드 칸 — **이제 상태 하나에만 붙는다**(D-9 개정 · 미결 #64).
     *
     * ⛔ **조정 사유 칸에 쓰지 않는다.** 사유 값 목록은 고객이 공통코드 마스터에 등록하는
     * 마스터 데이터라(#36 회신) 「우리가 정해야 하는데 못 했다」가 사실이 아니다 —
     * 그 칸이 비어 있으면 고객의 마스터가 아직 그럴 뿐이고, 화면은 그대로 돈다.
     *
     * **비어 있어도 아무것도 막히지 않는다** — 이력 조회는 조건 없이도 열려 있다.
     */
    codePending: '값 목록이 아직 확정되지 않아 고를 수 있는 값이 없습니다. 조회는 그대로 됩니다.',
    codePlaceholder: '고를 값이 없습니다',
    /** 기본 기간을 심지 않는다 — 심으면 첫 조회에 날짜가 실리고 사용자가 그 사정을 못 읽는다. */
    periodNote: '전기일을 비우면 전기 전의 전표까지 함께 보입니다.',
    /** ×가 기간 칩에만 없는 이유. 없으면 사용자가 ×를 찾다가 화면을 고장으로 읽는다. */
    periodClearNote: '전기일은 「초기화」로만 풉니다.',
    chipPeriodBoth: (from: string, to: string): string => `전기일 ${from} ~ ${to}`,
    chipPeriodFrom: (from: string): string => `전기일 ${from}부터`,
    chipPeriodTo: (to: string): string => `전기일 ${to}까지`,
    /** **실사는 번호가 아니라 이름으로 적는다**(`omf-mes#44`) — 화면이 풀어 넘긴다. */
    chipCount: (countName: string): string => `대상 실사 ${countName}`,
    chipRemoveCount: '대상 실사 조건 풀기',
    chipReason: (code: string): string => `조정 사유 ${code}`,
    chipRemoveReason: '조정 사유 조건 풀기',
    chipStatus: (code: string): string => `상태 ${code}`,
    chipRemoveStatus: '상태 조건 풀기',
  },
  /**
   * 처리 이력 목록 표.
   *
   * **원천이 셋이라 실사 참조가 비는 것이 정상이다**(조심 ⑤ · C43) — 그 칸은 「—」이고
   * 경고 표식을 붙이지 않는다. 현장 실측·직접 등록은 실사를 거치지 않는 정상 경로다.
   */
  historyTable: {
    inventoryAdjustmentNo: '조정 전표번호',
    countRef: '대상 실사',
    reason: '조정 사유',
    status: '상태',
    adjustedAt: '전기일',
    select: '선택',
    /**
     * 아직 전기되지 않았다. **판정 근거가 전기 시각의 유무 하나다**(C35) — 상태 코드를 읽지
     * 않는다. 「—」로만 두면 값이 없는 것인지 화면이 못 그린 것인지 갈리지 않는다.
     */
    notPosted: '전기 전',
  },
  /**
   * 고른 조정 전표의 제목줄 — **상세 응답의 머리다.**
   *
   * **코드를 뜻으로 옮기지 않는다**(공유계약 G-2) — 화면이 뜻을 붙이면 그 뜻은 화면이
   * 지어낸 것이 되고, 값이 바뀌는 날 조용히 틀린다. ⚠ 사유에 이름을 붙일지는 설계 판단이다
   * (`history-detail-pane.tsx` 같은 자리 주석).
   */
  historySummary: {
    label: '조정 전표 요약',
    inventoryAdjustmentNo: '조정 전표번호',
    countRef: '대상 실사',
    reason: '조정 사유',
    status: '상태',
    adjustedAt: '전기일',
    erp: 'ERP 송신',
    lines: '조정 라인',
    /** **표의 줄 수와 같은 수다** — 두 자리에서 각자 세면 갈릴 자리가 생긴다. */
    lineCount: (lineCount: number): string => `${String(lineCount)}행`,
  },
  /**
   * 이력 상세의 라인 표 — **등록 탭과 같은 「장부 · 실물 · 차이」 세 열이다**(조심 ③ · C44).
   *
   * ⚠ **장부와 실물이 늘 「—」다.** 계약의 조정 라인에 장부가 없고(실측), 지금 잔액을 불러
   * 채우면 **조정 시점의 장부가 아닌 값**이 그 자리에 선다 — 그 수로 계산한 실물은 사용자가
   * 확인한 적 없는 값이다. 세 열을 그대로 두는 것은 등록 탭과 **같은 읽기 규칙**을 유지하기
   * 위해서다(차이가 결과 수량으로 읽히지 않는다).
   *
   * **위치 열이 없다.** 위치 이름은 창고를 알아야 풀 수 있는데(계약이 위치 조회에 창고를
   * 필수로 요구한다) 조정 전표에는 창고가 없다 — 번호를 대신 낼 수는 없으므로(`omf-mes#44`)
   * 열을 두지 않고 그 사정을 아래 안내가 밝힌다.
   */
  historyLineTable: {
    lineNo: '줄',
    item: '품목',
    lot: '자재 LOT',
    bookQty: '장부',
    actualQty: '실물',
    adjustmentQty: '차이',
    /** 두 열이 비는 이유. 값을 지어내지 않고 **왜 없는지**를 적는다. */
    qtyNote: '장부와 실물은 조정 시점의 값이라 이 목록에서 확인할 수 없습니다.',
    /** 위치 열이 없는 이유. 없는 것을 없다고 말하지 않으면 사용자는 화면이 빠뜨린 줄 안다. */
    locationNote: '위치 이름은 창고를 알아야 확인할 수 있고 조정 전표에는 창고가 없습니다.',
  },
  /** 쪽 이동 — 이전·다음과 지금 위치뿐이다. 쪽 번호 목록을 만들지 않는다. */
  pageNav: {
    label: '쪽 이동',
    range: (from: number, to: number, total: number): string =>
      `${String(from)}–${String(to)} / 전체 ${String(total)}건`,
    /** 보이는 것이 없으면 범위를 지어내지 않는다. 전체 건수는 그대로 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  /**
   * 장부 수량 칸의 글자.
   *
   * **묻지 않음·목록에 없음은 빈 값 표식(`values.empty`)으로 낸다** — 표 안에서는 자리를
   * 아끼고, 무엇이 일어났는지는 표 아래 안내(`notes.bookQtyOptional`)가 맡는다. 그래서 이
   * 블록에는 **사용자가 기다릴지 다시 부를지를 가리는 두 갈래만** 있다.
   */
  bookQty: {
    loading: '장부 확인 중',
    failed: '장부를 확인하지 못했습니다',
  },
  actions: {
    addLine: '라인 추가',
    removeLine: (lineNo: number): string => `${String(lineNo)}번 줄 삭제`,
    loadVariance: '실사 차이 불러오기',
    register: '조정 등록',
    discard: '초안 버리기',
    /** 결재에 올린다. **승인·반려 조작이 아니다** — 그것은 결재함이 소유한다(⛔ D-3). */
    requestApproval: '조정 상신',
    /**
     * **접힌 두 번째 선택지를 여는 손잡이**(D-12).
     *
     * 문구가 펼침 상태에 따라 바뀌지 않는다 — 상태는 `aria-expanded`가 말한다. 낱말이 바뀌면
     * 보조기술 사용자가 같은 컨트롤을 두 이름으로 만난다.
     */
    togglePost: '승인 없이 전기',
    /** 펼친 뒤의 실행 손잡이. **여는 손잡이와 이름을 갈라 둔다** — 같으면 어느 것을 누르는지 갈린다 */
    post: '재고 전기',
    /** 창의 버튼 문구는 「확인/취소」가 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */
    keepEditing: '계속 입력',
    /** 전기 확인 창의 되돌아가기. 「계속 입력」과 갈라 둔다 — 이 창에는 고칠 칸이 없다 */
    keepReviewing: '다시 확인',
    confirmRegister: '등록합니다',
    confirmSubmit: '결재에 올립니다',
    confirmPost: '재고를 움직입니다',
    confirmDiscard: '초안을 버립니다',
    /** 처리 이력 탭의 쪽 이동과 고르기. **번호가 아니라 전표번호로 가리킨다**(`omf-mes#44`) */
    prevPage: '이전 쪽',
    nextPage: '다음 쪽',
    goFirstPage: '첫 쪽으로',
    select: '선택',
    deselect: '선택 해제',
    selectAdjustmentRow: (adjustmentNo: string): string => `${adjustmentNo} 선택`,
    deselectAdjustmentRow: (adjustmentNo: string): string => `${adjustmentNo} 선택 해제`,
  },
  /** 비활성 사유는 **그 컨트롤의 이름으로 시작한다.** 잠갔으면 반드시 함께 선다. */
  actionReasons: {
    loadVarianceNeedsCount: '실사 차이 불러오기는 대상 실사를 고른 뒤에 할 수 있습니다.',
    loadVarianceLoading: '실사 차이 불러오기는 앞선 조회가 끝난 뒤에 다시 할 수 있습니다.',
    addLineNeedsWarehouse:
      '라인 추가는 대상 창고를 고른 뒤에 할 수 있습니다. 창고를 골라야 위치와 장부를 확인할 수 있습니다.',
    /**
     * 실사 갈래에서는 줄을 더하지 않는다 — 대상은 실사가 정한다.
     *
     * **컨트롤 이름으로 시작한다**(배치 규범 4-5). 사정을 주어로 삼는 이탈 조건은 「한 사정이
     * 여러 조작을 한꺼번에 잠글 때」인데 이것은 「라인 추가」 하나만 잠근다.
     */
    addLineCountSource:
      '라인 추가는 실사 차이 갈래에서 할 수 없습니다. 직접 등록으로 바꾸면 줄을 더할 수 있습니다.',
    /**
     * 나가는 중과 이미 등록한 뒤 — **되돌릴 수 없는 쓰기를 막는 두 사정**이다.
     *
     * 공통 쓰기 훅이 호출마다 새 멱등 키를 만들어, 두 번 누르는 것이 그대로 **전표 두 벌**이 된다.
     * 이 화면에는 만들어진 전표를 되돌릴 경로가 없다.
     */
    saving: '보내는 중입니다. 응답이 오면 풀립니다.',
    alreadyRegistered: '이미 등록했습니다. 다른 조정을 세우려면 화면을 새로 여세요.',
    /**
     * ⚠ **잘린 목록으로 등록하지 않는다.** 못 받은 줄은 조정 대상에 실리지 않고, 그 차이는
     * 조정되지 않은 채 남는다 — 실사 차이 조회에 페이지네이션이 있는 것이 이 잠금의 근거다.
     *
     * **탈출구를 함께 적는다**(같은 블록의 `addLineCountSource`와 같은 형태). 쪽 크기가 고정이고
     * 쪽 이동 컨트롤이 없어 **이 화면에서 나머지를 더 받을 길이 없다** — 「전부 가져온 뒤에」로만
     * 말하면 사용자가 이룰 수 없는 조치를 찾아 헤맨다.
     */
    registerVarianceTruncated:
      '조정 등록은 이 실사의 차이를 전부 받은 뒤에 할 수 있는데, 지금 화면에서는 나머지를 더 받을 수 없습니다. 이대로 등록하면 나머지 차이가 조정되지 않은 채 남습니다 — 직접 등록으로 바꾸면 필요한 줄을 직접 세울 수 있습니다.',
    /**
     * 사유가 막는 사정은 **이 하나뿐이다** — 고를 값이 있고 없고는 고객의 마스터가 정하므로
     * 화면이 앞서 막지 않는다(#36 회신 ④).
     */
    registerNeedsReason: '조정 등록은 조정 사유를 고른 뒤에 할 수 있습니다.',
    registerNeedsLines: '조정 등록은 조정 대상이 한 줄 이상 있어야 할 수 있습니다.',
    registerLineInvalid: '조정 등록은 표에 붙은 오류를 고친 뒤에 할 수 있습니다.',
    /** 줄은 있는데 전부 차이 0인 갈래 — 보낼 줄이 남지 않는다(계약이 최소 1행을 요구한다). */
    registerAllExcluded:
      '조정 등록은 차이가 0이 아닌 줄이 한 줄 이상 있어야 할 수 있습니다. 지금은 모든 줄이 등록에서 빠집니다.',
    discardNothing: '초안 버리기는 버릴 값이 있어야 할 수 있습니다.',
    /**
     * 상신이 막힌 사유 둘. **승인 축으로는 막지 않는다**(D-13 · C37) — 자리표시가 비어 있는
     * 채로 잠그면 그 버튼이 영영 잠긴다.
     *
     * 공백만인 사유를 **목이 202로 통과시킨다**(실측) — 막는 곳이 화면뿐이라 이 잠금이 곧
     * 「요약이 빈 결재 요청」을 막는 유일한 겹이다.
     */
    submitReasonRequired:
      '조정 상신은 사유를 적은 뒤에 할 수 있습니다. 공백만으로는 보낼 수 없습니다.',
    submitting: '결재에 올리는 중입니다. 응답이 오면 풀립니다.',
    /**
     * 되돌릴 수 없는 쓰기 **둘이 서로를 막는다** — 두 요청이 함께 나가면 재고가 움직이는
     * 순간과 결재가 시작되는 순간이 겹치고, 어느 쪽이 먼저 닿는지 화면이 알 수 없다.
     *
     * ⛔ **승인 축으로는 막지 않는다**(D-12·D-13 · C33). 결재선이 있는지 화면이 알 통로가
     * 계약에 없어, 틀린 길은 **서버가 400으로** 막는다.
     */
    submitWhilePosting: '조정 상신은 전기 응답이 온 뒤에 할 수 있습니다.',
    /**
     * 이미 전기한 전표를 결재에 올리지 않는다.
     *
     * **근거가 이 화면이 받은 200이다**(C35) — 상태 코드를 읽어 판정하지 않는다. 재고가 이미
     * 움직인 조정에 결재를 올리면 결재함에 「무엇을 승인하는지 없는」 요청이 남는다.
     */
    submitAfterPosted: '조정 상신은 이미 전기한 전표에는 할 수 없습니다.',
    posting: '전기하는 중입니다. 응답이 오면 풀립니다.',
    postWhileSubmitting: '재고 전기는 상신 응답이 온 뒤에 할 수 있습니다.',
    /**
     * 전기 본문의 두 값이 갖춰지지 않았다. **무엇이 잘못됐는지는 칸에 붙는다** —
     * 여기서 되풀이하면 같은 사실이 화면에 두 번 서고, 둘이 갈리면 어느 쪽이 참인지 모른다.
     */
    postDraftInvalid: '재고 전기는 영업일과 발생 일시를 갖춘 뒤에 할 수 있습니다.',
  },
  errors: {
    adjustmentQtyRequired: '차이 수량을 넣으세요.',
    adjustmentQtyNotNumber: '차이 수량은 숫자로 넣으세요.',
    locationRequired: '위치를 고르세요.',
    itemRequired: '품목을 고르세요.',
    uomRequired: '단위를 고르세요.',
    /**
     * 전기 본문의 두 칸. **네이티브 칸이 첫째 층이고 이 문구는 둘째 층이다** — 붙여넣기로
     * 들어온 글자가 되돌릴 수 없는 전기 본문에 실리는 길이 실재한다.
     */
    businessDateRequired: '영업일을 넣으세요.',
    businessDateFormat: '영업일은 2026-08-18 꼴로 넣으세요.',
    occurredAtRequired: '발생 일시를 넣으세요.',
    occurredAtFormat: '발생 일시는 2026-08-18 14:05 꼴로 넣으세요.',
  },
  notes: {
    /**
     * 차이가 0인 줄. **막지 않고 무엇이 일어나는지 적는다**(스펙 §6의 자동 제외).
     * 등록 본문을 만들 때 그 줄이 빠지고 확인 창이 그 수를 다시 밝힌다.
     */
    excludedZero: (lineCount: number): string =>
      `차이가 0인 ${String(lineCount)}행은 등록에서 빠집니다.`,
    /** 줄이는 조정이 정상 경로라는 사실. 음수를 막지 않는다는 것을 미리 알린다. */
    negativeAllowed: '줄이는 조정은 차이를 음수로 넣습니다.',
    /** 실물은 파생 값이다 — 고칠 수 있는 값으로 읽히지 않게 밝힌다. */
    actualDerived: '실물은 장부에 차이를 더한 값입니다. 직접 고치지 않습니다.',
    /** 장부를 못 찾아도 등록을 막지 않는다 — 현장 실측은 장부를 모른 채로도 조정한다. */
    bookQtyOptional: '장부를 확인하지 못한 줄도 조정할 수 있습니다. 차이 수량만 있으면 됩니다.',
    /** 실사에서 온 사유는 보이기만 한다 — 조정 라인에 사유를 담을 자리가 아직 없다. */
    lineReasonReadOnly: '실사에서 적은 사유는 참고로만 보입니다. 이 화면에서 고치지 않습니다.',
    /** 줄번호를 화면이 정하지 않는다(공유계약 A-5). */
    lineNoAssignedByServer: '줄번호는 등록할 때 배열 순서대로 매겨집니다.',
    /**
     * ERP 연계 **방식**은 서버가 정한다 — 화면에 표현할 자리가 없다.
     * 화면이 정하는 것은 보낼지 여부 하나이고, 그 사실만 토글 옆에 적는다.
     */
    sendToErpNote: '보내는 방식은 서버가 정합니다. 이 화면은 보낼지 여부만 정합니다.',
    /**
     * **응답이 오지 않은 요청은 「실패」가 아니다** — 멱등 완화의 마지막 층(공유계약 C-1).
     *
     * 쓰기 훅이 호출마다 새 멱등 키를 만들어, 그대로 다시 보내면 서버에는 다른 요청으로 보인다.
     * 이 화면의 요청은 조정 전표를 만드는 것이라 두 번 전달되면 **전표가 두 벌 남고**,
     * 그 전표를 이 화면에서 되돌릴 경로가 없다.
     * **네트워크 갈래에만 붙인다** — 서버가 거절한 요청은 전달된 것이 확실하다.
     *
     * ✅ **갱신 표지를 이행했다**(처리 이력 탭이 선 회차). 앞선 문면은 「이 화면에서 확인할 수
     * 없습니다」였다 — 그때는 조정을 조회할 자리가 이 슬라이스에 없어 확인 절차를 지시하면
     * **할 수 없는 조치**가 됐다. 지금은 그 자리가 실재하므로 **어디서 어떻게 확인하는지**를
     * 말한다: 이력 탭의 조건은 조정 사유·대상 실사·상태·전기일이고(계약이 받는 넷), 방금 보낸
     * 등록의 사유로 좁히면 그 전표가 목록에 선다.
     *
     * ⚠ **금지를 확인 뒤로 미루지 않는다.** 「확인하고 나서 다시 보내라」로 적으면 확인에
     * 실패한 사용자가 그대로 다시 보낸다 — **먼저 막고, 확인 자리를 알린다.** 쓰기 훅이
     * 호출마다 새 멱등 키를 만들어 다시 보내면 서버에는 다른 요청으로 보이고, 이 화면에는
     * 만들어진 전표를 되돌릴 경로가 없다.
     */
    networkUnconfirmed:
      '응답을 받지 못해 조정 전표가 만들어졌는지 알 수 없습니다. 같은 내용을 바로 다시 등록하지 마세요 — 「처리 이력」 탭에서 조정 사유로 좁혀 그 전표가 만들어졌는지 먼저 확인하세요.',
    /**
     * 초안을 버린 **뒤에** 앞선 등록이 **응답 없이 끝난** 갈래(T2 §R1의 비대칭 · T5 재판단).
     *
     * **성공은 알리는데 이 갈래는 침묵하던 자리다.** 침묵의 근거는 두 가지였다 — ① 서버가
     * 거절한 요청은 남는 것이 없다(지금도 참이라 그 갈래는 여전히 말하지 않는다) ② 응답이
     * 오지 않은 요청만이 「남았을 수 있다」인데 **그것을 확인할 자리가 화면에 없었다.**
     * 처리 이력 탭이 서면서 ②가 풀렸으므로 이제 그 사실을 말한다.
     *
     * **전표번호를 적지 않는다** — 응답을 받지 못해 화면이 그 번호를 모른다. 지어내지 않고
     * 「하나 있었다」는 사실과 확인할 자리만 말한다.
     */
    unconfirmedRegisterNote:
      '앞서 보낸 등록 하나는 응답을 받지 못해 전표가 만들어졌는지 알 수 없습니다. 「처리 이력」 탭에서 확인하세요.',
  },
  values: {
    empty: '—',
    unknown: '알 수 없음',
    referenceLoading: '이름 불러오는 중',
    referenceFailed: '이름 불러오기 실패',
    inactiveSuffix: ' (미사용)',
    /**
     * 이름이 비어 오는 갈래. **번호를 대신 내지 않는다**(`omf-mes#44`) —
     * 계약이 이름을 필수로 두었으나 빈 문자열도 스키마를 통과한다.
     */
    unknownRequester: '상신자 이름 없음',
    unknownApprover: '승인자 이름 없음',
  },
  lookups: {
    truncated: '선택지가 앞쪽 일부만 보입니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
    failed: '선택지를 불러오지 못했습니다.',
  },
  loading: {
    varianceLines: '실사 차이를 불러오는 중',
    approvalRequest: '결재 진행을 불러오는 중',
    adjustments: '처리 이력을 불러오는 중',
    adjustmentDetail: '조정 전표를 불러오는 중',
  },
  empty: {
    noLinesTitle: '아직 조정 대상이 없습니다',
    noLinesCountDescription:
      '대상 실사를 고르고 「실사 차이 불러오기」를 누르면 차이가 있는 줄이 여기에 섭니다.',
    noLinesDirectDescription:
      '대상 창고를 고르고 「라인 추가」를 누르면 줄을 직접 세울 수 있습니다.',
    /** 빈 상태가 두 갈래다 — 결과 없음 / 쪽 밖. **사용자가 할 조치가 서로 다르다.** */
    historyNoResultTitle: '조건에 맞는 조정 전표가 없습니다',
    historyNoResultDescription: '조건을 넓히거나 「초기화」로 전체를 다시 보세요.',
    historyBeyondLastTitle: '이 쪽에는 결과가 없습니다',
    historyBeyondLastDescription: '조건에 맞는 전표는 있으나 이 쪽에는 없습니다.',
    /** 셋째 갈래는 표가 아니라 **아래 구획**이 맡는다 — 「아직 고르지 않았다」. */
    historyNoSelectionTitle: '조정 전표를 고르면 라인이 보입니다',
    historyNoSelectionDescription: '위 목록에서 「선택」을 누르면 그 전표의 라인이 여기에 섭니다.',
    /** 고른 전표가 없었다. **주소에서 지운 뒤에는 그 사정을 말할 근거가 사라진다.** */
    historyNotFoundTitle: '고른 조정 전표를 찾을 수 없습니다',
    historyNotFoundDescription: '지워졌거나 볼 권한이 없는 전표입니다. 다시 골라 주세요.',
  },
  reasons: {
    /**
     * **안내가 말하는 넷과 복구가 되살리는 넷이 같다.**
     *
     * 하나라도 어긋나면 그 참조만 실패했을 때 사실이 아닌 문구가 서거나 복구가 그 참조를
     * 되살리지 못한다. 창고는 **원천 구획**이 따로 맡는다(그 이름이 실패로 보이는 자리가
     * 거기다) — 조건도 문구도 복구도 그쪽에 갈라 두었다.
     */
    lineReferencesFailed:
      '위치·품목·단위·자재 LOT 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    /**
     * 창고만 실패하는 갈래. **직접 등록은 창고를 고르는 것으로 시작하므로 여기서 막히면
     * 화면 전체가 막다른 길이 된다** — 그래서 복구 수단이 이 안내와 함께 선다.
     */
    warehousesFailed:
      '창고 이름을 불러오지 못했습니다. 창고를 고르지 못하면 위치와 장부도 확인할 수 없습니다.',
    balancesFailed: '장부 수량을 불러오지 못했습니다. 장부 자리에 사유가 표시됩니다.',
    /**
     * 이력 상세의 같은 자리 — **말하는 셋과 되살리는 셋이 같다.**
     *
     * 등록 탭의 문구(넷)와 갈라 둔다: 이력 상세에는 **위치 열이 없다**(창고를 알 통로가 없어
     * 이름을 풀 수 없다) — 넷을 말하면 그 하나는 이 구획에 있지도 않은 것을 가리키게 된다.
     */
    historyReferencesFailed:
      '품목·단위·자재 LOT 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
  },
  /**
   * 확인 창 — **되돌릴 수 없는 조작 앞의 마지막 층**이다.
   *
   * 등록 확인은 스크림·X를 막고, 버리기 확인은 열어 둔다: 실수로 닫혀도 **아무것도 버리지
   * 않으므로** 잃는 것이 없다. 규칙은 「막는다」가 아니라 「되돌릴 수 없는 창은 막고 버리기
   * 창은 연다」이다.
   */
  dialog: {
    registerTitle: '이 조정을 등록할까요?',
    registerLead: '아래 내용으로 조정 전표를 만듭니다.',
    /** 무엇이 실리는지 값으로 되보인다. 창이 다시 세지 않고 화면이 만든 글자를 받는다. */
    reasonCode: '조정 사유',
    sendToErp: 'ERP 송신',
    sendToErpOn: '보냅니다',
    sendToErpOff: '보내지 않습니다',
    countRef: '대상 실사',
    includedLineCount: (lineCount: number): string =>
      `조정 라인 ${String(lineCount)}행을 함께 보냅니다.`,
    /**
     * **빠지는 줄 수를 창이 밝힌다**(C19). 표에서 「제외」 표식을 못 본 채 확인하는 길이 있고,
     * 그때 사용자가 확인한 줄 수와 실제로 나가는 줄 수가 갈린다.
     */
    excludedLineCount: (lineCount: number): string =>
      `차이가 0인 ${String(lineCount)}행은 등록에서 빠집니다.`,
    /** 짝 방향 — 빠지는 줄이 없다는 것도 사실이라 말한다. 없을 때 침묵하면 확인이 반쪽이 된다. */
    noExcludedLine: '빠지는 줄은 없습니다.',
    /** 무엇이 **아직 일어나지 않는지**를 함께 적는다 — 등록은 재고를 움직이지 않는다. */
    registerIsNotPost:
      '등록만 합니다. 재고는 아직 움직이지 않고, 결재 상신과 전기는 별개 조작입니다.',
    registerNoUndo: '만들어진 조정 전표는 이 화면에서 되돌릴 수 없습니다.',
    discardTitle: '세운 조정 대상을 버릴까요?',
    discardLead: '표의 줄과 고른 조정 사유가 사라집니다. 실사 차이는 다시 불러올 수 있습니다.',
    /**
     * **보내는 중에도 버릴 수 있다** — 화면의 초안을 비우는 조작이지 서버에 보낸 것을 되돌리는
     * 조작이 아니다. 그 사실을 적지 않으면 사용자가 이 창으로 등록이 취소된 줄 안다.
     */
    discardWhileSaving:
      '보내는 중인 등록은 이 창이 되돌리지 않습니다. 서버가 받아들이면 조정 전표는 만들어집니다.',
    /**
     * 상신 확인 — **되돌릴 수 없는 둘째 조작 앞의 마지막 층**이다.
     *
     * **사유 전문과 첫 줄을 나눠 보인다**(C30 · A-12). 첫 줄만 보이면 무엇을 보내는지 모르고,
     * 전문만 보이면 어느 줄이 남들에게 요약으로 보일지 모른다.
     */
    submitTitle: '이 사유로 결재에 올릴까요?',
    submitLead: '아래 사유로 이 조정 전표의 승인을 요청합니다.',
    reasonFull: '사유 전문',
    reasonFirstLine: '결재함 목록에 요약으로 보일 첫 줄',
    reasonSummaryNote: '결재함 목록에서는 이 첫 줄만 보입니다.',
    /**
     * **승인자·결재선을 이 창이 고르지 않는다**(D-12). 계약의 본문이 사유 한 칸이라 보낼 자리가
     * 없고, 승인 주체는 결재선 정의(W-06-15)가 정한 대로 전개된다 — 그 사실을 적어야 사용자가
     * 「고르는 칸이 없다」를 결함으로 읽지 않는다.
     */
    submitApprover: '승인자와 결재선은 이 화면이 정하지 않습니다. 결재선 정의대로 전개됩니다.',
    submitNoUndo: '결재에 올린 뒤에는 이 화면에서 되돌릴 수 없습니다. 취소는 결재함에서 합니다.',
    /**
     * 전기 확인 — **이 화면에서 재고가 실제로 움직이는 유일한 창이다**(D-17).
     *
     * 상신 확인 창과 **갈라 둔다.** 그 창이 확인시키는 것은 「이 문장이 결재함 요약이 된다」이고,
     * 여기서 확인시키는 것은 **무엇이 언제 자로 원장에 잡히는가**다.
     */
    postTitle: '이 조정을 전기할까요?',
    postLead: '아래 값으로 재고를 움직입니다. 되돌리려면 반대 방향의 조정을 새로 세워야 합니다.',
    /**
     * ⭐ **영업일과 발생 일시의 날짜가 갈렸다** — 막지 않고 밝힌다(공유계약 C-8의 야간조 경계).
     *
     * 자정을 넘겨 일한 사람에게는 이것이 정상이고, 실수로 남은 값이면 여기서 알아차린다.
     * 막으면 어제 자 조정을 전기할 길이 사라진다.
     */
    postDatesApart:
      '영업일과 발생 일시의 날짜가 다릅니다. 자정을 넘겨 일한 조정이면 정상이고, 아니면 닫고 고치세요.',
  },
  /**
   * 등록 결과 — **화면이 확인한 것만 말한다.**
   *
   * | 말한다 | 말하지 않는다 |
   * | --- | --- |
   * | 전표번호 · 서버가 준 **상태 코드 그대로** · 서버가 저장한 줄 수 | 「등록 완료」·「승인 대기」 — 상태의 뜻을 화면이 옮겨 적지 않는다(공유계약 G-2) |
   * | ERP **대기열 적재** 세 갈래 | 「ERP로 전송됐습니다」 — 적재는 전송이 아니다 |
   */
  result: {
    label: '등록 결과',
    createdTitle: (adjustmentNo: string): string => `조정 전표 ${adjustmentNo}를 만들었습니다.`,
    createdDescription: '재고는 아직 움직이지 않았습니다. 결재 상신과 전기는 별개 조작입니다.',
    inventoryAdjustmentNo: '조정 전표번호',
    statusCode: '등록 시점 상태',
    /** 지금 상태의 정본은 이 화면이 아니다 — 등록 시점의 값이라는 사실을 밝힌다. */
    statusNote: '등록할 때 서버가 준 상태입니다. 그 뒤의 진행은 결재함에서 확인합니다.',
    lineCount: (lineCount: number): string =>
      `서버가 저장한 조정 라인은 ${String(lineCount)}행입니다.`,
    erp: 'ERP 송신',
    erpQueued: '송신 대기열에 올랐습니다',
    erpNotQueued: '송신 대기열에 오르지 않았습니다',
    /** 값이 오지 않는 갈래. **거짓으로 접지 않는다** — 계약이 이 필드를 선택으로 두었다. */
    erpUnknown: '알 수 없음',
    erpNote:
      '대기열에 오른 것이 전송 완료는 아닙니다. 상대 시스템에서는 아직 보이지 않을 수 있습니다.',
    /**
     * 초안을 버린 **뒤에** 앞선 등록이 성공한 갈래.
     *
     * 그 등록은 실제로 일어났으므로 감추지 않는다. 다만 **지금 세우는 초안의 결과가 아니므로**
     * 결과 구획을 세우지도, 지금 폼을 잠그지도 않는다 — 시도한 적 없는 초안 위에 서는 진술이 된다.
     *
     * **번호를 여럿 받는다.** 매임이 끊긴 성공은 **쌓이고 덮이지 않는다** — 하나만 들면 다음
     * 등록이 성공하는 순간 앞 전표의 번호가 화면에서 사라지고, 이 갈래를 만든 이유(사용자가
     * 모르는 전표가 서버에 남는다)가 그대로 되돌아온다.
     *
     * ✅ **지속성은 이제 처리 이력이 진다**(T5 재판단). 이 줄이 화면에서 사라지는 자리가 아직
     * 하나 남아 있으나(둘째 등록을 확정하면 읽는 자리의 파생이 새 매임으로 덮인다), **그 번호를
     * 되찾을 조회 자리가 실재한다** — 그래서 적재를 더 늘리는 대신 확인할 자리를 함께 말한다.
     */
    unboundCreatedNote: (adjustmentNos: string): string =>
      `앞서 보낸 등록이 끝나 조정 전표가 만들어졌습니다 — ${adjustmentNos}. 지금 세우는 초안과는 별개이고, 「처리 이력」 탭에서 다시 찾을 수 있습니다.`,
    /**
     * 상신 갈래 — **화면이 확인한 것만 말한다.**
     *
     * | 갈래 | 무슨 일이 있었나 | 화면이 하는 말 |
     * | --- | --- | --- |
     * | 등록만 됨 | 전표만 만들어졌다 | 「만들었습니다」 + 사유 칸과 「조정 상신」 |
     * | 나가는 중 | 상신 요청이 나가는 중 | 위 + 「올리는 중」 |
     * | 올라감 | **202를 받았다** | 「올렸습니다」 + 결재 진행 구획 |
     * | **실패** | **전표는 남고 상신만 실패했다** | 그 사실을 **정확히** 말하고 다시 올릴 길을 준다 |
     *
     * **넷째 갈래가 이 구획이 갈래를 갖는 이유다.** 통째로 실패라고 말하면 사용자가 처음부터
     * 다시 만들어 **전표가 두 벌** 남고, 통째로 성공이라고 말하면 결재에 올라가지 않은 조정을
     * 올라간 것으로 믿는다.
     */
    submitting: '결재에 올리는 중입니다.',
    submittedTitle: (adjustmentNo: string): string =>
      `조정 전표 ${adjustmentNo}를 결재에 올렸습니다.`,
    submittedDescription:
      '재고는 아직 움직이지 않았습니다. 승인과 반려는 결재함에서 처리하고, 전기는 승인이 끝난 뒤의 별개 조작입니다.',
    submitFailedTitle: (adjustmentNo: string): string =>
      `조정 전표 ${adjustmentNo}는 만들어졌고 결재에는 올라가지 않았습니다.`,
    submitFailedDescription:
      '전표를 다시 만들지 마세요. 사유를 고쳐 다시 올릴 수 있습니다 — 다시 등록하면 조정 전표가 두 벌 남습니다.',
    /**
     * 매임이 끊긴 채 **상신이 성공한** 갈래(D-15).
     *
     * 그 요청은 실제로 결재에 올라갔으므로 감추지 않는다. 다만 **지금 보고 있는 대상의 결과가
     * 아니므로** 결과 구획을 세우지 않는다 — 시도한 적 없는 대상 위에 서는 진술이 된다.
     *
     * **번호를 여럿 받는다** — 하나만 들면 뒤이은 상신이 앞 사실을 덮고, 이 갈래를 만든 이유
     * (사용자가 모르는 결재 요청이 서버에 남는다)가 그대로 되돌아온다.
     */
    unboundSubmittedNote: (adjustmentNos: string): string =>
      `앞서 보낸 상신이 끝나 조정 전표가 결재에 올라갔습니다 — ${adjustmentNos}. 지금 보고 있는 것과는 별개이고, 「처리 이력」 탭에서 다시 찾을 수 있습니다.`,
  },
  /**
   * 전기 — **이 화면에서 재고가 실제로 움직이는 유일한 자리다.**
   *
   * ⭐ **접힌 두 번째 선택지다**(D-12). 앞자리 주 버튼은 「조정 상신」이고, 이 길은 펼쳐야
   * 나온다 — 결재선이 있는 조정을 이 길로 보내면 **서버가 400으로 막는다.**
   *
   * ⛔ **화면이 결재선 유무를 판정하지 않는다.** 문서 유형의 승인 유형 코드가 확정되지 않아
   * 계약에 그 통로가 없다(미결 `omf-mes#72`) — 화면은 두 길을 함께 두고, 틀린 길은 서버가
   * 안전하게 거절한다.
   */
  post: {
    label: '전기',
    lead: '만들어진 조정을 수불 원장에 반영합니다.',
    /**
     * **상시 사유** — 접혀 있을 때도 선다(D-12). 이 길이 누구의 길인지 밝히지 않으면
     * 결재선이 있는 조정도 여기로 오고, 그때 사용자가 만나는 것은 이유를 알 수 없는 400이다.
     *
     * ⚠ **「승인이 끝나기 전에는」이 빠지면 계약보다 넓게 말한다**(리뷰 R-3). 서버가 막는 것은
     * 「승인이 필요한데 **끝나지 않았을 때**」이고, 결재선의 존재 자체가 이 길을 영영 막는 것이
     * 아니다 — 넓게 적으면 **승인을 받아 낸 사용자가 이 길을 접고**, 그 조정은 승인만 받은 채
     * 영영 전기되지 않는다. 아래 세 문장 ②(「승인 뒤에도 이 버튼을 눌러야」)와 같은 방향을
     * 가리켜야 한다.
     */
    onlyWithoutRoute:
      '결재선이 없는 조정만 이 길로 갑니다. 결재선이 있으면 승인이 끝나기 전에는 서버가 전기를 막습니다 — 그때는 「조정 상신」으로 올리고 승인이 끝난 뒤에 전기하세요.',
    /**
     * 상시 문구 묶음의 **접근 이름**. 세 문장은 **버튼이 잠겨 있을 때도** 선다(C38) —
     * 잠금과 함께 감추면 정작 눌릴 수 있는 상태에서만 경고가 뜨는데, 그때는 이미 누르러 온
     * 순간이라 읽지 않는다.
     */
    effectsLabel: '전기하면 일어나는 일',
    /** 세 문장 ① — 이 조작의 결과를 가장 먼저 적는다(스펙 §5-2 · 결정 08). */
    effectMovesStock: '이 조작은 수불 원장에 조정을 기록해 재고를 실제로 움직입니다.',
    /** 세 문장 ② — 승인은 재고를 움직이지 않는다(스펙 J-5). 승인만 받아 놓고 잊는 일을 막는다. */
    effectApprovalIsNotPosting:
      '승인은 재고를 움직이지 않습니다 — 승인 뒤에도 이 버튼을 눌러야 조정이 원장에 잡힙니다.',
    /** 세 문장 ③ — 되돌리는 길이 이 화면에 **없다**는 사실. 있는 척하지 않는다. */
    effectNoUndoHere:
      '되돌리려면 반대 방향의 조정을 새로 세워 다시 전기해야 합니다 — 이 화면에 취소 수단은 없습니다.',
    /**
     * 두 칸의 라벨과 보조 문구.
     *
     * **화면이 정하지 않고 사용자에게 확인받는 값이다**(공유계약 C-8·C-1). 기본값은 제출
     * 순간이고, 경계에 선 사람만 고친다 — 그 사정을 보조 문구가 밝힌다.
     */
    businessDate: '영업일',
    businessDateHelper:
      '이 조정이 원장에 잡힐 날짜입니다. 자정을 넘겨 일했으면 어제 날짜일 수 있습니다.',
    occurredAt: '발생 일시',
    occurredAtHelper: '재고가 실제로 어긋난 시각입니다. 전기를 누르는 시각과 다를 수 있습니다.',
    posting: '전기하는 중입니다.',
    /**
     * 전기 성공 — **화면이 받은 200이 근거다.** 등록 응답에 실려 온 전기 시각으로는 이 갈래를
     * 세우지 않는다(목이 그 값을 채워 준다 — 계획 §5.2.5).
     */
    postedTitle: (adjustmentNo: string): string => `조정 전표 ${adjustmentNo}를 전기했습니다.`,
    postedDescription: '재고가 움직였습니다. 되돌리려면 반대 방향의 조정을 새로 세워야 합니다.',
    adjustedAt: '전기 시각',
    /**
     * 200은 왔는데 **전기 시각이 실려 오지 않았다**(계약이 그 값을 nullable로 두었다).
     * 빈 자리로 두면 「불러오지 못한 것」처럼 보이고, 지어내면 없는 사실을 말하게 된다.
     */
    adjustedAtUnknown: '서버가 전기 시각을 내려주지 않았습니다',
    /** 전기 응답이 준 상태 코드 **그대로**. 등록 시점 상태와 **다른 값**이라 이름을 가른다 */
    statusAfterPost: '전기 뒤 상태',
    /**
     * 이 화면의 장부·실물은 **등록할 때 받은 값**이다 — 전기로 재고가 움직였으므로 지금
     * 값과 다르다. 다시 부르면 사용자가 확인하고 등록한 근거가 화면에서 달라지므로 부르지 않고,
     * **그 사실을 적는다.**
     *
     * ⛔ **처리 이력 탭을 가리키지 않는다**(T5 재판단 · 다른 네 문구와 갈리는 자리). 이력
     * 상세는 이 낡음을 풀어 주지 못한다 — 계약의 조정 라인에 **장부가 없고**(실측), 지금 잔액을
     * 불러 채우면 그것은 조정 시점의 장부가 아니다. 확인할 수 없는 자리를 가리키면 그 지시가
     * 곧 죽은 문구가 되므로, 이 한 줄은 **사실만 말하는 형태를 유지한다.**
     */
    bookQtyStale: '위 표의 장부·실물은 등록할 때 받은 값이고 전기 뒤에 다시 부르지 않습니다.',
    /**
     * 전기만 실패한 갈래 — **전표는 남았다.** 통째로 실패라고 말하면 사용자가 처음부터 다시
     * 만들어 전표가 두 벌 남는다.
     *
     * ⛔ **서버가 거절한 갈래에서만 쓴다**(리뷰 R-1). 「재고는 움직이지 않았습니다」는 서버가
     * 요청을 되돌려 준 것을 근거로 하는 말이라, **응답이 오지 않은 요청**에는 쓸 수 없다 —
     * 그 요청은 서버에 닿아 이미 원장을 바꿨을 수 있다. 그 갈래는 아래 `networkUnconfirmed`가 맡는다.
     */
    failedTitle: (adjustmentNo: string): string =>
      `조정 전표 ${adjustmentNo}는 남고 전기만 실패했습니다.`,
    failedDescription:
      '재고는 움직이지 않았습니다. 전표를 다시 만들지 마세요 — 사정을 고쳐 다시 전기할 수 있습니다.',
    /**
     * ⭐ **응답을 받지 못한 요청은 「실패」가 아니다** — 멱등 완화의 마지막 층(공유계약 C-1).
     *
     * 이 화면의 세 쓰기 가운데 **하중이 가장 크다**: 그 요청은 서버에 닿아 **이미 재고를
     * 움직였을 수 있고**, 이 화면에는 그것을 되돌릴 경로가 없다(반대 방향의 조정을 새로 세워야
     * 한다). 그런데 쓰기 훅은 호출마다 새 멱등 키를 만들고, 다시 누르는 길은 상세 GET을 먼저
     * 지나 **새 잠금 토큰을 앉히므로** 낙관적 잠금도 두 번째 전기를 막지 못한다 — **막는 것이
     * 이 문구뿐이다.**
     *
     * ✅ **갱신 표지를 이행했다**(처리 이력 탭이 선 회차 · 등록 축과 같은 잣대). 확인 자리가
     * 실재한다 — 이력 목록에서 그 전표를 골라 상세를 열면 **전기일**이 선다. 그 값이 있으면
     * 원장에 잡힌 것이고 「전기 전」이면 아직 아니다(판정 근거가 전기 시각의 유무 하나다).
     *
     * ⚠ **금지가 먼저다.** 확인 뒤로 미루면 확인에 실패한 사용자가 그대로 다시 보내는데,
     * 다시 누르는 길은 상세 GET을 먼저 지나 **새 잠금 토큰을 앉히므로** 낙관적 잠금도 두 번째
     * 전기를 막지 못한다.
     */
    networkUnconfirmed:
      '응답을 받지 못해 재고가 움직였는지 알 수 없습니다. 같은 전표를 바로 다시 전기하지 마세요 — 「처리 이력」 탭에서 그 전표의 전기일을 먼저 확인하세요.',
    /**
     * 매임이 끊긴 채 **전기가 성공한** 갈래(D-15).
     *
     * **재고가 실제로 움직였다** — 등록·상신의 같은 갈래보다 무거운 사실이라 더 감출 수 없다.
     * 지금 보고 있는 대상의 결과로 세우지는 않되, 그 사실은 화면에 남긴다.
     */
    unboundPostedNote: (adjustmentNos: string): string =>
      `앞서 보낸 전기가 끝나 재고가 움직였습니다 — ${adjustmentNos}. 지금 보고 있는 것과는 별개이고, 「처리 이력」 탭에서 다시 찾을 수 있습니다.`,
  },
  /**
   * 결재 진행 — **어디까지 왔는가**만 말하는 자리다.
   *
   * ⛔ **승인·반려 조작이 없다**(조심 ① · D-3). 결재함(W-CO-09)이 그것을 소유하고, 이 화면은
   * 올리는 쪽이다 — 「내 차례」 표기도 나르지 않는다(C36).
   */
  progress: {
    label: '결재 진행',
    /** 「2 / 4 단계」·「결재 종료 · 전체 4단계」 — **서버가 준 두 수 그대로다.** */
    position: (current: number, total: number): string =>
      `${String(current)} / ${String(total)} 단계`,
    finished: (total: number): string => `결재 종료 · 전체 ${String(total)}단계`,
    noSteps: '결재 단계가 아직 없습니다.',
    /** 결재 전 단계의 **보이는 글자**. 디자인 시스템의 상태 낱말은 스크린리더 전용이다. */
    waitingCurrent: '결재를 기다리는 중',
    waitingPending: '앞 단계가 끝나기를 기다리는 중',
    requestNo: '승인 요청번호',
    approvalType: '승인 유형',
    status: '상태',
    requester: '상신자',
    requestedAt: '상신일',
    reason: '상신 사유',
    /**
     * 사유 구획의 **접근 이름**. 보이는 라벨과 갈라 둔다 — 같은 문자열을 쓰면 스크린리더가
     * 「상신 사유 … 상신 사유, 그룹」으로 두 번 읽는다.
     */
    reasonPane: '상신 사유 전문',
    /** 사유가 빈 채로 오는 갈래. 줄이 하나도 없으면 「불러오지 못한 것」처럼 보인다. */
    emptyReason: '사유가 비어 있습니다.',
    /**
     * 전표에 실려 온 승인 요청 값이 조회할 수 있는 값이 아니다.
     * **없는 값을 0으로 메워 부르지 않는다** — 그러면 남의 요청을 열거나 헛도는 요청이 나간다.
     */
    unusableTitle: '결재 진행을 확인할 수 없습니다',
    unusableDescription:
      '상신 응답에 실려 온 승인 요청 값이 조회할 수 있는 값이 아닙니다. 결재함에서 확인하거나 담당자에게 알려 주세요.',
    loadFailedTitle: '결재 진행을 불러오지 못했습니다',
    /** 계약이 「승인자도 상신자도 아니면 403」이라 적었다 — 같은 권한으로 다시 불러도 같은 답이다. */
    forbiddenTitle: '이 요청의 결재 진행을 볼 권한이 없습니다',
    forbiddenDescription:
      '승인자도 상신자도 아니면 결재 진행이 열리지 않습니다. 담당자에게 확인해 주세요.',
    notFoundTitle: '결재 진행을 찾을 수 없습니다',
    notFoundDescription: '승인 요청이 지워졌거나 이 전표와 이어지지 않습니다.',
    /**
     * **못 읽어도 이 조정에 일어난 일은 달라지지 않는다.** 결재 진행은 판단을 돕는 자료이지
     * 처리의 전제가 아니다 — 상신은 이미 202로 받아들여졌다.
     */
    loadFailedNote:
      '결재 진행을 읽지 못해도 상신은 이미 접수됐습니다. 결재함에서 확인할 수 있습니다.',
    /**
     * **계약이 못 박은 사실**이라 화면이 지어내는 것이 아니다 — 승인은 상태만 바꾸고 재고는
     * 전기가 움직인다. 승인만 받아 놓고 잊는 일을 막는 자리다.
     */
    postSeparateNote: '승인은 재고를 움직이지 않습니다. 재고는 전기할 때 움직입니다.',
    /** 승인 완료를 뜻하는 상태 코드가 확정되기 전까지 화면이 못 하는 판정을 밝힌다(D-13). */
    unjudgeableNote:
      '승인이 끝났는지 화면이 판정하지 못합니다. 위 단계와 상태 코드를 보고 판단하세요.',
    /**
     * 자리표시가 **채워졌고** 그 요청이 승인 상태일 때만 선다(D-13).
     *
     * ⚠ **없는 자리를 가리키지 않는다.** 이 회차에는 전기 조작이 아직 없으므로 「전기하세요」로
     * 지시하지 않는다 — 할 수 없는 조치를 지시하면 그 안내가 사용자를 헛돌게 한다.
     * **전기가 붙는 회차가 이 문구를 그 자리를 가리키도록 갱신한다.**
     */
    approvedNote: '승인되었습니다. 재고는 아직 움직이지 않았습니다 — 전기는 별개 조작입니다.',
  },
} as const;

/**
 * W-CO-10 비밀번호 변경 — **로그인 블록과 반대 규율이 걸리는 자리다.**
 *
 * 로그인 문구는 어느 칸이 틀렸는지 지목하지 않는다. 지목하는 말이 곧 「그 아이디는 있다」를
 * 흘리기 때문이다. 여기서는 **지목한다** — 이미 인증된 본인만 보는 화면이라 흘릴 것이 없고,
 * 세 칸 중 어디를 고쳐야 하는지 말하지 않으면 사용자가 고칠 수 없다.
 *
 * ⛔ **이 블록에 두지 않는 말 넷.** 잠금·남은 시도 횟수(이 화면은 계정을 잠그지 않는다) ·
 * 조합 규칙(대문자·숫자·특수문자 — 설계가 뺐다) · 직전 비밀번호 재사용 금지(이력이 필요한
 * 규칙이라 설계가 뺐다) · 재로그인 안내(바꾼 뒤 다시 로그인시키지 않는다). **없는 규칙을 문구가
 * 먼저 만들면** 사용자는 그 규칙이 있다고 믿고, 화면은 지키지도 못할 말을 한 것이 된다.
 */
const passwordChange = {
  title: '비밀번호 변경',
  breadcrumbRoot: '시스템 관리',
  fields: {
    currentPassword: '현재 비밀번호',
    newPassword: '새 비밀번호',
    confirmPassword: '새 비밀번호 확인',
  },
  /**
   * 새 비밀번호 칸의 도움말. **최소 길이를 주입받는다** — 문구에 숫자를 손으로 적으면 상수를
   * 바꿀 때 문구만 옛 값으로 남는다(로그인 블록의 `lockWarning`과 같은 규율).
   *
   * 뒷문장이 **없는 규칙을 밝힌다.** 조합 규칙이 있다고 넘겨짚은 사용자는 쓸 수 있는 값을
   * 스스로 버린다 — 규칙이 없다는 사실도 알려야 할 정보다.
   *
   * ⛔ 그러면서도 **규칙의 종류를 이름으로 부르지 않는다.** 「대문자·숫자·특수문자는 필요
   * 없습니다」라고 쓰면 부정문이어도 그 낱말들이 화면에 서고, 빨리 읽는 사람에게는 그것이 곧
   * 규칙 목록으로 보인다. 없는 규칙은 이름도 짓지 않는다.
   *
   * ⚠ **있는 규칙은 하나도 빼지 않는다.** 앞문장을 「…자 이상이면 됩니다」로 쓰면 충분조건으로
   * 읽히는데 이 화면에는 규칙이 하나 더 있다(현재 비밀번호와 같으면 거부). 감추면 사용자는
   * 통과할 줄 알았던 값에서 예고 없는 오류를 만난다 — **없는 규칙을 짓지 않는 것과 있는 규칙을
   * 감추지 않는 것은 같은 규율의 양면이다.**
   */
  notice: (minLength: number): string =>
    `${String(minLength)}자 이상이어야 하고 현재 비밀번호와 달라야 합니다. 글자 종류를 섞어야 하는 규칙은 없습니다.`,
  actions: {
    submit: '변경',
  },
  /**
   * 바뀌었다는 알림. **이동하지도 다시 로그인시키지도 않으므로**(스펙 §5-3) 화면은 그대로 있고
   * 이 한 줄이 유일한 성공 신호다 — 그래서 공용 문구(「저장했습니다」)를 쓰지 않고 **무엇이
   * 바뀌었는지**를 말한다. 다음에 로그인할 때 무엇을 쳐야 하는지가 그 말에 달렸다.
   */
  toast: {
    changed: '비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 사용하세요.',
  },
  /**
   * 화면 수준 실패. **칸에 붙일 수 없는 것만** 여기 선다 — 어느 칸의 문제인지 아는 실패는
   * 인라인이 맡는다(공유계약 G-1의 이 화면 판본: 이미 인증된 본인이라 지목해도 흘릴 것이 없다).
   */
  banner: {
    /**
     * 실패가 **확정된** 갈래의 제목. 이 단언이 참인 갈래는 **400 하나뿐**이다 — 계약이 그것을
     * 「검증 실패, 고쳐야 풀린다」로 두었고(실행 전 거부) 서버가 **값을 보고 거절했음**이 확실하다.
     *
     * ⚠ **나머지 갈래에는 쓰지 않는다.** 갈래마다 따로 답한 결과다.
     *
     * | 갈래 | 이 단언이 참인가 | 왜 |
     * | --- | :-: | --- |
     * | 400 검증 실패 | ✅ | 서버가 값을 보고 거절했다(실행 전 거부) |
     * | 응답 없음 | ⛔ | 요청이 닿았다면 이미 바뀌었다 |
     * | 가를 근거 없음(5xx 포함) | ⛔ | **적용 여부도 가를 수 없다** — 5xx는 원본이 쓰기를 마친 뒤 앞단이 실패한 경우를 포함하고, 그래서 이 갈래는 멱등 키를 유지한다 |
     * | 401 | — | 배너를 세우지 않는다(그 칸 옆이 자리다) |
     */
    failureTitle: '비밀번호를 바꾸지 못했습니다',
    /**
     * ⭐ **응답이 오지 않은 갈래의 제목 — 실패를 단언하지 않는다.**
     *
     * 제목은 굵게 먼저 읽히므로, 본문이 「이미 바뀌었을 수 있습니다」라고 말해도 제목이
     * 「바꾸지 못했습니다」면 사용자는 **제목을 믿고 옛 비밀번호로 다음 로그인을 시도한다.**
     * 한 배너 안에서 두 문장이 서로를 부정하면 그중 먼저 읽히는 쪽이 이긴다.
     *
     * ⚠ **전례(로그인)의 「제목은 갈래 무관 상수」 형태를 그대로 옮기면 안 되는 자리다.**
     * 그쪽에서 그 형태가 참인 이유는 **세션이 생겼거나 안 생겼거나 둘뿐**이고 응답이 없으면
     * 세션은 확실히 없기 때문이다. 이 화면은 **되돌릴 수 없는 쓰기**라 「응답을 못 받았다」와
     * 「적용되지 않았다」가 같지 않다 — 결정 ②-1이 키를 유지하는 이유와 같은 사실이다.
     *
     * ⭐ **그 물음은 갈래마다 따로 답해야 한다.** 한 갈래(응답 없음)에 답한 것으로 나머지가
     * 답해지지 않는다 — 오히려 한 갈래를 고치는 편집이 나머지 갈래의 점검을 「이미 봤다」로 덮는다.
     * 실제로 그렇게 5xx가 한 회차 동안 잘못된 근거로 단언을 유지했다. 위 `failureTitle`의 표가
     * 갈래별 답이며, **갈래가 늘면 그 표에 줄을 더한다**(제목이 필수 필드라 컴파일러가 함께 묻는다).
     */
    unconfirmedTitle: '비밀번호가 바뀌었는지 확인하지 못했습니다',
    /**
     * ⭐ **응답이 오지 않은 갈래 — 「바꾸지 못했다」고 단언하지 않는다.**
     *
     * 요청은 서버에 닿았을 수 있고, 그렇다면 비밀번호는 **이미 바뀌었다.** 실패라고만 말하면
     * 사용자는 옛 비밀번호로 다음 로그인을 시도한다. 그래서 이 문구는 **모른다는 사실**을 말하고,
     * 다시 눌러도 두 번 적용되지 않는다는 것까지 알린다(같은 시도로 다시 보내기 때문이다).
     */
    networkUnconfirmed:
      '응답이 오지 않아 바뀌었는지 확인하지 못했습니다. 이미 바뀌었을 수 있습니다 — 다시 시도해도 같은 요청이라 두 번 적용되지 않습니다.',
  },
  actionReasons: {
    /** 아직 다 치지 않았다. **어느 칸인지 세지 않는다** — 빈 칸이 여럿이면 목록이 되어 길어진다. */
    incomplete:
      '변경은 현재 비밀번호와 새 비밀번호, 새 비밀번호 확인을 모두 입력하면 쓸 수 있습니다.',
    /**
     * 나가는 중인 사유. **연타를 막는 것이 목적이다** — 이 쓰기는 되돌릴 수 없고, 두 번 실행되면
     * 두 번째가 반드시 실패한다(첫 번째가 이미 값을 바꿔 놓았기 때문이다).
     */
    submitting: '변경은 응답을 기다리는 중입니다. 답이 오면 다시 쓸 수 있습니다.',
    /**
     * 칸은 다 찼는데 규칙이 깨졌다. **무엇이 깨졌는지 여기서 되풀이하지 않는다** — 그것은
     * 이미 그 칸 옆에 인라인으로 서 있고, 같은 말을 두 자리에서 하면 어느 쪽을 고쳐야 할지
     * 흐려진다. 사유는 **고칠 자리를 가리키는 일**만 한다.
     */
    invalid: '변경은 각 칸에 표시된 오류를 고치면 쓸 수 있습니다.',
  },
  /**
   * 칸 옆에 서는 인라인 오류. **한 칸에 한 문장**이다.
   *
   * 짝이 어긋난 문구(`confirmMismatch`)는 **두 칸에 함께** 선다(공유계약 A-2) — 한쪽만 붉히면
   * 새 값을 고쳐야 하는지 확인 값을 고쳐야 하는지 알 수 없다. 그래서 문구도 어느 한쪽을
   * 틀렸다고 말하지 않고 **두 값이 다르다는 사실**만 말한다.
   */
  validation: {
    tooShort: (minLength: number): string =>
      `새 비밀번호는 ${String(minLength)}자 이상이어야 합니다.`,
    sameAsCurrent: '새 비밀번호가 현재 비밀번호와 같습니다. 다른 값을 입력하세요.',
    confirmMismatch: '새 비밀번호와 확인 값이 다릅니다.',
    /**
     * 서버가 현재 비밀번호를 거절했다. **그 칸에 인라인으로 선다.**
     *
     * ⛔ **몇 번 틀렸는지도, 몇 번 더 틀릴 수 있는지도 말하지 않는다.** 이 화면은 틀려도 계정을
     * 잠그지 않으므로(스펙 §5-2) 셀 것이 없고, 세는 말을 두면 잠금이 있다는 뜻이 된다.
     * 계약도 이 응답에 남은 횟수를 두지 않았다.
     */
    currentMismatch: '현재 비밀번호가 맞지 않습니다.',
  },
} as const;

/**
 * W-06-14 적치 규칙 마스터.
 *
 * **이 화면의 고유 어휘는 둘이다.**
 *
 * 1. **「창고 전체」** — 규칙의 위치가 비어 있는 상태다. 값이 빠진 것이 아니라 **확정된 뜻**이며
 *    (그 창고 어디에 두어도 된다) 「알 수 없음」이나 대시로 두면 정반대로 읽힌다.
 * 2. **「규칙 없는 품목」** — 그 창고에 입고 이력이 있는데 활성 규칙이 하나도 없는 품목이다.
 *    이 수가 0인 것이 **좋은 상태**이므로 0건의 문면에 경고 어휘를 쓰지 않는다.
 */
const putawayRule = {
  title: '적치 규칙',
  breadcrumbRoot: '기준정보',
  panes: {
    list: '적치 규칙 목록',
    uncovered: '규칙 없는 품목',
    /** 등록과 수정이 **한 구획**을 쓴다 — 두 폼을 나란히 두면 어느 것이 지금 열린 것인지 흐려진다. */
    form: '적치 규칙 편집',
    /**
     * 사용 전환 구획 — **폼과 나눈다.**
     *
     * 전환은 폼 저장과 다른 오퍼레이션이고 **초안이 서기 전에도 자리가 있어야 한다** —
     * 상세가 오기 전에는 잠금 토큰이 없어 전환을 낼 수 없는데(위험 R2), 그 사실을 말할 자리가
     * 폼 안에만 있으면 폼이 서기 전까지 화면이 아무 말도 하지 못한다.
     */
    activation: '규칙 사용 전환',
  },
  fields: {
    warehouse: '창고',
    item: '품목',
    location: '위치',
    capacity: '용량',
    /** 폼에서만 고른다. 목록에서는 용량 문자열의 일부로 들어간다. */
    uom: '단위',
    remarks: '비고',
    /**
     * 규칙 용량 옆에 서는 열. **용량이 숫자 하나로 떠 있으면 크고 작음을 판단할 수 없다** —
     * 지금 얼마나 차 있는지가 옆에 있어야 그 수가 뜻을 얻는다.
     */
    onHand: '현재 적재',
    /** 목록 열 이름. 폼의 「사용 여부」와 달리 한 낱말이라야 좁은 칸에서 접히지 않는다. */
    status: '사용',
    priorityNo: '우선순위',
    itemCode: '품목코드',
    itemName: '품목명',
    lastReceivedAt: '마지막 입고',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    /** 목록과 규칙 없는 품목을 **함께** 다시 부른다. 한쪽만 부르면 갱신된 값과 낡은 값이 섞인다. */
    reload: '다시 조회',
    /**
     * 행 안의 버튼. 보이는 글자(품목 이름)가 행마다 같을 수 있다 — 같은 품목의 위치별 규칙이
     * 여럿 설 수 있어 **위치를 함께 담는다.** 내부 번호는 접근 이름에도 넣지 않는다(`omf-mes#44`).
     */
    selectRow: (itemLabel: string, locationLabel: string): string =>
      `${itemLabel} · ${locationLabel} 선택`,
    /** 펼침 손잡이 하나가 두 방향을 맡는다 — 접근 이름은 **지금 무엇을 하는가**로 적는다. */
    expandUncovered: '규칙 없는 품목 펼치기',
    collapseUncovered: '규칙 없는 품목 접기',
    /** 빈 초안을 연다. 「추가」만으로는 무엇이 추가되는지 액션 줄 밖에서 읽히지 않는다. */
    create: '규칙 추가',
    /** 등록의 주 액션. 수정의 「저장」과 이름이 달라야 지금 어느 폼인지 버튼에서 읽힌다. */
    submitCreate: '등록',
    /**
     * 꺼진 규칙을 되살린다. 「사용 중지」(`common.deactivate`)와 **짝이며 한 번에 하나만 선다** —
     * 둘을 함께 두면 지금 켜져 있는지 꺼져 있는지가 버튼에서 읽히지 않는다.
     */
    activate: '다시 사용',
    /**
     * **어느 쪽인지 아직 모를 때** 서는 중립 이름.
     *
     * 상세가 오기 전에는 사용 여부를 모르므로 「사용 중지」도 「다시 사용」도 사실이 아니다 —
     * 그 자리에 둘 중 하나를 세우면 화면이 확인하지 않은 상태를 단언하게 된다. 이 이름은
     * **비활성으로만** 서고, 상세가 도착하면 두 이름 중 하나로 바뀐다.
     */
    activation: '사용 전환',
    /** 품목은 수천 건일 수 있어 펼침 목록에 담지 않는다 — 창을 열어 찾는다. */
    openItemPicker: '품목 찾기',
    searchItems: '찾기',
    /** 창 안 표의 행 버튼. 보이는 글자가 품목 이름이라 그대로 담는다(내부 번호는 담지 않는다). */
    chooseItem: (itemLabel: string): string => `${itemLabel} 고르기`,
    keepEditing: '계속 편집',
    discardDraft: '고친 값 버리기',
    /*
     * 409의 「최신 불러오기」는 여기 없다 — 공통 저장 실패 배너(`patterns/master`)가 그 문구를
     * 갖는다. 화면마다 다시 적으면 같은 조작의 이름이 화면마다 갈린다.
     */
  },
  loading: {
    list: '적치 규칙 목록 불러오는 중',
    uncovered: '규칙 없는 품목 불러오는 중',
    detail: '적치 규칙 불러오는 중',
    itemSearch: '품목 찾는 중',
  },
  filters: {
    all: '전체',
    /**
     * 「사용 중만」이 화면 어휘다. 계약 파라미터(`includeInactive`)는 방향이 반대이며
     * 뒤집는 자리는 `filters.ts` 한 곳이다.
     *
     * **기본은 꺼짐이다** — 끈 규칙을 다시 켜는 것이 이 마스터의 정상 운용이라(이슈 §6)
     * 사용 안 함 행이 처음부터 보여야 한다.
     */
    activeOnly: '사용 중만',
    /** 창고를 고르기 전에는 품목을 좁힐 대상이 없다. 감추지 않고 사유를 밝힌다. */
    itemNeedsWarehouse: '품목 조건은 창고를 고른 뒤에 쓸 수 있습니다.',
    /**
     * 선택지가 **0건**일 때 트리거에 서는 자리표시.
     *
     * 그때는 「전체」도 붙이지 않는다 — 「전체를 고를 수 있다」가 곧 「목록이 준비됐다」로
     * 읽히는데, 실제로는 고를 값이 하나도 오지 않은 상태다.
     */
    noWarehouseOptions: '고를 창고가 없습니다',
    noItemOptions: '고를 품목이 없습니다',
    lookupTruncated: '선택지가 앞쪽 일부만 보입니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
    lookupFailed: '선택지를 불러오지 못했습니다.',
    chipWarehouse: (value: string): string => `창고: ${value}`,
    chipItem: (value: string): string => `품목: ${value}`,
    chipRemoveWarehouse: '창고 조건 제거',
    chipRemoveItem: '품목 조건 제거',
    chipRemoveActiveOnly: '사용 중만 조건 제거',
  },
  /** 쪽 이동. 번호 목록을 두지 않는 근거는 screens/putaway-rule/page-nav.tsx에 있다. */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  empty: {
    /** 창고를 고르기 전. **빈 표가 아니라 안내다** — 빈 표는 「규칙이 없다」로 읽힌다. */
    noWarehouseTitle: '창고를 고르면 적치 규칙이 보입니다',
    noWarehouseDescription: '위쪽 창고 칸에서 창고를 고르세요.',
    noResultTitle: '등록된 규칙이 없습니다',
    noResultDescription: '조건을 줄이거나 「사용 중만」을 끈 뒤 다시 조회하세요.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
    /** 규칙을 고르기 전. 폼 구획을 빈 칸으로 두면 「값이 없는 규칙」으로 읽힌다. */
    noSelectionTitle: '규칙을 고르면 여기서 고칠 수 있습니다',
    noSelectionDescription: '표에서 품목을 누르거나 「규칙 추가」로 새로 만드세요.',
    /** 주소에 남은 번호가 가리키는 규칙이 없다. 실패와 다른 사실이라 다른 문구를 낸다. */
    notFoundTitle: '고른 규칙을 찾을 수 없습니다',
    notFoundDescription: '이미 지워졌거나 주소가 잘못됐습니다. 표에서 다시 고르세요.',
  },
  values: {
    /** 이름 목록은 왔는데 그 안에 없다 — **값이 잘못됐다**는 신호다. */
    unknown: '알 수 없음',
    /** 이름 목록이 아직 오지 않았다. 「알 수 없음」으로 쓰면 정상 값이 잘못된 값으로 읽힌다. */
    referenceLoading: '이름 불러오는 중',
    /** 이름 목록 조회가 실패했다. 값이 없는 것과 다르다. */
    referenceFailed: '이름을 불러오지 못했습니다',
    inactiveSuffix: ' (미사용)',
    /**
     * 위치를 비운 규칙. **빈 값이 아니라 확정된 뜻이다** — 그 창고 안 어디에 두어도 되고
     * 세부 위치는 창고 안 정책이 정한다. 참조 조회가 실패해도 이 뜻은 흔들리지 않는다.
     */
    warehouseWide: '창고 전체',
    active: '사용 중',
    inactive: '사용 안 함',
    /** 용량은 수량과 단위가 한 몸이다 — 수량만 보이면 크고 작음을 판단할 수 없다. */
    capacity: (qty: string, uomLabel: string): string => `${qty} ${uomLabel}`,
    /** 입고 이력이 없다. 계약이 이 값을 선택으로 두었다. */
    neverReceived: '입고 이력 없음',
    /**
     * 현재 적재량. **용량과 같은 형태로 적는다** — 두 수가 같은 모양이라야 눈으로 견줄 수 있다.
     * 키를 용량과 나눠 두는 이유는 뜻이 다르기 때문이다(하나는 규칙이 정한 상한, 하나는 실측).
     */
    onHandQty: (qty: string, uomLabel: string): string => `${qty} ${uomLabel}`,
    /**
     * 사용률 수치. 막대의 낭독 문자열(`valueText`)이 쓴다.
     *
     * **막대가 아니라 이 문자열이 실제 비율을 말한다.** 디자인 시스템 `Progress`는 값을 `max`로
     * 자르므로(`clampValue`) 128%와 100%가 막대에서 구분되지 않는다 — 낭독까지 잘린 값을
     * 읽으면 화면을 보지 않는 사용자에게는 초과 사실이 아예 사라진다.
     */
    usagePercent: (percent: string): string => `${percent}%`,
    /**
     * 사용률 칸에 눈으로 보이는 한 줄. **수량·단위·비율을 한 줄에 둔다** —
     * 비율만 보이면 무엇의 비율인지 되짚어야 하고, 수량만 보이면 용량과 견주는 일을
     * 사람이 대신 하게 된다.
     */
    usageSummary: (qty: string, uomLabel: string, percent: string): string =>
      `${qty} ${uomLabel} · ${percent}%`,
    /** 사용률 막대의 접근 이름. 막대 하나가 무엇을 견주는지 이름이 말해야 한다. */
    usageBarLabel: '용량 대비 현재 적재',
    /**
     * 잔액 줄이 **한 줄도 없다.** 「0이다」와 다른 사실이다 —
     * 0은 재고를 확인한 결과이고 이것은 그 위치·품목의 잔액 줄 자체가 없는 것이다.
     */
    onHandNone: '—',
    /** 잔액이 아직 오지 않았다. 「없다」로 쓰면 확인하지 못한 것을 사실로 말하게 된다. */
    onHandLoading: '적재량 불러오는 중',
    /** 잔액 조회가 실패했다. 값이 없는 것과 다르다. */
    onHandFailed: '적재량을 불러오지 못했습니다',
    /** 잘린 목록으로 합을 내면 실제보다 적은 수가 사용률의 분자가 된다. */
    onHandTruncated: '적재량이 일부만 왔습니다',
    /**
     * 응답에 묶은 축이 섞여 왔다. 축이 다른 줄을 함께 더하면 **같은 재고를 두 번 센다** —
     * 셈하지 않고 그 사실을 말한다.
     */
    onHandAxisMixed: '적재량을 묶은 축이 섞여 있습니다',
    /** 소유 구분은 서버가 준 코드를 번역하지 않고 그대로 낸다(공유계약 G-2 — 값 목록 미확정). */
    ownershipQty: (code: string, qty: string, uomLabel: string): string =>
      `${code} ${qty} ${uomLabel}`,
    /**
     * 같은 (품목·창고·위치·우선순위) 활성 규칙이 이 쪽에 둘 이상이다.
     *
     * **이 쪽 안의 사실만 말한다** — 쪽이 다른 중복은 저장 시 서버가 400으로 되돌린다.
     * ⚠ 판정 축이 4키인 것은 **확정이 아니라 채택한 기본값**이다(계약 정본 안에서 등록 문면은
     * 3키다 — `screens/putaway-rule/duplicate-badge.ts` 주석과 승인 기록 Q2).
     */
    duplicate: '중복',
  },
  notes: {
    /**
     * **이 쪽 안에서 센 수다.** 전체 건수는 서버가 주지만 사용 중 건수는 주지 않으므로
     * 지금 보이는 쪽에서만 셀 수 있다 — 범위를 밝히지 않으면 전체 수로 읽힌다.
     */
    activeCountInPage: (count: number): string => `이 쪽에서 사용 중 ${String(count)}건`,
    /**
     * 이름 목록이 잘렸다 — **위치·단위처럼 고르는 칸이 없는 참조**의 잘림을 말하는 자리다.
     *
     * 잘린 목록으로 이름을 풀면 뒤쪽 값을 가리키는 **정상 규칙**이 「알 수 없음」으로 찍히는데,
     * 그 문구는 *값이 잘못됐다*는 뜻이라 사용자가 정확히 반대로 읽는다. 그래서 「알 수 없음」이
     * 값의 잘못이 아닐 수 있다는 것까지 말한다.
     */
    nameLookupTruncated:
      '이름 목록이 앞쪽 일부만 왔습니다. 「알 수 없음」으로 보이는 값이 실제로는 정상일 수 있습니다 — 담당자에게 알려 주세요.',
    /**
     * 규칙 단위와 적재 단위가 다르다. **환산하지 않는다** — 환산 정의가 없는 조합이 있고,
     * 억지로 맞춘 숫자를 운영자가 근거로 삼는다(이슈 §6). 두 값을 단위와 함께 그대로 둔다.
     */
    usageUnitMismatch: '단위가 달라 비율을 내지 않았습니다.',
    /**
     * 소유 구분이 둘 이상이다. **합치지 않는다**(공유계약 L-7) —
     * 자사 재고와 고객 지급품을 더한 비율은 오독이다.
     */
    usageOwnershipSplit: '소유 구분이 섞여 있어 합치지 않았습니다.',
    /**
     * 규칙 용량이 0 이하다. 계약은 0을 넣을 수 없다고 적었지만 자료가 그렇다면 나눌 수 없다 —
     * 나누면 화면에 무한대나 NaN이 선다.
     */
    usageCapacityNotPositive: '규칙 용량이 0 이하라 비율을 낼 수 없습니다.',
    /**
     * 적재량이 음수다. 계약이 명시로 허용한 값이며(음수 허용 품목) **장부와 실물이 어긋난
     * 상태**다.
     *
     * 비율을 내면 막대가 0으로 잘려 **가장 비어 있는 위치와 같은 모양**이 되는데, 둘은 정반대의
     * 조치를 부른다 — 비율을 만들지 않고 수량만 사실대로 보인다.
     */
    usageNegativeOnHand: '적재량이 음수라 비율을 내지 않았습니다.',
    /**
     * 수정에서 품목·창고가 잠긴 사유. **계약이 수정 본문에서 두 키를 뺐다** —
     * 「바꾸면 다른 규칙이다」가 계약의 말이다. 잠근 채 사유를 말하지 않으면 고장으로 읽힌다.
     */
    itemFixed: '품목과 창고는 등록할 때만 고를 수 있습니다. 바꾸려면 새 규칙을 만드세요.',
    /**
     * 위치를 비우면 창고 전체 규칙이다. **빈 값이 아니라 확정된 뜻**이라 그 사실을 칸 옆에서 말한다 —
     * 말하지 않으면 사용자는 「고르다 만 것」으로 읽는다.
     */
    locationEmptyMeansWarehouseWide: '위치를 비우면 그 창고 전체에 적용되는 규칙입니다.',
    /**
     * 창고 관리수준 값 목록이 확정되기 전이다(`omf-mes#64`). **지금은 모든 창고에서 위치를
     * 고를 수 있다** — 값이 정해지면 위치를 쓰지 않는 창고에서 이 칸이 잠긴다.
     */
    managementLevelPending:
      '창고별 위치 관리 여부가 아직 정해지지 않아 모든 창고에서 위치를 고를 수 있습니다.',
    /**
     * 위치 칸이 **실제로 잠긴** 사유. 위 문장과 **반드시 달라야 한다** —
     * 「모든 창고에서 고를 수 있습니다」를 잠긴 칸의 사유로 쓰면 값이 정해지는 날
     * 화면이 자기모순을 말한다(잠겼는데 「고를 수 있다」).
     *
     * ⛔ 지금은 **뜰 수 없다.** `LOCATION_MANAGED_LEVEL_CODES`가 비어 있는 동안 칸이
     * 잠기지 않기 때문이다. 값이 채워지는 날 이 문장이 처음 화면에 선다.
     */
    locationNotManaged: '이 창고는 위치를 관리하지 않습니다.',
    /** 우선순위 방향은 **데이터에 적혀 있지 않고 계약이 정한 것**이라 화면이 말해야 한다. */
    priorityDirection: '작을수록 먼저 권장합니다.',
    /**
     * 위치 자체 용량 — **실값을 나란히 보인다**(계약이 `Location.capacityQty`를 내려준다).
     * 규칙 용량 하나만 보이면 그 수가 그 위치에 맞는지 판단할 근거가 화면에 없다.
     */
    locationCapacity: (qty: string, uomLabel: string): string =>
      `이 위치의 용량 ${qty} ${uomLabel}`,
    /**
     * 규칙 용량이 위치 용량보다 크다. **막지 않는다**(`omf-mes#84` — 용량은 적치 판정에 쓰이지
     * 않는다). 어느 쪽이 이기는지 정해지지 않은 상태에서 저장을 막으면 화면이 없는 규칙을 만든다.
     */
    locationCapacityOver: '규칙 용량이 이 위치의 용량보다 큽니다. 저장은 됩니다.',
    /** 단위가 다르면 두 수는 애초에 같은 종류가 아니다 — 환산하지 않고 견주지도 않는다. */
    locationCapacityUnitMismatch: '위치 용량과 단위가 달라 견주지 않았습니다.',
    /**
     * 활성 중복을 **판정하지 못했다**(불러오는 중·실패·잘림). 「중복 없음」으로 뭉개면 확인하지
     * 못한 것을 사실로 말하게 된다 — 다만 **막지는 않는다**(계약이 같은 조건을 다시 검사한다).
     */
    duplicateUnknown: '같은 조합의 규칙이 이미 있는지 확인하지 못했습니다. 저장은 할 수 있습니다.',
    /**
     * **켜기 갈래**의 판정 불가. 저장 축(`duplicateUnknown`)과 문장을 나눈 이유는 두 가지다 —
     * 겨누는 값이 다르고(저장은 폼 값, 켜기는 **서버 값**) 뒤따르는 조작 이름이 다르다.
     * 「저장은 할 수 있습니다」를 켜기 자리에 세우면 사용자가 누를 버튼과 문장이 어긋난다.
     */
    activateDuplicateUnknown:
      '같은 조합의 사용 중인 규칙이 있는지 확인하지 못했습니다. 다시 사용은 할 수 있습니다 — 겹치면 서버가 되돌립니다.',
    /**
     * 요청이 나가는 중이라는 사실을 **상시** 밝힌다(공유계약 G-30). 막는 것은 전역이고
     * 보이는 것은 대상에만인데, 잠긴 이유가 화면 어디에도 없으면 사용자에게 고장으로 읽힌다.
     *
     * ⛔ **폼 구획 안에 두지 않는다.** 폼은 대상이 풀리면 닫히는데(뒤로가기·주소 편집) 잠금은
     * 요청이 끝날 때까지 남는다 — 사유를 폼 안에 두면 **폼이 닫힌 채 잠긴 갈래**에서 잠긴
     * 이유가 화면 어디에도 없다. 전환(끄기·켜기)은 폼이 서기 전에도 시작될 수 있어 그 갈래가
     * 흔해진다. 그래서 이 문장의 자리는 **화면 수준**이다(`screens/putaway-rule/screen.tsx`).
     */
    savingLock:
      '보내는 중인 요청이 끝날 때까지 다른 규칙으로 옮기거나 새 저장·사용 전환을 시작할 수 없습니다.',
    /**
     * ⭐ **응답을 받지 못한 요청은 「실패」가 아니다** — 멱등 완화의 마지막 층(공유계약 C-1).
     *
     * 쓰기 훅은 호출마다 **새 멱등 키**를 만든다 — 그대로 다시 보내면 서버에는 다른 요청으로
     * 보이고, 첫 요청이 이미 닿았다면 같은 규칙이 두 번 등록된다.
     *
     * ⚠ **금지가 먼저다.** 확인을 앞에 두면 확인에 실패한 사용자가 그대로 다시 보낸다.
     * 확인 자리는 실재한다 — 「다시 조회」가 목록과 상세를 함께 다시 부른다.
     */
    networkUnconfirmed:
      '응답을 받지 못해 저장됐는지 알 수 없습니다. 같은 값으로 바로 다시 저장하지 마세요 — 「다시 조회」로 목록에서 결과를 먼저 확인하세요.',
    /**
     * ⭐ 전환 축의 같은 갈래. **저장 축보다 무겁다** — 끄기가 닿았다면 그 순간부터 현장의
     * 적치 검증이 달라져 있고, 화면이 「실패했습니다」로 접으면 사용자는 **끄지 못했다고 믿은 채**
     * 검증 없이 도는 현장을 그대로 둔다.
     *
     * 확인 자리는 목록의 「사용」 칸이다 — 값이 바뀌었으면 닿은 것이고 그대로면 아직 아니다.
     */
    activationUnconfirmed:
      '응답을 받지 못해 사용 여부가 바뀌었는지 알 수 없습니다. 같은 버튼을 바로 다시 누르지 마세요 — 「다시 조회」로 목록의 사용 표시를 먼저 확인하세요.',
  },
  /**
   * 등록·수정 폼에서만 쓰는 문구.
   *
   * 창고의 「고를 창고가 없습니다」는 **조건 줄과 같은 문장**이라 `filters`의 것을 그대로 쓴다 —
   * 같은 사실을 두 문장으로 적으면 두 자리가 갈릴 때 어느 쪽이 옳은지 알 수 없다.
   */
  form: {
    /** 선택지가 **0건**일 때만 선다. 미도착·실패에는 아무 말도 하지 않는다(`optionsPlaceholder`). */
    noUomOptions: '고를 단위가 없습니다',
    /**
     * 아직 품목을 고르지 않았다.
     *
     * ⛔ **「알 수 없음」을 쓰지 않는다.** 그 낱말은 이 슬라이스에서 *이름 목록은 왔는데 그
     * 안에 없다 = 값이 잘못됐다*는 뜻이고, 목록 표의 깨진 행이 같은 낱말을 쓴다 — 빈 폼에
     * 그것을 세우면 「아직 안 골랐다」와 「값이 깨졌다」를 사용자가 가를 수 없다.
     */
    itemNotChosen: '아직 고르지 않았습니다',
  },
  /** 보내기 전에 화면이 잡는 오류. 서버가 되돌려 주기를 기다리면 사용자가 두 번 기다린다. */
  validation: {
    itemRequired: '품목을 고르세요.',
    warehouseRequired: '창고를 고르세요.',
    capacityRequired: '용량을 입력하세요.',
    capacityNotNumber: '용량은 숫자로 입력하세요.',
    /** 계약이 「0 은 넣을 수 없다」로 못 박았다. 음수도 같은 자리에서 막는다. */
    capacityNotPositive: '용량은 0보다 커야 합니다.',
    uomRequired: '단위를 고르세요.',
    priorityRequired: '우선순위를 입력하세요.',
    priorityNotInteger: '우선순위는 정수로 입력하세요.',
  },
  /** 비활성 액션에는 **반드시 사유가 붙는다**(배치 규범 4). 컨트롤 이름으로 시작한다. */
  actionReasons: {
    saveNoChanges: '저장은 고친 것이 있을 때 누를 수 있습니다.',
    /**
     * 같은 (품목·창고·위치·우선순위) 활성 규칙이 이미 있다 — 계약이 400으로 막는 조합이다.
     * ⚠ 판정 축이 4키인 것은 **확정이 아니라 채택한 기본값**이다(승인 기록 Q2).
     *
     * **건수와 「지금 쪽에 없을 수 있다」를 함께 말한다.** 조준 조회는 쪽을 넘어 보므로
     * 막은 상대가 지금 보는 목록 쪽에 없을 수 있다 — 그 사실을 밝히지 않으면 사용자가
     * 화면에서 찾을 수 없는 규칙 때문에 막힌 채로 남는다.
     */
    duplicateActive: (count: number): string =>
      `같은 품목·창고·위치·우선순위의 사용 중인 규칙이 이미 ${String(count)}건 있습니다. 지금 보는 쪽에 없을 수 있습니다.`,
    saveLockedByOtherSave: '저장은 앞선 저장이 끝난 뒤에 할 수 있습니다.',
    createLockedByOtherSave: '등록은 앞선 저장이 끝난 뒤에 할 수 있습니다.',
    cancelLockedByOtherSave: '취소는 저장이 끝난 뒤에 할 수 있습니다.',
    /**
     * 머리글의 「규칙 추가」가 막힌 두 사유. **버튼 이름으로 시작한다**(배치 규범 4) —
     * 폼 안의 「등록」과 컨트롤이 다르므로 `createLockedByOtherSave`를 돌려 쓰지 않는다.
     * 사유가 이름과 어긋나면 사용자가 어느 버튼 이야기인지 되짚어야 한다.
     */
    addNeedsWarehouse: '규칙 추가는 창고를 고른 뒤에 쓸 수 있습니다.',
    addLockedByOtherSave: '규칙 추가는 보내는 중인 요청이 끝난 뒤에 쓸 수 있습니다.',
    /**
     * 전환을 아직 낼 수 없다 — **잠금 토큰이 상세 응답에서만 온다**(위험 R2).
     *
     * 목록 응답에는 토큰이 없어 행에서 곧바로 끄거나 켤 수 없다. 사유를 밝히지 않으면 잠깐
     * 잠긴 버튼이 고장으로 읽힌다.
     */
    activationNeedsDetail: '사용 전환은 규칙을 불러온 뒤에 쓸 수 있습니다.',
    activationLockedByOtherSave: '사용 전환은 보내는 중인 요청이 끝난 뒤에 쓸 수 있습니다.',
    /**
     * 켜기가 활성 중복으로 막혔다 — 계약이 400으로 막는 조합이라 화면이 먼저 막는다.
     * ⚠ 판정 축이 4키인 것은 **확정이 아니라 채택한 기본값**이다(승인 기록 Q2).
     *
     * **건수와 「지금 쪽에 없을 수 있다」를 함께 말한다** — 조준 조회는 쪽을 넘어 보므로
     * 막은 상대가 지금 보는 목록 쪽에 없을 수 있다.
     */
    activateDuplicate: (count: number): string =>
      `같은 품목·창고·위치·우선순위의 사용 중인 규칙이 이미 ${String(count)}건 있습니다. 지금 보는 쪽에 없을 수 있습니다.`,
  },
  /**
   * 품목 찾기 창. **창 안에 펼침 선택칸을 두지 않는다** — 창 본문이 펼침 목록을 잘라
   * 무엇을 고르는지 읽을 수 없다(`design-system-v2-webui#68`).
   */
  itemPicker: {
    title: '품목 찾기',
    keywordLabel: '품목코드·품목명',
    keywordPlaceholder: '찾을 품목을 입력하세요',
    /** 검색어가 비면 조회하지 않는다 — 빈 검색어로 받은 앞 N건은 고를 만한 후보가 아니다. */
    beforeSearch: '찾을 말을 입력하고 「찾기」를 누르세요.',
    noResult: '찾은 품목이 없습니다.',
    searchFailed: '품목을 찾지 못했습니다.',
    truncated: '앞쪽 일부만 보입니다. 찾는 품목이 없으면 조건을 좁혀 다시 찾으세요.',
  },
  dialog: {
    /** 되돌릴 수 없는 조작 앞에 한 걸음을 둔다 — 친 값이 확인 없이 사라지지 않게 한다. */
    discardTitle: '고치던 값을 버릴까요?',
    discardBody: '고친 값이 사라지고 저장된 값으로 돌아갑니다.',
    /**
     * 끄기 확인. **막지 않고 정확히 말한다** — 계약에 이 오퍼레이션의 400이 아예 없어
     * 화면의 경고가 유일한 방어다(공유계약 G-12 규칙 2).
     */
    deactivateTitle: '이 규칙을 사용 중지할까요?',
    /** 무엇을 끄는지. **내부 번호가 아니라 품목·위치 이름이다**(`omf-mes#44`). */
    deactivateTarget: (itemLabel: string, locationLabel: string): string =>
      `${itemLabel} · ${locationLabel} 규칙을 사용 중지합니다.`,
    /**
     * ⭐ **이것이 마지막 활성 규칙일 때만 서는 문장이다.**
     *
     * 「끄면 위치 검증 없이 통과합니다」를 갈래 없이 늘 세우면, 같은 품목에 다른 활성 규칙이
     * 남는 경우 화면이 **확인하지 않은 사실을 단언**하게 된다. 조준 조회가 이 창고·품목의
     * 사용 중인 규칙을 이미 실어 오므로 세 갈래로 갈라 말할 수 있다.
     */
    deactivateLastRule:
      '이 창고에서 이 품목의 사용 중인 규칙이 이것뿐입니다. 끄면 현장에서 위치 검증 없이 통과합니다.',
    /** 남는 규칙이 있다 — 이 갈래에서 「위치 검증 없이 통과」는 참이 아니다. */
    deactivateRemaining: (count: number): string =>
      `이 창고에서 이 품목의 사용 중인 규칙이 ${String(count)}건 더 남습니다. 끈 뒤에도 그 규칙들이 적용됩니다.`,
    /** 확인하지 못했다 — 「마지막이다」로도 「남는다」로도 단언하지 않고 조건부로 말한다. */
    deactivateCoverageUnknown:
      '이 품목에 사용 중인 규칙이 더 있는지 확인하지 못했습니다. 이것이 마지막이면 현장에서 위치 검증 없이 통과합니다.',
    /**
     * 되돌릴 수 있다는 사실이 이 결정의 무게를 정한다 — 물리 삭제와 갈리는 자리다.
     *
     * ⛔ **무조건으로 약속하지 않는다.** 켜기는 같은 (품목·창고·위치·우선순위)로 다른 활성
     * 규칙이 서면 **화면이 막고 계약도 400**이다 — 이 화면이 스스로 구현한 갈래다. 「언제든」
     * 같은 무조건 부사는 그 갈래와 어긋날 뿐 아니라 **끄기 결정의 무게를 낮추는 쪽**으로
     * 작용한다(되돌릴 수 있으니 일단 끄자).
     */
    deactivateReversible:
      '끈 규칙은 목록에 남고 다시 사용할 수 있습니다 — 다만 그사이 같은 조합의 규칙이 사용 중이 되면 막힙니다.',
    activateTitle: '이 규칙을 다시 사용할까요?',
    activateTarget: (itemLabel: string, locationLabel: string): string =>
      `${itemLabel} · ${locationLabel} 규칙을 다시 사용합니다.`,
    /**
     * 무엇이 다시 적용되는가. **「이 위치로만 간다」고 말하지 않는다** — 같은 품목에 우선순위가
     * 다른 규칙이 여럿 설 수 있고 어느 것이 이기는지는 이 창이 아는 사실이 아니다.
     */
    activateApplies: '현장의 적치 검증에서 이 규칙이 다시 쓰입니다.',
  },
  /**
   * 전환이 끝났음을 알리는 문면.
   *
   * ⛔ **「저장했습니다」를 쓰지 않는다.** 전환은 **폼을 저장하지 않는다** — 사용 여부만
   * 뒤집는다. 그런데 이 화면은 **초안이 더러운 채로도 전환할 수 있어**(전환 손잡이에 「고친
   * 것이 있는가」 문이 없다 — 의도된 설계) 저장 축의 문면을 그대로 쓰면 사용자가 **고치던 값이
   * 저장된 것으로 읽는다.** 같은 회차가 잠금 사유와 응답 없음 안내를 축마다 나눈 것과 같은
   * 잣대다 — 한 문장으로 합치면 어느 쪽에서든 반쯤 틀린다.
   *
   * ⚠ 전례(`approvalRoute`)는 아직 저장 축 문면을 쓴다. **이 회차의 범위 밖이라 건드리지
   * 않았고**, 같은 자리라는 사실만 인계에 남긴다.
   */
  toast: {
    deactivated: '사용을 중지했습니다',
    activated: '다시 사용으로 바꿨습니다',
  },
  /**
   * 규칙 없는 품목 — **이 화면이 목록만큼 중요하게 다뤄야 하는 자리다.**
   * 규칙이 없으면 현장이 위치 검증 없이 통과하는데, 등록된 것만 보이면 그 사실이 어디에도
   * 드러나지 않는다(공유계약 G-12).
   */
  uncovered: {
    /** 0건은 **좋은 상태**다. 경고 어휘를 쓰지 않는다. */
    noneTitle: '이 창고에는 규칙 없는 품목이 없습니다',
    noneDescription: '입고 이력이 있는 품목마다 적치 규칙이 있습니다.',
    countTitle: (count: number): string => `이 창고에 규칙 없는 품목 ${String(count)}건`,
    countDescription: '규칙이 없는 품목은 현장에서 위치 검증 없이 통과합니다.',
    truncated: '앞쪽 일부만 보입니다. 나머지는 다음 쪽에 있습니다.',
    /** 펼쳤는데 목록이 비었다. 건수와 어긋나는 상태이므로 감추지 않고 그대로 말한다. */
    emptyListTitle: '펼칠 목록이 없습니다',
    emptyListDescription: '건수와 목록이 어긋나면 담당자에게 알려 주세요.',
  },
} as const;

/**
 * W-01-13 물류 문서 진행현황·취소.
 *
 * 이 묶음의 문구는 **목록과 고른 문서의 상세까지**다(작업 단위 ①·②) — 취소 요청·승인 진행·
 * 취소 실행의 문구는 그 조작이 실제로 생기는 회차에서 이 묶음에 더한다. 미리 적어 두면 아무
 * 화면도 내지 않는 문장이 남고, 그 문장은 고쳐도 아무도 모른다.
 *
 * **취소 불가 사유는 계약이 열거한 네 값만 문면을 갖는다.** 그 밖의 코드는 문구를 지어내지 않고
 * 코드 문자열을 그대로 낸다 — 화면이 뜻을 붙이면 값이 늘 때 조용히 틀린다(공유계약 G-2).
 */
const documentProgress = {
  title: '물류 문서 진행현황·취소',
  breadcrumbRoot: '자재창고',
  /** 구획 이름. 목록 구획은 화면 이름을 그대로 쓴다 — 이 화면의 본체가 목록이다. */
  panes: {
    detail: '고른 문서',
  },
  /** 조건 줄의 칸 이름. 순서가 곧 화면의 배치 순서다. */
  fields: {
    documentType: '문서 유형',
    status: '상태',
    period: '문서 일자',
    item: '품목 번호',
    lot: '자재 LOT 번호',
    warehouse: '창고 번호',
    cancellableOnly: '지금 취소 가능한 것만',
    q: '문서번호',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    select: '선택',
    deselect: '선택 해제',
    /**
     * 행 손잡이의 접근 이름. **문서번호를 넣는다** — 「선택」이 행마다 되풀이되면 어느 문서를
     * 여는지 보조기술로 알 수 없다. ⛔ **내부 번호는 넣지 않는다**(omf-mes#44): 눈으로 읽는
     * 값과 보조기술이 읽는 값이 어긋나면 안 되고, 내부 번호는 사용자에게 아무 뜻이 없다.
     */
    selectRow: (documentNo: string): string => `${documentNo} 고르기`,
    deselectRow: (documentNo: string): string => `${documentNo} 선택 해제`,
    openDocument: '문서 열기',
    openSuccessor: (successorNo: string): string => `${successorNo} 열기`,
  },
  filters: {
    all: '전체',
    /**
     * 번호로 좁히는 칸이 셋인 이유를 밝힌다. 이 화면에는 품목·LOT·창고를 이름으로 고르는
     * 참조 조회가 없다 — 이름 목록을 얹으면 그 조회의 좁힘·잘림 규칙이 함께 따라온다.
     */
    idNote: '품목·자재 LOT·창고는 번호로 좁힙니다. 번호가 아닌 값은 조건에서 빠집니다.',
    /**
     * 기본 기간을 심지 않는다는 사실을 화면이 밝힌다 — **비어 있는 칸이 고장으로 읽히지 않게**
     * 한다. 심으면 사용자가 확인하지 않은 기간으로 첫 요청이 나가고, 왜 그 기간만 보이는지
     * 화면 어디에서도 읽을 수 없다.
     */
    periodNote: '문서 일자를 고르지 않으면 기간을 좁히지 않고 조회합니다.',
    /** 외주 문서처럼 고를 수 없는 유형이 있을 때. 사유를 감추지 않는다. */
    disabledTypes: (reasons: string): string => `고를 수 없는 유형이 있습니다. ${reasons}`,
  },
  loading: {
    list: '문서 진행현황을 불러오는 중',
    detail: '고른 문서의 상세를 불러오는 중',
  },
  /**
   * 목록 표의 머리글. 열 구성의 근거는 screens/document-progress/progress-table.tsx에 있다.
   *
   * **후속 건수가 열로 있는 것이 이 표의 요점이다** — 상세를 열어야 취소 가능 여부를 알면
   * 실무자가 목록에서 대상을 고르지 못한다.
   *
   * ⛔ **「유형」 머리글이 없다.** 계약이 문서 유형을 목록 조회의 필수 질의값으로 두어 한 응답의
   * 모든 행이 같은 유형이라, 그 열을 두지 않았다 — 쓰지 않는 문구를 남겨 두면 다음 사람이
   * 그 열이 있는 줄 안다. 열을 되살리면 이 자리에 머리글을 다시 넣는다.
   */
  table: {
    documentNo: '문서번호',
    documentDate: '문서일자',
    subType: '세부구분',
    status: '상태',
    plannedQty: '계획 수량',
    processedQty: '처리 수량',
    remainingQty: '잔여 수량',
    successorCount: '후속',
    cancelAvailability: '취소 가능',
    /** 행을 고르는 열. 고른 문서의 상세가 목록 **아래**에 선다(드로어·창이 아니다). */
    select: '선택',
  },
  /** 취소 가능 열의 두 모양. **색만으로 말하지 않는다** — 글자로 낸다. */
  cancel: {
    available: '취소 요청 가능',
    blocked: '취소 불가',
  },
  /**
   * 계약이 설명문에 열거한 취소 불가 사유 네 값.
   *
   * **여기 없는 코드는 문구를 만들지 않는다.** 읽는 자리가 코드 문자열을 그대로 내고,
   * 그것이 「모르는 값을 아는 척하지 않는다」의 화면 쪽 표현이다.
   */
  blockReasons: {
    SUCCESSOR_EXISTS: '후속 문서가 있습니다',
    ALREADY_CANCELLED: '이미 취소된 문서입니다',
    CANCEL_IN_PROGRESS: '취소 요청이 진행 중입니다',
    STATE_LOCKED: '지금 상태에서는 취소할 수 없습니다',
  },
  /**
   * 고른 문서의 상세 — **목록 아래 구획**의 문구다.
   *
   * ⭐ **요약은 상세 응답의 값이다**(계약 `DocumentProgressDetail.progress`). 목록 행을 그대로
   * 다시 그리면 목록을 조회한 시점과 상세를 조회한 시점이 갈려, 같은 화면의 위아래가 서로
   * 다른 수량을 말할 수 있다.
   */
  detail: {
    /** 요약 묶음의 접근 이름. 어느 문서의 요약인지 **문서번호**로 말한다(내부 번호가 아니다). */
    summary: (documentNo: string): string => `${documentNo} 요약`,
    documentType: '문서 유형',
    documentNo: '문서번호',
    documentDate: '문서일자',
    subType: '세부구분',
    status: '상태',
    plannedQty: '계획 수량',
    processedQty: '처리 수량',
    remainingQty: '잔여 수량',
    /** 위아래가 다른 값을 말할 수 있다는 사실을 밝힌다 — 감추면 사용자가 화면을 의심한다. */
    summaryNote: '요약은 이 문서의 상세 조회 결과입니다. 위 목록과 조회 시점이 다를 수 있습니다.',
    /**
     * 문서를 열 수 없는 **두 갈래**. **열기 손잡이를 만들지 않고** 왜 없는지만 밝힌다 —
     * 그럴듯한 주소를 지어 넣으면 사용자가 「열었더니 그 문서가 아닌」 자리에 도착한다.
     *
     * ⭐ **둘을 한 문면으로 뭉개지 않는다 — 풀 수 있는 사람이 다르기 때문이다.**
     * 앞은 서버가 값을 채워야 하고, 뒤는 이 프로그램에 그 화면이 생기면 풀린다. 「열 수 없습니다」
     * 하나만 내면 담당자에게 물어야 할 사람과 기다려야 할 사람이 구분되지 않는다.
     */
    openBlocked: {
      noScreenId: '이 문서를 어느 화면에서 여는지 아직 오지 않아 여기서 열 수 없습니다.',
      unmapped: '이 문서를 여는 화면이 아직 이 프로그램에 없어 여기서 열 수 없습니다.',
    },
  },
  /**
   * 처리 경과 — **서버가 준 차례 그대로** 그린다. 화면이 다시 정렬하지 않는다(계약이 시간순으로
   * 내린다고 적었고, 화면이 다시 세우면 같은 시각의 두 단계 차례가 서버와 갈린다).
   */
  steps: {
    caption: '처리 경과',
    stepCode: '단계',
    occurredAt: '시각',
    actor: '처리자',
    ledger: '원장',
    /**
     * 행위자 이름이 비어 온 단계. 계약이 「사람이 한 것이 아니면 비어 있다」라고 적었으므로
     * **그 사실을 그대로** 옮긴다. ⛔ 내부 번호를 대신 내지 않는다(omf-mes#44).
     */
    systemActor: '사람이 하지 않은 단계',
    emptyTitle: '처리 경과가 없습니다',
    emptyDescription: '이 문서에 기록된 처리 경과가 아직 없습니다.',
    /** 원장 진입을 만들지 않는 사실을 밝힌다 — 번호와 영업일을 **함께** 보이는 이유이기도 하다. */
    ledgerNote:
      '원장 번호는 조회에 필요한 영업일과 함께 보입니다. 원장 조회 화면이 아직 없어 여기서 열 수는 없습니다.',
  },
  /**
   * 원장 참조 — **번호와 영업일이 둘 다 있을 때만 짝으로** 낸다.
   *
   * 계약이 둘 다 선택으로 두었고 원장 조회는 **영업일이 키의 일부**다. 번호만 보이면 사용자가
   * 그 번호로 원장을 찾을 수 없는데 찾을 수 있는 것처럼 보인다 — 한쪽만 왔으면 그 사실을 적는다.
   */
  ledger: {
    pair: (transactionNo: string, businessDate: string): string =>
      `${transactionNo} · 영업일 ${businessDate}`,
    noBusinessDate: (transactionNo: string): string =>
      `${transactionNo} · 영업일을 받지 못해 원장을 찾을 수 없습니다`,
    noTransactionNo: (businessDate: string): string =>
      `영업일 ${businessDate} · 원장 번호를 받지 못했습니다`,
  },
  /**
   * 후속 문서 — **0건이 정상이다.** 후속이 없어야 이 문서를 취소할 수 있으므로 0건은 오히려
   * 좋은 소식이다. ⛔ 그래서 경고 톤을 쓰지 않는다.
   */
  successors: {
    caption: '후속 문서',
    typeCode: '유형',
    documentNo: '문서번호',
    qty: '수량',
    open: '열기',
    emptyTitle: '후속 문서가 없습니다',
    emptyDescription: '이 문서를 원천으로 삼는 하류 문서가 아직 없습니다.',
    /**
     * 후속을 열 수 없는 **두 갈래**. 위 `detail.openBlocked`와 같은 이유로 가르고, 주어만 다르다 —
     * 표 아래에 **갈래마다 한 줄씩** 서므로 어느 후속이 왜 막혔는지 사용자가 읽을 수 있다.
     */
    openBlocked: {
      noScreenId: '어느 화면에서 여는지 오지 않은 후속 문서가 있어 그 줄은 열 수 없습니다.',
      unmapped: '여는 화면이 아직 이 프로그램에 없는 후속 문서가 있어 그 줄은 열 수 없습니다.',
    },
  },
  empty: {
    /**
     * 문서 유형 값 목록이 확정되지 않아 조회를 시작할 수 없는 상태.
     * **고장으로 읽히지 않게** 왜 비어 있는지와 무엇이 정해지면 살아나는지를 함께 말한다.
     */
    typesPendingTitle: '문서 유형 선택지가 준비 중입니다',
    typesPendingDescription:
      '문서 유형 목록이 확정되면 이 화면에서 진행현황을 조회할 수 있습니다. 지금은 조회할 수 없습니다.',
    noDocumentTypeTitle: '문서 유형을 고르고 조회하세요',
    noDocumentTypeDescription: '진행현황은 문서 유형을 정해야 조회할 수 있습니다.',
    noResultTitle: '조건에 맞는 문서가 없습니다',
    noResultDescription: '기간을 넓히거나 조건을 줄인 뒤 다시 조회하세요.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
    noSelectionTitle: '문서를 고르면 아래에 상세가 보입니다',
    noSelectionDescription: '목록에서 문서를 고르면 처리 경과와 후속 목록이 이 자리에 섭니다.',
    /**
     * 고른 문서가 404였다. 주소에서 선택을 지운 뒤 **그 사실을 말한다** — 조용히 지우면
     * 사용자는 자기가 누른 것이 왜 열리지 않는지 알 수 없다.
     */
    detailNotFoundTitle: '고른 문서를 찾을 수 없습니다',
    detailNotFoundDescription:
      '이미 지워졌거나 다른 조건으로 옮겨 갔을 수 있습니다. 다시 조회한 뒤 골라 주세요.',
  },
  /**
   * 조회 실패 문면.
   *
   * **덮지 않는 문서 유형(400)을 따로 가른다.** 계약이 그 갈래를 응답으로 따로 적었고,
   * 「불러오지 못했습니다」로 뭉개면 사용자가 다시 시도를 되풀이한다 — 몇 번을 눌러도 같은 답이
   * 온다. 이 화면이 덮는 것은 여섯 유형이며 그 밖은 다른 도메인이 다룬다.
   */
  errors: {
    unsupportedTitle: '이 화면이 덮지 않는 문서 유형입니다',
    unsupportedDescription:
      '고른 문서 유형은 이 화면에서 볼 수 없습니다. 다른 유형을 고르거나 담당자에게 문의하세요.',
  },
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
    /** 취소가 막혔는데 사유 코드가 오지 않았다. 사유를 지어내지 않고 그 사실을 적는다. */
    noBlockReason: '사유를 받지 못했습니다',
  },
} as const;

/**
 * W-CO-03 알림센터.
 *
 * **이 블록의 문구가 지켜야 할 것은 둘이다.**
 *
 * 1. **알림 문장을 화면이 짓지 않는다.** 카드 본문은 서버가 준 `message`를 그대로 그린다 —
 *    이 블록에 알림 내용을 조립하는 문구가 있으면 같은 사실을 두 곳에서 말하게 된다.
 *    ⚠ 그 문장은 **발송 시점의 언어**로 저장돼 있다(다국어 처리는 아직 정해지지 않았다).
 *    화면에 그 사실을 알리는 상시 안내를 두지 않는다 — 늘 참인데 사용자가 할 조치가 없다.
 * 2. **기간은 풀 수 없는 조건이다.** 계약이 필수로 두어 「기간 없이 보기」가 성립하지 않는다.
 *    그래서 사유 문구가 「기간을 지우세요」로 읽히면 안 되고, **고쳐서 다시 고르는** 길만 말한다.
 */
const notificationCenter = {
  title: '알림센터',
  breadcrumbRoot: '알림',
  panes: {
    list: '알림 목록',
  },
  loading: {
    list: '알림을 불러오는 중',
  },
  fields: {
    /** 기간은 **한 컨트롤**이다(`DatePicker mode="range"`) — 라벨도 하나다. */
    period: '조회 기간',
    /**
     * 「안 읽음만」은 **켜진 채로 시작한다**(화면 스펙 §4의 배치).
     *
     * ⚠ **「전체」라는 말이 화면에 나타나지 않는다.** 컨트롤이 체크상자라 끈 상태를 부르는
     * 이름이 없다 — 스펙 §4 도식은 이 조건을 선택칸으로 읽히게 그렸고, 그쪽이라면 두 상태가
     * 각각 이름을 갖는다. 어느 쪽이 정본인지는 질문 `omf-mes#165`로 설계에 올려 두었다.
     * **여기서 논증으로 정하지 않는다** — 답이 오면 컨트롤과 이 문구를 함께 고친다.
     */
    unreadOnly: '안 읽음만',
    eventCode: '알림 유형',
  },
  filters: {
    all: '전체',
    /**
     * 유형 목록을 못 받았을 때. **목록 조회는 계속된다** — 유형으로 좁히지 못할 뿐이고,
     * 카드 제목은 원본 코드로 낙하한다. 그래서 화면 전체를 오류로 두지 않고 이 칸만 밝힌다.
     */
    eventsFailed: '알림 유형 목록을 불러오지 못했습니다. 유형으로 좁힐 수 없습니다.',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
  },
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  /**
   * 기준 시각(공유계약 L-5). 이 화면은 저 혼자 갱신되지 않으므로(L-6) 지금 보이는 목록이
   * 언제의 것인지 밝히지 않으면 사용자가 실시간으로 읽는다.
   */
  asOf: (at: string): string => `기준 ${at}`,
  /**
   * 조회를 멈춘 사유. 화면이 기본값을 채우는 것은 **주소에 기간 키가 아예 없을 때뿐**이므로,
   * 여기 있는 셋은 전부 **사용자가 기간에 손을 댄 뒤**의 사태다.
   *
   * ⭐ **셋을 한 문구로 합치지 않는다**(공유계약 G-9 — 「없는 값」과 「틀린 값」을 같은 모양으로
   * 두지 않는다). 사용자가 할 조치가 갈래마다 다르다 — 비운 쪽을 채우는 것 · 날짜를 다시 고르는
   * 것 · 순서를 바꾸는 것.
   */
  reasons: {
    /**
     * 한쪽이든 양쪽이든 **비어 있다.**
     *
     * ⛔ 「올바른 날짜가 아닙니다」로 말하지 않는다 — 한쪽만 비운 사람이 넣은 날짜는 멀쩡한데
     * 그것까지 다시 고르라는 말이 된다. **비어 있는 쪽만** 가리킨다.
     * 형제 화면들의 `searchNeedsPeriod`와 같은 사태이나 문형이 다르다 — 그쪽은 「조회」 버튼의
     * 비활성 사유라 컨트롤 이름으로 시작하고, 이 화면에는 그 버튼이 없다.
     */
    periodIncomplete: '기간은 시작일과 종료일이 모두 있어야 합니다. 비어 있는 쪽을 고르세요.',
    /** 넣긴 넣었는데 날짜가 아니다 — 없는 날짜(`2026-02-31`)와 형식이 깨진 값. */
    periodInvalid: '기간이 올바른 날짜가 아닙니다. 시작일과 종료일을 다시 고르세요.',
    periodReversed: '기간 종료는 기간 시작보다 앞설 수 없습니다.',
  },
  empty: {
    blockedTitle: '이 기간으로는 조회할 수 없습니다',
    noneTitle: '받은 알림이 없습니다',
    /**
     * 조건이 셋으로 늘어 「기간을 넓혀라」만으로는 부족하다 — 「안 읽음만」이 켜져 있으면
     * 이미 읽은 알림이 있어도 0건이 된다. 사용자가 풀 수 있는 조건을 전부 짚는다.
     */
    noneDescription: '기간을 넓히거나 「안 읽음만」·유형 조건을 풀고 다시 찾아보세요.',
    /** 결과는 있는데 이 쪽에는 없다 — **0건과 갈라야** 사용자가 조건을 헛되이 넓히지 않는다. */
    beyondLastTitle: '이 쪽에는 알림이 없습니다',
    beyondLastDescription: '앞쪽에 결과가 있습니다. 첫 쪽으로 이동하세요.',
  },
  card: {
    read: '읽음',
    unread: '안 읽음',
    /**
     * 본문이 빈 알림. **빈 자리를 그리지 않는다** — 카드가 제목만 남으면 사용자는 화면이
     * 덜 그려진 것으로 읽는다. 「무엇이 왔는지 모른다」는 사실 자체를 말한다.
     */
    emptyMessage: '내용이 없는 알림입니다.',
  },
} as const;

export const ko = {
  common,
  conflict,
  stateLocked,
  httpError,
  save,
  editability,
  pendingCode,
  warehouseLocation,
  routing,
  defectCauseCode,
  integrationSync,
  inspectionStandard,
  commonCode,
  itemExtendedAttrs,
  masterChange,
  judgmentCode,
  usersRoles,
  inboundSchedule,
  stockStatus,
  overReceiptSplit,
  goodsReceipt,
  stocktaking,
  supplierReturn,
  disposalIssue,
  approvalRoute,
  approvalInbox,
  iqcSkipApproval,
  poRegister,
  login,
  stockAdjust,
  passwordChange,
  putawayRule,
  documentProgress,
  notificationCenter,
} as const;

export type Messages = typeof ko;
