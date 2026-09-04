/**
 * W-04-06 반품·클레임 입고 등록.
 *
 * 작성 규칙 — 화면 문구에 내부 이슈 번호·업무 구분 번호·설계 문서 위치를 넣지 않는다. 뜻만 옮긴다.
 * 이 화면은 «입고»만 한다 — 판정도 부적합 등록도 다른 화면 몫이라 그 동사를 버튼에 쓰지 않는다.
 */
export const returnReceipt = {
  title: '반품·클레임 입고 등록',
  breadcrumbRoot: '출하',
  /** 상단 상시 안내 — 확정된 출하는 취소되지 않고 이 화면으로 돌아온다. */
  scopeNotice:
    '확정된 출하의 반품·클레임은 여기서 입고합니다. 반품은 보류(Hold)로 들어오고, 재작업/폐기 판정은 판정 의뢰 화면에서 합니다.',
  panes: {
    search: '① 원 출하 찾기',
    receipt: '② 반품 입고',
    lines: '반품 라인',
    outcome: '등록 결과',
  },
  fields: {
    customer: '고객',
    shipDate: '출하일',
    keyword: '검색어',
    shipmentNo: '출하번호',
    shippedAt: '출하일',
    status: '상태',
    items: '품목',
    lots: '원 LOT',
    item: '품목',
    lotNo: '원 LOT',
    shippedQty: '출하',
    returnQty: '반품',
    uom: '단위',
    reason: '반품 사유',
    remarks: '비고',
    warehouse: '입고 창고',
    location: '입고 위치',
    qualityStatus: '품질 상태',
    receiptNo: '입고번호',
    source: '원천',
  },
  all: '전체',
  keywordPlaceholder: '출하번호·LOT 번호',
  codePlaceholder: '기준값 준비 중',
  /** 값 목록이 서버에서 오는 칸이 비었을 때 — 선택지를 지어내지 않는다. */
  codePending: '선택할 기준값이 아직 준비되지 않았습니다',
  lookupLoading: '목록을 불러오는 중입니다',
  lookupFailed: '목록을 불러오지 못했습니다',
  lookupTruncated: '목록이 잘렸습니다. 찾는 값이 없으면 검색어를 좁히세요',
  values: {
    notAvailable: '—',
    unknownLots: 'LOT은 선택하면 보입니다',
  },
  search: {
    periodRequired: '출하일 기간은 비울 수 없습니다',
    periodReversed: '시작일이 종료일보다 늦습니다',
    empty: '조건에 맞는 출하가 없습니다',
    emptyDescription:
      '기간을 넓히거나 검색어를 바꿔 보세요. 원 출하를 못 찾으면 아래에서 직접 입력합니다.',
    beyondLast: '이 쪽은 비어 있습니다. 첫 쪽으로 돌아가세요.',
    loading: '출하를 불러오는 중입니다',
    /** 원 출하를 못 찾는 것이 정상이다 — 막지 않고 길을 낸다. */
    notFoundHint: '원 출하를 못 찾으면 아래에서 직접 입력합니다.',
    lotCount: (count: number): string => `LOT ${String(count)}건`,
  },
  actions: {
    search: '조회',
    reset: '초기화',
    selectRow: (shipmentNo: string): string => `${shipmentNo} 선택`,
    prevPage: '이전',
    nextPage: '다음',
    firstPage: '첫 쪽으로',
    withoutShipment: '원 출하 없이 등록',
    backToSearch: '원 출하 찾기로',
    findLot: 'LOT 찾기',
    removeLine: (lotNo: string): string => `${lotNo} 줄 지우기`,
    submit: '반품 입고 등록',
    cancel: '취소',
    checkOutcome: '결과 확인',
    openDisposition: '판정 의뢰로',
    registerAnother: '다른 반품 등록',
  },
  target: {
    none: '왼쪽에서 원 출하를 고르거나 「원 출하 없이 등록」을 누르세요',
    shipment: (shipmentNo: string): string => `원 출하 ${shipmentNo}`,
    direct: '원 출하 없이 등록 — LOT 번호로 줄을 더합니다',
    detailLoading: '원 출하의 LOT을 불러오는 중입니다',
    noAllocations: '이 출하에는 배분된 LOT이 없습니다. 원 출하 없이 등록하세요.',
  },
  /** 원천은 고정이다 — 출하가 끝난 뒤 돌아오는 입고는 전부 고객 클레임이라 가를 것이 없다. */
  sourceFixed: '원천은 고객 클레임으로 고정됩니다. 입고 유형은 반품 입고입니다.',
  lot: {
    label: 'LOT 번호',
    placeholder: 'LOT 번호를 정확히 입력',
    notFound: (lotNo: string): string => `LOT ${lotNo}을(를) 찾지 못했습니다. 번호를 확인하세요.`,
    alreadyAdded: (lotNo: string): string => `LOT ${lotNo}은(는) 이미 줄에 있습니다.`,
    searching: 'LOT을 찾는 중입니다',
    searchFailed: 'LOT을 찾지 못했습니다. 잠시 뒤 다시 시도하세요.',
    help: '원 출하 수량을 모르므로 반품 수량에 상한이 없습니다.',
  },
  lines: {
    empty: '반품할 LOT이 없습니다',
    qtyPlaceholder: '0이면 제외',
    qtyNotNumber: '숫자로 입력하세요',
    qtyTooSmall: '1 이상 입력하세요',
    qtyExceeds: (max: string): string => `출하 수량 ${max}을(를) 넘을 수 없습니다`,
    noneEntered: '반품 수량을 한 줄 이상 입력하세요',
    /** 분할 반품은 정상이다 — 누계는 계약이 세는 축을 주지 않아 보이지 않는다. */
    partialNote: '같은 LOT을 나눠 반품해도 됩니다. 반품 수량이 비거나 0인 줄은 보내지 않습니다.',
  },
  form: {
    reasonPlaceholder: '선택하지 않음',
    reasonHelp: '순수한 반품 사유만 고릅니다. 값은 공통코드에서 옵니다.',
    remarksHelp: '고객이 말한 내용·상태를 적어 두면 판정에 도움이 됩니다.',
    warehouseHelp: '반품은 불량창고로 우선 입고합니다.',
    warehouseNotDefect:
      '불량창고가 아닙니다. 판정 전 재고가 정상 창고에 섞입니다 — 그래도 등록할 수 있습니다.',
    locationRequired: '입고 위치를 지정해 주세요',
    locationLocked: '입고 위치는 입고 창고를 고른 뒤 고를 수 있습니다',
    locationEmpty: '이 창고에는 등록된 위치가 없습니다',
    qualityFixed: '보류(Hold) 고정 — 판정 전입니다',
    qualityFixedNote: '반품 LOT은 판정이 끝날 때까지 출하·피킹이 막힙니다.',
    effectTitle: '이 등록이 하는 일',
    effectStock: (qty: string, uom: string, warehouse: string): string =>
      `${warehouse} 재고가 ${qty} ${uom} 늘어납니다`.replace(/\s+/g, ' '),
    effectStockUnknown: '반품 수량을 입력하면 늘어날 재고를 보입니다',
    effectHold: 'Lot Status는 보류(Hold)로 들어옵니다 — 출하·피킹이 막힙니다',
    effectDisposition: '재작업/폐기 판정은 판정 의뢰 화면에서 합니다',
    irreversible: '등록한 입고는 이 화면에서 되돌릴 수 없습니다.',
    success: '반품 입고를 등록했습니다',
  },
  lock: {
    noLines: '반품 입고 등록은 반품할 LOT 줄이 있어야 할 수 있습니다.',
    noQty: '반품 입고 등록은 반품 수량을 한 줄 이상 입력해야 할 수 있습니다.',
    lineErrors: '반품 입고 등록은 수량 오류를 고친 뒤 할 수 있습니다.',
    noLocation: '반품 입고 등록은 입고 위치를 지정해야 할 수 있습니다.',
    saving: '반품 입고를 등록하는 중입니다.',
    uncertain:
      '앞선 등록의 결과를 아직 모릅니다. 「결과 확인」으로 다시 읽은 뒤 이어서 하세요 — 그냥 다시 누르면 두 번 들어갈 수 있습니다.',
  },
  outcome: {
    title: '등록된 반품 입고',
    receiptNo: '입고번호',
    lines: (count: number): string => `라인 ${String(count)}건`,
    next: '다음 — 판정 의뢰 화면에서 부적합을 등록하고 판정을 의뢰합니다.',
  },
  page: {
    total: (total: number): string => `총 ${String(total)}건`,
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / ${String(total)}건`,
  },
} as const;
