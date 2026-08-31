/**
 * W-04-08 완제품 재고·Lot Status 조회. 조회 전용이라 쓰기 어휘가 없다.
 *
 * **W-01-07(재고 현황·상태 조회)의 축소판이 아니라 다른 계약 형편에 선 화면이다** — 이
 * 화면이 쓰는 `/inventory/balances` 응답은 창고·품목·LOT·소유처 이름을 전부 내부 번호로만
 * 준다(W-01-07이 이름 인라인을 요청한 계약 개선이 이 클라이언트가 생성한 API 타입에는
 * 아직 반영되지 않았다 — 실행 보고서 참고). 그래서 이 화면도 이름을 풀 참조가 필요하고,
 * 「알 수 없음」·「이름 불러오는 중」 같은 표기 갈래를 W-01-07과 같은 말로 쓴다.
 *
 * **요약 집계(품목수·LOT수·보유·가용·보류 합계)는 지금 이 화면이 받을 수 없다** — 계약에
 * `summary`가 있으나 이 API 타입에는 없다. 전부 「불러올 수 없음」 표식과 안내로 대신한다.
 */
export const productStockStatus = {
  title: '완제품 재고·Lot Status 조회',
  breadcrumbRoot: '출하',
  panes: {
    list: '재고 잔액 목록',
    /** LOT을 고르면 목록 아래에 여는 구획이다. 드로어도 창도 아니다 — 목록이 계속 보인다. */
    detail: 'LOT 상세',
  },
  fields: {
    warehouse: '창고',
    item: '품목',
    groupBy: '묶기',
    availableOnly: '가용만',
  },
  /** 「묶기」 선택지. 값은 주소 키 `view`와 같다. */
  views: {
    item: '품목별',
    lot: 'LOT별',
    location: '위치별',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    refresh: '새로고침',
    select: '상세',
    deselect: '선택 해제',
    /* 접근 이름에 LOT 이름을 넣는다 — 「선택」이 행마다 되풀이되면 어느 줄인지 알 수 없다. */
    selectRow: (lotName: string): string => `${lotName} 선택`,
    deselectRow: (lotName: string): string => `${lotName} 선택 해제`,
    lotStatusLink: 'Lot Status 화면에서 보기',
  },
  reasons: {
    warehouseRequired: '창고를 고른 뒤 조회합니다. 이 화면은 한 창고의 재고를 봅니다.',
    lotViewNeedsItem: 'LOT별 묶기는 품목을 고른 뒤에 열립니다. LOT 이름을 품목 범위에서 풉니다.',
    filterReferencesFailed:
      '창고·품목 이름을 불러오지 못했습니다. 선택지 자리에 사유가 표시됩니다.',
    listReferencesFailed:
      '품목·LOT·위치 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
  },
  loading: {
    balances: '재고 잔액을 불러오는 중',
    lotDetail: 'LOT 상세를 불러오는 중',
  },
  table: {
    item: '품목',
    lot: 'LOT',
    location: '위치',
    onHandQty: '보유',
    availableQty: '가용',
    availableRatio: '가용률',
    blockedQty: '보류',
    qualityStatus: '품질 상태',
    inventoryStatus: '재고 상태',
    select: '상세',
  },
  groupHeader: {
    item: (name: string): string => `품목: ${name}`,
    location: (name: string): string => `위치: ${name}`,
  },
  filters: {
    all: '전체',
    lookupTruncated: '선택지가 앞쪽 일부만 보입니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
    lookupFailed: '선택지를 불러오지 못했습니다.',
    chipWarehouse: (value: string): string => `창고: ${value}`,
    chipItem: (value: string): string => `품목: ${value}`,
    chipAvailableOnly: '가용만',
    chipRemoveWarehouse: '창고 조건 제거',
    chipRemoveItem: '품목 조건 제거',
    chipRemoveAvailableOnly: '가용만 조건 해제',
  },
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  empty: {
    notQueriedTitle: '아직 조회하지 않았습니다',
    notQueriedDescription: '조건 줄에서 창고를 고른 뒤 조회하세요.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
    noResultTitle: '조건에 맞는 재고가 없습니다',
    noResultDescription: '조건을 줄인 뒤 다시 조회하세요.',
    noSelectionTitle: '고른 LOT이 없습니다',
    noSelectionDescription: '위 표에서 LOT을 고르면 해제되지 않은 보류가 여기에 보입니다.',
  },
  values: {
    empty: '—',
    negativeOnHand: '음수 보유',
    heldLotCount: (count: number): string => `보류 LOT ${String(count)}건`,
    /** 가용률을 계산할 수 없을 때(보유가 0 이하) — 지어내지 않고 계산 불가를 표시한다. */
    availableRatioUnavailable: '계산 불가',
  },
  notes: {
    groupScope: '그룹은 지금 보고 있는 쪽 안에서만 묶입니다. 다른 쪽의 행은 함께 묶이지 않습니다.',
  },
  /**
   * 요약 구획 — 지금은 전부 「불러올 수 없음」이다. 계약에는 `summary`가 있으나
   * 이 화면이 쓰는 API 타입에는 아직 실려 있지 않다(실행 보고서 참고).
   */
  summary: {
    title: '요약',
    itemCount: '품목수',
    lotCount: 'LOT수',
    onHandQty: '보유 합계',
    availableQty: '가용 합계',
    blockedQty: '보류 합계',
    unavailableMark: 'ⓘ',
    unavailable:
      '품목수·LOT수·보유·가용·보류 합계는 지금 이 화면이 받을 수 없습니다. 계약이 정한 요약 집계가 이 화면의 조회에는 아직 연결되지 않았습니다.',
  },
  detail: {
    heading: (label: string): string => `LOT ${label}`,
    holds: {
      title: '해제되지 않은 보류',
      reason: '사유',
      status: '상태',
      heldAt: '보류 시각',
      releaseCondition: '해제 조건',
      emptyTitle: '해제되지 않은 보류가 없습니다',
      emptyDescription: '이 LOT에 걸린 보류가 없거나 모두 해제되었습니다.',
    },
  },
  asOf: (at: string): string => `기준 ${at}`,
} as const;
