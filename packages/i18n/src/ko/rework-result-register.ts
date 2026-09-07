export const reworkResultRegister = {
  title: '재작업 실적 등록',
  workOrders: '재작업 W/O',
  empty: '진행할 재작업 W/O가 없습니다.',
  loadError: '재작업 정보를 불러오지 못했습니다.',
  selectWorkOrder: '재작업 W/O를 선택해 주세요.',
  target: '재작업 대상',
  sourceLot: '원 LOT',
  sourceWorkOrder: '원 W/O',
  nonconformance: '근거 부적합',
  disposition: '처분 수량',
  quantities: {
    title: '실적 입력',
    goodQty: '양품',
    defectQty: '불량',
    holdQty: '보류',
    scrapQty: '폐기',
  },
  total: '합계',
  remaining: '미처리',

  /**
   * ③ 결과 LOT — **스펙 §3 이 독립 구획으로 둔 자리다**(96px).
   *
   * ⭐ **재작업은 같은 물건을 고치는 것이라 LOT 이 갈리지 않는다**(§5-4). 선별과 다르다 —
   * 선별은 양품·불량을 다른 LOT 으로 가르지만 재작업은 원 LOT 에 그대로 남는다. 작업자가
   * 「새 번호가 생기나」를 묻지 않도록 **넣은 수량으로 그 결과를 즉시 보인다.**
   *
   * ⛔ 「Lot Status」라고 적지 않는다 — 컬럼 이름이지 작업자의 말이 아니다.
   */
  resultLot: {
    title: '결과 LOT',
    good: (qty: string): string => `양품 ${qty} → 원 LOT 유지`,
    keep: '새 LOT 을 만들지 않습니다.',
    rest: (defect: string, hold: string): string =>
      `불량 ${defect} · 보류 ${hold} → 원 LOT 에 남고 상태가 갈립니다`,
  },

  /**
   * ④ 진행 — 이 W/O 의 **누계**다. ②의 「합계」가 이번 입력이라면 이쪽은 지금까지의 몫이다
   * (스펙 §3 ④ · §5-3 「④ 진행 구획이 누계를 보인다」).
   */
  progress: {
    title: '진행',
    line: (done: string, target: string): string => `이 W/O 재작업 ${done} / ${target}`,
  },
  emptyQuantity: '하나 이상 입력해 주세요.',
  exceeded: (target: number) => `처분 수량 ${target}을 넘을 수 없습니다.`,
  partial: (remaining: number) => `부분 실적입니다. 미처리 ${remaining}이 남습니다.`,
  reworkHint: '재작업 후 다시 불량이면 불량입니다. 재작업 수량이 아닙니다.',
  lotHint: '결과는 원 LOT에 남으며 새 LOT을 만들지 않습니다.',
  defectCode: '불량 코드',
  defectCodePlaceholder: '선택할 수 없음',
  defectCodeReason: '불량 코드 저장 기준이 확정되기 전까지 선택할 수 없습니다.',
  reset: '다시 입력',
  save: '실적 저장',
  queued: '실적을 저장했습니다.',
  queueError: '실적을 단말에 저장하지 못했습니다. 다시 시도해 주세요.',
  rejected: '서버가 실적을 받지 않았습니다. 입력 내용을 확인해 주세요.',
  gateUnidentified: '단말과 공정이 확인되지 않아 저장할 수 없습니다.',
  gateChecking: '단말 기능을 확인하고 있습니다.',
  gateDenied: '이 단말에서는 실적을 입력할 수 없습니다.',
  gateUnavailable: '단말 기능을 확인할 수 없어 저장할 수 없습니다.',
  workerMissing: '작업자 사번이 확인되지 않아 저장할 수 없습니다.',
  pending: (count: number) => `미전송 ${count}건`,
} as const;
