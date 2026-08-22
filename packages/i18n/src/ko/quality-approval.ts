export const qualityApproval = {
  scopeWarning:
    '승인 유형 기준값이 준비되지 않아 나에게 배정된 모든 유형의 요청을 표시합니다. 승인 유형 원문을 확인하세요.',
  fields: {
    approvalTypeCode: '승인 유형',
    statusCode: '상태',
    period: '상신일',
    q: '요청번호 검색',
    pendingOnly: '결재 대기만 보기',
    request: '요청',
    target: '대상',
  },
  codePending: '선택할 기준값이 아직 준비되지 않았습니다',
  codePlaceholder: '기준값 준비 중',
  all: '전체',
  actions: {
    selectRow: (requestNo: string): string => `${requestNo} 선택`,
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
  },
  loading: '승인 요청 목록 불러오는 중',
  empty: {
    title: '조건에 맞는 승인 요청이 없습니다',
    description: '조건을 줄이거나 결재 대기만 보기를 꺼 보세요.',
    beyondTitle: '이 쪽에 표시할 요청이 없습니다',
    beyondDescription: '첫 쪽으로 돌아가 요청을 확인하세요.',
  },
  page: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    total: (total: number): string => `전체 ${String(total)}건`,
  },
  values: {
    unknownTarget: '대상 이름 없음',
    myTurn: '내 차례',
  },
} as const;
