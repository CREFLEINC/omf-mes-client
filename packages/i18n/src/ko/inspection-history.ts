/** 검사 대상 이력(omf-all-around#61) — IQC·PQC·OQC 상세가 함께 쓰는 공용 구획. */
export const inspectionHistory = {
  heading: '검사 이력',
  loading: '검사 이력을 불러오는 중입니다.',
  loadFailed: '검사 이력을 불러오지 못했습니다.',
  source: '전달 문서',
  sourceLot: '대상 LOT',
  empty: '—',
  events: {
    REQUESTED: '검사 대상 전달',
    RESULT_SAVED: '검사 결과 저장',
    RESULT_CONFIRMED: '검사 결과 확정',
    LOT_STATUS_CHANGED: 'LOT 상태 변경',
  },
  round: (round: number): string => `${String(round)}회차`,
  quantities: (accepted: number, rejected: number, held: number): string =>
    `합격 ${String(accepted)} · 불합격 ${String(rejected)} · 보류 ${String(held)}`,
  judgment: (code: string): string => `판정 ${code}`,
  lotStatus: (lotNo: string, from: string, to: string): string => `${lotNo} ${from} → ${to}`,
  by: (name: string): string => `처리 ${name}`,
};
