export const dispositionDecision = {
  title: '부적합 처분 관리',
  breadcrumbRoot: '품질 관리',
  /** 탭 줄 오른쪽 상태 칩 — 「판정 대기 3」. 건수를 아직 모르면 이름만(#223). */
  statusChip: (label: string, count: number | undefined): string =>
    count === undefined ? label : `${label} ${String(count)}`,
  /** 조회 조건의 상세 펼치기 — 심각도 · 원천(사용자 지시 · #223). */
  filterDetail: { open: '상세 펼치기', close: '상세 접기' },
  tabs: {
    label: '처분 판정 보기',
    pending: '처분 대기',
    history: '처분 이력',
    /** 탭 줄 칩 — 「처분 대기 3」(#223). 건수를 아직 모르면 이름만. */
    pendingCount: (count: number | undefined): string =>
      count === undefined ? '처분 대기' : `처분 대기 ${String(count)}`,
    historyCount: (count: number | undefined): string =>
      count === undefined ? '처분 이력' : `처분 이력 ${String(count)}`,
  },
  panes: {
    filter: '조회 조건',
    list: '처분 대기 목록',
    detail: '선택한 부적합',
    detailDecision: '부적합 상세 및 판정',
    /** 처분 이력 탭의 오른쪽 구획 — 판정 입력 없이 보기만(#223). */
    historyDetail: '부적합 상세',
    decision: '판정',
    history: '처분 판정 이력',
    lots: '대상 자재 관리 LOT',
    decisions: '처분 이력',
  },
  fields: {
    /** 조회 조건 선택칸 이름 — 「…선택」(사용자 지시 · #223). */
    severityPick: '심각도 선택',
    sourcePick: '원천 선택',
    period: '접수일',
    openedFrom: '접수 시작일',
    openedTo: '접수 종료일',
    decidedPeriod: '판정일',
    decidedFrom: '판정 시작일',
    decidedTo: '판정 종료일',
    /** 처분 이력 목록 열 이름(#223). */
    historyType: '처분 유형',
    historyQty: '처분 수량',
    historyReason: '판정 사유',
    item: '품목',
    severityCode: '심각도',
    statusCode: '처리 상태',
    sourceCode: '원천',
    nonconformanceNo: '부적합번호',
    openedAt: '접수일',
    qty: '수량',
    description: '설명',
    lotNo: 'LOT 번호',
    uom: '단위',
    qualityStatus: '품질 상태',
    dispositionTypeCode: '처분',
    decisionQty: '수량',
    reason: '사유',
    decidedAt: '판정 일시',
    decidedBy: '판정자',
    remainingQty: '남은 수량',
    dispositionProgressCode: '판정 현황',
  },
  all: '전체',
  codePending: '선택할 기준값이 아직 준비되지 않았습니다',
  codePlaceholder: '기준값 준비 중',
  /** 심각도·상태 선택지는 공통코드 조회가 채운다 — 못 채운 사유를 갈래별로 밝힌다(G-2 · 규범 4). */
  codeLock: {
    loading: '기준값을 불러오는 중입니다',
    failed: '기준값을 불러오지 못했습니다. 다시 조회해 주세요',
    empty: '등록된 기준값이 없습니다. 공통코드에 값이 서야 고를 수 있습니다',
  },
  codeTruncated: '기준값 일부만 받았습니다. 목록에 없는 값은 고를 수 없습니다',
  /** 주입된 코드 목록이 비어 있을 때의 방어 문구. 기본 목록은 고정 OpenAPI enum으로 채워져 있다. */
  dispositionPending: '처분 선택지가 아직 준비되지 않아 판정을 저장할 수 없습니다',
  /**
   * 원천 칸에 상시 붙는 안내 — **비어 있어서가 아니라 축의 범위가 좁아서** 다는 것이다.
   * 그래서 값 목록이 없을 때 다는 `codePending`과 자리가 다르다.
   *
   * ⚠ 설계 원문은 업무 구분 번호를 앞에 달았으나(「04 제품·04 반품」) 화면 문구에는 내부
   * 구성을 드러내지 않는다(이 파일 머리의 작성 규칙) — 뜻을 그대로 두고 번호만 걷었다.
   */
  actions: {
    save: '판정 저장',
    cancel: '취소',
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
  },
  detail: {
    select: '목록에서 판정할 부적합을 선택하세요.',
    /** 처분 이력 탭 — 고르기 전 안내(#223). */
    selectHistory: '목록에서 볼 처분 이력을 선택하세요.',
    /** 고르기 전 소제목 — 두 탭 같다(omf-all-around#228). */
    selectHint: '선택한 부적합의 상세 정보가 표시됩니다.',
    loading: '부적합 상세 불러오는 중',
    notFound: '부적합을 찾을 수 없습니다',
    notFoundDescription: '목록을 새로 조회한 뒤 다른 부적합을 선택하세요.',
    emptyDescription: '등록된 설명이 없습니다',
    noLots: '대상 자재 관리 LOT 이 없습니다',
    /** 기본 정보의 대상 수량 칸(사용자 시안 · #223). */
    affectedQty: '대상 수량',
  },
  decisions: {
    /** 접는 머리의 건수 — 「판정 이력 0건」(사용자 시안 · #223). */
    count: (count: number): string => `${String(count)}건`,
    loading: '판정 이력 불러오는 중',
    empty: '처분 이력이 없습니다.',
    unavailable: '판정 이력을 표시할 수 없습니다',
  },
  /** 특채(omf-all-around#84 · 서버 선행 P-79) — 불합격 LOT 을 결재 뒤 조건부로 쓴다. */
  concession: {
    /** 접는 머리 — 「특채 요청 및 이력 0건」(사용자 시안 · #223). */
    foldTitle: '특채 요청 이력',
    count: (count: number): string => `${String(count)}건`,
    /** 요청 구역 머리 — 제목 왼쪽, 한 줄 설명 오른쪽(사용자 시안 · #223). */
    requestHeading: '특채 요청',
    requestNote: '불합격 입하 LOT 의 조건부 사용 승인을 요청합니다 — 한도 승인도 이 길로',
    /** 005 FR-038 — 전량 특채(남은 수량 고정 · 일부 특채 없음). 자재 관리 LOT 이 여럿이면 `lotId` 없이 요청한다(D-14). */
    target: '대상',
    /** 「자재 관리 LOT n개 전부」를 앞에 — 읽기 전용 칸이 좁아 뒤가 잘려 보이지 않았다(G2 L13). */
    targetAll: (inboundLotNo: string | null, count: number): string =>
      `자재 관리 LOT ${String(count)}개 전부${inboundLotNo === null ? '' : ` · 입하 LOT ${inboundLotNo}`}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    qtyLocked: '남은 수량 전부 — 바꿀 수 없음',
    wholeHint:
      '특채는 남은 수량 전부만 요청합니다(일부 특채 없음). 일부만 쓰려면 먼저 [선별]로 불량 자재 관리 LOT 를 떼어 낸 뒤, 그 입하 LOT 를 전량 특채하세요.',
    /** 결재 대기 특채가 있으면 처분 판정 자리에 — 적용은 아래 「특채 요청 이력」의 [특채 적용]. */
    pendingBanner: (concessionNo: string, count: number): string =>
      `특채 ${concessionNo} 결재 대기 중(W-03-09). 승인되면 [특채 적용]으로 자재 관리 LOT ${String(count)}개 전부를 정상으로 풉니다.`,
    /** 결재가 승인됐고 적용 전(G2 M3). */
    approvedBanner: (concessionNo: string, count: number): string =>
      `특채 ${concessionNo} 승인됨 — 적용 대기. [특채 적용]으로 자재 관리 LOT ${String(count)}개 전부를 정상으로 풉니다.`,
    rejectedBanner: (concessionNo: string): string =>
      `특채 ${concessionNo} 결재가 반려됐습니다. [특채 닫기]로 이 특채를 닫으세요.`,
    close: '특채 닫기',
    /** 이력 표의 묶음 한 줄 — 같은 결재의 행(자재 관리 LOT 마다 한 행)을 한 줄로. */
    targetGroup: (count: number): string => `자재 관리 LOT ${String(count)}개 전부`,
    historyHeading: '특채 요청 이력',
    reasonPlaceholder: '특채 사유 입력',
    validToPlaceholder: '제한 없음',
    none: '특채 요청 이력이 없습니다.',
    loading: '특채를 불러오는 중입니다.',
    loadFailed: '특채를 불러오지 못했습니다.',
    request: '특채 요청',
    requesting: '요청하는 중…',
    apply: '특채 적용',
    applying: '적용하는 중…',
    qty: '사용 가능 수량',
    validFrom: '시작일',
    validTo: '종료일 (선택)',
    reason: '특채 사유',
    requested: '특채를 요청했습니다. 결재가 끝나면 적용하세요.',
    /** 다LOT 전량 특채 — 서버가 자재 관리 LOT 마다 특채 행을 만든 수(`concessionIds`). */
    requestedLots: (count: number): string =>
      `특채를 요청했습니다. 자재 관리 LOT ${String(count)}개 전부에 특채가 걸렸습니다. 결재가 끝나면 적용하세요.`,
    applied: '특채를 적용했습니다. 자재 관리 LOT 이 정상으로 풀렸습니다.',
    appliedLots: (count: number): string =>
      `특채를 적용했습니다. 자재 관리 LOT ${String(count)}개가 정상으로 풀렸습니다.`,
    /** omf-all-around#207 — 일부 특채는 승인 안 된 수량을 «불량으로 남은 LOT»(새 번호)으로 나눈다. */
    appliedSplit: (lotNo: string, nonconformanceNo: string): string =>
      `특채를 적용했습니다. 승인 수량만 정상으로 풀었습니다. 불량으로 남은 수량은 새 LOT ${lotNo} 로 나누었고, 부적합 ${nonconformanceNo} 에서 처분합니다. 불량으로 남은 LOT 에 새 라벨을 붙이세요.`,
    rejected: '결재가 반려되어 특채를 닫았습니다.',
    /** 요청 단추가 잠겼을 때 읽는 이유 — 칸별 안내 문구는 두지 않는다(필수 표시로 알린다). */
    requestBlocked: '남은 수량, 유효 기간, 특채 사유를 갖추면 요청할 수 있습니다.',
    blocked: {
      qty: '남은 수량을 확인하는 중입니다.',
      date: '유효 기간을 확인하세요.',
      reason: '특채 사유를 입력하세요.',
    },
    status: { PENDING: '결재 대기', APPROVED: '적용됨', APPLIED: '적용됨', REJECTED: '반려' },
    columns: {
      concessionNo: '특채 번호',
      target: '대상',
      qty: '사용 가능 수량',
      period: '유효 기간',
      status: '상태',
    },
    caption: '특채 목록',
  },
  form: {
    /** 판정 구역 머리와 오른쪽 남은 수량(사용자 시안 · #223). */
    heading: '처분 판정',
    reasonPlaceholder: '판정 사유를 입력하세요',
    dispositionLabel: '처분 유형',
    qtyLabel: '처분 수량',
    reasonLabel: '판정 사유',
    /**
     * 005 FR-038 — 처분 수량은 남은 수량 전부로 고정한다(입력 없음 · 일부 판정 없음). 판정 하나가 자재 관리 LOT 전부를 옮긴다.
     */
    qtyLocked: '남은 수량 전부 — 바꿀 수 없음',
    wholeEffect: (count: number, effect: string): string =>
      `= 남은 수량 전부. 판정 하나가 자재 관리 LOT ${String(count)}개 ${effect}`,
    effect: {
      NORMAL: '전부 정상',
      SCRAP: '전부 폐기',
      REWORK: '전부 검사 대기 + 재검사',
    },
    reworkInboundEffect: (inboundLotNo: string): string =>
      `전부 검사 대기 + 입하 LOT ${inboundLotNo} 의 IQC 를 다시 엶(결과 더한 뒤 다시 확정)`,
    remainingUnknown: '남은 수량을 확인하는 중입니다. 잠시 뒤 다시 저장하세요',
    /** 처분 유형 칸의 한 줄 설명(시안 W0310-After). */
    typeHint: {
      NORMAL: '자재 관리 LOT 전부를 정상으로',
      SCRAP: '자재 관리 LOT 전부를 폐기',
      REWORK: '전부 검사 대기 + 같은 입하 LOT IQC 다시 열림',
      SORT: '불량 자재 관리 LOT 만 새 입하 LOT 로 분리',
      CONCESSION: '전량 조건부 사용 — 결재(W-03-09)',
    } as Record<string, string | undefined>,
    /** 막힌 처분 유형의 이유 — 단추는 잠그고 이유를 단다. */
    typeLock: {
      closed: '종결된 부적합입니다',
      concessionPending: '특채 결재 대기 중',
      /** 결재 승인 뒤 적용 전 — 위 상자의 「승인됨 — 적용 대기」와 같은 말(G2 L-d). */
      concessionApproved: '특채 승인됨 — 적용 대기',
      sortNoInboundLot: '반품·OQC 부적합에는 선별이 없습니다(입하 LOT 없음)', // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
      sortSingleLot: '자재 관리 LOT 가 1개라 선별할 수 없습니다',
      sortNotFirst: '선별은 첫 판정일 때만 할 수 있습니다',
      normalSorted: '선별로 떼어 낸 불량 — 폐기·재작업·특채로 처분', // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    },
    /** 저장 뒤 결과 카드(정상 · 폐기 · 재작업). */
    resultClosed: (typeLabel: string): string => `${typeLabel} 판정으로 종결`,
    resultLots: (count: number, what: string): string =>
      `자재 관리 LOT ${String(count)}개 전부 → ${what}`,
    resultWhat: {
      NORMAL: '정상',
      SCRAP: '폐기',
      REWORK: '검사 대기(재작업) — IQC 다시 열림',
    } as Record<string, string | undefined>,
    reworkReopened: (inboundLotNo: string): string =>
      `W-01-01 에서 ${inboundLotNo} 검사가 「검사 진행 중」으로 다시 열렸습니다.`,
    /**
     * ⭐ 저장 409의 구조화 문구 — **저장을 서버가 거절한 뒤** 응답의 `code`를 보고 화면이 되말하는 문구다 — `message` 원문을 그대로 옮기지
     * 않는다(공유 정규화기를 고치지 않고 화면 로컬에서 되말한다). 근거: W-03-10 §6 ·
     * 공유계약 A-9 ⓑ · omf-mes#253.
     */
    qtyExceededByServer: (remaining: string): string =>
      `처분 결정 수량 합이 남은 수량(${remaining})을 넘어 저장되지 않았습니다. 부적합을 다시 불러온 뒤 저장하세요`,
    alreadyClosed: '이미 종결된 부적합입니다. 판정을 저장할 수 없습니다',
    reasonRequired: '사유를 입력하세요',
    dispositionRequired: '처분을 선택하세요',
    savingReason: '판정을 저장하는 중입니다',
    uncertainReason: '앞서 보낸 판정의 처리 결과를 먼저 확인해야 합니다',
    /**
     * ⭐ 적용 여부를 모르는 판정이 **지금 보고 있는 부적합이 아닌** 다른 부적합을 겨눌 때.
     * 어느 부적합인지 이름을 대야 확인하러 갈 수 있다 — 「먼저 확인하세요」만으로는 어디를
     * 확인해야 하는지 알 수 없고, 그러면 확인 없이 지워 버리게 된다.
     */
    uncertainOtherTarget: (nonconformanceNo: string): string =>
      `부적합 ${nonconformanceNo}에 보낸 판정의 처리 결과를 먼저 확인해야 합니다`,
    forbiddenReason: '판정 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요',
    /** ⛔ 잠그되 왜 잠겼는지를 말한다 — 버튼만 죽이면 무엇이 잘못됐는지 알 수 없다. */
    unitUnknownReason:
      '대상 LOT의 단위를 하나로 정할 수 없어 판정할 수 없습니다. 담당자에게 문의하세요',
    /** 적용 여부를 모르는 저장에서 빠져나가는 길. 없으면 새로고침이 유일한 탈출이 된다. */
    checkOutcome: '처리 결과 확인',
    selectFirstReason: '먼저 판정할 부적합을 선택하세요',
    reloadDetail: '부적합 상태 다시 확인',
    success: '판정을 저장했습니다',
  },
  /** 005 입하 LOT 단위 처분(US4-4 · FR-031) — 상세의 입하 LOT · IQC 결과 매칭(참고용). */
  inboundLot: {
    inboundLotNo: '입하 LOT',
    inspectionRequestNo: 'IQC 검사',
    supplier: '공급사',
    listLine: (inboundLotNo: string): string => `입하 LOT ${inboundLotNo}`,
    /** 목록 「원천」 칸(screens/W-03-10.md 목록 행 · G2 L8). */
    sourceColumn: '원천',
    source: { IQC: 'IQC · 자재 입하', RETURN: '반품', PRODUCT: 'OQC · 제품' }, // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    /** 선별 건 — 「· 선별 ← 0004」(원래 부적합 번호 끝 4자리). */
    sortedFromTail: (tail: string): string => ` · 선별 ← ${tail}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    bannerTitle: '처분은 입하 LOT 단위입니다.',
    bannerBody: (count: number): string =>
      `판정 하나가 자재 관리 LOT ${String(count)}개 전부에 함께 적용됩니다. 자재 관리 LOT 별로 따로 처분하지 않습니다.`,
    matching: 'IQC 결과 매칭',
    matchingNote: 'IQC 결과 매칭 — 참고용',
    noMatch: '매칭 없음',
    resultChip: (seqNo: number, judgment: string, defect: string | null): string =>
      `결과 ${String(seqNo)} ${judgment}${defect === null ? '' : ` · ${defect}`}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    rejectedCount: (count: number): string => `불합격 결과 ${String(count)}건`,
    unmatched: (results: string): string => `매칭 없는 결과: ${results}`,
    judgment: { ACCEPTED: '합격', REJECTED: '불합격', HELD: '보류' } as Record<
      string,
      string | undefined
    >,
    sortedFrom: '선별로 생김 ←',
    rejectedConfirmed: '불합격 확정',
  },
  /** 005 선별(US7-2 · FR-041) — 불량 자재 관리 LOT 을 새 입하 LOT 로 옮긴다. 수량으로 LOT 를 쪼개지 않는다. */
  sort: {
    heading: '선별 — 불량 자재 관리 LOT 고르기',
    help: '고른 자재 관리 LOT 는 새 입하 LOT 로 옮겨져 불량 그대로 새 부적합에서 처분합니다. 고르지 않은 자재 관리 LOT 는 정상이 됩니다. 수량으로 LOT 를 쪼개지 않습니다.',
    lotsLabel: '불량 자재 관리 LOT',
    noMatch: '매칭 결과 없음',
    allSelected:
      '원래 입하 LOT 에 자재 관리 LOT 가 하나 이상 남아야 합니다. 모두 불량이면 선별하지 말고 폐기·재작업·특채로 처분하세요.', // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    noneSelected: '불량 자재 관리 LOT 를 하나 이상 고르세요',
    goodQty: '양품 수량 (정보 · 선택)', // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    defectQty: '불량 수량 (정보 · 선택)', // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    qtyNote: '선별 결과 기록용입니다. 재고·LOT 수량은 바뀌지 않습니다.', // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    qtyInvalid: '0 이상의 수로 입력하세요',
    previewTitle: '저장하면',
    previewRest: (lots: string, qty: string): string =>
      `${lots} (${qty}) → 정상, 이 부적합은 「선별」로 종결`,
    previewMoved: (lots: string, qty: string): string =>
      `${lots} (${qty}) → 새 입하 LOT, 불량 그대로 · 새 부적합 1건(판정 대기, 이 부적합과 연결)`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    previewIqc: (inspectionRequestNo: string | null): string =>
      `새 입하 LOT 에 불합격으로 확정된 IQC 기록 (${inspectionRequestNo === null ? '원래 IQC' : `원래 ${inspectionRequestNo}`} 와 연결, 옮긴 LOT 에만 매칭된 결과 복사)`,
    save: '선별 저장',
    resultTitle: '선별을 저장했습니다 — 이 부적합은 「선별」로 종결',
    resultRest: (lots: string): string => `${lots} → 정상 (입고할 수 있음)`,
    resultMoved: (lots: string, inboundLotNo: string): string =>
      `${lots} → 새 입하 LOT ${inboundLotNo} (불량 그대로)`,
    resultIqc: (inspectionRequestNo: string, original: string | null): string =>
      `IQC ${inspectionRequestNo} 불합격 확정${original === null ? '' : `(원래 ${original} 와 연결)`}`,
    resultNewNonconformance: '새 부적합',
    resultNewNonconformanceAfter: '판정 대기 — 폐기·재작업·특채로 처분하세요', // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    resultInfo: (good: string, defect: string): string =>
      `정보 수량: 양품 ${good} · 불량 ${defect}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    toast: (lots: string, inboundLotNo: string, nonconformanceNo: string): string =>
      `선별을 저장했습니다. ${lots} 는 새 입하 LOT ${inboundLotNo} · 부적합 ${nonconformanceNo} 로 넘어갔습니다.`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    newInboundLot: '새 입하 LOT',
  },
  loading: '처분 대기 목록 불러오는 중',
  historyLoading: '처분 이력 불러오는 중',
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
    /** 대상 LOT 의 품질 상태 표시명(#223) — 모르는 값은 코드 그대로. */
    qualityStatus: {
      NORMAL: '정상',
      DEFECTIVE: '불량',
      INSPECTION_PENDING: '검사 대기',
      HOLD: '보류',
      SCRAPPED: '폐기',
    } as Record<string, string | undefined>,
    unknownQty: '—',
    /** 셋의 해법이 서로 다르므로 문구를 가른다(G-3 — 사유는 「어떻게 풀 것인가」를 담는다). */
    periodRequired: '기간을 선택해야 조회할 수 있습니다',
    periodInvalid: '달력에 없는 날짜입니다. 있는 날짜로 고쳐 주세요',
    periodReversed: '시작일이 종료일보다 뒤입니다. 두 날짜를 바꿔 주세요',
    /**
     * 원천 두 값. 「판정 진행」과 같은 사정이다 — 계약이 값을 열거했으므로(G-2 예외) 이름을
     * 붙여도 된다. ⛔ **이름을 붙이는 것뿐이고 값으로 «행동»을 가르지 않는다** — 이 화면에서
     * 원천은 거르는 축으로만 쓰이며, 서버가 대상 LOT의 입고 유형으로 파생해 내린다.
     *
     * ⚠ **이름이 겹친다** — 입고 유형의 `PRODUCT`(제품입고)와 뜻이 다르다.
     */
    sourceCode: {
      PRODUCT: '제품',
      RETURN: '반품',
    },
    /** 처분 셋은 계약이 `enum` 으로 닫아 표시명을 화면이 갖는다(G-33). W-04-07 과 같은 낱말. */
    dispositionType: {
      REWORK: '재작업',
      SCRAP: '폐기',
      NORMAL: '정상',
      SORT: '선별',
      CONCESSION: '특채',
    },
    /** 「판정 진행」 열의 값 셋. 계약이 값을 열거했으므로(G-2 예외) 코드로 갈라도 된다. */
    dispositionProgress: {
      NOT_STARTED: '미판정',
      PARTIAL: '일부 판정',
      COMPLETED: '완료',
    },
  },
  /**
   * 「지금(바뀌기 전)」 띠(005 · screens/W-03-10.md · mockups/W0310-After.html) — 처분 방식이 바뀐 점을 알린다.
   * C5 에서는 한국어 상수였고 C7 에서 언어별 문구로 옮겼다(총괄 지시 2026-11-12).
   */
  nowBand: {
    title: '지금(바뀌기 전)',
    summary:
      '처분 수량을 나눠 여러 번 판정 · 선별 = 양품/불량 수량으로 LOT 를 쪼갬(자식 LOT) · 특채 = LOT 1개 고르고 일부 수량도 가능', // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    expand: '펼치기',
    collapse: '접기',
    items: [
      {
        label: '처분 수량',
        tag: '없어짐',
        note: '처분 수량을 나눠 일부만 판정할 수 있었습니다(입력 / 미입력).',
      },
      {
        label: '양품 · 불량 수량 (선별)', // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
        tag: '바뀜',
        note: '불량 수량은 새 LOT 으로 나뉘어(자식 LOT) 새 부적합이 됐습니다.',
      },
      {
        label: '특채 요청',
        tag: '일부 특채 없어짐',
        note: 'LOT 하나를 고르고 일부 수량만 승인할 수 있었고, 나머지는 새 LOT 과 부적합으로 나뉘었습니다.',
      },
    ],
  },
} as const;
