export const workOrder = {
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
    heading: (workOrderNo: string): string => `선택한 W/O — ${workOrderNo}`,
    warning: '자원 종류별로 하나만 배정할 수 있습니다. 더 필요하면 W/O를 분할하세요.',
    placeholder: '선택하세요',
    cards: { machine: 'Machine', man: 'Man', tool: 'Tool/Mold', material: 'Material' },
    fields: { productionLine: '생산 라인', equipment: '설비', worker: '담당 작업자', mold: '금형' },
    materialInfo: '자재 배정은 이 화면에서 변경하지 않습니다.',
    empty: {
      notSelectedTitle: '자원을 배정할 작업지시를 선택하세요.',
      notSelectedDescription: '목록에서 작업지시를 선택하면 자원 배정 내용을 확인할 수 있습니다.',
    },
  },
  planFieldsPane: {
    pane: '작업지시 계획 필드',
    heading: (workOrderNo: string): string => `선택한 W/O — ${workOrderNo}`,
    card: '계획',
    fields: {
      plannedStartAtLocal: '계획 시작',
      plannedEndAtLocal: '계획 종료',
      priorityNo: '우선순위',
    },
    warning: '계획 시작과 계획 종료가 모두 있어야 자원 겹침을 확인할 수 있습니다.',
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
