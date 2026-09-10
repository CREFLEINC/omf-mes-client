export const reworkResultRegister = {
  title: '재작업 실적 등록',
  workOrders: '재작업 W/O',
  empty: '진행할 재작업 W/O가 없습니다.',
  loadError: '재작업 정보를 불러오지 못했습니다.',
  selectWorkOrder: '재작업 W/O를 선택해 주세요.',

  /**
   * 머리줄 왼쪽의 맥락 — **스펙 §3 은 이 자리에 «값»을 둔다**(`W/O-2026-R012 · FG-1001`).
   *
   * ⛔ **안내문을 두지 않는다.** 「재작업 W/O를 선택해 주세요」가 여기 서 있었는데, 그 말은
   * 본문 목록이 이미 하고 있고 머리줄은 「지금 무엇을 들고 있는가」를 말하는 자리다. 아직
   * 고르지 않았으면 **값이 없다고** 적는다 — POP 이 쓰는 「— 」 표기다(전례 「단말 —」).
   *
   * ⭐ **품목을 함께 둔다** — 스펙이 W/O 번호와 품목을 가운뎃점으로 이었다. 재작업은 같은
   * 번호가 여러 품목으로 갈리지 않지만, 손에 든 지시서와 맞추는 값이 둘이다.
   */
  headerContext: (workOrderNo: string, itemCode: string): string =>
    `${workOrderNo} · ${itemCode}`,
  workOrderUnknown: 'W/O —',

  /**
   * 사번 — **라벨을 붙인다.** 숫자만 두면 무슨 번호인지 알 수 없다. POP 스펙들이 맥락 값
   * (작업지시·설비)에는 라벨을 붙이지 않고 **사번에만** 붙인다(`P-02-01`·`P-02-02` §3).
   */
  workerLabel: (workerNo: string): string => `사번 ${workerNo}`,
  workerUnknown: '사번 —',
  /** 고른 뒤 다른 W/O 로 옮겨 갈 때. 목록을 다시 편다 — 전례 `P-02-04` 의 「변경」. */
  changeWorkOrder: '변경',
  /** 표의 접근 이름. 화면에는 구획 제목이 이미 같은 이름으로 서 있다. */
  workOrderCaption: '진행할 수 있는 재작업 작업지시',
  /* 쪽 넘김 랜드마크 이름(#1005). */
  pageNav: '재작업 작업지시 목록 페이지 이동',
  columns: {
    workOrder: '작업지시',
    item: '품목',
    quantity: '수량',
  },
  selectRow: (workOrderNo: string): string => `${workOrderNo} 선택`,
  target: '재작업 대상',
  sourceLot: '원 LOT',
  /**
   * 근거·처분 — **스펙 §3 ①의 라벨 그대로다**(「근거」·「처분」). 앞선 판은 「근거 부적합」·
   * 「처분 수량」이었는데, 값이 이미 「부적합 NC-… 」·「재작업 160 EA」로 무엇인지 말한다.
   */
  nonconformance: '근거',
  disposition: '처분',

  /** 「원 LOT  FG-…-0288  160 EA」 — 번호와 초기 수량을 잇는다. */
  /* ⚠ 겹공백을 쓰지 않는다 — 화면이 하나로 접어 감지기와 어긋난다(도면의 정렬은 표기일 뿐이다). */
  sourceLotValue: (lotNo: string, qty: string, uom: string): string =>
    uom === '' ? `${lotNo} ${qty}` : `${lotNo} ${qty} ${uom}`,
  /** 「근거  부적합 NC-2026-0071 · 외관 스크래치」 */
  nonconformanceValue: (no: string, description: string): string =>
    `부적합 ${no} · ${description}`,
  /**
   * 「처분  재작업 160 EA  (08-07)」
   *
   * ⛔ **판정한 사람을 적지 않는다.** 스펙 도면은 「(08-07 김품질)」로 이름까지 그렸지만
   * 계약이 주는 것은 `decidedBy`(사용자 «식별자» 숫자)뿐이다 — 숫자를 사람 이름 자리에 두면
   * 그것이 사번인지 무엇인지 알 수 없다. 이름을 받는 경로가 생기면 그때 붙인다.
   */
  dispositionValue: (qty: string, uom: string, decidedOn: string): string =>
    `재작업 ${uom === '' ? qty : `${qty} ${uom}`} (${decidedOn})`,
  /** 값을 아직 못 받았을 때. ⛔ 빈칸으로 두면 「없다」로 읽힌다. */
  unknown: '확인 중',
  quantities: {
    title: '실적 입력',
    /** 키 묶음의 접근 이름. */
    keypadLabel: '수량 키패드',
    /**
     * 칸을 누르면 뜨는 창의 제목 — **어느 칸을 치고 있는지**를 그 자리에서 말한다.
     *
     * ⭐ 키패드를 «상시» 두지 않는 것은 스펙 §3 ②가 그 자리를 그리지 않았기 때문이다.
     * 도면은 구획 전체 폭을 입력 칸이 쓰고 280px 로 검산돼 있다 — 키패드를 옆에 붙이면
     * 그 예산이 성립하지 않는다(사용자 결정 2026-09-07).
     */
    keypadDone: '확인',
    /**
     * ⛔ **X 를 쓰지 않는다**(사용자 결정 2026-09-07). 장갑 낀 손에 20px 짜리 기호는 작고,
     * 「닫기」와 「친 값을 버리기」가 같은 뜻인지도 기호로는 알 수 없다. 이름을 붙인다.
     */
    keypadCancel: '취소',
    /* 읽는 기계에는 이름이 가고 눈에는 기호가 보인다 — 전례 `P-05-01`·`P-02-04`. */
    backspace: '한 자 지움',
    clearGlyph: 'C',
    decimalKey: '소수점',
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
