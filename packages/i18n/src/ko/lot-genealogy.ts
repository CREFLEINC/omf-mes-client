/** 투입 자재 계보(omf-all-around#166 · 서버 선행 P-107) — LOT 상태 상세의 투입 자재·들어간 제품. */
export const lotGenealogy = {
  inputs: {
    heading: '투입 자재',
    loading: '투입 자재를 불러오는 중입니다.',
    loadFailed: '투입 자재를 불러오지 못했습니다.',
    none: '이 생산 LOT 에 이어진 투입 자재가 없습니다.',
    columns: { item: '자재', lot: '자재 LOT', fourM: '4M 변경' },
  },
  usage: {
    heading: '들어간 제품',
    loading: '들어간 제품을 불러오는 중입니다.',
    loadFailed: '들어간 제품을 불러오지 못했습니다.',
    none: '이 LOT 이 투입된 기록이 없습니다.',
    lotsCaption: '들어간 생산 LOT',
    serialsCaption: '들어간 시리얼',
    lotColumns: { lotNo: '생산 LOT', workOrderNo: '작업지시' },
    serialColumns: { serialNo: '시리얼', lotNo: '생산 LOT', producedAt: '생산 시각' },
    serialRange: (from: number, to: number, total: number): string =>
      `시리얼 ${total}건 중 ${from}–${to}`,
    prev: '이전 시리얼',
    next: '다음 시리얼',
  },
  basis: {
    LOT_GENEALOGY_ESTIMATE:
      '투입 시각 기준 추정 — 같은 작업지시, 같은 자재에서 다음 LOT 을 투입하기 전까지 만든 제품에 이었습니다.',
    WORK_ORDER_ESTIMATE:
      '작업지시 단위 추정 — 계보 기록 이전 작업지시라 그 작업지시에 투입된 것 전부입니다. 실제보다 넓을 수 있습니다.',
  },
  empty: '—',
};
