/**
 * P-04-07 출하 완료(POP · 피처 010 · omf-all-around#305).
 *
 * 출하 지시서 코드(PDA 화면 QR · 인쇄 QR)를 스캔하거나 찾기로 고르면 확인 화면이 열리고, [출하 완료] 한 번으로
 * 출하가 끝난다. ⛔ ERP 송신 여부는 이 화면 어디에도 말하지 않는다(사용자 결정 2026-11-18).
 * 문구는 현장 단말용으로 짧게, 할 일을 먼저 쓴다. 가운뎃점으로 항목을 잇지 않는다(C-13).
 */
export const popShipmentComplete = {
  /** 메뉴 이름(`pop-screen-catalog.ts`)과 같은 말이다. */
  title: '출하 완료',

  scan: {
    label: '출하 지시서 코드',
    placeholder: 'PDA 화면의 QR 이나 인쇄한 지시서 QR 을 스캔하세요',
    replacePlaceholder: '다른 지시서 QR 을 스캔하면 바꿔 엽니다',
    nextPlaceholder: '다음 지시서 QR 을 스캔하세요',
    submit: '직접 입력',
    search: '찾기',
    looking: '지시서를 여는 중입니다.',
    notCode: (value: string): string =>
      `출하 지시서 코드가 아닙니다. 읽은 값: ${value}. LOT 라벨이 아니라 지시서 QR 을 스캔하세요.`,
    notFound: (value: string): string => `찾을 수 없는 출하 지시서입니다. 읽은 값: ${value}`,
    failed: '지시서를 열지 못했습니다. 연결을 확인한 뒤 다시 스캔하세요.',
  },

  entry: {
    heading: '지시서를 여는 세 가지 방법',
    pda: {
      title: 'PDA 화면의 QR',
      body: 'PDA 제품 피킹에서 지시서를 열고 「지시서 코드 보기」를 스캐너에 비추세요.',
    },
    print: {
      title: '인쇄한 지시서의 QR',
      body: '관리웹에서 인쇄한 출하 지시서 위쪽 QR 을 스캔하세요.',
    },
    search: {
      title: '[찾기]로 고르기',
      body: '코드가 없으면 지시서 번호나 고객, 품목으로 찾아 고르세요.',
    },
    same: '세 방법 모두 같은 확인 화면으로 갑니다. 확인 화면에서 [출하 완료]를 누르는 순간이 출하 완료 시점입니다.',
  },

  head: {
    request: '출하 지시서',
    customer: '고객',
    shipTo: '납품처',
    salesOrder: '수주',
    noSalesOrder: '없음(수주 없이 작성)',
    ready: '완료 가능',
    blocked: '완료 불가',
    openedByScan: '스캔으로 엶',
    openedBySearch: '찾기로 엶',
    /** 「이름 (코드)」(C-10). */
    named: (name: string, code: string): string => `${name} (${code})`,
  },

  blockers: {
    heading: (count: number): string => `완료를 막는 이유 ${String(count)}`,
    PICKING_SHORT: {
      title: '피킹이 목표 수량에 못 미칩니다',
      hint: 'PDA 제품 피킹에서 LOT 을 스캔하세요.',
    },
    NOT_INSPECTED: {
      title: '검사하지 않은 LOT 이 있습니다',
      hint: 'OQC 출하검사(P-04-06, W-04-03)에서 결과를 기록하세요.',
    },
    REJECTED: {
      title: '불합격 LOT 이 있습니다',
      hint: 'PDA 에서 [교체]하거나 재검 결과를 넣으세요.',
    },
    HELD: {
      title: '보류 LOT 이 있습니다',
      hint: 'OQC 출하검사에서 판정을 마치세요.',
    },
    SALES_ORDER_LINE_CANCELLED: {
      title: 'ERP 에서 취소된 수주 라인이 있습니다',
      hint: '담당자에게 문의하세요.',
    },
    /** 라인 막힘의 대상 한 줄 — 「라인 2 FG-B200, 피킹 0 / 목표 50」. */
    line: (lineNo: number, itemCode: string, picked: string, target: string): string =>
      `라인 ${String(lineNo)} ${itemCode}, 피킹 ${picked} / 목표 ${target}`,
    lineOnly: (lineNo: number): string => `라인 ${String(lineNo)}`,
  },

  lines: {
    heading: '라인',
    caption: '라인별 목표와 피킹',
    note: '목표는 지시서 라인 수량, 피킹은 LOT 통째 합계입니다.',
    columns: {
      lineNo: '라인',
      itemCode: '품목 코드',
      itemName: '품목명',
      target: '목표',
      picked: '피킹',
      over: '초과',
      lotCount: 'LOT',
    },
  },

  warehouses: {
    heading: '재고가 빠질 창고',
    note: '정보로만 보입니다. 출하는 하나로 기록됩니다.',
    entry: (lotCount: number, qty: string): string => `LOT ${String(lotCount)}개, 수량 ${qty}`,
  },

  lots: {
    heading: (count: number): string => `LOT ${String(count)}개`,
    caption: '피킹 LOT 과 OQC 판정',
    note: 'OQC 판정은 이 지시서의 마지막 결과입니다.',
    columns: {
      lotNo: 'LOT',
      itemCode: '품목 코드',
      qty: '수량',
      oqc: 'OQC',
      managementCode: '출하 관리 코드',
    },
    /* 여러 창고·적치 대기 자리에 나뉜 LOT 의 몫 — 「창고 A 20, 창고 B 20」. */
    portion: (warehouse: string, qty: string): string => `${warehouse} ${qty}`,
    stagingIncluded: (qty: string): string => `적치 대기 ${qty} 포함`,
    /* 교체로 빠진 LOT — 확인 화면에서 출하에 들지 않는다는 것을 한 줄로 알린다. */
    replaced: (count: number, lots: string): string =>
      `교체로 빠진 LOT ${String(count)}: ${lots}. 출하에 들지 않습니다.`,
    replacedLot: (lotNo: string, judgment: string | null): string =>
      judgment === null ? lotNo : `${lotNo}(${judgment})`,
    oqc: {
      NOT_REQUIRED: '검사 불필요',
      SKIPPED: '검사 생략',
      NOT_INSPECTED: '미검사',
      ACCEPTED: '합격',
      REJECTED: '불합격',
      HELD: '보류',
    },
  },

  result: {
    title: '출하를 완료했습니다',
    shipmentNo: '출하 번호',
    request: '출하 지시서',
    completedAt: '완료 시각',
    worker: '작업자',
    qty: '출하 수량',
    qtyValue: (qty: string, lineCount: number, lotCount: number, over: string | null): string =>
      `${qty}, 라인 ${String(lineCount)}, LOT ${String(lotCount)}${over === null ? '' : ` (초과 ${over} 포함)`}`,
    warehouses: '재고 차감',
    warehouseValue: (name: string, qty: string): string => `${name} ${qty}`,
    cancelHint: '잘못 나갔으면 관리웹 출하 내역(W-04-12)에서 취소를 상신하세요.',
  },

  already: {
    title: '이미 출하 완료된 지시서입니다',
    body: '아무것도 바뀌지 않았습니다. 다음 지시서를 스캔하세요.',
    heading: '완료된 출하',
    shipmentNo: '출하 번호',
    request: '출하 지시서',
    completedAt: '완료',
    historyHint: '내역과 취소는 관리웹 출하 내역(W-04-12)에서 합니다.',
  },

  search: {
    title: '출하 지시서 찾기',
    close: '닫기',
    queryLabel: '검색어',
    queryPlaceholder: '지시서 번호, 고객, 품목(코드나 이름) 일부',
    find: '찾기',
    readyOnly: '완료 대기만',
    count: (total: number): string => `${String(total)}건`,
    note: '출하 완료된 지시서는 나오지 않습니다.',
    caption: '출하 지시서 목록',
    select: (requestNo: string): string => `지시서 ${requestNo} 열기`,
    ready: '완료 대기',
    blocked: (count: number): string => `막힘 ${String(count)}`,
    shipDate: '출하일',
    customer: '고객',
    items: '품목',
    itemsValue: (code: string, name: string, more: number): string =>
      more > 0 ? `${code} ${name} 외 ${String(more)}` : `${code} ${name}`,
    summary: '내용',
    summaryValue: (lineCount: number, lotCount: number, picked: string, target: string): string =>
      `라인 ${String(lineCount)}, LOT ${String(lotCount)}, 피킹 ${picked} / 목표 ${target}`,
    blockedWhy: '막는 이유',
    blockerCount: {
      PICKING_SHORT: (count: number): string => `피킹 부족 ${String(count)}라인`,
      NOT_INSPECTED: (count: number): string => `미검사 LOT ${String(count)}`,
      REJECTED: (count: number): string => `불합격 LOT ${String(count)}`,
      HELD: (count: number): string => `보류 LOT ${String(count)}`,
      SALES_ORDER_LINE_CANCELLED: (count: number): string => `수주 라인 취소 ${String(count)}`,
    },
    loading: '지시서 목록을 불러오는 중입니다.',
    emptyReady: '완료 대기인 지시서가 없습니다',
    emptyReadyHint: '「완료 대기만」을 끄면 피킹과 검사가 남은 지시서도 함께 봅니다.',
    turnOffReadyOnly: '완료 대기만 끄기',
    empty: '조건에 맞는 출하 지시서가 없습니다',
    emptyHint: '번호나 고객, 품목을 다시 확인하세요.',
    failed: '지시서 목록을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도하세요.',
    retry: '다시 시도',
    pageNav: '지시서 목록 쪽 이동',
  },

  bar: {
    idle: '지시서를 스캔하거나 찾으면 확인 화면이 열립니다.',
    ready: (qty: string, lotCount: number): string =>
      `합계 ${qty}, LOT ${String(lotCount)}개. 누르면 재고 차감과 출고 전표가 한 번에 생깁니다.`,
    blocked: (count: number): string =>
      `막는 이유 ${String(count)}건을 해결해야 완료할 수 있습니다.`,
    done: '완료했습니다. 다음 지시서를 스캔하거나 찾으세요.',
    already: '이미 완료된 지시서는 다시 완료할 수 없습니다.',
    workerMissing: '사번을 확인해야 완료할 수 있습니다.',
    recheck: '다시 확인',
    close: '닫기',
    complete: '출하 완료',
    completing: '완료하는 중…',
  },

  failure: {
    blocked: '완료를 막는 이유가 새로 생겼습니다. 이유를 확인하세요.',
    changed: '그사이 지시서가 바뀌었습니다. 다시 확인한 뒤 완료하세요.',
    network: '연결이 끊겨 완료하지 못했습니다. 연결을 확인한 뒤 다시 누르세요.',
    other: '출하를 완료하지 못했습니다. [다시 확인]을 누른 뒤 다시 시도하세요.',
  },
};
