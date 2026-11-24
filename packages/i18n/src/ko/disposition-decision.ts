export const dispositionDecision = {
  title: '부적합 처분 관리',
  splitter: '끌어서 목록·상세 폭 조절',
  /** 목록 · 상세 배치 고르기 — 「좌우 배치 | 상하 배치」 두 단추(품질 승인 처리 화면에서 옮김 · #352). */
  layout: { group: '목록·상세 배치', side: '좌우 배치', stack: '상하 배치' },
  /** 목록과 상세 사이 막대의 단추 — 항목을 고르면 목록이 접힌다(omf-all-around#275). */
  listCollapse: '목록 접기',
  listExpand: '목록 펼치기',
  breadcrumbRoot: '품질 관리',
  /** 탭 줄 오른쪽 상태 칩 — 「판정 대기 3건」. 건수를 아직 모르면 이름만(#223 · 2026-11-24 「N건」). */
  statusChip: (label: string, count: number | undefined): string =>
    count === undefined ? label : `${label} ${String(count)}건`,
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
    detailDecision: '부적합 상세',
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
    /** 목록은 품목명 · 품목코드 두 칸(#352 사용자 지시). */
    itemName: '품목명',
    itemCode: '품목코드',
    severityCode: '심각도',
    statusCode: '처리 상태',
    sourceCode: '원천',
    nonconformanceNo: '부적합 번호',
    openedAt: '접수일시',
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
    /** 아직 처분하지 않은 수량(omf-all-around#275 — 「남은 수량」에서 바꿈). */
    remainingQty: '미처분 수량',
    /** 부적합 사유 — 상세 기본 정보의 한 칸(omf-all-around#275). */
    reasonText: '부적합 사유',
  },
  all: '전체',
  codePending: '등록된 값이 없습니다',
  codePlaceholder: '등록된 값 없음',
  /** 심각도·상태 선택지는 공통코드 조회가 채운다 — 못 채운 사유를 갈래별로 밝힌다(G-2 · 규범 4). */
  codeLock: {
    loading: '기준값을 불러오는 중입니다',
    failed: '기준값을 불러오지 못했습니다. 다시 조회해 주세요',
    empty: '등록된 값이 없습니다. 공통코드에서 값을 등록하세요',
  },
  codeTruncated: '값을 일부만 불러왔습니다. 목록에 없는 값은 고를 수 없습니다',
  /** 주입된 코드 목록이 비어 있을 때의 방어 문구. 기본 목록은 고정 OpenAPI enum으로 채워져 있다. */
  dispositionPending: '등록된 처분이 없어 판정을 저장할 수 없습니다',
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
    /** 목록 · 기본 정보의 부적합 수량 칸(omf-all-around#275 — 「대상 수량」에서 바꿈). */
    affectedQty: '부적합 수량',
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
    /** 요청 구역 머리 — 제목 왼쪽, 한 줄 설명 오른쪽(사용자 시안 · #223). */
    requestHeading: '특채 요청',
    validToPlaceholder: '제한 없음',
    validFrom: '적용 시작일',
    validTo: '적용 종료일 (선택)',
    applied: '특채를 적용했습니다. 자재 관리 LOT 이 정상으로 풀렸습니다.',
    appliedLots: (count: number): string =>
      `특채를 적용했습니다. 자재 관리 LOT ${String(count)}개가 정상으로 풀렸습니다.`,
    /** 요청 단추가 잠겼을 때 읽는 이유 — 칸별 안내 문구는 두지 않는다(필수 표시로 알린다). */
    blocked: {
      date: '유효 기간을 확인하세요.',
    },
  },
  form: {
    /** 판정 구역 머리와 오른쪽 남은 수량(사용자 시안 · #223). */
    heading: '처분 판정',
    reasonPlaceholder: '판정 사유를 입력하세요',
    dispositionLabel: '처분 유형',
    /** 처분 판정 머리 오른쪽(사용자 시안 · omf-all-around#275). */
    qtyLabel: '처분 수량',
    reasonLabel: '판정 사유',
    /**
     * 005 FR-038 — 처분 수량은 남은 수량 전부로 고정한다(입력 없음 · 일부 판정 없음). 판정 하나가 자재 관리 LOT 전부를 옮긴다.
     */
    /* 저장하면 생기는 일 — 유형마다 다르다(정상 · 폐기는 상태만, 재작업은 IQC 가 다시 열린다 · omf-all-around#275). */
    /** 저장 단추 줄의 안내 라벨(omf-all-around#352 사용자 정정 문구) — 처분 이름은 따옴표로 감싼다. */
    wholeEffect: (count: number, typeLabel: string): string =>
      `저장하면 자재 관리 LOT ${String(count)}개에 모두 ‘${typeLabel}’ 판정이 적용됩니다.`,
    effect: {
      NORMAL: '모두 정상으로 바뀝니다.',
      SCRAP: '모두 폐기로 바뀝니다.',
      REWORK: '모두 검사 대기로 바뀌고, 다시 검사해야 합니다.',
    },
    reworkInboundEffect: (inboundLotNo: string): string =>
      `모두 검사 대기로 바뀌고, 입하 LOT ${inboundLotNo} 의 IQC 가 다시 열려 재검사해야 합니다.`,
    remainingUnknown: '남은 수량을 확인하는 중입니다. 잠시 뒤 다시 저장하세요',
    /** 막힌 처분 유형의 이유 — 단추는 잠그고 이유를 단다. */
    typeLock: {
      closed: '이 부적합 건은 종결되었습니다',
      sortNoInboundLot: '반품·OQC 부적합에는 선별이 없습니다(입하 LOT 없음)', // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
      sortSingleLot: '선별은 자재 관리 LOT가 2개 이상일 때 선택할 수 있습니다.',
      sortNotFirst: '선별은 첫 판정일 때만 할 수 있습니다',
      normalSorted: '선별로 떼어 낸 불량 — 폐기·특채로 처분', // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    },
    /**
     * ⭐ 저장 409의 구조화 문구 — **저장을 서버가 거절한 뒤** 응답의 `code`를 보고 화면이 되말하는 문구다 — `message` 원문을 그대로 옮기지
     * 않는다(공유 정규화기를 고치지 않고 화면 로컬에서 되말한다). 근거: W-03-10 §6 ·
     * 공유계약 A-9 ⓑ · omf-mes#253.
     */
    qtyExceededByServer: (remaining: string): string =>
      `처분 결정 수량 합이 남은 수량(${remaining})을 넘어 저장되지 않았습니다. 부적합을 다시 불러온 뒤 저장하세요`,
    alreadyClosed: '이미 종결된 부적합입니다. 판정을 저장할 수 없습니다',
    /* 입력칸 안내(「판정 사유를 입력하세요」)와 같은 말을 되풀이하지 않는다(omf-all-around#275). */
    reasonRequired: '판정 사유를 입력하세요.',
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
  /** 폐기 · 선별 처분 결재(omf-all-around#352) — 결재선이 있으면 요청 → 결재 → [처분 적용], 없으면 바로 반영. */
  /** 판정 확인 팝업(omf-all-around#352) — 폐기 · 선별 · 특채 모두 저장 전에 띄운다. 결재선이 있으면 결재자, 없으면 바로 반영된다는 말. */
  confirm: {
    title: '처분 판정 확인',
    type: '처분 유형',
    target: '대상 LOT',
    targetLots: (count: number): string => `자재 관리 LOT ${String(count)}개`,
    qty: '총 처분 수량',
    sortRest: '정상 처리',
    sortMoved: '불량 분리 · 새 판정 대기',
    period: '적용 기간',
    periodText: (from: string, to: string | null): string => `${from} ~ ${to ?? '제한 없음'}`,
    reason: '판정 사유',
    direct: '저장하면 바로 반영됩니다.',
    save: '판정 저장',
  },
  /** 결재자가 보는 부적합 정보(omf-all-around#352) — 품질 승인 처리 · 결재함 상세에 선다. */
  approvalSummary: {
    title: '부적합 정보',
    nonconformanceNo: '부적합번호',
    item: '품목',
    lots: '대상 LOT',
    affectedQty: '부적합 수량',
    remainingQty: '남은 수량',
    defect: '불량 내용',
    requestedDisposition: '요청 처분',
    sortLots: '불량으로 분리할 LOT',
    goodQty: '양품 수량',
    defectQty: '불량 수량',
    reason: '처분 사유',
    loading: '부적합 정보 불러오는 중',
    loadError: '부적합 정보를 불러오지 못했습니다. 다시 시도하세요.',
  },
  /** 005 입하 LOT 단위 처분(US4-4 · FR-031) — 상세의 입하 LOT · IQC 결과 매칭(참고용). */
  inboundLot: {
    inboundLotNo: '입하 LOT',
    inspectionRequestNo: 'IQC 검사',
    supplier: '공급사',
    /** 목록 「원천」 칸(screens/W-03-10.md 목록 행 · G2 L8). */
    sourceColumn: '원천',
    source: { IQC: 'IQC · 자재 입하', RETURN: '반품', PRODUCT: 'OQC · 제품' }, // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    /** 선별 건 — 「· 선별 ← 0004」(원래 부적합 번호 끝 4자리). */
    sortedFromTail: (tail: string): string => ` · 선별 ← ${tail}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    /** 이 LOT 에 연결된 IQC 검사 결과(omf-all-around#275 — 「IQC 결과 매칭」에서 바꿈). */
    matching: '검사 결과',
    noMatch: '연결된 검사 결과 없음',
    /** 「불합격 (검사 결과 1)」 — 판정을 앞에, 몇 번째 검사 결과인지 뒤에(omf-all-around#275). */
    resultChip: (seqNo: number, judgment: string, defect: string | null): string =>
      `${judgment}${defect === null ? '' : `: ${defect}`} (검사 결과 ${String(seqNo)})`,
    rejectedCount: (count: number): string => `불합격 결과 ${String(count)}건`,
    unmatched: (results: string): string => `LOT에 연결되지 않은 검사 결과: ${results}`,
    judgment: { ACCEPTED: '합격', REJECTED: '불합격', HELD: '보류' } as Record<
      string,
      string | undefined
    >,
    /** 선별로 생긴 부적합의 기존 부적합 건 — 심각도 오른쪽 칸(#352 사용자 지시). */
    sortedFrom: '기존 부적합 건',
    sortedFromButton: '기존 부적합 건 조회',
    /** 선별로 종결된 부적합에서 새로 생긴 부적합 — 「기존 부적합 건」과 짝(#352 사용자 지시). */
    derived: '신규 부적합 건',
    derivedButton: '신규 부적합 건 조회',
    openDerived: (nonconformanceNo: string): string => `신규 부적합 건 ${nonconformanceNo} 조회`,
    sortedFromNote: (nonconformanceNo: string): string =>
      `이 부적합 건은 [${nonconformanceNo}]에서 선별된 LOT에 대해 생성되었습니다.`,
    openSortedFrom: (nonconformanceNo: string): string => `기존 부적합 건 ${nonconformanceNo} 조회`,
    rejectedConfirmed: '불합격 확정',
  },
  /** 005 선별(US7-2 · FR-041) — 불량 자재 관리 LOT 을 새 입하 LOT 로 옮긴다. 수량으로 LOT 를 쪼개지 않는다. */
  sort: {
    /** 선별 영역(omf-all-around#352 사용자 지시) — 제목 · 목록 위 안내 · 저장 후 처리 요약. */
    heading: '불량으로 분리할 자재 LOT',
    selectNote: '저장하면 선택한 LOT는 불량으로 분리되고, 나머지 LOT는 정상 처리됩니다.',
    help: '고른 자재 관리 LOT 는 새 입하 LOT 로 옮겨져 불량 그대로 새 부적합에서 처분합니다. 고르지 않은 자재 관리 LOT 는 정상이 됩니다. 수량으로 LOT 를 쪼개지 않습니다.',
    lotsLabel: '불량 자재 관리 LOT',
    noMatch: '연결된 검사 결과 없음',
    allSelected:
      '원래 입하 LOT 에 자재 관리 LOT 가 하나 이상 남아야 합니다. 모두 불량이면 선별하지 말고 폐기·특채로 처분하세요.', // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    noneSelected: '불량 자재 관리 LOT 를 하나 이상 고르세요',
    goodQty: '양품 수량 (선택)',
    defectQty: '불량 수량 (선택)',
    qtyNote: '선별 결과 기록용입니다. 재고·LOT 수량은 바뀌지 않습니다.', // ui-check-ignore: C-13 설계 확정 문구(screens/W-03-10.md)
    qtyInvalid: '0 이상의 수로 입력하세요',
    previewTitle: '저장 후 처리',
    previewRestLabel: '정상 처리',
    previewMovedLabel: '불량 분리 · 새 판정 대기',
    previewTarget: (lots: string, qty: string): string => `${lots} · ${qty}`,
    /* 서버 선별 처리(disposition-sort)와 대조한 문구 — 원래 부적합 SORT 종결 · 새 입하 LOT · 새 부적합 판정 대기 · 옮긴 LOT 에만 연결된 결과 복사. */
    previewNotes: [
      '기존 부적합 건은 ‘선별’로 종결됩니다.',
      '불량 LOT는 새 입하 LOT로 분리되며, 새 부적합 건이 판정 대기 상태로 등록됩니다.',
      '분리한 LOT에 해당하는 불합격 IQC 결과만 새 입하 LOT에 복사됩니다.',
    ],
    previewIqc: (inspectionRequestNo: string): string => `기존 검사 의뢰 ${inspectionRequestNo}`,
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
    /** 처리 상태 칸 — 일부 판정 건만 상태 뒤에 덧붙인다(「판정 현황」 열을 합침 · omf-all-around#275). */
    statusWithProgress: (status: string, progress: string): string => `${status} (${progress})`,
  },
} as const;
