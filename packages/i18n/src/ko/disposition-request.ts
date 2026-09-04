/**
 * W-04-07 재작업/폐기 판정 의뢰.
 *
 * 작성 규칙 — 화면 문구에 내부 이슈 번호·업무 구분 번호·설계 문서 위치를 넣지 않는다. 뜻만 옮긴다.
 * 이 화면은 «의뢰»만 한다 — 판정은 품질 화면 몫이라 「판정」이라는 동사를 버튼에 쓰지 않는다.
 */
export const dispositionRequest = {
  title: '재작업/폐기 판정 의뢰',
  breadcrumbRoot: '출하',
  /** 상단 상시 안내 — 이 화면에서 «하지 않는 것»을 먼저 말한다. 안 적으면 판정 버튼을 찾는다. */
  scopeNotice: '판정은 품질 화면에서 합니다. 여기서는 부적합을 등록하고 판정을 의뢰합니다.',
  panes: {
    list: '판정 대기 대상',
    target: '선택한 대상',
    register: '① 부적합 등록',
    request: '② 판정 의뢰',
    result: '③ 결과 수신 후',
    progress: '진행 단계',
    decisions: '처분 목록',
  },
  fields: {
    warehouse: '창고',
    sourceCode: '원천',
    stage: '상태',
    keyword: '검색어',
    lotNo: 'LOT',
    item: '품목',
    qty: '수량',
    uom: '단위',
    receiptNo: '입고번호',
    receivedAt: '입고일',
    partner: '거래처',
    inspectionResult: '검사 결과',
    nonconformanceNo: '부적합 번호',
    severity: '심각도',
    description: '내용',
    department: '담당 부서',
    requestedQty: '의뢰 수량',
    remarks: '비고',
    dispositionType: '처분',
    decisionQty: '수량',
    reason: '사유',
    decidedAt: '판정 일시',
  },
  all: '전체',
  none: '없음',
  keywordPlaceholder: 'LOT 번호·입고번호·품목',
  /** 값 목록이 서버에서 오는 칸이 비었을 때 — 선택지를 지어내지 않는다. */
  codePending: '선택할 기준값이 아직 준비되지 않았습니다',
  codePlaceholder: '기준값 준비 중',
  warehousePending: '불량창고 목록이 아직 없습니다. 창고를 거르지 않고 조회합니다.',
  values: {
    sourceCode: {
      RETURN: '반품',
      PRODUCT: '제품(OQC 불합격)',
    },
    /** 진입 목록의 배지 넷 — 한 목록에서 나온다(스펙 §5-7). */
    stage: {
      NONE: '부적합 없음',
      NOT_REQUESTED: '의뢰 전',
      PENDING_DECISION: '판정 대기',
      DECIDED: '판정 완료',
    },
    dispositionType: {
      REWORK: '재작업',
      SCRAP: '폐기',
      NORMAL: '정상',
    },
    unknownQty: '—',
    notAvailable: '—',
  },
  /** 상태 필터의 세 갈래(의뢰 전·판정 대기·판정 완료)는 부적합 목록에서 온다 — 대상이 아니라 부적합 단위다. */
  stageSourceNote: '의뢰 전·판정 대기·판정 완료는 등록된 부적합 기준으로 조회합니다.',
  loading: '판정 대기 대상 불러오는 중',
  empty: {
    title: '판정을 기다리는 대상이 없습니다',
    description: '조건을 바꾸거나 창고를 넓혀 보세요.',
    beyondTitle: '이 쪽에는 대상이 없습니다',
    beyondDescription: '조건에 맞는 대상은 있지만 이 쪽에는 없습니다. 첫 쪽으로 돌아가세요.',
  },
  page: {
    label: '판정 대기 대상 쪽 이동',
    total: (total: number): string => `총 ${String(total)}건`,
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / ${String(total)}건`,
  },
  actions: {
    selectRow: (lotNo: string): string => `${lotNo} 선택`,
    register: '부적합 등록',
    request: '판정 의뢰',
    cancel: '취소',
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
    checkOutcome: '처리 결과 확인',
    openDecision: '판정 결과 보기',
    reworkResult: '재작업 실적 등록',
    disposalRequest: '폐기 품의',
    reinstate: '재고 재등록',
  },
  target: {
    select: '왼쪽 목록에서 대상을 선택하세요',
    loading: '부적합 상세 불러오는 중',
    notFound: '부적합을 찾을 수 없습니다',
    notFoundDescription: '목록을 새로 조회한 뒤 다른 대상을 선택하세요',
    /** 원천 갈래별 머리 — 반품은 입고 전표, 제품은 검사 결과가 근거다. */
    returnSource: '반품 입고',
    productSource: 'OQC 불합격',
    lotCount: (count: number): string => `LOT ${String(count)}건`,
  },
  progress: {
    register: '부적합 등록',
    request: '판정 의뢰',
    decide: '판정 (품질 화면)',
    followUp: '후속 처리',
  },
  register: {
    severityLabel: '심각도',
    severityPlaceholder: '심각도를 고르세요',
    descriptionLabel: '내용',
    /** A-12 — 판정자가 이 문장만 읽고 정한다. 형식을 화면이 유도한다. */
    descriptionHelp:
      '무엇이 · 어디가 · 얼마나 잘못됐는지 적어 주세요. 예) 외관 스크래치 · 상단 모서리 · 200개 중 40개 육안 확인',
    descriptionRequired: '무엇이 잘못됐는지 적어 주세요',
    descriptionShort: '판정자가 이 문장만 보고 정합니다. 조금 더 구체적으로 적으면 좋습니다',
    severityRequired: '심각도를 고르세요',
    departmentLabel: '담당 부서',
    departmentNone: '지정하지 않음',
    /** 원천은 묻지 않는다(스펙 §5-1-1) — 서버가 입고 유형으로 정한다는 사실을 읽기 표시 옆에 둔다. */
    sourceDerived: '원천은 서버가 입고 유형으로 정합니다. 여기서 고르지 않습니다.',
    qtyNote: (qty: string, uom: string): string =>
      `대상 수량 ${qty} ${uom} 전량을 부적합 대상으로 등록합니다.`,
    success: '부적합을 등록했습니다',
    irreversible: '등록한 부적합은 지울 수 없습니다.',
    lock: {
      noTarget: '부적합 등록은 대상을 고른 뒤에 할 수 있습니다.',
      alreadyRegistered: (nonconformanceNo: string): string =>
        `부적합 등록은 이미 끝났습니다 (${nonconformanceNo}). 아래에서 판정을 의뢰하세요.`,
      severityPending: '부적합 등록은 심각도 기준값이 준비되면 할 수 있습니다.',
      noLot: '부적합 등록은 LOT이 하나인 대상에서만 할 수 있습니다.',
      saving: '등록 중입니다.',
      uncertain: '앞선 등록의 결과를 아직 확인하지 못했습니다. 결과를 확인한 뒤 진행하세요.',
    },
  },
  request: {
    qtyLabel: '의뢰 수량',
    qtyHelp: (max: string, uom: string): string => `1 이상 ${max} ${uom} 이하로 입력하세요.`,
    qtyRequired: '의뢰 수량을 입력하세요',
    qtyNotNumber: '의뢰 수량은 숫자로 입력하세요',
    qtyTooSmall: '의뢰 수량은 1 이상이어야 합니다',
    qtyExceeds: (max: string): string => `대상 수량 ${max}을(를) 넘을 수 없습니다`,
    remarksLabel: '비고',
    remarksHelp: '판정자에게 함께 전할 말이 있으면 적으세요.',
    /** 의뢰하면 무엇이 일어나는지 — 품질 화면으로 넘어가고 결과가 돌아온다(스펙 §3 ②). */
    afterNote: '의뢰하면 품질 화면으로 넘어가고, 판정 결과가 이 화면으로 돌아옵니다.',
    success: '판정을 의뢰했습니다',
    irreversible: '의뢰는 되돌릴 수 없습니다.',
    lock: {
      noTarget: '판정 의뢰는 대상을 고른 뒤에 할 수 있습니다.',
      noNonconformance: '판정 의뢰는 부적합을 먼저 등록해야 할 수 있습니다.',
      loading: '부적합 상세를 불러오는 중입니다.',
      loadFailed: '부적합 상세를 불러오지 못해 판정을 의뢰할 수 없습니다.',
      alreadyRequested: '이미 의뢰했습니다. 판정 대기 중입니다.',
      decided: '판정이 끝난 부적합입니다. 다시 의뢰하지 않습니다.',
      unknownStage: (statusCode: string): string =>
        `부적합 상태(${statusCode})를 판정할 수 없어 의뢰를 막았습니다.`,
      saving: '의뢰 중입니다.',
      uncertain: '앞선 의뢰의 결과를 아직 확인하지 못했습니다. 결과를 확인한 뒤 진행하세요.',
    },
    /** 저장 409의 구조화 문구 — 서버 `message` 원문을 그대로 옮기지 않는다. */
    conflict: {
      invalidState: '부적합 상태가 바뀌어 의뢰할 수 없습니다. 다시 불러온 뒤 확인하세요.',
      qtyExceeded: '의뢰할 수 있는 수량을 넘었습니다. 다시 불러온 뒤 수량을 확인하세요.',
    },
  },
  result: {
    loading: '처분 목록 불러오는 중',
    empty: '아직 판정 결과가 없습니다',
    pending: '판정 대기 중입니다. 결과가 오면 여기에 보입니다.',
    notRequested: '아직 의뢰하지 않았습니다.',
    unavailable: '처분 목록을 표시할 수 없습니다',
    /** 부분 처분이 정상이다(스펙 §5-5) — 여러 행이 올 수 있음을 머리에 적는다. */
    partialNote: '한 부적합에 처분이 여러 건일 수 있습니다. 처분마다 후속이 다릅니다.',
    approvalPending: '결재 진행 중',
    /** 후속 버튼의 비활성 사유 — 규범 4: 컨트롤 이름으로 시작하고 풀리는 조건을 함께 적는다. */
    followUp: {
      reworkUnavailable:
        '재작업 실적 등록은 현장 단말 화면에서 합니다. 이 화면에서는 열 수 없습니다.',
      reworkNotDecided: '재작업 실적 등록은 재작업 처분이 내려지면 할 수 있습니다.',
      disposalUnavailable:
        '폐기 품의 화면이 아직 준비되지 않았습니다. 준비되면 이 버튼을 쓸 수 있습니다.',
      disposalNotDecided: '폐기 품의는 폐기 처분이 내려지면 할 수 있습니다.',
      reinstateUnavailable:
        '재고 재등록 화면이 아직 준비되지 않았습니다. 준비되면 이 버튼을 쓸 수 있습니다.',
      reinstateNotDecided: '재고 재등록은 정상 처분이 내려지면 할 수 있습니다.',
      openDecisionUnavailable: '판정 결과 보기는 부적합을 등록한 뒤에 할 수 있습니다.',
    },
  },
} as const;
