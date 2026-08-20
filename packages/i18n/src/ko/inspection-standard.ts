/**
 * W-06-02 검사기준 등록. 버전 마스터 형 화면의 두 번째 벌이라 문구 구조는 `routing`과 같다.
 *
 * **샘플 크기의 라벨과 검증 문구는 단위 `%`를 담는다.** 받는 값이 비율이라 단위를 적지 않으면
 * 30을 30개로 읽는다. 「수량」·「개수」로 되돌리지 않는다 — 수량은 검사 시점에 로트 크기로
 * 환산되는 파생값이고 이 화면이 정하는 것이 아니다(#201).
 */
export const inspectionStandard = {
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
