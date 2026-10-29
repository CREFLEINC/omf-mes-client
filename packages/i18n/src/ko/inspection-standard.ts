/**
 * W-06-02 검사기준 등록. 버전 마스터 형 화면의 두 번째 벌이라 문구 구조는 `routing`과 같다.
 *
 * **샘플 크기의 라벨과 검증 문구는 단위 `%`를 담는다.** 받는 값이 비율이라 단위를 적지 않으면
 * 30을 30개로 읽는다. 「수량」·「개수」로 되돌리지 않는다 — 수량은 검사 시점에 로트 크기로
 * 환산되는 파생값이고 이 화면이 정하는 것이 아니다(#201).
 */
export const inspectionStandard = {
  title: '검사기준 등록',
  breadcrumbRoot: '품질 관리',
  panes: {
    plan: '검사기준',
    version: '버전 목록',
    planForm: '기준 정보',
    versionForm: '버전 정보',
    items: '검사 항목',
  },
  actions: {
    /* 기본 정보 폼의 품목 칸 지우기 — 비우면 전 품목 공통 기준이다(#196). */
    itemClear: '품목 지우기',
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    excelUpload: '엑셀 올리기',
    addPlan: '기준 추가',
    createVersion: '버전 등록',
    newRevision: '신규 버전 발행',
    confirm: '확정',
    obsolete: '폐기',
    discard: '작성 취소',
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
    /*
     * 계약의 라우팅 조회가 품목을 필수 쿼리로 둔다 — 품목을 비운 「전 품목 공통 기준」에는
     * 고를 수 있는 라우팅 자체가 없다. 값을 고를 수 없는 칸을 활성으로 두면
     * 사용자가 무엇이 막혔는지 모르고, 감추면 「이 화면에는 없는 항목」으로 오해한다.
     */
    routingNeedsItem: '라우팅은 품목을 선택한 뒤에 선택할 수 있습니다. 먼저 품목을 선택하세요.',
    /*
     * 발행하면 새 버전이 선택돼 지금 버전을 떠난다 — 저장하지 않은 편집은 그때 사라진다.
     */
    newVersionBlockedByUnsaved:
      '신규 버전 발행은 저장하지 않은 변경이 있으면 할 수 없습니다. 먼저 저장하거나 취소하세요.',
    /* 작성중 판은 기준당 하나만 둔다 — 둘이면 어느 쪽을 확정할지 엇갈린다(사용자 지시 · #196). */
    /* 어느 버전이 작성 중인지 밝힌다(사용자 시안 · #208). 조사는 숫자 끝자리 읽기를 따른다(2 · 4 · 5 · 9 → 가). */
    newVersionBlockedByDraft: (planVersion: number): string =>
      `버전 ${String(planVersion)}${[2, 4, 5, 9].includes(planVersion % 10) ? '가' : '이'} 작성 중입니다. 확정하거나 작성을 취소해 주세요.`,
    confirmNeedsDraft: '확정은 작성중 버전에만 할 수 있습니다. 변경하려면 신규 버전을 발행하세요.',
    /* 계약이 항목 1건 이상을 요구한다(위반 시 400 LINE_REQUIRED) — 화면이 먼저 막고 사유를 밝힌다. */
    confirmNeedsItems: '확정은 검사 항목을 1건 이상 저장해야 할 수 있습니다.',
    /*
     * 확정하면 그 버전은 더 이상 수정할 수 없다 — 저장하지 않은 편집은 되돌릴 길 없이 사라진다.
     */
    confirmBlockedByUnsaved:
      '확정은 저장하지 않은 변경이 있으면 할 수 없습니다. 먼저 저장하거나 취소하세요.',
    obsoleteNeedsConfirmed: '폐기는 확정된 버전에만 할 수 있습니다. 먼저 확정하세요.',
    discardNeedsDraft: '작성 취소는 작성중 버전에만 할 수 있습니다. 확정된 버전은 폐기하세요.',
    /** 여러 컨트롤이 공유하는 안내라 무엇에 대한 안내인지로 시작한다. */
    transitionNeedsVersion: '확정·폐기는 버전을 먼저 등록해야 할 수 있습니다.',
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
    deactivateTitle: '이 검사기준을 사용 중지할까요?',
    deactivateDescription:
      '삭제하지 않습니다. 사용 중지하면 새 검사에서 이 기준을 쓸 수 없게 됩니다.',
    confirmTitle: '이 버전을 확정할까요?',
    confirmDescription:
      '확정하면 이 버전은 더 이상 수정할 수 없습니다. 변경하려면 신규 버전을 발행해야 합니다.',
    obsoleteTitle: '이 버전을 폐기할까요?',
    obsoleteDescription: '폐기한 버전은 새 검사에서 사용할 수 없습니다. 기존 데이터는 유지됩니다.',
    discardTitle: '이 작성중 버전을 취소할까요?',
    discardDescription:
      '이 버전과 검사 항목이 삭제되며 되돌릴 수 없습니다. 저장하지 않은 변경도 함께 사라집니다.',
    itemCreateTitle: '검사 항목 추가',
    itemEditTitle: '검사 항목 수정',
    /*
     * 순서 컬럼에 유일 제약이 있어 행 단위 저장이 성립하지 않는다 —
     * 이 창의 확인은 표에만 반영되고 서버 반영은 「저장」 한 번뿐이다. 그 사실을 감추지 않는다.
     */
    itemLocalNote: '확인 시 목록에 추가되며, 저장 후 최종 반영됩니다.',
    /* 칸마다 무엇을 넣을지 알린다(사용자 시안 · #196). */
    itemPlaceholders: {
      inspectionItemCode: '항목코드를 입력하세요',
      inspectionItemName: '항목명을 입력하세요',
      dataType: '검사값 유형을 선택하세요',
      uom: '검사 단위를 선택하세요',
      targetValue: '기준값을 입력하세요',
      lowerLimit: '하한값을 입력하세요',
      upperLimit: '상한값을 입력하세요',
      inspectionMethod: '검사 방법을 선택하세요',
      defaultInspectionEquipment: '검사 장비를 선택하세요',
    },
    /* 창의 확인칸 이름 — 표의 짧은 라벨(필수 · 자동판정)과 따로 둔다(사용자 지시 · #196). */
    requiredFlagLabel: '필수 검사 항목 여부',
    automaticJudgmentLabel: '자동 판정 사용 여부',
  },
  /** 되돌리기 어려운 상태 변경은 일반 저장과 구별해 방금 끝난 일을 그대로 말한다. */
  result: {
    deactivated: '검사기준 사용을 중지했습니다.',
    confirmed: '버전을 확정했습니다.',
    obsoleted: '버전을 폐기했습니다.',
    discarded: '작성중 버전을 취소했습니다.',
  },
  /** 엑셀 올리기 창(#199). 툴 엑셀 올리기와 같이 «올리기 전에» 되돌리지 않음을 말한다. */
  import: {
    title: '검사기준 엑셀 올리기',
    partialWarningTitle: '업로드 후 일괄 취소가 불가합니다.',
    partialWarning: '기준별로 작성중인 버전이 생성되며, 성공 항목만 저장됩니다.',
    guideHeaderRow: '첫 번째 시트의 첫 행을 제목으로 사용합니다.',
    guideRequiredColumns: '필수 열: 기준코드, 항목코드, 항목명',
    guideTckt: '기존 검사기준서(TCKT) 파일도 업로드할 수 있습니다.',
    fileLabel: '검사기준 엑셀 파일',
    fileHint: '.xlsx · 여러 파일 선택 가능',
    filePlaceholder: '파일 추가',
    fileRequired: '올릴 파일을 먼저 선택하세요.',
    fileCount: (count: number): string => `${String(count)}개 파일 선택됨`,
    removeFile: (name: string): string => `${name} 빼기`,
    progress: (done: number, total: number): string =>
      `${String(total)}개 중 ${String(done)}개를 처리했습니다. 창을 닫지 마세요.`,
    formatGuide: '엑셀 작성 형식 안내',
    submit: '올리기',
    resultTitle: '올리기 결과',
    succeeded: (count: number): string => `기준 ${String(count)}건을 반영했습니다.`,
    noneSucceeded: '반영된 기준이 없습니다.',
    failed: (count: number): string => `기준 ${String(count)}건이 실패했습니다.`,
    allSucceeded: '실패한 기준이 없습니다.',
    fields: {
      key: '기준코드',
      reason: '사유',
    },
    keyUnknown: '기준코드 없음',
  },
  filters: {
    searchLabel: '검사 기준 검색',
    searchPlaceholder: '기준 코드 또는 기준명을 입력하세요',
    searchClear: '검사 기준 검색 지우기',
    inspectionType: '검사 유형 선택',
    typeAll: '전체 유형',
    chipKeyword: (value: string): string => `검색어: ${value}`,
    chipInspectionType: (label: string): string => `검사 유형: ${label}`,
    chipRemoveKeyword: '검색어 조건 제거',
    chipRemoveInspectionType: '검사 유형 조건 제거',
    unapprovedOnly: '미승인',
    chipRemoveUnapproved: '미승인 조건 제거',
    usageLabel: '사용 여부',
    usageAll: '전체',
    usageActive: '사용',
    usageInactive: '미사용',
    usageCount: (label: string, count: number): string => `${label} ${String(count)}`,
    /* 품목 조건 — 검사 조회·판정의 품목 검색과 같은 모양(#196). */
    item: '품목 검색',
    itemPlaceholder: '품목을 입력하세요',
    itemClear: '품목 조건 지우기',
    itemPick: '선택',
    chipItem: (label: string): string => `품목: ${label}`,
    chipRemoveItem: '품목 조건 제거',
  },
  /*
   * 상세 칸 맨 위의 버전 고르기 줄 — 선택칸으로 바로 고르고, 「버전 목록」 창에서 표로 고르거나
   * 신규 버전을 발행한다(omf-all-around#196).
   */
  /* 기준 정보 구획 머리(omf-all-around#196) — 제목과 승인 · 사용 상태 칩. */
  detail: {
    title: '검사 기준 상세',
    createTitle: '검사 기준 등록',
    chipNotApproved: '미승인',
    chipActive: '사용',
    chipInactive: '미사용',
    editBasic: '기본 정보 수정',
    itemUnset: '품목 미지정',
    pqcSkipOn: '허용',
    close: '닫기',
  },
  /* 상세 카드의 버전 구획(omf-all-around#196) — 버전 고르기 · 요약 · 탭(검사 항목 / 버전 설정 / 이력). */
  versionSection: {
    /* 샘플을 비율 · 개수 중 무엇으로 받을지 고르는 칩(#196). */
    samplingByRatio: '비율(%)',
    samplingByQty: '수량',
    samplingBasis: '샘플 기준 선택',
    samplingBasisLocked:
      '전수검사는 샘플을 입력하지 않습니다. 검사 방식을 샘플링으로 바꾸면 고를 수 있습니다.',
    /* 요약 줄의 샘플 개수 표기(#201 · #196). */
    samplingQtyValue: (qty: string): string => `${qty}개`,
    title: '검사 기준 버전',
    sampling: '검사 방식',
    effectivePeriod: '적용 기간',
    noEnd: '종료일 미설정',
    itemsTitle: (count: number): string => `검사 항목 (${String(count)})`,
    lockedHint: '검사 항목을 추가하려면 신규 버전을 발행하세요.',
    tabsLabel: '버전 내용',
    tabItems: '검사 항목',
    editSettings: '버전 설정 수정',
    tabItemsCount: (count: number): string => `검사 항목 ${String(count)}건`,
    tabHistory: '이력',
    tabHistoryCount: (count: number): string => `이력 ${String(count)}건`,
    notSet: '미설정',
  },
  /* 검사 기준 목록 표의 추가 열(omf-all-around#196). */
  listColumns: {
    item: '품목',
    approval: '승인 여부',
    active: '사용 여부',
    approved: '승인',
    notApproved: '미승인',
  },
  /* 버전 비교 창 — 두 버전의 설정 · 검사 항목 차이(사용자 지시 · #196). 서버 비교 경로 없이 두 버전을 불러 화면이 견준다. */
  compare: {
    title: '버전 비교',
    base: '기준 버전',
    target: '비교 버전',
    settingsTitle: '버전 설정 비교',
    itemsTitle: '검사 항목 비교',
    legendChanged: '변경',
    legendAdded: '추가',
    legendRemoved: '삭제',
    count: (count: number): string => `총 ${String(count)}건`,
    fieldColumn: '항목',
    statusColumn: '상태',
    itemColumn: '검사 항목',
    changesColumn: '변경',
    added: '추가',
    removed: '삭제',
    changed: '변경',
    same: '같음',
    hideSame: '동일 항목 숨기기',
    noItemDiff: '바뀐 검사 항목이 없습니다.',
    noItems: '두 버전 모두 검사 항목이 없습니다.',
    yes: '예',
    no: '아니요',
    change: (label: string, before: string, after: string): string =>
      `${label}: ${before} → ${after}`,
    loading: '비교할 버전을 불러오는 중',
  },
  /* 버전 변경 이력(#196) — 서버가 버전 쓰기마다 남긴 감사 이력을 읽는다. 최근 1년만 조회한다(조회 경로가 기간을 요구한다). */
  history: {
    title: '변경 이력',
    occurredAt: '일시',
    performedBy: '처리자',
    action: '구분',
    changes: '변경 내용',
    created: '버전 생성',
    revised: '신규 버전 발행',
    settingsSaved: '버전 설정',
    itemsSaved: '검사 항목',
    confirmed: '확정',
    obsoleted: '폐기',
    discarded: '작성 취소',
    updated: '수정',
    unknownUser: (userId: number): string => `사용자 #${String(userId)}`,
    system: '시스템',
    itemAdded: '항목 추가',
    itemRemoved: '항목 삭제',
    itemField: (code: string, label: string): string => `${code} · ${label}`,
    none: '변경 이력이 없습니다',
    noneDescription: '버전 저장 · 확정 · 폐기 시 기록됩니다.',
    loading: '변경 이력을 불러오는 중',
    range: '최근 1년',
  },
  versionBar: {
    label: '버전',
    placeholder: '버전을 선택하세요',
    openList: '버전 목록',
    close: '닫기',
  },
  /* 검사 기준 검색 창 — 검사 조회·판정의 품목 선택 창과 같은 모양(omf-all-around#196). */
  picker: {
    title: '검사 기준 검색',
    keywordLabel: '검색어',
    keywordPlaceholder: '기준 코드 또는 기준명을 입력하세요',
    search: '찾기',
    cancel: '취소',
    pick: '선택',
    searching: '찾는 중입니다.',
    noResult: '찾는 검사 기준이 없습니다.',
    searchFailed: '검사 기준을 찾지 못했습니다. 다시 시도하세요.',
    columns: {
      select: '선택',
      code: '기준 코드',
      name: '기준명',
    },
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
    planNotSelected: '목록에서 검사 기준을 먼저 선택하세요',
    /* 상세 칸 빈 안내(사용자 시안 · #196) — 배치(좌우 · 상하)에 따라 목록 위치가 달라 「왼쪽」이라 하지 않는다. */
    detailNotSelectedTitle: '검사 기준을 선택하세요',
    detailNotSelectedDescription: '목록에서 선택하면 상세 정보가 표시됩니다.',
    versionNoneTitle: '등록된 버전이 없습니다',
    versionNoneDescription: '「버전 등록」으로 첫 버전을 만드세요.',
    versionNotSelected: '버전을 선택하세요',
    versionNotSelectedDescription: '선택한 버전의 검사 기준 정보가 표시됩니다.',
    itemNoneTitle: '등록된 검사 항목이 없습니다',
    itemNoneDescription: '검사 항목을 등록하세요.',
  },
  fields: {
    inspectionPlanCode: '기준코드',
    inspectionPlanName: '기준명',
    inspectionType: '검사 유형',
    item: '품목',
    process: '공정',
    routing: '라우팅',
    /** omf-all-around#119 — PQC 기준에만 선다. */
    pqcSkipAllowed: 'PQC 생략 허용',
    approval: '승인',
    active: '사용',
    planVersion: '버전',
    status: '상태',
    effectiveFrom: '적용 시작일',
    effectiveTo: '적용 종료일',
    samplingMethod: '검사 방식',
    /*
     * **단위를 라벨에 박는다.** 받는 값이 백분율인데 라벨이 그것을 말하지 않으면
     * 30을 30개로 읽는다(#201).
     */
    samplingRatio: '샘플 비율(%)',
    samplingQty: '샘플 수량',
    aqlValue: 'AQL',
    acceptanceNumber: '합격 허용 불량 수',
    rejectionNumber: '불합격 판정 불량 수',
    inspectionFrequency: '검사 주기',
    frequencyIntervalValue: '검사 주기 값',
    frequencyIntervalUom: '주기 단위',
    sequence: '순서',
    /** 표의 「항목」 열 — 코드와 이름을 한 칸에 담는다. `item`(품목)과 다른 것이다. */
    itemSpec: '항목',
    dataType: '검사값 유형',
    targetRange: '목표·범위',
    measurementCount: '측정 횟수',
    judgment: '판정',
    /** 행 안의 수정·삭제 열. 머리글이 없으면 보조기술이 열의 뜻을 읽을 수 없다. */
    rowActions: '편집',
    inspectionItemCode: '항목코드',
    inspectionItemName: '항목명',
    uom: '검사 단위',
    targetValue: '기준값',
    lowerLimit: '하한값',
    upperLimit: '상한값',
    inspectionMethod: '검사 방법',
    defaultInspectionEquipment: '검사 장비',
    requiredFlag: '필수',
    automaticJudgment: '자동판정',
  },
  values: {
    pqcSkipAllowedNote: '활성화하면 해당 기준이 적용된 작업지시에서 PQC를 생략할 수 있습니다.',
    /* 공정 · 라우팅을 비운 선택지(사용자 시안 · #208). */
    notSelected: '선택 안 함',
    /* 다른 자료가 쓰는 기준의 코드 잠금 안내(사용자 시안 · #208). */
    codeInUseLocked: '사용 중인 코드는 변경할 수 없습니다.',
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
    /*
     * 검사 유형 3값의 선택지 이름. 약어만으로는 무엇을 가리키는지 읽히지 않아 풀어 쓴 말을 괄호에 담는다.
     * 값 자체(IQC·PQC·OQC)는 계약이 정한 코드라 옮기지 않는다 — `screens/inspection-standard/code-options.ts`가 짝이다.
     */
    inspectionTypes: {
      iqc: 'IQC (수입검사)',
      pqc: 'PQC (공정검사)',
      oqc: 'OQC (출하검사)',
    },
    samplingMethods: {
      fullInspection: '전수검사',
      sampleByUnit: '샘플링(제품 단위)',
      sampleByLot: '샘플링(LOT 단위)',
    },
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
    effectiveRangeReversed: '적용 종료일은 적용 시작일과 같거나 그 뒤여야 합니다.',
    /* 계약이 짝을 요구하나 데이터베이스 CHECK 가 없다 — 화면이 먼저 막는다. */
    frequencyPairRequired: '검사 주기 값과 주기 단위는 함께 채우거나 함께 비워야 합니다.',
    /* 계약 CHECK > 0 — 0 은 「없음」이 아니라 위반이다. */
    rejectionNumberInvalid: '불합격 판정 불량 수는 0보다 큰 숫자여야 합니다.',
    /* 계약 CHECK ≥ 0 — 0 은 허용된다. 불합격판정개수와 규칙이 다르다. */
    acceptanceNumberInvalid: '합격 허용 불량 수는 0 이상의 숫자여야 합니다.',
    /*
     * 계약 exclusiveMinimum: 0 · maximum: 100. 라벨과 같은 말을 쓴다 —
     * 단위 `%`가 문구에 없으면 무엇을 고쳐야 하는지 알 수 없다.
     */
    samplingRatioInvalid: '샘플 비율(%)은 0보다 크고 100 이하인 값이어야 합니다.',
    /* 샘플 방식이면 검사 수량을 비율로 환산한다 — 비율 없이는 몇 개를 검사할지 정할 수 없다. */
    samplingRatioRequired: '샘플링 방식이면 샘플 비율(%) 또는 샘플 수량을 입력하세요.',
    samplingQtyBoth: '샘플 비율(%)과 샘플 수량 중 하나만 입력하세요.',
    samplingQtyInvalid: '샘플 수량은 1 이상의 정수여야 합니다.',
    /*
     * 계약이 버전 내 유일 제약을 두지 않았다 — 막는 곳이 화면과 서버뿐이다.
     * 중복이 저장되면 측정 기록이 어느 항목의 것인지 가릴 수 없다.
     */
    itemCodeDuplicated: '같은 항목코드가 이 버전에 이미 있습니다. 다른 코드를 입력하세요.',
    /* 계약 ck_inspection_limits — 데이터베이스가 막는다. 먼저 막는 것이 사용자에게 이롭다. */
    limitsReversed: '상한값은 하한값과 같거나 그보다 커야 합니다.',
    /* 계약 CHECK > 0. 측정 횟수는 표본 번호의 상한이라 정수여야 한다. */
    measurementCountInvalid: '측정 횟수는 1 이상의 정수여야 합니다.',
    /*
     * **경고이지 차단이 아니다.** 계약이 목표값 범위 밖을 데이터베이스로 막지 않고
     * 서버가 경고 등급으로 다룬다 — 관리 한계와 규격 한계가 다른 경우가 업무상 정상이다.
     */
    targetOutOfRange: '기준값이 하한값~상한값 밖입니다. 의도한 값인지 확인하세요.',
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
