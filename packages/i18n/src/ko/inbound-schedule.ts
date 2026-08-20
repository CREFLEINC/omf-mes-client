/**
 * W-01-09 입하 예정 조회. **자재창고 도메인의 첫 화면**이고 조회 전용이라 쓰기 어휘가 하나도 없다.
 *
 * **「ASN」을 사용자 문구에 쓰지 않는다** — 업계 약어라 화면에서는 「입하 예정」으로 쓴다.
 *
 * **「미입하」·「지연」을 쓰지 않는다.** 상태 값 집합이 확정되지 않아 입하 여부를 화면이 판정할 수 없다.
 * 도착 예정일이 지났다는 **사실만** 말한다.
 *
 * **참조 값(공급사·공장·품목·단위)의 표기가 세 갈래다** — 아직 오지 않음 · 목록에 없음 · 불러오기 실패.
 * 셋을 한 문구로 뭉개면 정상 값이 잠깐 「알 수 없음」으로 보여 뜻이 반대로 읽힌다.
 */
export const inboundSchedule = {
  title: '입하 예정 조회',
  breadcrumbRoot: '자재창고',
  panes: {
    list: '입하 예정 목록',
    lines: '선택한 건의 라인',
  },
  fields: {
    periodFrom: '도착 예정일 시작',
    periodTo: '도착 예정일 종료',
    supplier: '공급사',
    status: '상태',
    item: '품목',
    q: '문서번호 검색',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    select: '선택',
    deselect: '선택 해제',
    /*
     * 행 안의 버튼은 보이는 글자가 행마다 같다. 접근 이름에 입하예정번호를 넣어 어느 건인지 밝히되,
     * 보이는 글자를 그대로 담는다 — 담지 않으면 음성 조작이 「선택」으로 이 버튼을 부를 수 없다.
     * **입하예정번호를 쓴다.** 내부 번호를 접근 이름에 넣으면 화면 밖으로 새어 나간다.
     */
    selectRow: (asnNo: string): string => `${asnNo} 선택`,
    deselectRow: (asnNo: string): string => `${asnNo} 선택 해제`,
  },
  /** 비활성 사유·실패 사유는 그 컨트롤이나 대상의 이름으로 시작한다(배치 규범 4). */
  reasons: {
    periodInvalid: '도착 예정일은 있는 날짜여야 합니다. 시작일과 종료일을 다시 고르세요.',
    periodReversed: '도착 예정일 종료는 시작보다 앞설 수 없습니다.',
    /*
     * 이름을 못 불러온 것이지 자료가 없는 것이 아니다 — 둘을 섞으면 목록이 비어 보인다.
     *
     * **문구에 적은 대상과 「다시 시도」가 다시 부르는 대상이 같아야 한다.** 다르면 눌러도
     * 한쪽은 실패인 채로 남는데 문구는 둘 다 고쳐질 것처럼 말한다.
     * 공장은 고른 건의 제목줄에서만 보이므로 아래 구획 안내가 맡는다.
     */
    referencesFailed: '공급사 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
    lineReferencesFailed:
      '품목·단위·공장 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
  },
  loading: {
    asns: '입하 예정 목록을 불러오는 중',
    lines: '라인을 불러오는 중',
  },
  /** 목록 표의 머리글. 열 구성과 폭의 근거는 screens/inbound-schedule/asn-table.tsx에 있다. */
  table: {
    asnNo: '입하예정번호',
    supplier: '공급사',
    expectedArrivalDate: '도착 예정일',
    status: '상태',
    select: '선택',
  },
  /** 라인 표의 머리글. **진행 열과 P/O 라인 열이 없다** — 근거는 asn-line-table.tsx에 있다. */
  lineTable: {
    lineNo: '줄번호',
    item: '품목',
    expectedQty: '예정수량',
    uom: '단위',
    supplierLotNo: '공급사 LOT',
  },
  /** 고른 건의 제목줄. **위 표에 두지 않은 값(공장·비고)이 여기서 보인다.** */
  summary: {
    label: '고른 입하 예정',
    asnNo: '입하예정번호',
    supplier: '공급사',
    plant: '공장',
    expectedArrivalDate: '도착 예정일',
    deliveryNoteNo: '거래명세서번호',
    remarks: '비고',
  },
  /**
   * 조건 줄. 상태 선택지는 조회 결과에서 만들므로 그 한계를 문구가 함께 밝힌다 —
   * ① 아직 확정되지 않은 **임시 목록**이라는 것 ② 이번 결과에 없는 값은 빠진다는 것.
   */
  filters: {
    all: '전체',
    statusNote:
      '상태는 아직 확정되지 않은 임시 목록입니다. 이번 조회 결과에 나온 값으로 만들어, 결과에 없는 값은 목록에 없습니다.',
    /* 기간이 필수가 아니라는 사실은 화면에서 읽혀야 한다 — 비워 두면 「빠뜨렸다」로 읽힌다. */
    periodNote: '도착 예정일 기간은 비워 두어도 조회됩니다.',
    lookupTruncated: '선택지가 앞쪽 일부만 보입니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
    lookupFailed: '선택지를 불러오지 못했습니다.',
    chipSupplier: (value: string): string => `공급사: ${value}`,
    chipStatus: (value: string): string => `상태: ${value}`,
    chipItem: (value: string): string => `품목: ${value}`,
    chipQ: (value: string): string => `문서번호: ${value}`,
    chipRemoveSupplier: '공급사 조건 제거',
    chipRemoveStatus: '상태 조건 제거',
    chipRemoveItem: '품목 조건 제거',
    chipRemoveQ: '문서번호 조건 제거',
  },
  /** 쪽 이동. 번호 목록을 두지 않는 근거는 screens/inbound-schedule/page-nav.tsx에 있다. */
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  empty: {
    noResultTitle: '조건에 맞는 입하 예정이 없습니다',
    noResultDescription: '기간을 넓히거나 조건을 줄인 뒤 다시 조회하세요.',
    /*
     * **조회하지 않은 것을 「없습니다」로 말하지 않는다.** 보낼 수 없는 기간(없는 날짜·뒤집힘)이면
     * 요청 자체가 나가지 않는데, 그때 결과 없음을 내면 사용자가 자료가 없는 줄 알고
     * 조건을 더 넓힌다 — 무엇을 해도 결과가 같다. 사유는 조건 줄이 밝히므로 여기서는
     * 되풀이하지 않고 어디를 고쳐야 하는지만 가리킨다.
     */
    notQueriedTitle: '아직 조회하지 않았습니다',
    notQueriedDescription: '조건 줄의 안내에 따라 도착 예정일을 고친 뒤 조회하세요.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
    noSelectionTitle: '입하 예정을 고르면 라인이 보입니다',
    noSelectionDescription: '위 목록에서 한 건을 골라 「선택」을 누르세요.',
    noLinesTitle: '이 건에는 라인이 없습니다',
    noLinesDescription: '입하 예정에 담긴 품목 줄이 하나도 없습니다.',
  },
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
    /** 이름 목록은 왔는데 그 안에 없다 — **값이 잘못됐다**는 신호다. */
    unknown: '알 수 없음',
    /** 이름 목록이 아직 오지 않았다. 「알 수 없음」으로 쓰면 정상 값이 잘못된 값으로 읽힌다. */
    referenceLoading: '이름 불러오는 중',
    /** 이름 목록 조회가 실패했다. 값이 없는 것과 다르다. */
    referenceFailed: '이름을 불러오지 못했습니다',
    /* 「미입하」라고 쓰지 않는다 — 상태 값 집합을 모르므로 입하 여부를 화면이 판정할 수 없다. */
    overdue: '도착 예정일 경과',
    /*
     * 미사용 참조에 붙이는 표식. **선택지에서 빼지 않는다** — 이 화면은 조회 전용이고
     * ERP 수신본에는 지금은 쓰지 않는 거래처·품목을 참조하는 과거 건이 있다.
     * 빼면 그 건들을 조건으로 찾을 방법이 사라진다. 표식만 붙여 고를 때 알 수 있게 한다.
     */
    inactiveSuffix: ' (미사용)',
  },
  notes: {
    /* 밝히지 않으면 사용자가 「전체가 정렬된 것」으로 읽는다. */
    sortScope:
      '정렬은 지금 보고 있는 쪽 안에서만 적용됩니다. 다른 쪽의 건은 함께 정렬되지 않습니다.',
  },
} as const;
