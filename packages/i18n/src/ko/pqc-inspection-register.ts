/**
 * W-03-11 PQC 검사 등록·조회(관리웹 · omf-all-around#107).
 *
 * 검사 항목·결과 입력·확정의 말은 POP 의 PQC 제품 검사(`pqcInspection`)를 그대로 쓴다 — 같은 판정을
 * 두 자리가 다른 말로 부르지 않는다. 여기에는 목록·화면 틀의 말만 둔다.
 */
export const pqcInspectionRegister = {
  title: 'PQC (공정검사) 조회·판정',
  breadcrumbRoot: '품질 관리',

  queue: {
    heading: '검사 의뢰',
    caption: 'PQC 검사 의뢰 목록',
    pendingOnly: '대기·진행만 보기',
    empty: '조회된 검사 의뢰가 없습니다.',
    /** 빈 목록 아래 안내 — 제목과 함께 `EmptyState` 로 보인다(omf-all-around#171). */
    emptyHint: '검색 조건을 변경하거나 필터를 초기화하세요.',
    unavailable: '목록을 표시할 수 없습니다.',
    loading: 'PQC 검사 의뢰를 불러오는 중입니다.',
  },

  detail: {
    paneLabel: '검사 입력',
    nothingSelected: '왼쪽 목록에서 검사할 의뢰를 고르세요.',
    /** 상세는 목록과 나뉜 한 화면이다(#135 · IQC #133 과 같다) — 경로 셋째 단계와 돌아가기. */
    sectionTitle: '검사 기본 정보',
    backToList: '← 목록',
    leaveUnsaved: '변경사항을 저장하지 않았습니다',
    leaveUnsavedNote: '저장하지 않고 이동하면 입력한 내용이 사라집니다.',
    keepEditing: '계속 작성',
    leaveAnyway: '저장하지 않고 이동',
  },

  /** 목록 조건 줄(#135) — IQC 판정 화면(#133)과 같은 말. */
  filters: {
    item: '품목 검색',
    itemPlaceholder: '품목을 입력하세요',
    itemPick: '선택',
    itemClear: '품목 조건 지우기',
    /** 조건 줄의 「전체」 — 좁히지 않는다는 뜻이다(빈 값과 같은 자리). */
    all: '전체',
    workOrder: '작업지시 검색',
    workOrderPlaceholder: '작업지시를 입력하세요',
    workOrderNotFound: '일치하는 작업지시가 없습니다.',
    workOrderAmbiguous: '여러 작업지시가 맞습니다. 번호를 정확히 입력하세요.',
    workOrderFailed: '작업지시를 찾지 못했습니다. 다시 조회하세요.',
    lotNoRequest: '이 LOT 의 작업지시에 대기 중인 공정검사 의뢰가 없습니다.',
    keyword: '의뢰번호 검색',
    keywordPlaceholder: '의뢰번호를 입력하세요',
    apply: '조회',
    reset: '초기화',
  },

  /** 목록 표 열(#135) — 내부 번호 대신 작업지시 번호 · 품목 이름·코드. */
  columns: {
    skip: '생략',
    lot: '대상 LOT',
    workOrder: '작업지시',
    item: '품목',
    targetQty: '검사 수량',
    status: '상태',
    requestedAt: '의뢰 일시',
  },

  /** 관리웹 상세(#135) — IQC 판정 화면(#133)과 같은 짜임·말. POP 의 말(`pqcInspection`)은 그대로 둔다. */
  web: {
    /** 수량과 판정을 합친 단계(사용자 지시 2026-11-09). */
    mergedHeading: '검사 수량 · 판정', // ui-check-ignore: C-13 사용자 지시 표기(#247)
    /* 입력을 상자 셋으로 — IQC 결과 입력 창과 같다(사용자 시안 2026-11-16 · omf-all-around#274). */
    quantityBox: '검사 수량',
    judgmentBox: '종합 판정',
    autoResult: '자동 판정 결과',
    autoResultHint: '검사 수량과 항목을 입력한 뒤 판정 결과를 확인하세요.',
    /** 생산 실적이 없어 판정을 막을 때(#135) — 관리웹 말. POP 의 말(`pqcInspection.result.noProductionResult`)은 그대로 둔다. */
    noProductionResult: '생산 실적이 없으므로 판정할 수 없습니다.',
    /** 검사기준이 없을 때 「검사 내용」 이름 옆 안내와 입력 칸 안내(#135) — 관리웹 말. POP 의 말(`pqcInspection.noStandard`)은 그대로 둔다. */
    noStandardNote:
      '이 의뢰에는 검사기준이 등록되어 있지 않습니다. 필요 시 검사 내용을 입력하세요.',
    remarksPlaceholder: '검사 내용을 입력하세요.',
    summary: {
      heading: '검사 기본 정보',
      inspectionRequestNo: '의뢰번호',
      workOrder: '작업지시',
      item: '품목',
      targetQty: '총 검사 수량',
      inspectionType: '검사 유형',
      inspectionTypeName: 'PQC (공정검사)',
      plan: '적용 검사 기준',
      noPlan: '미지정',
      lot: '대상 LOT',
      lotMore: (first: string, rest: number): string => `${first} 외 ${String(rest)}건`,
      requestedAt: '의뢰 일시',
    },
    items: {
      /* 상자 제목 · 진행 · 머리(사용자 시안 2026-11-16 · omf-all-around#274). */
      heading: '검사 항목',
      progress: (judged: number, total: number): string =>
        `${String(judged)}/${String(total)} 항목`,
      columns: {
        no: 'No.',
        item: '검사 내용',
        spec: '규격',
        /** 항목마다 한 번 재면 「n1」, 여러 번 재는 항목이 있으면 「측정 결과」(칸 안에 n2 · n3 …). */
        valueSingle: 'n1',
        value: '측정 결과',
        judgment: '판정',
      },
      sampleTag: (sampleNo: number): string => `n${String(sampleNo)}`,
      /** 상 · 하한으로 판정이 저절로 서는 항목 — 값을 넣기 전 판정 칸. */
      autoJudgment: '자동 판정',
      /** 항목 판정 단추 이름 — 모르는 코드는 코드 이름 그대로. */
      judgmentShort: { ACCEPTED: 'OK', REJECTED: 'NG' } as Record<string, string>,
      valueLabel: (item: string, sampleNo: number): string =>
        `${item} ${String(sampleNo)}회차 측정 결과`,
      judgmentLabel: (item: string, sampleNo: number): string =>
        `${item} ${String(sampleNo)}회차 판정`,
      tolerance: (value: number, delta: number): string => `${value} ± ${delta}`,
      target: (value: number): string => `기준값 ${value}`,
      withTarget: (limits: string, value: number): string => `${limits} (기준값 ${value})`,
    },
    quantity: {
      heading: '검사 수량 입력',
      targetQty: '총 검사 수량',
      round: (round: number): string => `${String(round)}회차`,
      inspectedQty: '검사 수량',
      accepted: '합격 수량',
      rejected: '불합격 수량',
      held: '보류 수량',
      entered: '입력 완료',
      remaining: '미입력',
      overBy: (over: string): string => `${over} 초과`,
      overNote: (over: string): string => `검사 수량보다 ${over} 많습니다.`,
      progressLabel: '검사 수량 대비 입력 합계',
    },
    judgment: {
      heading: '판정',
      label: '최종 판정',
      placeholder: '최종 판정을 선택하세요',
    },
    actions: {
      confirm: '판정 확정',
      confirmNote: '판정 확정 후 수정이 불가합니다.',
      confirmed: '판정이 확정되어 수정할 수 없습니다.',
    },
  },
  /**
   * PQC 건별 생략(omf-all-around#212 · 서버 선행 P-152) — OQC 생략 구획과 같은 모양이다. 요청 → 결재(W-03-09) → 실행.
   */
  /** 목록 「생략」 칸의 창(사용자 지시 2026-11-09). */
  skipDialog: {
    approveTitle: 'PQC (공정검사) 생략 승인 처리',
    approved: 'PQC 생략 요청을 승인했습니다.',
    rejected: 'PQC 생략 요청을 반려했습니다.',
    executeTitle: '공정검사를 생략하시겠습니까?',
    executeBody:
      '실행하면 이 작업지시의 남은 공정검사가 생략되고, 검사 대기인 생산 LOT 은 정상이 됩니다.',
    execute: '생략 실행',
  },
  skip: {
    heading: 'PQC (공정검사) 생략 요청',
    steps: ['1. 생략 요청', '2. 승인 처리', '3. 생략 실행'],
    result:
      '요청 후 생략을 승인하면 이 작업지시의 남은 공정검사가 생략되고, 검사 대기인 생산 LOT 은 정상이 됩니다.',
    reason: '생략 사유',
    reasonPlaceholder: '생략 사유를 입력하세요',
    openApproval: '요청 건 승인 처리로 이동',
    currentStep: '현재 단계',
    reasonCount: (count: number): string => `${String(count)}자`,
    reasonRequired: '생략 사유를 입력하세요.',
    openRequest: '생략 요청',
    cancel: '취소',
    request: '생략 승인 요청',
    requesting: '요청하는 중…',
    execute: 'PQC 생략 실행',
    executing: '실행하는 중…',
    requested: 'PQC 생략을 요청했습니다. 결재가 끝나면 여기서 실행하세요.',
    pending: '결재가 아직 진행 중입니다.',
    approved: '생략이 승인됐습니다. 실행하면 이 작업지시의 PQC 가 생략됩니다.',
    rejected: '직전 생략 요청이 반려됐습니다. 다시 요청할 수 있습니다.',
    executed: 'PQC 를 생략했습니다. 검사 대기였던 생산 LOT 은 정상이 됐습니다.',
    skipped: '이 의뢰는 결재 승인으로 PQC 가 생략됐습니다.',
    skippedDefault: '검사 기준이 ‘기본 생략’으로 설정되어 PQC 검사 없이 생산 처리됩니다.',
    loading: '생략 결재 상태를 불러오는 중입니다.',
    loadFailed: '생략 결재 상태를 불러오지 못했습니다.',
  },
};
