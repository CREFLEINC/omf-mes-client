/**
 * 반납 입고 — POP `P-01-03` · PDA `M-01-15`(피처 019 · omf-all-around#367 · 시안 확정 2026-11-27).
 *
 * 현장에서 쓰지 않고 생산창고로 가져온 자재 LOT 을 창고 재고로 되돌린다. 사람은 LOT(라벨 스캔)과 수량만 준다 —
 * 어느 W/O 에 붙는지는 서버가 정하고 화면에 내지 않는다(FR-013). 라벨이 없는 자재는 「W/O 로 찾기」로 고른다.
 *
 * ⚠ W-04-06 반품·클레임 입고(`returnReceipt`)와 다른 화면이다.
 */
export const materialReturn = {
  title: '반납 입고',

  /** POP P-01-03 — 여러 LOT 을 담아 한 번에 보낸다. */
  pop: {
    scanLabel: '반납할 자재 LOT 라벨을 스캔하세요',
    manualLabel: '자재 LOT 번호',
    byWorkOrder: '라벨이 없어요 · W/O 로 찾기',
    looking: 'LOT 을 찾는 중입니다.',
    notFound: (lotNo: string) => `「${lotNo}」 LOT 이 이 공장에 없습니다. 라벨을 확인하세요.`,
    lookupFailed: 'LOT 을 읽지 못했습니다. 연결을 확인하고 다시 스캔하세요.',
    destination: (warehouse: string) =>
      `받는 곳: 그 LOT 을 출고한 생산창고의 적치 대기 (이 창고 ${warehouse})`,
    destinationPlain: '받는 곳: 그 LOT 을 출고한 생산창고의 적치 대기',
    table: {
      label: '반납할 LOT',
      no: 'No',
      item: '품목',
      lotNo: 'LOT 번호',
      returnable: '반납 가능',
      qty: '반납 수량',
      destination: '받는 곳',
      remove: (lotNo: string) => `${lotNo} 빼기`,
    },
    staging: '적치 대기',
    stagingOf: (warehouse: string) => `적치 대기 · ${warehouse}`,
    otherWarehouse: (warehouse: string) => `다른 창고 · ${warehouse}`,
    byWorkOrderChip: 'W/O 로 찾음',
    qtyLabel: '반납 수량',
    returnableHint: (qty: string) => `반납 가능 ${qty}`,
    qtyOver: (qty: string) => `반납 수량은 반납 가능 ${qty} 이하로 적으세요.`,
    qtyInteger: '이 단위는 소수로 적을 수 없습니다.',
    noLine: '목록에서 LOT 을 고르면 수량을 적습니다.',
    emptyTitle: '반납할 자재 LOT 라벨을 스캔하세요',
    emptyHint: '라벨이 없는 자재는 「W/O 로 찾기」로 고릅니다.',
    sum: (lines: number, totals: string) => `${lines}건 · 합 ${totals}`,
    clear: '목록 비우기',
    submit: (lines: number) => `반납 입고 (${lines}건)`,
    submitting: '보내는 중…',
    barLabel: '반납 입고 작업',
    done: (lines: number) =>
      `반납 입고 ${lines}건을 받았습니다. 적치 대기에 들어갔습니다. PDA 로 적치하세요.`,
    /** 받은 창고 이름을 붙인 보낸 뒤 문구(시안 「G 생산창고 적치 대기」) — 여러 창고면 쉼표로 잇는다. */
    doneIn: (lines: number, warehouses: string) =>
      `반납 입고 ${lines}건을 받았습니다. ${warehouses} 적치 대기에 들어갔습니다. PDA 로 적치하세요.`,
    queued: '보낼 대기열에 넣었습니다. 연결되면 보냅니다.',
    pending: (count: number) => `보낼 대기열 ${count}건`,
    rejected: (reason: string) => `대기열에서 보낸 반납 입고가 거절됐습니다 — ${reason}`,
    rejectedNoReason: '대기열에서 보낸 반납 입고가 거절됐습니다. 목록을 확인하고 다시 담으세요.',
    submitFailed: '반납 입고를 보내지 못했습니다. 연결을 확인하고 다시 누르세요.',
    forbidden: '이 단말에는 반납 입고 권한이 없습니다. 관리자에게 알리세요.',
  },

  /**
   * 서버 거절 문구 — 오류 코드로 꺼낸다. 서버 문구는 한국어 하나라 베트남어 화면에 그대로 쓰지 않는다
   * (적치 판정 `putaway.direct.verdict` 와 같은 방식). 모르는 코드만 서버 문구 그대로 둔다.
   */
  reason: {
    NOT_RETURNABLE: '반납할 수 있는 자재 LOT 이 아닙니다 — 이 LOT 은 W/O 로 출고된 적이 없습니다.',
    NOTHING_TO_RETURN: '반납할 양이 남지 않았습니다 — 이 LOT 은 출고된 양을 모두 반납했습니다.',
    overReturnable: (qty: string) => `출고된 양보다 많이 반납할 수 없습니다 (반납 가능 ${qty})`,
    WORK_ORDER_MISMATCH:
      '고른 W/O 가 이 LOT 의 가장 최근 출고 W/O 가 아닙니다. 다시 찾아 고르세요.',
    lotMissing: '없는 LOT 입니다. 라벨을 확인하세요.',
  },

  /** 「라벨이 없어요 · W/O 로 찾기」 — POP 창 · PDA 화면이 함께 쓴다. */
  findByWo: {
    title: 'W/O 로 찾기',
    steps: { workOrder: '1. W/O', lot: '2. 자재 LOT', qty: '3. 수량' },
    search: 'W/O 번호 일부',
    recent: '최근 출고',
    unprinted: (count: number) => `라벨 미발행 ${count}`,
    unprintedShort: (count: number) => `미발행 ${count}`,
    finalized: '최종 마감',
    finalizedNote:
      '이 W/O 는 최종 마감됐습니다. 반납하면 재고는 돌아오지만 이 W/O 에는 붙지 않습니다.',
    workOrderLine: (item: string, process: string, issuedAt: string) =>
      `${item} · ${process} · 출고 ${issuedAt}`,
    /** W/O 로 나간 자재 — 「B-220 하우징 커버(좌) 외 2」, 다른 품목이 없으면 품목만. */
    withOthers: (item: string, others: number) => (others > 0 ? `${item} 외 ${others}` : item),
    choose: '선택',
    back: '‹ W/O 다시 고르기',
    lotTable: {
      label: '이 W/O 로 나간 자재 LOT',
      item: '품목',
      lotNo: 'LOT 번호',
      issued: '출고',
      returnable: '반납 가능',
    },
    labelUnprinted: '라벨 미발행',
    autoPicked: '자동 선택',
    pickedLot: '고른 LOT',
    qty: '수량',
    add: '목록에 담기',
    addHint: '담으면 목록에 「W/O 로 찾음」 표시와 함께 들어갑니다.',
    close: '닫기',
    loading: '불러오는 중입니다.',
    loadFailed: '목록을 불러오지 못했습니다. 연결을 확인하고 다시 여세요.',
    emptyWorkOrders: '반납할 양이 남은 W/O 가 없습니다.',
    emptySearch: (query: string) => `「${query}」 이 들어간 W/O 가 없습니다.`,
    emptyLots: '이 W/O 로 나간 자재 중 반납할 양이 남은 LOT 이 없습니다.',
    next: '다음',
  },

  /** POP 반납 직후 라벨 찍기 창 — P-01-02 분할 LOT 라벨과 같은 자재 LOT 라벨. */
  label: {
    title: (count: number) => `라벨이 없는 LOT ${count}건 — 자재 LOT 라벨을 찍으세요`,
    body: '반납 입고를 받았습니다. 라벨이 아직 없는 LOT 입니다. 지금 찍어 자재에 붙이세요.',
    same: '「분할 LOT 라벨」 탭과 같은 라벨입니다.',
    later: '나중에 (분할 LOT 라벨 탭에 남김)',
    print: '라벨 발행',
    printing: '찍는 중…',
    loading: '라벨 정보를 불러오는 중입니다.',
    notFound: '라벨 정보를 찾지 못했습니다. 「분할 LOT 라벨」 탭에서 찍으세요.',
    printed: (count: number) => `자재 LOT 라벨 ${count}장을 찍었습니다.`,
    failed: (reason: string) =>
      `라벨을 찍지 못했습니다 — ${reason} 「분할 LOT 라벨」 탭에 남습니다.`,
    failedNoReason: '라벨을 찍지 못했습니다. 「분할 LOT 라벨」 탭에 남습니다.',
    workerMissing: '사번을 확인해야 라벨을 찍습니다.',
  },

  /** PDA M-01-15 — LOT 하나씩: LOT → 수량 → 위치(건너뛸 수 있음). */
  pda: {
    title: '반납 입고',
    menuDescription: '창고로 돌아온 자재를 받아 위치에 놓기',
    steps: { lot: 'LOT', qty: '수량', location: '위치' },
    scan: '자재 LOT 라벨 스캔',
    scanSub: '창고로 돌아온 자재 LOT 을 스캔하세요',
    lotCard: 'LOT',
    returnable: '반납 가능',
    returnableOf: (qty: string) => `반납 가능 ${qty}`,
    qty: '반납 수량',
    next: '다음',
    location: '놓을 위치 스캔',
    locationSub: '건너뛰면 적치 대기로 들어갑니다',
    skip: '적치 대기로 받기',
    confirm: '확인',
    otherLocation: '다른 위치',
    undesignatedTitle: (location: string, item: string) =>
      `${location} 에 ${item} 을 처음 놓습니다`,
    undesignatedBody: (item: string) =>
      `이 위치에는 ${item} 이 지정돼 있지 않습니다. 맞으면 확인하세요.`,
    blockedTitle: (location: string) => `${location} · 놓을 수 없음`,
    sendFailedTitle: '보내지 못함',
    doneLocated: '반납 입고 · 적치 끝',
    doneStaged: '반납 입고 끝 · 적치 대기',
    doneStagedHint: '나중에 「적치·입고 완료」에서 위치에 놓으세요.',
    stagingOf: (warehouse: string) => `${warehouse} 적치 대기`,
    staging: '적치 대기',
    nextLot: '다음 LOT',
    queued: '보낼 대기열에 넣었습니다',
    queuedHint: '연결되면 보냅니다. 다음 LOT 을 스캔하세요.',
    sending: '보내는 중…',
    locationNotFound: (code: string, warehouse: string) =>
      `「${code}」 위치가 ${warehouse} 에 없습니다. 위치 라벨을 확인하세요.`,
    /** 연결이 끊겨 위치를 못 읽었을 때만 — 서버가 답한 실패는 PDA 공통 문구(`useLoadFailure`)를 쓴다. */
    locationLookupFailed:
      '위치를 읽지 못했습니다. 연결을 확인하거나 「적치 대기로 받기」를 누르세요.',
    /** 서버에 닿았지만 위치를 읽지 못했을 때 붙이는 다음 할 일. */
    locationLookupCaution: '「적치 대기로 받기」로 받을 수 있습니다.',
    stepCard: (step: string) => `${step} 다시 하기`,
  },
};
