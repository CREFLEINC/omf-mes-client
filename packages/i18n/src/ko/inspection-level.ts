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
    item: '품목',
    itemCode: '품목코드',
    itemName: '품목명',
    level: '검사 수준',
    reason: '사유',
    reasonPlaceholder: '사유를 입력하세요(선택)',
    duplicate:
      '이미 검사 수준을 지정한 품목입니다. 검사 기준 관리에서 이 품목의 IQC 기준을 열고 「기본 정보 수정」으로 바꿔 주세요.',
  },

  history: {
    itemColumns: {
      changedAt: '변경 일시',
      from: '변경 전',
      to: '변경 후',
      changedBy: '변경자',
      reason: '변경 사유',
    },
    firstSetNote: '최초 지정',
    caption: '검사 수준 변경 이력',
    empty: '검사 수준 변경 이력이 없습니다.',
    loading: '변경 이력을 불러오는 중입니다.',
    loadFailed: '변경 이력을 불러오지 못했습니다.',
    acceptStreak: (count: number) => `${String(count)} LOT 연속 합격`,
    rejected: (requestNo: string) => `불합격 — 의뢰 ${requestNo}`,
  },
};
