/**
 * W-01-16 입하/입고 작업 기록(005 · omf-all-around#254 · screens/W-01-16.md · 시안 W0116-After). 「구매 / 자재 관리 ›
 * 입고 관리」 탭 묶음의 마지막 탭. 새 흐름 입하 LOT 의 P/O 매칭을 고치고 최종 마감한다.
 * ⛔ 시안의 「ERP 송신 상태」(보냄 · 반영 대기 / ERP 반영) 문구와 [ERP 반영]은 두지 않는다 — #265.
 *
 * 보기마다의 뜻 풀이 · 매칭 규칙 · 한도 계산식 같은 설명문은 화면에 두지 않는다(사용자 지시 2026-11-18 「불필요한 지시문
 * 제거」). 마감 승인 대기 = 입하 완료이고 자재 관리 LOT 가 모두 끝난 것(입고됨 또는 반품·폐기 처분 끝), 진행 중 = 입하 중이거나
 * IQC·입고·처분이 남은 것. 매칭은 마감 때 발주일 오래된 것부터 잔량 → 허용치 차례로 채우고 남으면 P/O 없음이다. 라인마다
 * 「발주량 + 허용치 − 이전 받은 양」을 넘길 수 없다(오류 문구가 한도를 말한다). 최종 마감하면 ERP 구매입고 대상이 된다(송신은 #265).
 */
/** 끝 글자 받침 여부 — apps/web `patterns/josa` 와 같은 판단(영문 대문자 L·R·M·N 등은 받침 있음). */
const hasFinal = (word: string): boolean => {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 ? code % 28 !== 0 : /[013678LRMNlmngktp]/.test(last);
};

export const inboundWorkRecord = {
  title: '입하/입고 작업 기록',
  noPlant: '쓰는 공장이 없습니다.',
  filters: {
    label: '조회 조건',
    plant: '공장',
    periodFrom: '입하 시작일',
    periodTo: '입하 종료일',
    supplier: '공급사',
    supplierAll: '전체',
    query: '품목 · 입하 LOT', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-16.md)
    /** 흐린 문구는 「~을/를 입력하세요」(사용자 지시 2026-11-27 · #360). */
    queryPlaceholder: '품목 코드·이름 또는 IL 번호를 입력하세요',
    /** 「조건 더보기」에 접힌 공장이 첫 공장이 아닐 때의 칩(C-6). */
    chipPlant: (value: string): string => `공장: ${value}`,
    chipRemovePlant: '공장 조건 제거',
  },
  views: {
    label: '보기',
    ready: '마감 승인 대기',
    prog: '진행',
    final: '최종 마감',
  },
  list: {
    label: '입하 LOT 목록',
    columns: {
      inboundLot: '입하 LOT',
      supplier: '공급사',
      itemCode: '품목코드',
      itemName: '품목명',
      receivingDate: '입하일',
      lotCount: '자재 관리 LOT',
      receivedQty: '입하 수량',
      goodsReceivedQty: '입고 수량',
      match: 'P/O 매칭',
      status: '상태',
      reason: '최종 마감 못 하는 이유',
      finalized: '최종 마감',
    },
    empty: (view: string) => `「${view}」 입하 LOT가 없습니다.`,
    open: (inboundLotNo: string) => `${inboundLotNo} 열기`,
    autoMatchLater: '마감 때 자동 매칭',
    matchLine: (line: string, qty: string) => `${line}: ${qty}`,
    excess: (qty: string) => `(초과 ${qty})`,
    unallocated: (qty: string) => `P/O 없음: ${qty}`,
    /** 매칭 요약 칸에서 라인 사이를 잇는 글자(시안). */
    separator: ' · ', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-16.md 「 · 」로 잇는다)
    readyChip: '마감 승인 대기',
    autoClosed: '자동 마감',
    receiving: '입하 중 — 아직 마감 전',
    blockedUnknown: '상세에서 이유를 확인하세요',
  },
  /** 최종 마감 막힘 문구(screens/W-01-16.md 표 · 계약 `finalizeBlockers`). */
  blockers: {
    IQC_IN_PROGRESS: (count: number) => `IQC 진행 중 — 자재 관리 LOT ${String(count)}개`,
    DISPOSITION_IN_PROGRESS: (count: number) => `처분 진행 중 — 자재 관리 LOT ${String(count)}개`,
    NOT_RECEIVED: (count: number) => `입고 안 됨 — 자재 관리 LOT ${String(count)}개`,
    RECEIPT_CANCEL_PENDING: (count: number) =>
      `입고 취소 요청 중 — 자재 관리 LOT ${String(count)}개`,
  },
  detail: {
    label: '입하 LOT 상세',
    close: '닫기',
    status: {
      ready: '마감 승인 대기',
      prog: '진행',
      final: '최종 마감',
    },
    supplier: '공급사',
    itemCode: '품목코드',
    itemName: '품목명',
    receivingDate: '입하일',
    receiptClosed: '입하 마감',
    notClosed: '마감 전',
    autoClosedSuffix: ' (날짜 바뀜 자동)',
    receivedQty: '입하 수량',
    goodsReceivedQty: '입고 수량',
    receivedValue: (qty: string, uom: string, count: number) =>
      `${qty} ${uom} · 자재 관리 LOT ${String(count)}개`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-16.md)
    blocked: (reason: string) => `최종 마감할 수 없습니다 — ${reason}.`,
    finalized: (at: string, by: string) => `최종 마감 ${at} · ${by}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-16.md)
    finalizedNoName: (at: string) => `최종 마감 ${at}`,
    matchTitle: 'P/O 매칭',
    noMatchYet: '아직 입하 중이라 매칭이 없습니다.',
    editMatch: '매칭 수정',
    matchLabel: 'P/O 매칭 표',
    matchColumns: {
      line: 'P/O 라인',
      orderDate: '발주일',
      ordered: '발주량',
      previous: '이전 받은 양',
      thisMatch: '이번 매칭',
      tolerance: '허용치',
      remaining: '남은 한도',
    },
    lineName: (purchaseOrderNo: string, lineNo: number) => `${purchaseOrderNo} · ${String(lineNo)}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-16.md 「PO-…0031/10」 줄 이름)
    unallocatedRow: 'P/O 없음',
    totalLabel: '합계',
    total: (sum: string, need: string, uom: string) => `${sum} / ${need} ${uom}`,
    excessChip: (qty: string) => `초과 ${qty}`,
    openedAfterClose: '초과분 발주 · 마감 뒤 생김', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-16.md)
    lotsTitle: (count: number) => `자재 관리 LOT ${String(count)}`,
    lotsLabel: '자재 관리 LOT 표',
    lotColumns: {
      lotNo: '자재 관리 LOT 번호',
      qty: '수량',
      status: '상태',
    },
    lotStatus: {
      received: '입고됨',
      /** 입고 뒤 입고 취소를 요청한 LOT(G2 L5). */
      receiptCancelPending: '입고 취소 요청 중',
      returned: '반품 처분 끝',
      disposed: '폐기 처분 끝',
      dispositionInProgress: '처분 진행',
      iqcInProgress: 'IQC 진행',
      inspectionHold: '검사 대기 · 보류', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-16.md)
      waitingReceipt: '입고 대기',
    },
    finalize: '최종 마감',
    finalizeLockedByEdit: '매칭 수정을 먼저 저장하거나 취소하세요',
  },
  editor: {
    qtyLabel: (line: string) => `${line} 이번 매칭`,
    errorsTitle: '저장할 수 없습니다',
    notNumber: (line: string) => `${line}: 0 이상의 수를 넣으세요`,
    overLimit: (
      line: string,
      qty: string,
      limit: string,
      uom: string,
      ordered: string,
      tolerance: string,
      previous: string,
    ) =>
      `${line}: ${qty} — 한도 ${limit} ${uom}(발주 ${ordered} + 허용치 ${tolerance} − 받은 양 ${previous})를 넘습니다`,
    overTotal: (sum: string, need: string, uom: string, diff: string) =>
      `매칭 합 ${sum} ${uom}가 입하 수량 ${need} ${uom}를 넘습니다(+${diff})`,
    cancel: '취소',
    save: '매칭 저장',
    saveLocked: '오류를 고쳐야 저장할 수 있습니다',
    saved: (inboundLotNo: string) => `${inboundLotNo} 매칭을 고쳤습니다`,
    saveFailed: '매칭을 저장하지 못했습니다.',
    finalizedLocked: '최종 마감된 입하 LOT 입니다 — 매칭을 고칠 수 없습니다',
  },
  finalizeDialog: {
    title: '최종 마감할까요?',
    /** 사실 상자(사용자 시안 2026-11-27). */
    item: '품목',
    receivedQty: '입하 수량',
    goodsReceivedQty: '입고 수량',
    qty: (qty: string, uom: string) => `${qty} ${uom}`,
    /** 경고 첫 문장 — P/O 미매칭 수량이 있을 때만(사용자 시안 2026-11-27). 「는/은」은 단위 끝소리에 맞춘다. */
    unallocatedWarning: (qty: string, uom: string) =>
      `P/O 미매칭 수량 ${qty} ${uom}${hasFinal(uom) ? '은' : '는'} ERP로 전송되지 않습니다.`,
    acknowledge: 'ERP에 전송되지 않는 수량을 확인했습니다.',
    warning: '최종 마감 후에는 입고 취소, 마감 취소, P/O 매칭 수정이 불가능합니다.',
    cancel: '취소',
    confirm: '최종 마감',
    done: (inboundLotNo: string) => `${inboundLotNo} 최종 마감`,
    blocked: (reason: string) => `최종 마감할 수 없습니다 — ${reason}`,
    failed: '최종 마감하지 못했습니다.',
  },
  errors: {
    conflict: '다른 사람이 먼저 바꿨습니다',
    reload: '다시 불러오기',
    stateLocked: '입하 중으로 돌아간 입하 LOT 입니다',
  },
};
