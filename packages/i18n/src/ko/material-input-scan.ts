/**
 * P-02-03 자재 투입 스캔·오투입 검증. **POP(현장 단말) 화면**이라 관리웹과 어휘가 갈린다.
 *
 * - 작업자가 장갑을 낀 채 읽는다. 문장을 짧게 쓰고 한 줄에 한 가지만 말한다.
 * - **「통과」가 「정상」이 아니다.** 출고 미귀속·교차 투입은 막지 않고 기록만 하는데,
 *   나중에 계보를 추적할 때 그 구분이 필요하다 — 그래서 표시할 말이 따로 있다.
 * - 판정 문구를 화면이 지어내지 않는다. 자재 상태·오투입 판정은 서버가 하고 화면은 옮긴다.
 */
export const materialInputScan = {
  title: '자재 투입',
  panes: {
    receipt: '계획 대비 수령',
    scan: '스캔',
    inputs: '투입 목록',
  },
  header: {
    /** W/O 를 주소에서 받지 못한 상태 — 무엇을 해야 하는지까지 적는다. */
    workOrderMissing: '작업지시가 지정되지 않았습니다. 작업지시를 고른 뒤 다시 들어오세요.',
    workOrder: (workOrderId: number): string => `작업지시 #${String(workOrderId)}`,
  },
  table: {
    item: '품목',
    lot: 'LOT',
    issuedQty: '출고',
    receivedQty: '수령',
    varianceQty: '차이',
    status: '상태',
  },
  /** 수령 상태 — 서버가 계산한 차이 수량을 세 갈래로 옮긴 것이다. 값을 만들지 않는다. */
  receiptStatus: {
    matched: '수령 완료',
    short: '수령 부족',
    none: '미수령',
  },
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
  },
  loading: {
    receipt: '라인 수령 내역을 불러오는 중',
  },
  empty: {
    receiptTitle: '수령 내역이 없습니다',
    receiptDescription: '이 작업지시로 라인에 내려온 자재가 아직 없습니다.',
    /* 조회 자체가 나가지 않은 상태 — 「받은 자재가 없다」와 다른 말을 한다. */
    notQueriedTitle: '아직 조회하지 않았습니다',
  },
  notes: {
    /* 부족·미수령은 투입을 막지 않는다(스펙 §6) — 밝히지 않으면 작업자가 멈춰 선다. */
    shortAllowed: '부족·미수령이 있어도 수령한 양으로 투입할 수 있습니다. 차이 사유를 남기세요.',
  },
} as const;
