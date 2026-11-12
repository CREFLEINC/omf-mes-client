/**
 * M-01-03 입하 마감(PDA, 005 · omf-all-around#254 · screens/M-01-03.md).
 *
 * 입하 중인 입하 LOT 를 건별로 확인·해제·입하 마감하고, 아직 다음 일이 시작되지 않은 입하 완료 건을 마감 취소한다.
 * 문구는 확정 시안(mockups/M0103-After)을 따른다. 「공급사·품목」은 설계 확정 용어다.
 */
export const inboundClose = {
  title: '입하 마감',
  /** 목록 위 구획 — 입하 중(마감 대상). */
  open: {
    heading: (count: number) => `입하 중 (마감 대상) ${count}`,
    empty: '마감할 입하 LOT가 없습니다',
    note: '마감하지 않아도 공장 날짜가 바뀌면 시스템이 자동 마감합니다.',
    receiving: '입하 중',
    reopened: '마감 취소됨',
    firstAt: (when: string) => `첫 등록 ${when}`,
  },
  /** 목록 아래 구획 — 입하 완료 · 마감 취소 가능. */
  done: {
    heading: (count: number) => `입하 완료 · 마감 취소 가능 ${count}`, // ui-check-ignore: C-13 설계 확정 구획 이름(screens/M-01-03.md)
    note: '아직 아무 일도 시작되지 않은 건만 보입니다.',
    empty: '마감 취소할 수 있는 건이 없습니다',
    autoChip: '자동 마감',
    closedAuto: (when: string) => `날짜 바뀜 자동 마감 ${when}`,
    closed: (when: string) => `마감 ${when}`,
    reopen: '마감 취소',
    /** 같은 공급사·품목이 입하 중이라 미리 막힌 건. */
    blocked: (no: string) =>
      `같은 공급사·품목의 ${no} 이 입하 중 — 먼저 마감해야 취소할 수 있습니다`, // ui-check-ignore: C-13 설계 확정 용어 「공급사·품목」(screens/M-01-03.md)
    reason: {
      NO_IQC_RESULT: { chip: 'IQC 결과 0건', sub: '검사 필요 · 결과 없음' }, // ui-check-ignore: C-13 설계 확정 칩 문구(screens/M-01-03.md)
      INSPECTION_NOT_REQUIRED: { chip: '검사 불필요 · 입고 전', sub: '자재 관리 LOT 정상' }, // ui-check-ignore: C-13 설계 확정 칩 문구(screens/M-01-03.md)
      IQC_SKIPPED: { chip: '긴급 생략 실행 · 입고 전', sub: '자재 관리 LOT 정상(긴급 생략)' }, // ui-check-ignore: C-13 설계 확정 칩 문구(screens/M-01-03.md)
    },
    hiddenTitle: '여기에 보이지 않는 것 — 마감 취소 불가',
    hidden: [
      'IQC 결과가 1건이라도 있는 건 (W-01-01 에서 결과를 지운 뒤에야 보임)',
      '자재 관리 LOT가 하나라도 입고된 건',
      '긴급 생략 결재 대기 중인 건',
      '관리자가 최종 마감 한 건 (W-01-16 입하/입고 작업 기록)',
    ],
  },
  /** 카드 공통. */
  card: {
    itemSupplier: (item: string, supplier: string) => `${item} · ${supplier}`, // ui-check-ignore: C-13 설계 확정 카드 표기(screens/M-01-03.md)
    total: (count: number, qty: string) => `자재 관리 LOT ${count}개 · ${qty}`, // ui-check-ignore: C-13 설계 확정 합계 표기(screens/M-01-03.md)
    open: (no: string) => `${no} 열기`,
    withSub: (total: string, sub: string) => `${total} · ${sub}`, // ui-check-ignore: C-13 설계 확정 카드 표기(screens/M-01-03.md)
    withIqc: (closed: string, iqcNo: string) => `${closed} · ${iqcNo}`, // ui-check-ignore: C-13 설계 확정 카드 표기(screens/M-01-03.md)
    lotItem: (no: string, item: string) => `${no} · ${item}`, // ui-check-ignore: C-13 설계 확정 창 표기(mockups/M0103-After)
  },
  /** 상세(입하 중 카드를 누르면). */
  detail: {
    inboundLot: '입하 LOT',
    status: '상태',
    statusValue: '입하 중 · 마감 전', // ui-check-ignore: C-13 설계 확정 상태 문구(screens/M-01-03.md)
    item: '품목',
    supplier: '공급사',
    receiptNo: '입하 번호',
    firstAt: '첫 등록',
    total: '합계',
    lots: (count: number) => `자재 관리 LOT ${count}`,
    pending: '검사 대기 · 보류', // ui-check-ignore: C-13 설계 확정 상태 칩(screens/M-01-03.md)
    normal: '정상',
    unregister: '해제',
    /** LOT 수량 뒤 패키징 — 「1,000 EA · 봉지 10」(M-01-01 과 같은 표기, G2 L20). */
    package: (unit: string, count: number) => ` · ${unit} ${String(count)}`, // ui-check-ignore: C-13 설계 확정 표기 「1,000 EA · 봉지 10」(screens/M-01-01.md)
    note: '남은 상자는 M-01-01 입하 등록에서 스캔하면 마감 전까지 이 입하 LOT에 이어 들어갑니다. 공장 날짜가 바뀌면 자동 마감됩니다.',
    close: '마감',
    loading: '입하 LOT를 불러오는 중입니다',
    gone: '이 입하 LOT는 이미 마감됐거나 없어졌습니다. 목록으로 돌아가세요.',
  },
  unregisterDialog: {
    title: '자재 관리 LOT 등록을 풀까요?',
    body: (qty: string) => `대기로 돌아가고 입하 수량에서 ${qty}만큼 빠집니다.`,
    last: '마지막 자재 관리 LOT입니다. 풀면 입하 LOT가 없어지고(입하 취소) 이 목록에서 빠집니다.',
    cancel: '취소',
    proceed: '등록 풀기',
    done: (tail: string) => `등록을 풀었습니다 — …|${tail} 대기로`,
    lastDone: (no: string) => `${no} 마지막 자재 관리 LOT를 풀었습니다 — 입하 LOT 없어짐`,
  },
  closeDialog: {
    title: (no: string) => `${no} 를 마감할까요?`,
    total: (count: number, qty: string) => `자재 관리 LOT ${count}개 · ${qty}.`, // ui-check-ignore: C-13 설계 확정 확인 문구(screens/M-01-03.md)
    withIqc: 'IQC 요청이 생기고',
    withoutIqc: '검사 불필요 품목이라 IQC는 「검사 생략」으로 남고',
    /** IQC 기본 생략 기준이 없는 검사 불필요 품목(G2 L15 · US2-7). */
    withoutIqcRecord: '검사 불필요 품목이라 IQC 기록이 생기지 않고',
    rest: ', 이 입하 LOT에는 더 받거나 해제할 수 없습니다. 같은 공급사·품목을 다시 스캔하면 새 입하 LOT가 생깁니다.', // ui-check-ignore: C-13 설계 확정 용어 「공급사·품목」(screens/M-01-03.md)
    cancel: '취소',
    proceed: '마감',
  },
  result: {
    withIqc: (no: string) => `입하 완료 — IQC 요청이 생겼습니다(${no})`,
    withIqcNoNumber: '입하 완료 — IQC 요청이 생겼습니다',
    noInspection: '입하 완료 — 검사 불필요, 자재 관리 LOT 정상',
    notice:
      '품질 담당자에게 IQC 인계 알림을 보냈습니다. 결과가 기록되기 전까지는 「입하 완료 · 마감 취소 가능」에 보입니다.', // ui-check-ignore: C-13 설계 확정 구획 이름(screens/M-01-03.md)
    back: '목록으로',
  },
  reopenDialog: {
    title: '마감을 취소할까요?',
    effect: {
      NO_IQC_RESULT: (iqcNo: string) =>
        `IQC 요청(${iqcNo})이 취소되고 입하 LOT가 「입하 중」으로 돌아갑니다. 자재 관리 LOT는 검사 대기·보류 그대로입니다.`, // ui-check-ignore: C-13 설계 확정 효과 문구(screens/M-01-03.md)
      INSPECTION_NOT_REQUIRED: () =>
        'IQC 「검사 생략」 기록이 취소되고 입하 LOT가 「입하 중」으로 돌아갑니다. 자재 관리 LOT는 정상 그대로입니다(검사 불필요 품목).',
      IQC_SKIPPED: (iqcNo: string) =>
        `IQC 요청(${iqcNo})이 취소되고 입하 LOT가 「입하 중」으로 돌아갑니다. 긴급 IQC 생략이 무효가 되고 자재 관리 LOT가 검사 대기로 돌아갑니다. 다시 마감하면 검사하거나 생략을 다시 요청해야 합니다`,
    },
    common:
      '입하 중이 되면 같은 공급사·품목 스캔이 이 입하 LOT로 들어갑니다. 더 받거나 해제한 뒤 다시 마감합니다. 공장 날짜가 바뀌면 다시 자동 마감됩니다.', // ui-check-ignore: C-13 설계 확정 용어 「공급사·품목」(screens/M-01-03.md)
    cancel: '닫기',
    proceed: '마감 취소',
    done: (no: string) => `${no} 마감을 취소했습니다 — 입하 중으로`,
  },
  /** 마감 취소 막힘 창(409). 코드마다 「여기에 보이지 않는 것」과 같은 말. */
  blockedDialog: {
    title: '마감을 취소할 수 없습니다',
    openReceipt: (supplier: string, item: string, no: string) =>
      `같은 공급사·품목(${supplier} · ${item})의 ${no} 이 입하 중입니다. 입하 중인 입하 LOT는 공급사·품목마다 하나뿐이라 그것을 먼저 마감하세요.`, // ui-check-ignore: C-13 설계 확정 막힘 문구(screens/M-01-03.md)
    codes: {
      IQC_RECORDED:
        '그사이 IQC 결과가 기록됐습니다. W-01-01 에서 결과를 지운 뒤에야 마감을 취소할 수 있습니다.',
      GOODS_RECEIVED: '그사이 자재 관리 LOT가 입고됐습니다.',
      SKIP_PENDING: '긴급 생략 결재가 진행 중입니다.',
      INBOUND_LOT_FINALIZED: '관리자가 최종 마감 했습니다(W-01-16 입하/입고 작업 기록).',
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
