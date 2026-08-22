export const qualityApproval = {
  fields: {
    statusCode: '상태',
    request: '요청',
    target: '대상',
  },
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
