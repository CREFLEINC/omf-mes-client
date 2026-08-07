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
     * **단위를 라벨에 박는다.** 저장되는 값은 개수인데 라벨이 그것을 말하지 않으면
     * 30을 넣은 사람이 30%로 오해한다(착수 이슈 #12 §6).
     */
    samplingQty: '샘플 수량(개)',
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
    /*
     * 라벨의 단위 표기만으로는 오해가 남는다 — 착수 이슈 #12 §4·§6이 밝혔듯
     * 확정 스펙은 비율 입력인데 저장 자리는 수량이라, 두 표현이 엇갈린 채로 남아 있다.
     * 두 낱말을 함께 적어 무엇이 아닌지까지 밝히는 **유일한 자리**다.
     * 라벨·검증 문구에는 두 낱말을 쓰지 않는다.
     */
    samplingQty: '비율(%)이 아니라 검사할 개수입니다.',
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
    /* 계약 minimum: 0. 「개수」라고만 적는다 — 라벨과 같은 말이어야 무엇을 고칠지 알 수 있다. */
    samplingQtyInvalid: '샘플 수량은 0 이상의 개수여야 합니다.',
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
  },
  panes: {
    codeGroup: '코드그룹',
    codeGroupForm: '코드그룹 정보',
    department: '부서',
    departmentForm: '부서 정보',
    worker: '작업자',
    workerDetail: '작업자 기본 정보',
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
    periodFrom: '기간 시작',
    periodTo: '기간 종료',
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
  /** 탭 라벨. **만든 탭만 둔다.** 역할·권한 탭은 그 탭의 목록·폼이 생길 때 붙는다. */
  tabs: {
    label: '사용자·역할·권한',
    users: '사용자',
  },
  panes: {
    userList: '사용자',
    userForm: '사용자 정보',
    roleAssign: '역할 부여',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    addUser: '사용자 추가',
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
    /* 주 액션의 이름이 모드마다 달라 사유도 갈린다 — 규범 4는 컨트롤 이름으로 시작하라고 정한다. */
    saveNoChanges: '저장은 고친 내용이 있을 때 누를 수 있습니다.',
    addNoInput: '사용자 추가는 입력한 내용이 있을 때 누를 수 있습니다.',
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
    deactivateDescription:
      '사용 중지하면 이 사용자는 시스템을 쓸 수 없게 되고 이미 쌓인 자료는 그대로 남습니다. 되돌리는 경로가 없습니다.',
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
  },
  loading: {
    users: '사용자 목록을 불러오는 중',
    userDetail: '사용자 정보를 불러오는 중',
    roleAssign: '역할 부여분을 불러오는 중',
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
} as const;

export type Messages = typeof ko;
