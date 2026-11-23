/**
 * M-01-03 입하 마감(PDA, 005 · omf-all-around#254 · screens/M-01-03.md).
 *
 * 입하 중인 입하 LOT 를 건별로 확인·해제·입하 마감하고, 아직 다음 일이 시작되지 않은 입하 완료 건을 마감 취소한다.
 * 문구는 확정 시안(mockups/M0103-After)을 따른다. 「공급사·품목」은 설계 확정 용어다.
 * 화면에 원리 설명 · 다른 화면 코드(M-01-01 · W-01-01 · W-01-16)를 적지 않는다(사용자 지시 2026-11-18). 마감하지 않아도 공장
 * 날짜가 바뀌면 시스템이 자동 마감하고, 마감 취소 목록에는 아직 다음 일(IQC 결과 · 입고 · 최종 마감)이
 * 시작되지 않은 건만 온다 — 이 사정은 주석에만 남긴다.
 */
export const inboundClose = {
  title: '입하 마감',
  /**
   * 입하 중 · 입하 완료 탭 — 한 화면에 이어 두면 입하 중이 많을 때 입하 완료가 밑에 깔린다(사용자 지시 2026-11-23).
   * 탭 이름은 아래 두 구획의 heading 이다.
   */
  tabsLabel: '입하 마감 목록',
  /**
   * 입하 중 탭. 건수는 적지 않는다(사용자 지시 2026-11-23, 「(마감 대상) N」을 걷음). 표 위 오른쪽 [전체 마감]이 입하 중인
   * 품목을 모두 마감한다. 「마감 취소됨」 칩은 두지 않는다.
   */
  open: {
    heading: '입하 중',
    empty: '마감할 입하 LOT가 없습니다',
    closeAll: '전체 마감',
    closeAllLabel: (items: number, lots: number) => `입하 중 ${items}품목 ${lots}개 전체 마감`,
  },
  /**
   * 입하 완료 탭. 줄은 마감 시각 · 품목 · 개수 · 수량 · [취소]만(사용자 지시 2026-11-23). 「마감 취소 가능 N」 · 까닭 칩
   * (「IQC 결과 0건」 등) · IQC 요청 번호 · 입하 LOT 번호 · 막힘 줄은 줄에 두지 않는다 — [취소]를 누르면 뜨는 창이 말한다.
   */
  done: {
    heading: '입하 완료',
    empty: '마감 취소할 수 있는 건이 없습니다',
    /** 줄 끝 단추 — 「마감 취소」를 줄였다(사용자 지시 2026-11-23). 낭독 이름은 무엇을 취소하는지까지. */
    reopen: '취소',
    reopenLabel: (itemCode: string, itemName: string) => `${itemCode} ${itemName} 마감 취소`,
  },
  /** [전체 마감] 확인 창 · 결과. */
  closeAllDialog: {
    title: '입하 중인 품목을 모두 마감할까요?',
    summary: (items: number, lots: number) => `${items}품목 ${lots}개를 마감합니다.`,
    body: '마감하면 더 받거나 해제할 수 없고, 검사가 필요한 품목은 IQC 요청이 생깁니다.',
    cancel: '취소',
    proceed: '전체 마감',
    done: (items: number) => `${items}품목 마감`,
  },
  /** 카드 공통. */
  /**
   * 목록 표(사용자 지시 2026-11-20 — 입하 등록 「이번 입하」 표와 같은 모양). 입하 LOT 번호 · 첫 등록 시각은 줄에서 뺐다 —
   * 작업자는 품목으로 찾는다. 번호는 마감 확인 창에 남는다.
   */
  list: {
    open: (itemCode: string, itemName: string) => `${itemCode} ${itemName} 열기`,
  },
  /** 줄을 누르면 아래에서 올라오는 시트 — 이름표 칸 · 자재 관리 LOT · [마감]. */
  sheet: {
    title: '입하 품목',
    /** 이름표 칸 — 품목 시트와 마감 취소 · 막힘 창이 같이 쓴다(창의 「명시적인 타이틀」, 사용자 지시 2026-11-23). */
    fields: {
      itemCode: '품목코드',
      itemName: '품목명',
      supplier: '공급사',
      qty: '수량',
      closedAt: '마감 시각',
    },
    summary: (count: number, total: string) => `${String(count)}개 ${total}`,
  },
  /** 상세(입하 중 카드를 누르면). */
  detail: {
    lotCount: 'LOT 수',
    lots: (count: number) => `자재 관리 LOT ${count}`,
    /** 자재 관리 LOT 표 — 행은 한 줄(번호 · 수량 · 등록 시각 · ✕). 번호는 보통 끝 일련번호. */
    columns: { no: '번호', qty: '수량', registered: '등록' },
    unregister: '해제',
    /** LOT 수량 뒤 패키징 — 「1,000 EA · 봉지 10」(M-01-01 과 같은 표기, G2 L20). */
    package: (unit: string, count: number) => ` · ${unit} ${String(count)}`, // ui-check-ignore: C-13 설계 확정 표기 「1,000 EA · 봉지 10」(screens/M-01-01.md)
    close: '마감',
    loading: '입하 LOT를 불러오는 중입니다',
    gone: '이 입하 LOT는 이미 마감됐거나 없어졌습니다. 목록으로 돌아가세요.',
  },
  unregisterDialog: {
    title: '자재 관리 LOT 등록을 해제할까요?',
    body: (qty: string) => `입하 수량에서 ${qty}만큼 빠집니다.`,
    last: '마지막 자재 관리 LOT입니다. 해제하면 입하 취소됩니다.',
    cancel: '취소',
    proceed: '해제',
    done: (tail: string) => `등록 해제 — …|${tail}`,
    lastDone: (no: string) => `${no} 입하 취소 — 마지막 자재 관리 LOT 해제`,
  },
  closeDialog: {
    title: (no: string) => `${no} 를 마감할까요?`,
    total: (count: number, qty: string) => `자재 관리 LOT ${count}개 · ${qty}.`, // ui-check-ignore: C-13 설계 확정 확인 문구(screens/M-01-03.md)
    withIqc: 'IQC 요청이 생기고',
    withoutIqc: '검사 불필요 품목이라 IQC는 「검사 생략」으로 남고',
    /** IQC 기본 생략 기준이 없는 검사 불필요 품목(G2 L15 · US2-7). */
    withoutIqcRecord: '검사 불필요 품목이라 IQC 기록이 생기지 않고',
    rest: ', 더 받거나 해제할 수 없습니다.',
    cancel: '취소',
    proceed: '마감',
  },
  result: {
    withIqc: (no: string) => `입하 완료 — IQC 요청이 생겼습니다(${no})`,
    withIqcNoNumber: '입하 완료 — IQC 요청이 생겼습니다',
    noInspection: '입하 완료 — 검사 불필요, 자재 관리 LOT 정상',
  },
  reopenDialog: {
    title: '마감을 취소할까요?',
    effect: {
      NO_IQC_RESULT: (iqcNo: string) =>
        `IQC 요청(${iqcNo})이 취소되고 입하 LOT가 「입하 중」으로 돌아갑니다. 자재 관리 LOT는 검사 대기나 보류 상태 그대로입니다.`,
      INSPECTION_NOT_REQUIRED: () =>
        'IQC 「검사 생략」 기록이 취소되고 입하 LOT가 「입하 중」으로 돌아갑니다. 자재 관리 LOT는 정상 그대로입니다(검사 불필요 품목).',
    },
    cancel: '닫기',
    proceed: '마감 취소',
    done: (itemCode: string, itemName: string) => `${itemCode} ${itemName} 마감 취소`,
  },
  /** 마감 취소 막힘 창(409). 코드마다 「여기에 보이지 않는 것」과 같은 말. */
  blockedDialog: {
    title: '마감을 취소할 수 없습니다',
    /**
     * 같은 공급사·품목을 그 뒤에 다시 받아 「입하 중」이 새로 생겼다 — 한 공급사·품목에 입하 중은 하나뿐이라 마감을 취소하면
     * 둘이 된다. 줄에 미리 적던 것을 [취소]를 누른 때 이 창에서만 말한다(사용자 지시 2026-11-23).
     */
    openReceipt: '같은 품목을 입하 중이라 마감 취소할 수 없습니다.',
    /** 그 입하 중 건의 품목 시트를 연다. */
    openReceiving: '입하 중 열기',
    codes: {
      IQC_RECORDED: '그사이 IQC 결과가 기록됐습니다.',
      GOODS_RECEIVED: '그사이 자재 관리 LOT가 입고됐습니다.',
      INBOUND_LOT_FINALIZED: '관리자가 최종 마감했습니다.',
      LEGACY_INBOUND_LOT: '이전 데이터 입하라 마감을 취소할 수 없습니다.',
    } as Record<string, string | undefined>,
    other: '지금은 마감을 취소할 수 없습니다. 목록을 다시 불러왔습니다.',
    close: '닫기',
  },
  errors: {
    conflict: '다른 기기에서 먼저 바꿨습니다. 목록을 다시 불러왔습니다.',
    stateLocked: '이 입하 LOT는 그사이 상태가 바뀌었습니다. 목록을 다시 불러왔습니다.',
    failed: '저장하지 못했습니다. 연결을 확인한 뒤 다시 하세요.',
    loadFailed: '입하 LOT 목록을 불러오지 못했습니다.',
    retry: '다시 불러오기',
  },
  /** 온라인에서만 쓴다(screens/M-01-03.md). */
  offline: '오프라인 — 입하 마감·해제·마감 취소는 연결된 뒤에 할 수 있습니다', // ui-check-ignore: C-13 동작 이름 나열(screens/M-01-03.md 「온라인에서만」)
  noWorker: '사번을 확인한 뒤 할 수 있습니다',
  noPlant: '이 기기의 공장을 알 수 없어 목록을 불러오지 않습니다. 기기 등록을 확인하세요.',
} as const;
