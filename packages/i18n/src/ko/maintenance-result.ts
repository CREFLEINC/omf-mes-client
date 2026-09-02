/**
 * W-05-06 보전 실적·예비품 출고 — 보전을 어떻게 했고 무엇을 썼는지 적는다.
 *
 * ⛔ **이 화면은 물건을 움직이지도 상태를 바꾸지도 않는다.** 출고는 물류가 만든 것을 참조만
 * 하고, 설비 상태도 건드리지 않는다. 그래서 문구가 「여기서 하지 않는 일」을 분명히 말한다.
 */
export const maintenanceResult = {
  title: '보전 실적·예비품',
  breadcrumbRoot: '설비/툴',

  panes: {
    filters: '조회 조건',
    list: '실적 목록',
    form: '실적 등록',
  },

  filters: {
    order: '보전 지시',
    period: '시작 기간',
    all: '전체',
    search: '조회',
    reset: '초기화',
    periodInvalid: '달력에 없는 날짜입니다. 시작일과 종료일을 다시 고르세요.',
    periodReversed: '종료일이 시작일보다 앞섭니다. 두 날짜를 바꿔 주세요.',
  },

  table: {
    startedAt: '시작',
    finishedAt: '종료',
    target: '대상',
    order: '지시',
    performer: '수행',
    closed: '마감',
    parts: '예비품',
    notAvailable: '—',
    ongoing: '진행 중',
    partCount: (count: number): string => `${String(count)}건`,
    emptyTitle: '실적이 없습니다',
    empty: '조건에 맞는 실적이 없습니다. 조건을 줄이거나 기간을 넓혀 보세요.',
    beyondLastTitle: '이 쪽에는 실적이 없습니다',
    beyondLast: '조건에 맞는 실적은 있지만 이 쪽에는 없습니다. 첫 쪽으로 돌아가세요.',
    firstPage: '첫 쪽으로',
  },

  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
    prev: '이전',
    next: '다음',
  },

  form: {
    /** ⛔ 이 화면이 하지 않는 일을 먼저 말한다. */
    scopeLead:
      '이 화면은 보전을 어떻게 했는지 적는 자리입니다. 예비품 출고를 만들지 않고 재고를 깎지도 않으며, 설비 상태도 바꾸지 않습니다.',
    target: '대상 설비',
    order: '보전 지시',
    orderNone: '지시 없이 처리',
    orderNote: '지시 없이도 적을 수 있습니다 — 현장에서 이미 조치한 건이 있습니다.',
    startedAt: '시작 시각',
    finishedAt: '종료 시각',
    finishedAtNote: '아직 끝나지 않았으면 비워 두세요.',
    resultNote: '실적 내용',
    performer: '수행자',
    outsourced: '외주 보전',
    vendorName: '외주 업체',
    /** ⛔ 거래처 마스터를 가리키지 않는다 — 등록을 강제하면 실적을 못 적는다. */
    vendorNote:
      '거래처 마스터에서 고르지 않고 직접 적습니다. 보전 업체는 구매 협력사로 등록돼 있지 않을 수 있습니다.',
    closed: '지시 마감',
    closedNote: '지시를 마감하면 이 실적으로 지시가 닫힙니다.',
    /** ⚠ 항목별 결과 값 목록이 없어 항목을 적을 수 없고, 그래서 마감 판정도 성립하지 않는다. */
    linesLocked:
      '항목·부위별 결과의 값 목록이 아직 등록되지 않아 항목을 적을 수 없습니다. 값이 등록되면 열립니다.',

    parts: '쓴 예비품',
    partsLead:
      '물류가 만든 출고 건을 골라 잇습니다. 여기서 출고를 만들지 않고 재고도 깎지 않습니다.',
    /** ⚠ 예비품에는 LOT 번호가 없다 — 자재 LOT은 입하에서 만들어진다. */
    partsNoLot: '예비품에는 LOT 번호가 없습니다. 코드와 명칭, 수량만 적습니다.',
    /** 예비품 마스터의 속성이 아직 정해지지 않았다. */
    partsMasterNote: '예비품 마스터에 규격·재고 기준이 아직 없어 코드와 명칭만 보입니다.',
    part: '예비품',
    usedQty: '사용 수량',
    goodsIssue: '연결 출고 건',
    goodsIssueNone: '연결하지 않음',
    addPart: '예비품 더하기',
    removePart: '빼기',

    submit: '실적 저장',
    reset: '입력 지우기',
    requiredTarget: '대상 설비를 고르세요.',
    requiredStartedAt: '시작 시각을 고르세요.',
    requiredResultNote: '실적 내용을 적으세요.',
    requiredPerformer: '수행자를 고르세요.',
    requiredVendor: '외주 업체를 적으세요.',
    /** ⭐ 짝 제약 — 계약이 「화면이 진다」로 넘겼다. */
    outsourcedPerformer: '외주 보전에는 수행자를 비웁니다. 업체와 담당자는 실적 내용에 적으세요.',
    invalidFinishedAt: '종료 시각이 시작 시각보다 앞섭니다. 두 시각을 다시 고르세요.',
    requiredPartQty: '사용 수량은 0보다 커야 합니다.',
    duplicatePart: '같은 예비품을 두 번 적었습니다. 한 줄로 합치세요.',

    lookupFailed: (name: string): string =>
      `${name} 목록을 불러오지 못해 지금은 고를 수 없습니다. 다시 시도해 주세요.`,
    lookupTruncated: '목록의 일부만 보입니다. 찾는 값이 없으면 담당자에게 문의하세요.',
    selectPlaceholder: '고르세요',
  },
} as const;
