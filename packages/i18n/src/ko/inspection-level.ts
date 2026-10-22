/** 검사 수준 관리(관리웹 · 품질 관리). 품목별 IQC 검사 수준과 자동 전환 이력. */
export const inspectionLevel = {
  title: '검사 수준 관리',
  breadcrumbRoot: '품질 관리',

  levels: {
    NONE: '무검사',
    REDUCED: '수월',
    NORMAL: '보통',
    TIGHTENED: '엄격',
  } as Record<string, string>,

  rule: '사용자가 정한 수준을 그대로 씁니다 — IQC 판정 결과로 자동 전환하지 않습니다. 샘플 수량과 판정 기준은 바뀌지 않습니다.',

  list: {
    heading: '품목별 검사 수준',
    caption: '품목별 검사 수준 목록',
    keyword: '품목 코드·이름',
    level: '검사 수준',
    levelAll: '전체',
    search: '찾기',
    add: '품목 추가',
    empty: '검사 수준을 지정한 품목이 없습니다.',
    loading: '검사 수준을 불러오는 중입니다.',
    loadFailed: '검사 수준을 불러오지 못했습니다.',
    retry: '다시 시도',
  },

  columns: {
    itemCode: '품목 코드',
    itemName: '품목명',
    level: '현재 수준',
    updatedAt: '수정 일시',
    actions: '작업',
  },

  actions: {
    changeLevel: '수준 변경',
    changeLevelRow: (itemCode: string) => `${itemCode} 수준 변경`,
    showHistory: '이력',
    showHistoryRow: (itemCode: string) => `${itemCode} 전환 이력 보기`,
  },

  dialog: {
    addTitle: '검사 수준 지정',
    changeTitle: '검사 수준 변경',
    item: '품목',
    pickItem: '품목 찾기',
    pickConfirm: '선택',
    noItem: '품목을 고르세요.',
    level: '검사 수준',
    reason: '사유',
    sameLevel: '지금과 같은 수준입니다. 다른 수준을 고르세요.',
    duplicate: '이미 검사 수준을 지정한 품목입니다. 목록에서 수준 변경을 쓰세요.',
  },

  history: {
    heading: '전환 이력',
    caption: '검사 수준 전환 이력',
    filteredBy: (itemCode: string) => `품목 ${itemCode}의 이력만 보는 중`,
    showAll: '전체 보기',
    empty: '전환 이력이 없습니다.',
    loading: '전환 이력을 불러오는 중입니다.',
    loadFailed: '전환 이력을 불러오지 못했습니다.',
    columns: {
      changedAt: '일시',
      item: '품목',
      change: '이전 → 새 수준',
      type: '구분',
      reason: '사유',
      changedBy: '처리자',
    },
    types: { AUTO: '자동', MANUAL: '수동' } as Record<string, string>,
    firstSet: '(최초 지정)',
    acceptStreak: (count: number) => `${String(count)} LOT 연속 합격`,
    rejected: (requestNo: string) => `불합격 — 의뢰 ${requestNo}`,
  },
};
