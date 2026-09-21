export const workOrder = {
  editor: {
    loading: '작업지시 배정 정보를 불러오는 중입니다.',
    failed: '작업지시 배정 정보를 불러오지 못했습니다.',
    ownerMismatch: '요청한 작업지시와 다른 상세가 반환되었습니다.',
    staleTitle: '최신 작업지시를 확인하지 못했습니다.',
    staleDescription: '미저장 입력을 유지했습니다. 다시 조회한 뒤 저장하세요.',
    staleBlocked: '최신 작업지시를 확인할 때까지 편집할 수 없습니다.',
    changedTitle: '작업지시가 외부에서 변경되었습니다.',
    changedDescription: '미저장 입력을 유지했습니다. 최신 내용을 적용한 뒤 다시 편집하세요.',
    changedBlocked: '최신 작업지시를 적용할 때까지 편집할 수 없습니다.',
    writeOwnerMismatch: '저장 응답의 작업지시가 일치하지 않아 결과를 반영하지 않았습니다.',
    validationFailed: '작업지시 검증 결과를 불러오지 못했습니다.',
    validationBlocked: '작업지시 검증 결과를 다시 확인할 때까지 편집할 수 없습니다.',
    lookup: {
      loading: '선택 목록을 불러오는 중입니다.',
      failed: '선택 목록을 불러오지 못했습니다.',
      truncated: '선택 목록의 첫 페이지만 표시합니다.',
      noPlant: 'P/O에 공장이 없어 선택 목록을 불러올 수 없습니다.',
      workerTruncated: '작업자 일부만 표시합니다. 사번·성명으로 검색하세요.',
    },
  },
  screen: {
    view: {
      title: '4M 자원배정·유효성 점검',
      breadcrumbRoot: '생산',
      selectPlan: '생산계획을 먼저 선택하세요.',
      selectPlanLink: 'W/O 전개·편성으로 이동',
      openAssignment: '4M 자원배정·유효성 점검으로 이동',
      contextPane: '선택 생산계획',
      editorPane: '작업지시 배정 편집',
      /** 두 구획 위에서 한 번만 쓰는 제목 — 카드마다 W/O 번호를 반복하지 않는다 */
      selectedHeading: (workOrderNo: string): string => `선택한 W/O — ${workOrderNo}`,
      context: (productionOrderNo: string, total: number): string =>
        `P/O ${productionOrderNo} · W/O ${String(total)}건`,
      selectWorkOrder: '배정할 작업지시를 선택하세요.',
      selectDescription: '목록에서 W/O 번호를 선택하면 자원 배정과 검증 결과를 확인할 수 있습니다.',
      failed: '작업지시 배정 화면을 불러오지 못했습니다.',
      ownerMismatch: '요청 범위와 다른 작업지시 배정 정보가 반환되었습니다.',
      stale: '최신 작업지시 배정 정보를 확인하지 못했습니다.',
      staleDescription: '미저장 입력을 유지했습니다. 다시 조회한 뒤 편집하세요.',
      staleBlocked: '최신 배정 정보를 확인할 때까지 편집할 수 없습니다.',
      retry: '배정 화면 다시 시도',
    },
    assignmentCount: (assigned: number, total: number): string =>
      `${String(assigned)}/${String(total)}`,
    validation: {
      notChecked: '선택 후 확인',
      failed: '검증 조회 실패',
      blocked: '검증 차단',
      warning: '검증 경고',
      passed: '검증 통과',
    },
    errors: {
      REQUIRED: '필수 입력입니다.',
      INVALID_SELECTION: '선택값을 확인하세요.',
      INVALID_INTEGER: '정수를 입력하세요.',
      INVALID_DATE_TIME: '날짜와 시각을 확인하세요.',
      END_BEFORE_START: '계획 종료는 시작보다 빠를 수 없습니다.',
    },
  },
  panes: { list: '작업지시 목록' },
  fields: {
    workOrderNo: 'W/O 번호',
    operation: '공정',
    quantity: '수량',
    priority: '우선순위',
    assignment: '배정',
    validation: '검증',
  },
  actions: {
    select: (workOrderNo: string): string => `${workOrderNo} 선택`,
    priorityLabel: (workOrderNo: string): string => `${workOrderNo} 우선순위`,
  },
  values: { missingOperation: '공정 표시명 없음' },
  loading: '작업지시 목록을 불러오는 중입니다.',
  empty: {
    title: '표시할 작업지시가 없습니다',
    description: '생산계획을 선택하거나 조회 조건을 바꿔 다시 확인하세요.',
    beyondTitle: '현재 쪽에 표시할 작업지시가 없습니다',
    beyondDescription: '첫 쪽 또는 이전 쪽으로 이동해 다시 확인하세요.',
  },
  page: {
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    total: (total: number): string => `전체 ${String(total)}건`,
  },
  /** 4M 화면 목록 전용 — 생산계획·W/O 마감이 함께 쓰는 `pageNav` 는 그대로 둔다. */
  assignmentPageNav: { label: '작업지시 쪽 이동', prev: '이전', next: '다음' },
  pageNav: {
    label: '작업지시 쪽 이동',
    first: '첫 쪽',
    previous: '이전 쪽',
    next: '다음 쪽',
    disabled: {
      first: '첫 쪽: 이미 첫 쪽입니다. 첫 쪽이 아닌 곳에서 이동할 수 있습니다.',
      previous: '이전 쪽: 이미 첫 쪽입니다. 첫 쪽 뒤에서 이동할 수 있습니다.',
      next: '다음 쪽: 다음 쪽이 없습니다. 다음 쪽이 있을 때 이동할 수 있습니다.',
    },
  },
  validationPane: {
    /* 검증 결과 표시 문구 — W-02-03·W-02-04 가 같이 쓴다(사용자 지시 2026-09-20). */
    /** 통과 칩과 겹치지 않게 숫자만 남긴다(사용자 지시 2026-09-20). */
    clean: '차단 0건 · 경고 0건',
    checksTitle: '확인 항목',
    resultTitle: '결과',
    /** 배정이 없어 돌지 않은 검사가 있을 때만 한 번 보인다 */
    skippedNote: '배정되지 않은 설비·금형·작업자 관련 항목은 검증 대상에서 제외됩니다.',
    /** 서버 작업지시 검증이 도는 검사들. 배정이 없는 자원은 그 검사를 돌지 않는다. */
    checks: {
      equipmentStatus: '설비 사용 가능 상태',
      equipmentCalibration: '설비 검교정 기한',
      equipmentDoubleBooked: '설비 일정 겹침',
      moldStatus: '금형 사용 가능 상태',
      moldLife: '금형 수명',
      workerQualification: '작업자 공정 자격',
    },
    /** 돌지 않은 검사를 「이상 없음」이라고 말하지 않는다 — 대상이 아니었다고 말한다 */
    checkState: { checked: '이상 없음', skipped: '해당 없음' },

    panes: { validation: '작업지시 검증' },
    fields: { severity: '등급', message: '내용' },
    loading: '작업지시 검증 결과를 불러오는 중입니다.',
    refreshing: '작업지시 검증 결과를 새로고침하는 중입니다.',
    severity: { block: '차단', warning: '경고' },
    summary: { blocked: '검증 차단', warning: '검증 경고', passed: '검증 통과' },
    empty: {
      notSelectedTitle: '검증할 작업지시를 선택하세요.',
      notSelectedDescription: '목록에서 작업지시를 선택하면 검증 결과를 확인할 수 있습니다.',
      missingTitle: '검증 결과를 불러오지 못했습니다.',
      missingDescription: '다시 선택하거나 새로고침해 확인하세요.',
      noFindingsTitle: '검증 항목이 없습니다.',
      noFindingsDescription: '현재 작업지시에 확인할 검증 결과가 없습니다.',
    },
  },
  resourcePane: {
    pane: '작업지시 자원 배정',
    /** W/O 번호는 두 구획 위에서 한 번만 쓴다(사용자 지시 2026-09-20). */
    heading: '4M 자원배정',
    warning: '자원별로 1개만 배정할 수 있습니다. 추가 배정이 필요하면 W/O를 분할해 주세요.',
    placeholder: '선택하세요',
    /** 별표 옆 한마디 — 칸 아래에 문장을 다시 쓰지 않는다(사용자 지시 2026-09-20) */
    requiredHint: '필수 입력',
    clearOption: '배정 없음',
    cards: { machine: 'Machine', man: 'Man', tool: 'Tool/Mold', material: 'Material' },
    fields: {
      productionLine: '생산 라인',
      equipment: '설비',
      worker: '담당 작업자',
      mold: '금형',
      shift: '계획 교대',
      defaultWipLocation: '기본 WIP 위치',
      defaultFgLocation: '기본 완제품 위치',
      defaultScrapLocation: '기본 스크랩 위치',
    },
    /** 담당 작업자는 창에서 찾아 고른다 — 품목·공급사 선택 창과 같은 방식(사용자 지시 2026-09-20). */
    workerPicker: {
      open: '코드·이름으로 검색',
      clear: '담당 작업자 지우기',
      title: '담당 작업자 선택',
      keywordLabel: '검색어',
      keywordPlaceholder: '사번 또는 성명',
      search: '찾기',
      columns: { select: '선택', workerNo: '사번', workerName: '성명' },
      inactive: '미사용',
      noResult: '검색 결과가 없습니다. 사번이나 성명의 일부로 다시 찾아보세요.',
      searchFailed: '작업자를 찾지 못했습니다.',
      searching: '찾는 중입니다…',
      page: {
        range: (from: number, to: number, total: number): string =>
          `${String(from)}–${String(to)} / 전체 ${String(total)}건`,
        previous: '이전',
        next: '다음',
      },
      cancel: '취소',
      pick: '선택',
    },
    materialInfo: '자재 배정은 이 화면에서 변경하지 않습니다.',
    empty: {
      notSelectedTitle: '자원을 배정할 작업지시를 선택하세요.',
      notSelectedDescription: '목록에서 작업지시를 선택하면 자원 배정 내용을 확인할 수 있습니다.',
    },
  },
  planFieldsPane: {
    pane: '작업지시 계획 필드',
    heading: '계획',
    fields: {
      plannedStartAtLocal: '계획 시작',
      plannedEndAtLocal: '계획 종료',
      priorityNo: '우선순위',
    },
    warning: '계획 시작·종료 시간을 입력하면 자원 일정 중복을 확인할 수 있습니다.',
    empty: {
      notSelectedTitle: '계획을 확인할 작업지시를 선택하세요.',
      notSelectedDescription: '목록에서 작업지시를 선택하면 계획 정보를 확인할 수 있습니다.',
    },
  },
  assignmentActions: {
    actions: { validate: 'Validation 다시 실행', reset: '변경 취소', save: '저장' },
    reasons: {
      saving: '저장 중에는 작업을 실행할 수 없습니다.',
      noChanges: '변경된 내용이 없습니다.',
      invalidDraft: '배정 정보를 확인하세요.',
    },
  },
} as const;
