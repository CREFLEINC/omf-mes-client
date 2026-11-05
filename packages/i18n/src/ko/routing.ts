/**
 * W-06-01 Routing(공정) 등록·관리.
 *
 * 상태 문구(작성중·확정·폐기)는 서버 코드 문자열이 확정되기 전이라 화면이 매핑해서 고른다 —
 * 매핑의 정본은 screens/routing/routing-status.ts 한 곳이다.
 */
export const routing = {
  title: 'Routing(공정)',
  breadcrumbRoot: '기준정보 관리',
  panes: {
    item: '품목',
    revision: 'Rev 목록',
    header: 'Routing 정보',
    operations: '공정 라인',
    processList: '공정 목록',
    processForm: '공정 등록·편집',
  },
  /** 상세 카드(사용자 시안 · #231) — 머리 · 탭 · 구역 제목. */
  card: {
    title: '공정 경로',
    tabsLabel: '공정 경로 상세',
    settingsTab: '설정',
    historyTab: 'Rev 이력',
    /** 설정 탭 맨 아래 취소 · 저장 · 확정 · 폐기 줄(#231). */
    actionsLabel: '편집 단추',
    operationsTitle: '공정 구성',
    operationsCount: (count: number): string => `${count}개`,
    revisionChip: (revision: string, status: string): string => `${revision} · ${status}`,
  },
  actions: {
    /** Rev 이력 표의 「상세」 칸 단추 — 누르면 설정 탭에서 그 Rev 를 연다(#231). */
    viewDetail: '상세 보기',
    viewDetailLabel: (revision: string): string => `${revision} 상세 보기`,
    newRevision: '신규 Rev 발행',
    createRouting: 'Routing 등록',
    addOperation: '공정 추가',
    addProcess: '공정 추가',
    activateProcess: '다시 사용',
    confirm: '확정',
    obsolete: '폐기',
    dependencies: '공정 연결',
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
    /* 선후행은 저장된 라인만 가리킬 수 있다 — 저장 전 라인에는 서버 식별자가 없다. */
    dependenciesBlockedByUnsaved:
      '공정 연결은 저장하지 않은 공정 라인이 있으면 할 수 없습니다. 먼저 공정을 저장하거나 취소하세요.',
    dependenciesNeedOperations: '공정 연결은 공정 2개 이상 등록 시 사용 가능합니다.',
    removeBlockedWhileCheckingDependencies: '선후행을 확인하는 중입니다. 잠시 뒤 다시 시도하세요.',
    removeBlockedByDependencyLoadError:
      '선후행을 불러오지 못해 지울 수 있는지 확인할 수 없습니다. 새로고침한 뒤 다시 시도하세요.',
    removeBlockedByDependencies: (relations: string): string =>
      `이 공정에 선후행이 걸려 있습니다(${relations}). 먼저 [공정 연결]에서 그 관계를 지우고 공정을 지우세요.`,
    compareRevisionsUnavailable:
      'Rev 비교는 아직 할 수 없습니다. 비교 기능이 준비되면 이 버튼을 쓸 수 있습니다.',
    changeHistoryUnavailable:
      '변경 이력은 아직 볼 수 없습니다. 조회 기능이 준비되면 이 버튼을 쓸 수 있습니다.',
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
  /** 저장하지 않은 편집을 두고 다른 Rev·품목·화면으로 옮길 때의 확인 — 무엇이 사라지는지와 할 일. */
  discard: {
    title: '저장하지 않은 변경이 있습니다',
    body: '지금 옮기면 이 Rev에서 고친 Routing 정보·공정이 저장되지 않고 사라집니다. 남기려면 「계속 편집」을 누른 뒤 저장하세요.',
    /* 첫 Rev 등록 중에는 아직 Rev 가 없다 — 「이 Rev에서 고친」이 가리킬 것이 없다. */
    bodyCreating:
      '지금 옮기면 입력한 첫 Rev 등록 내용이 저장되지 않고 사라집니다. 남기려면 「계속 편집」을 누른 뒤 등록하세요.',
    stay: '계속 편집',
    confirm: '저장하지 않고 이동',
  },
  filters: {
    searchLabel: '품목 검색',
    /** 검색 칸의 「전체」 — 조건을 푼다(#231). */
    all: '전체',
    processSearchLabel: '공정 검색',
    chipRemoveKeyword: '검색어 조건 제거',
    chipKeyword: (value: string): string => `검색어: ${value}`,
  },
  loading: {
    items: '품목 목록을 불러오는 중',
    revisions: 'Rev 목록을 불러오는 중',
    header: 'Routing 정보를 불러오는 중',
    operations: '공정 라인을 불러오는 중',
    processes: '공정 목록을 불러오는 중',
    processDetail: '공정 상세를 불러오는 중',
  },
  optionsTruncated: '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
  optionsLoadFailed: '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
  empty: {
    itemNoneTitle: '등록된 품목이 없습니다',
    itemNoneDescription: '품목이 등록되면 이 목록에서 고를 수 있습니다.',
    itemNoMatchTitle: '조건에 맞는 품목이 없습니다',
    itemNoMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
    itemNotSelected: '품목을 선택하세요',
    revisionNoneTitle: '등록된 Rev가 없습니다',
    revisionNoneDescription: '「Routing 등록」으로 첫 Rev를 만드세요.',
    revisionNotSelected: '개정을 선택하세요',
    operationNoneTitle: '등록된 공정이 없습니다',
    operationNoneDescription: '「공정 추가」로 첫 공정을 등록하세요.',
    processNoneTitle: '등록된 공정이 없습니다',
    processNoneDescription: '「공정 추가」로 첫 공정을 등록하세요.',
    processNoMatchTitle: '조건에 맞는 공정이 없습니다',
    processNoMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
    processNotSelected: '좌측에서 공정을 고르거나 새 공정을 추가하세요',
  },
  fields: {
    item: '품목',
    itemCode: '품목코드',
    itemName: '품목명',
    routingCode: 'Routing 코드',
    revision: 'Rev',
    status: '상태',
    /** 이력 관리 표 — 확정 일시(#231). */
    confirmedAt: '확정 일시',
    detail: '상세',
    /** 품목 목록 열 — 그 품목의 기본 Rev(#231). */
    defaultRevision: '기본 Rev',
    /** 품목 목록 열 — 최신 Rev · 그 상태 · 발행한 Rev 수(#231). */
    latestRevision: '최신 Rev',
    progressStatus: '상태',
    revisionCount: '개정 수',
    operationNo: '순서',
    process: '공정',
    processCode: '공정코드',
    processName: '공정명',
    processType: '공정 유형',
    isActive: '사용여부',
    operationName: '공정명',
    managedItems: '관리 항목',
    /** 단위를 라벨에 적는다 — 값만 보고는 분·초를 구분할 수 없다. */
    standardCycleTimeSec: '표준 C/T(초)',
    /** 허용 범위를 라벨에 적는다 — 퍼센트로 오입력하면 100배가 조용히 통과한다. */
    standardYieldRate: '표준 수율(%)',
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
  /** Rev 비교(#231) — 두 Rev 의 기본 정보 · 공정 구성을 화면이 견준다(서버 비교 경로 없음). */
  compare: {
    title: 'Rev 비교',
    base: '기준 Rev',
    target: '비교 Rev',
    headerTitle: '기본 정보 비교',
    operationsTitle: '공정 구성 비교',
    fieldColumn: '항목',
    processColumn: '공정',
    changesColumn: '변경',
    detailColumn: '변경 내용',
    added: '추가',
    removed: '삭제',
    changed: '변경',
    same: '같음',
    hideSame: '동일 공정 숨기기',
    noDiff: '바뀐 공정이 없습니다.',
    noOperations: '두 Rev 모두 공정이 없습니다.',
    count: (count: number): string => `총 ${String(count)}건`,
    loading: '비교할 Rev를 불러오는 중',
  },
  /** 변경 이력(#231) — 서버가 Routing 쓰기마다 남긴 감사 이력. 최근 1년만 조회한다(조회 경로가 기간을 요구한다). */
  history: {
    title: '변경 이력',
    range: '최근 1년',
    occurredAt: '일시',
    performedBy: '처리자',
    action: '구분',
    changes: '변경 내용',
    created: 'Routing 등록',
    revised: '신규 Rev 발행',
    headerSaved: '기본 정보 수정',
    operationsSaved: '공정 구성 수정',
    dependenciesSaved: '공정 연결 수정',
    confirmed: '확정',
    obsoleted: '폐기',
    defaultSet: '기본 지정',
    defaultUnset: '기본 해제',
    updated: '수정',
    copiedFrom: '원본',
    operationCountLabel: '공정 수',
    countValue: (count: number): string => `${String(count)}개`,
    dependencyCountLabel: '공정 연결',
    dependencyCountValue: (count: number): string => `${String(count)}건`,
    operationField: (process: string, field: string): string => `${process} · ${field}`,
    operationAdded: '공정 추가',
    operationRemoved: '공정 삭제',
    yes: '예',
    no: '아니요',
    unknownUser: (userId: number): string => `사용자 #${String(userId)}`,
    system: '시스템',
    none: '변경 이력이 없습니다',
    noneDescription: '저장 · 확정 · 폐기 · 기본 지정 때부터 기록됩니다.',
    loading: '변경 이력을 불러오는 중',
  },
  values: {
    draft: '작성중',
    confirmed: '확정',
    obsolete: '폐기',
    /** 공정 마스터의 사용여부. 표의 칸과 편집 폼이 같은 말을 써야 두 자리가 갈리지 않는다. */
    active: '사용',
    inactive: '미사용',
    none: '없음',
    /** 관리 항목 요약 — 첫 항목 외 나머지 수(사용자 시안 · #231). */
    moreItems: (first: string, rest: number): string => `${first} 외 ${rest}개`,
    empty: '—',
    /** 표준 수율 표시 — 화면은 퍼센트(#231). */
    percent: (value: string): string => `${value}%`,
    inactiveSuffix: ' (미사용)',
    revision: (version: number): string => `Rev ${version}`,
    /** 품목 목록 「진행 상태」 — Rev 가 하나도 없는 품목(#231). */
    unregistered: '미등록',
    /** 코드 잠금 · 선후행 막힘을 긴 문장 대신 보이는 짧은 라벨(#231). 문장은 라벨 위 마우스로 본다. */
    codeLockedBadge: '사용 중 · 변경 불가',
    dependenciesBlockedBadge: '공정 2개 이상 등록 시 사용 가능',
    /** 이력 관리 — 기본 Rev 고르기 칸 · 확인 창(#231). */
    defaultSelect: '기본 Rev',
    defaultNone: '미지정',
    defaultNoConfirmed: '미지정',
    /** Rev 상세 보기 창 제목(#231). */
    detailTitle: (revision: string): string => `${revision} 상세`,
    setDefaultConfirm: '기본으로 지정',
    setDefaultTitle: '기본 Rev 지정',
    setDefaultQuestion: (revision: string): string => `${revision}를 기본 Rev로 지정하시겠습니까?`,
    setDefaultDescription: '기존 기본 Rev가 있다면 자동으로 해제됩니다.',
    setDefaultDone: '기본 Rev로 지정했습니다.',
  },
  validation: {
    required: '필수 입력 항목입니다.',
    codeBlank: 'Routing 코드는 공백만으로 지정할 수 없습니다.',
    operationNameBlank: '공정명은 공백만으로 지정할 수 없습니다.',
    processCodeBlank: '공정코드는 공백만으로 지정할 수 없습니다.',
    processNameBlank: '공정명은 공백만으로 지정할 수 없습니다.',
    processTypeRequired: '공정 유형을 고르세요.',
    /** 단위가 초이고 0은 불가다 — 라벨과 같은 말을 오류에도 적어야 무엇을 고칠지 알 수 있다. */
    cycleTimeInvalid: '표준 C/T는 0보다 큰 초 단위 숫자여야 합니다.',
    /** 퍼센트로 넣으면 여기서 막힌다. 막지 않으면 100배 오입력이 조용히 통과한다. */
    yieldRateInvalid: '표준 수율은 0~100 사이로 입력하세요.',
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
    obsoleteTitle: (revision: string): string => `${revision}를 폐기하시겠습니까?`,
    obsoleteDescription: '폐기된 Rev는 신규 작업에 사용할 수 없습니다.',
    obsoleteNote: '폐기 후에도 기존 이력은 유지됩니다.',
    /** 공정 편집 창 관리 항목 제목 옆 — 켠 항목 수(#231). */
    flagsSelected: (count: number): string => `${String(count)}개 선택`,
    deactivateProcessTitle: '이 공정을 사용 중지할까요?',
    deactivateProcessDescription:
      '기존 확정 Routing은 그대로 유지되고, 앞으로 새 공정 라인에서만 고를 수 없게 됩니다.',
    deactivateProcessReferences: (count: number): string =>
      `이 공정을 참조하는 곳이 ${String(count)}건 있습니다.`,
    activateProcessTitle: '이 공정을 다시 사용할까요?',
    activateProcessDescription: '앞으로 새 공정 라인에서도 이 공정을 다시 고를 수 있습니다.',
  },
  /** 공정 선후행 설정 창. */
  dependencies: {
    title: (revision: string): string => `공정 연결 · ${revision}`,
    itemCode: (code: string): string => `품목코드 ${code}`,
    predecessor: '선행 공정',
    successor: '후행 공정',
    type: '관계',
    remove: (rowNo: number): string => `${String(rowNo)}번째 선후행 삭제`,
    rowField: (rowNo: number, field: string): string => `${String(rowNo)}번째 줄 ${field}`,
    add: '연결 추가',
    operationOption: (displayNo: number, name: string): string => `${String(displayNo)}. ${name}`,
    unknownOperation: '알 수 없는 공정',
    loading: '선후행을 불러오는 중',
    noneTitle: '등록된 공정 연결이 없습니다.',
    typesLoadFailed:
      '관계 유형 목록을 불러오지 못했습니다. 다시 시도하세요. 불러오기 전에는 저장할 수 없습니다.',
    saveBlockedWhileLoadingTypes: '관계 유형 목록을 불러오는 중입니다. 잠시 뒤 저장하세요.',
    saveBlockedByInvalid: '선후행 저장은 표에 표시된 문제를 고쳐야 할 수 있습니다.',
    stateLocked:
      '이 Rev는 이미 확정돼 선후행을 바꿀 수 없습니다. 목록을 새로 읽었습니다 — 바꾸려면 신규 Rev를 발행하세요.',
    validation: {
      required: '선행·후행 공정을 모두 고르세요.',
      self: '선행과 후행에 같은 공정을 고를 수 없습니다. 다른 공정을 고르세요.',
      duplicate: (from: string, to: string): string =>
        `같은 선후행이 이미 있습니다(${from} → ${to}). 한 줄을 지우세요.`,
      cycle: (path: string): string =>
        `선후행이 순환합니다(${path}). 이 중 한 줄을 지우거나 방향을 바꾸세요.`,
    },
    discard: {
      title: '저장하지 않은 선후행이 있습니다',
      body: '닫으면 이 창에서 바꾼 선후행이 사라집니다.',
      stay: '계속 편집',
      confirm: '저장하지 않고 닫기',
    },
  },
} as const;
