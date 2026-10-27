export const qualityApproval = {
  title: '품질 승인 처리',
  breadcrumbRoot: '품질 관리',
  scopeWarning:
    '승인 유형 기준값이 준비되지 않아 나에게 배정된 모든 유형의 요청을 표시합니다. 승인 유형 원문을 확인하세요.',
  fields: {
    approvalTypeCode: '승인 유형',
    statusCode: '상태',
    /** 조회 조건 칸 이름(#144) — 목록·상세의 「상태」와 갈라 쓴다. */
    periodFrom: '상신 시작일 검색',
    periodTo: '상신 종료일 검색',
    q: '요청번호 검색',
    /** 조회 조건 체크 칸(#193) — 지금 내가 결재할 차례인 요청만. */
    myTurnOnly: '내 차례',
    approvalRequestNo: '요청번호',
    requestedByName: '상신자',
    requestedAt: '상신 일시',
    reason: '사유',
    request: '요청번호',
    target: '대상',
    /** 목록 표의 대상 열 머리(#144)·상세의 대상 칸 이름(#186). 확인 창은 「대상」 그대로다. */
    targetLot: '대상 LOT',
    myTurn: '결재 차례',
  },
  /** 탭 줄 오른쪽 상태 칩(#186) — 「결재 대기 3」. 누르면 그 상태만 남고, 다시 누르면 풀린다. */
  statusChips: {
    label: '결재 상태',
    count: (label: string, count: number): string => `${label} ${String(count)}`,
    filterOn: (label: string): string => `${label}만 보기`,
    filterOff: (label: string): string => `${label} 조건 해제`,
  },
  all: '전체',
  datePlaceholder: '날짜를 선택하세요',
  qPlaceholder: '요청번호를 입력하세요',
  /** 승인 유형 코드 → 사용자 용어. 목록 밖 코드는 원문 그대로 보인다(`approvalTypeLabelOf`). */
  typeLabels: {
    CONCESSION: '특채',
    IQC_SKIP: 'IQC (수입검사) 생략',
    OQC_SKIP: 'OQC (출하검사) 생략',
  },
  /** 요청 상태 코드 → 사용자 용어(IQC 생략 화면과 같은 낱말). 색: 대기 주황 · 승인 초록 · 반려 빨강. */
  statusLabels: { PENDING: '결재 대기', APPROVED: '승인', REJECTED: '반려' },
  /** 목록 | 상세 사이 끌기 막대(#186) — 입하 예정 조회와 같은 말. */
  splitter: '끌어서 목록·상세 폭 조절',
  /** 목록 · 상세 배치 고르기(#186) — 「좌우 배치 | 상하 배치」 두 단추. */
  layout: { group: '목록·상세 배치', side: '좌우 배치', stack: '상하 배치' },
  panes: {
    filter: '조회 조건',
    list: '승인 요청 목록',
    detail: '요청 상세',
    progress: '결재 진행',
    reason: '사유 전문',
    target: '승인 대상',
  },
  actions: {
    selectRow: (requestNo: string): string => `${requestNo} 선택`,
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
  },
  detail: {
    noSelectionTitle: '요청을 선택하세요',
    noSelectionDescription: '요청을 선택하면 상세 내용을 확인할 수 있습니다.',
    loading: '승인 요청 상세 불러오는 중',
    notFound: '요청을 찾을 수 없습니다',
    notFoundDescription: '목록을 새로 조회한 뒤 다른 요청을 선택하세요.',
    /** 「전체」·OQC 생략 탭의 승인된 OQC 생략 — 실행 권한이 없을 때(#193). 서버가 W-04-03 권한으로 거른다. */
    /** 특채 요청의 요청 상세 카드 제목과 요청 정보 묶음(#193). */
    concessionTitle: '특채 승인 상세',
    requestInfo: '요청 정보',
    /** 「전체」 탭의 승인된 IQC 생략 — 실행 권한이 없을 때(#186). */
    iqcSkipNoPermission: 'IQC 생략 실행은 「긴급 IQC 생략 한도승인」 화면 권한이 있어야 합니다.',
  },
  /**
   * 승인된 OQC 생략의 실행 구획(#193) — IQC 생략 실행과 같은 모양이다. 승인은 잠금만 풀고(공유계약 J-8) 실행이
   * 그 출하작업지시의 열린 OQC 의뢰를 생략으로 닫는다(omf-all-around#119 · 서버 P-83).
   */
  oqcSkipExecute: {
    heading: 'OQC 생략 실행',
    note: '승인된 요청입니다. 실행하면 이 출하작업지시의 열린 OQC 검사 의뢰를 생략 처리하고, 피킹한 LOT 에 생략 이력을 남깁니다.',
    action: 'OQC 생략 실행',
    dialogTitle: 'OQC 생략을 실행할까요?',
    dialogBody:
      '열린 OQC 검사 의뢰가 생략 처리되어 출하할 수 있게 됩니다. 피킹이 끝나지 않았으면 실행되지 않습니다 — 피킹을 먼저 마치세요.',
    irreversible: '실행한 뒤에는 되돌릴 수 없습니다.',
    done: 'OQC 생략을 실행했습니다',
    executed: '생략 실행 완료 — OQC 검사가 생략 처리되었습니다.',
    /** 한 줄 압축형(#193) — 이름 · 한 줄 요약 · 짧은 단추 · 완료 글. */
    compact: {
      title: 'OQC 생략',
      summary: '열린 검사 의뢰 생략 · LOT 이력 기록',
      action: '실행',
      done: '실행 완료',
    },
    /* 아래 둘은 OQC 에 쓰이지 않는다 — 실행 여부를 읽을 서버 값이 없어 늘 실행 가능으로 선다(#193). */
    checking: '상태를 확인하는 중입니다.',
    notPending: (status: string) => `생략을 실행할 수 없는 상태입니다(상태 ${status}).`,
  },
  condition: {
    title: '연결 조건',
    loading: '연결 조건 불러오는 중',
    none: '연결된 조건 없음',
    unsafe: '연결 조건을 안전하게 특정할 수 없습니다',
    /**
     * ⭐ 부적합 상세를 소유한 화면(처분 판정 처리)으로 나가는 링크의 이름.
     * 버튼이 아니라 링크라 이름이 곧 「어디로 가는가」다 — 사유를 따로 잇지 않는다.
     */
    openNonconformance: '부적합 열기',
    nonconformance: '부적합',
    /** 번호는 계약에서 선택 항목이다 — 없다고 이동까지 막지 않는다. 식별자는 따로 있다. */
    nonconformanceNoUnknown: '부적합번호 미제공',
    concessionNo: '특채번호',
    approvedQty: '승인 수량',
    consumedQty: '사용 수량',
    uom: '단위',
    validity: '유효기간',
    remarks: '비고',
    workOrder: '허용 작업지시',
    process: '허용 공정',
    customer: '허용 고객',
    usableLabel: '사용 가능 여부',
    usable: '사용 가능',
    unusable: '사용 불가',
    usableUnknown: '사용 가능 여부 미제공',
    concessionNoUnknown: '특채번호 미제공',
    remarksEmpty: '등록된 비고가 없습니다',
    openEnded: '종료일 없음',
    unrestricted: '제한 없음',
    /** 특채 승인 상세 카드(#193)의 묶음 이름 — 수량 요약 · 사용 조건 · 적용 제한 · 연관 부적합. */
    remainingQty: '잔여 수량',
    usageTitle: '사용 조건',
    limits: '적용 제한',
    limitWorkOrder: '작업지시',
    limitProcess: '공정',
    limitCustomer: '고객',
    limitsNone: '작업지시 · 공정 · 고객 모두 제한 없음',
    nonconformanceHeading: '연관 부적합',
    /** 다른 화면으로 여는 줄(#193) — 대상 LOT 은 LOT 상태, 허용 작업지시는 W/O 진행현황에서 연다. */
    lotHeading: '대상 LOT',
    lotNoUnknown: 'LOT 번호 미제공',
    openLot: 'LOT 열기',
    workOrderHeading: '허용 작업지시',
    openWorkOrder: '작업지시 열기',
    reference: {
      loading: '참조 이름 불러오는 중',
      failed: '참조 이름 조회 실패',
      unknown: '참조 이름을 확인할 수 없음',
      truncated: '참조 목록이 잘려 이름을 확인할 수 없음',
    },
  },
  progress: {
    steps: '결재 단계',
    position: (current: number, total: number): string =>
      `${String(current)} / ${String(total)} 단계`,
    myTurn: '결재할 차례입니다',
    notMyTurn: '지금 이 요청을 결재할 차례가 아닙니다',
    waitingPending: '대기',
    /** 끝난 요청의 상태 카드 제목(#193). 결재 대기는 「결재 진행」(panes.progress)이다. */
    resultTitle: '결재 결과',
    /** 끝난 단계 아래 결재 의견 줄의 이름 — 「결재 사유: …」. */
    decisionComment: '결재 사유',
    noSteps: '표시할 결재 단계가 없습니다',
    loading: '결재 진행 불러오는 중',
    unavailable: '결재 진행을 표시할 수 없습니다',
  },
  approval: {
    title: '승인 처리',
    commentLabel: '결재 사유',
    commentHelp: '반려 또는 승인 사유를 입력하세요',
    commentRequired: '승인 사유를 입력하세요',
    commentHeading: '승인 사유',
    rejectCommentRequired: '반려 사유를 입력하세요',
    rejectCommentHeading: '반려 사유',
    approve: '승인',
    reject: '반려',
    dialogTitle: '승인 확인',
    rejectDialogTitle: '반려 확인',
    notMyTurnReason: '지금은 내 결재 차례가 아닙니다',
    savingReason: '결재 요청을 처리하는 중입니다',
    uncertainOtherTarget: '앞서 보낸 승인 요청의 상태를 먼저 확인해야 합니다',
    conditionRequired: '안전하게 확인된 연결 조건 1건이 필요합니다',
    deliveryUnknown: '서버 적용 여부를 확인할 수 없습니다',
    reloadTarget: '승인 대상 상세 다시 확인',
    stateOnly: '승인은 상태만 해제합니다',
    irreversible: '승인은 되돌릴 수 없습니다',
    success: '승인이 완료되었습니다',
    rejectStateOnly: '반려는 상태만 변경합니다',
    rejectIrreversible: '반려는 되돌릴 수 없습니다',
    rejectSuccess: '반려가 완료되었습니다',
  },
  loading: '승인 요청 목록 불러오는 중',
  empty: {
    title: '조건에 맞는 승인 요청이 없습니다',
    description: '조건을 줄이거나 켜 둔 상태 칩을 풀어 보세요.',
    beyondTitle: '이 쪽에 표시할 요청이 없습니다',
    beyondDescription: '첫 쪽으로 돌아가 요청을 확인하세요.',
  },
  page: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    total: (total: number): string => `전체 ${String(total)}건`,
  },
  values: {
    unknownTarget: '대상 이름 없음',
    unknownRequester: '상신자 이름 없음',
    emptyReason: '등록된 사유가 없습니다',
    unknownApprover: '결재자 이름 없음',
    myTurn: '내 차례',
  },
} as const;
