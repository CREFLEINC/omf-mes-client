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
    plantFixedAfterCreate: '등록 후에는 공장을 바꿀 수 없습니다. 다른 공장이면 창고를 새로 등록하세요.',
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
    obsoleteDescription:
      '삭제하지 않습니다. 폐기하면 새 작업에서 이 Rev를 쓸 수 없게 됩니다.',
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
 * **「비율」·「%」를 샘플 수량의 라벨·검증 문구에 쓰지 않는다.** 저장되는 값은 개수이고,
 * 라벨을 「비율」로 쓰면 30을 넣은 사람이 30%로 오해한다. 다만 그 오해를 막는
 * 보조 안내 한 줄(`fieldNotes.samplingQty`)만은 두 낱말을 함께 적어야 뜻이 선다.
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
    excelUpload: '엑셀 올리기',
    addPlan: '기준 추가',
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
  },
  optionsTruncated: '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
  optionsLoadFailed: '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
  empty: {
    planNoneTitle: '등록된 검사기준이 없습니다',
    planNoneDescription: '「기준 추가」로 첫 검사기준을 등록하세요.',
    planNoMatchTitle: '조건에 맞는 검사기준이 없습니다',
    planNoMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
    planNotSelected: '좌측에서 검사기준을 먼저 고르세요',
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
  },
  validation: {
    required: '필수 입력 항목입니다.',
    planCodeBlank: '기준코드는 공백만으로 지정할 수 없습니다.',
    planNameBlank: '기준명은 공백만으로 지정할 수 없습니다.',
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
} as const;

export type Messages = typeof ko;
