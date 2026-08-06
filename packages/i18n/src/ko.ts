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
    /*
     * 아래 셋은 아직 붙지 않은 액션의 사유다 — 감추는 대신 사유와 함께 비활성으로 남긴다.
     * 그 액션을 붙이는 작업에서 이 키를 지우고 실제 활성 조건 문구로 바꾼다.
     */
    confirmNotReady: '확정은 아직 실행할 수 없습니다. 기능이 준비되면 이 버튼을 쓸 수 있습니다.',
    obsoleteNotReady: '폐기는 아직 실행할 수 없습니다. 기능이 준비되면 이 버튼을 쓸 수 있습니다.',
    newRevisionNotReady:
      '신규 Rev 발행은 아직 실행할 수 없습니다. 기능이 준비되면 이 버튼을 쓸 수 있습니다.',
    addOperationNotReady:
      '공정 추가는 아직 할 수 없습니다. 편집 기능이 준비되면 이 버튼을 쓸 수 있습니다.',
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
} as const;

export type Messages = typeof ko;
