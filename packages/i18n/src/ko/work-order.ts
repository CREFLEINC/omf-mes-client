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
} as const;
