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
} as const;
