/** 검사 수준 관리(관리웹 · 품질 관리). 품목별 IQC 검사 수준과 자동 전환 이력. */
export const inspectionLevel = {
  levels: {
    NONE: '무검사',
    REDUCED: '수월',
    NORMAL: '보통',
    TIGHTENED: '엄격',
  } as Record<string, string>,

  dialog: {
    addTitle: '검사 수준 지정',
    changeTitle: '검사 수준 변경',
    item: '품목',
    pickItem: '품목 찾기',
    pickConfirm: '선택',
    noItem: '품목을 선택하세요.',
    itemPlaceholder: '품목을 선택하세요',
    level: '검사 수준',
    reason: '사유',
    reasonPlaceholder: '사유를 입력하세요(선택)',
    sameLevel: '현재 검사 수준과 동일합니다.',
    duplicate: '이미 검사 수준을 지정한 품목입니다. 화면을 새로 고친 뒤 「변경」을 쓰세요.',
  },

  history: {
    itemTitle: '검사 수준 변경 이력',
    itemCode: (code: string) => `품목코드 ${code}`,
    itemColumns: {
      changedAt: '변경 일시',
      level: '검사 수준',
      type: '변경 방식',
      reason: '변경 사유',
      changedBy: '처리자',
    },
    firstSetNote: '최초 지정',
    changedFrom: (level: string) => `${level}에서 변경`,
    caption: '검사 수준 변경 이력',
    empty: '변경 이력이 없습니다.',
    loading: '변경 이력을 불러오는 중입니다.',
    loadFailed: '변경 이력을 불러오지 못했습니다.',
    types: { AUTO: '자동', MANUAL: '수동' } as Record<string, string>,
    acceptStreak: (count: number) => `${String(count)} LOT 연속 합격`,
    rejected: (requestNo: string) => `불합격 — 의뢰 ${requestNo}`,
  },
};
