export const dispositionDecision = {
  title: '처분 판정 처리',
  breadcrumbRoot: '품질',
  tabs: {
    label: '처분 판정 보기',
    pending: '판정 대기',
    history: '처리 이력',
  },
  panes: {
    list: '판정 대기 목록',
    detail: '선택한 부적합',
    decision: '판정',
    history: '처분 판정 이력',
    lots: '대상 LOT',
    decisions: '판정 이력',
  },
  fields: {
    period: '접수일',
    decidedPeriod: '판정일',
    item: '품목',
    severityCode: '심각도',
    statusCode: '상태',
    nonconformanceNo: '부적합번호',
    openedAt: '접수일',
    qty: '수량',
    description: '설명',
    lotNo: 'LOT',
    uom: '단위',
    qualityStatus: '품질 상태',
    dispositionTypeCode: '처분',
    decisionQty: '수량',
    reason: '사유',
    decidedAt: '판정 일시',
    decidedBy: '판정자',
    remainingQty: '남은 수량',
  },
  all: '전체',
  codePending: '선택할 기준값이 아직 준비되지 않았습니다',
  codePlaceholder: '기준값 준비 중',
  /**
   * G-2 — 처분 유형 코드 값 목록이 확정되지 않아 선택지가 비어 있다.
   * 문구에 내부 이슈 번호를 넣지 않는다(i18n 작성 규칙).
   */
  dispositionPending: '처분 선택지가 아직 준비되지 않아 판정을 저장할 수 없습니다',
  /**
   * 기준값이 아직 없어 코드 값을 날것으로 보이는 항목을 **이름으로 지목한다.**
   * 둘을 묶어 한 문장으로 두면 한쪽만 확정됐을 때 남은 쪽이 사유 없이 남는다.
   */
  scopeWarning: {
    both: '심각도·상태 기준값이 준비되지 않아 코드 값을 그대로 표시합니다. 원문 뜻은 담당자에게 확인하세요.',
    severity:
      '심각도 기준값이 준비되지 않아 코드 값을 그대로 표시합니다. 원문 뜻은 담당자에게 확인하세요.',
    status:
      '상태 기준값이 준비되지 않아 코드 값을 그대로 표시합니다. 원문 뜻은 담당자에게 확인하세요.',
  },
  /**
   * A-11 — 화면이 만들지 않기로 물러난 항목은 **물러난 사실을 적는다.**
   * 조용히 빼면 보는 사람이 「없는 기능」이 아니라 「없는 데이터」로 읽는다.
   */
  withdrawn: {
    decisionProgress:
      '판정 진행(미판정·일부 판정·완료)은 표시하지 않습니다. 부적합 상태만 보입니다.',
    sourceFilter: '원천으로 거르는 기능은 두지 않았습니다. 품목·심각도·상태로 좁히세요.',
  },
  actions: {
    selectRow: (nonconformanceNo: string): string => `${nonconformanceNo} 선택`,
    save: '판정 저장',
    cancel: '취소',
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
  },
  detail: {
    select: '부적합을 선택하세요',
    loading: '부적합 상세 불러오는 중',
    notFound: '부적합을 찾을 수 없습니다',
    notFoundDescription: '목록을 새로 조회한 뒤 다른 부적합을 선택하세요.',
    emptyDescription: '등록된 설명이 없습니다',
    noLots: '대상 LOT이 없습니다',
    /** A-11 — LOT 상태 전이 이력 표가 없어 화면이 물러난 수준을 결과 표 머리에 적는다. */
    transitionHistoryUnavailable:
      '판정으로 바뀐 LOT 상태는 이 표에 남지 않습니다. 현재 상태만 표시합니다.',
  },
  decisions: {
    loading: '판정 이력 불러오는 중',
    empty: '아직 판정된 내역이 없습니다',
    unavailable: '판정 이력을 표시할 수 없습니다',
  },
  remaining: {
    label: '남은 수량',
    /** 서버가 잔량 필드를 내리지 않아 화면이 합계 차로 낸 값임을 밝힌다(L-2 잠정 처리). */
    note: '표시된 남은 수량은 참고값입니다. 저장할 수 있는 수량은 저장할 때 서버가 판정합니다.',
    unknown: '남은 수량을 계산할 수 없습니다',
    settled: '남은 수량이 없습니다. 이 부적합은 판정이 끝났습니다',
  },
  form: {
    dispositionLabel: '처분',
    qtyLabel: '수량',
    qtyHelp: '1 이상, 남은 수량 이하로 입력하세요.',
    reasonLabel: '사유',
    reasonHelp: '이 처분을 정한 근거를 남기세요.',
    qtyRequired: '수량을 입력하세요',
    qtyNotNumber: '수량은 숫자로 입력하세요',
    qtyTooSmall: '수량은 1 이상이어야 합니다',
    qtyOverRemaining: (remaining: string): string =>
      `수량이 남은 수량(${remaining})보다 많습니다. 남은 수량 이하로 입력하세요`,
    reasonRequired: '사유를 입력하세요',
    dispositionRequired: '처분을 선택하세요',
    savingReason: '판정을 저장하는 중입니다',
    uncertainReason: '앞서 보낸 판정의 처리 결과를 먼저 확인해야 합니다',
    forbiddenReason: '판정 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요',
    settledReason: '남은 수량이 없어 더 판정할 수 없습니다',
    selectFirstReason: '먼저 판정할 부적합을 선택하세요',
    reloadDetail: '부적합 상태 다시 확인',
    irreversible: '판정은 되돌릴 수 없습니다',
    success: '판정을 저장했습니다',
  },
  loading: '판정 대기 목록 불러오는 중',
  historyLoading: '처리 이력 불러오는 중',
  empty: {
    title: '조건에 맞는 부적합이 없습니다',
    description: '기간을 넓히거나 다른 조건으로 조회하세요.',
    historyTitle: '조건에 맞는 판정 내역이 없습니다',
    historyDescription: '판정일 기간을 넓혀 다시 조회하세요.',
    beyondTitle: '이 쪽에 표시할 내용이 없습니다',
    beyondDescription: '첫 쪽으로 돌아가 확인하세요.',
  },
  page: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    total: (total: number): string => `전체 ${String(total)}건`,
  },
  values: {
    unknownQty: '—',
    /** 셋의 해법이 서로 다르므로 문구를 가른다(G-3 — 사유는 「어떻게 풀 것인가」를 담는다). */
    periodRequired: '기간을 선택해야 조회할 수 있습니다',
    periodInvalid: '달력에 없는 날짜입니다. 있는 날짜로 고쳐 주세요',
    periodReversed: '시작일이 종료일보다 뒤입니다. 두 날짜를 바꿔 주세요',
  },
} as const;
