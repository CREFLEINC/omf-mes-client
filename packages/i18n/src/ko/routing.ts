/**
 * W-06-01 Routing(공정) 등록·관리.
 *
 * 상태 문구(작성중·확정·폐기)는 서버 코드 문자열이 확정되기 전이라 화면이 매핑해서 고른다 —
 * 매핑의 정본은 screens/routing/routing-status.ts 한 곳이다.
 */
export const routing = {
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
