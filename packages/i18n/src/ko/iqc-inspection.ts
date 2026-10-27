/**
 * W-01-01 IQC 수입검사·판정.
 *
 * 이 화면의 문구는 **검사자가 쓰는 말**로 쓴다 — 「의뢰」·「회차」·「판정」은 현장 어휘이고,
 * 「낙관적 잠금」·「멱등 키」 같은 구현 어휘는 화면에 내지 않는다.
 */
export const iqcInspection = {
  /* 스펙 §3 머리와 IA 가 부르는 이름 그대로다 — 사이드바 항목과 같은 글자여야 길을 잃지 않는다. */
  title: 'IQC (수입검사) 조회·판정',
  /** 머리는 관리웹 사이드바 묶음을 따른다 — 「품질 관리 > IQC (수입검사) 조회·판정」. */
  breadcrumbRoot: '품질 관리',

  queue: {
    heading: '검사 대기',
    /**
     * 표 머리. 좌측 큐가 약 1/3 폭이라 **고르는 데 필요한 넷만** 둔다(화면 스펙 §3).
     * 품목·수량 같은 나머지는 고른 뒤 우측 창이 보인다.
     */
    columns: {
      /**
       * 첫 칸은 **품목**이다(사용자 지시 2026-09-21). 의뢰번호는 고르는 데 필요한 값이 아니고
       * 고른 뒤 우측 창이 먼저 보여 주므로 열에서 뺐다 — 좁은 칸의 자리를 검사자가 실제로
       * 찾는 값(무엇을 검사하는가)에 내준다.
       */
      item: '품목',
      lotId: '자재 LOT',
      statusCode: '상태',
      requestedAt: '의뢰 일시',
      inspectionRequestNo: '의뢰번호',
    },
    /** 값이 없는 칸. 빈 칸으로 두면 「없음」인지 「못 불러왔는지」 구분되지 않는다. */
    emptyValue: '—',
    /* 대기 목록 LOT 옆 표시(omf-all-around#63). */
    fourMBadge: '4M',
    fourMBadgeTitle: '4M 변경품',
    /**
     * 이 줄을 여는 버튼의 접근 이름.
     *
     * **보이는 글자(품목)를 그대로 담는다** — 담지 않으면 음성 조작이 화면에 보이는 말로
     * 이 버튼을 부를 수 없다. 거기에 의뢰번호를 덧붙여 **어느 건인지** 밝힌다 — 같은 품목의
     * 의뢰가 여럿일 수 있어 보이는 글자만으로는 줄이 갈리지 않는다.
     */
    openRow: (item: string, inspectionRequestNo: string): string =>
      `${item} · 검사 의뢰 ${inspectionRequestNo} 열기`,
    caption: '검사 대기 목록',
    /**
     * 조회는 됐는데 결과가 없다. 조건을 바꾸는 것이 사용자가 할 수 있는 유일한 조치다.
     *
     * ⛔ **기간을 가리키지 않는다** — 이 화면에 기간 조건이 없다(계약에서 사라졌다).
     * 없는 컨트롤을 넓히라고 하면 사용자는 찾을 수 없는 것을 찾는다.
     */
    empty: '조회된 검사 의뢰가 없습니다.',
    /** 빈 목록 아래 안내 — 제목과 함께 `EmptyState` 로 보인다(omf-all-around#171). */
    emptyHint: '검색 조건을 변경하거나 필터를 초기화하세요.',
    /**
     * 조회 자체가 실패했다. ⛔ **조건을 넓히라고 말하지 않는다** — 조건은 멀쩡한데 요청이
     * 실패한 것이라, 넓히라고 하면 사용자가 조건을 넓히다가 결국 못 찾는다. 무엇을 해야
     * 하는지는 위 배너가 이미 말한다.
     */
    unavailable: '목록을 표시할 수 없습니다.',
    loading: '검사 의뢰를 불러오는 중입니다.',
  },

  /**
   * 좌측 큐의 조건 — **셋뿐이다.**
   *
   * ⭐ 검사 유형과 「아직 안 끝난 것만」은 조건이 아니라 **이 화면이 무엇인지의 정의**라서
   * 조건 줄에 두지 않는다. 상태도 두지 않는다 — 두려면 값 목록이 필요한데 값 목록을 화면에
   * 고정하는 것은 금지이고(공유계약 G-6), 「대기·진행」은 이미 고정 축이 덮는다.
   */
  filters: {
    item: '품목 검색',
    /** 창을 여는 칸이다 — 「치세요」가 아니라 「고르세요」로 적는다. */
    itemPlaceholder: '품목을 입력하세요',
    itemPick: '선택',
    itemClear: '품목 조건 지우기',
    supplier: '공급사 검색',
    supplierPlaceholder: '공급사를 입력하세요',
    supplierClear: '공급사 조건 지우기',
    /** 공급사 검색 창(#133) — 품목 검색 창과 같은 모양이라 공용 문구(검색어 · 검색 · 취소 · 쪽)는 그 창의 것을 쓴다. */
    supplierPicker: {
      title: '공급사 검색',
      keywordPlaceholder: '공급사 코드 또는 이름을 입력하세요',
      columns: { code: '공급사 코드', name: '공급사 이름' },
      noResult: '검색 결과가 없습니다. 코드나 이름의 일부로 다시 찾아보세요.',
      searchFailed: '공급사를 찾지 못했습니다.',
      pick: '선택',
    },
    /** 조건 줄의 「전체」 — 좁히지 않는다는 뜻이다(빈 값과 같은 자리). */
    all: '전체',
    keyword: '의뢰번호 검색',
    keywordPlaceholder: '의뢰번호를 입력하세요',
    apply: '조회',
    reset: '초기화',
    /**
     * 번호 칸에 번호가 아닌 값이 들어왔다. **조용히 무시하지 않는다** — 무시하면 사용자는
     * 자기가 좁혔다고 믿는데 결과는 좁혀지지 않은 상태가 된다.
     */
    identifierInvalid: '번호는 1 이상의 정수로 넣어 주세요.',
  },

  /**
   * 상태 배지. **두 값만 가른다** — 큐가 보이는 것이 「대기」와 「진행」이기 때문이다.
   * 그 밖의 값은 서버가 준 표시명을 그대로 보인다(값 목록을 화면에 고정하지 않는다).
   */
  status: {
    requested: '대기',
    inProgress: '진행',
  },

  /** 우측 창 — 고른 의뢰의 상세(스펙 §4-A 여섯 항목). */
  detail: {
    backToList: '← 목록',
    leaveUnsaved: '변경사항을 저장하지 않았습니다',
    leaveUnsavedNote: '저장하지 않고 이동하면 입력한 내용이 사라집니다.',
    /** 검사 이력 접는 줄 오른쪽 끝의 건수(#133). */
    historyCount: (count: number): string => `${String(count)}건`,
    keepEditing: '계속 작성',
    leaveAnyway: '저장하지 않고 이동',
    heading: '대상',
    /** 상세 카드 첫 구획의 제목 — 참고 정보(읽기 전용)임을 입력 구획과 가른다. */
    sectionTitle: '검사 기본 정보',
    loading: '의뢰를 불러오는 중입니다.',
    /** 검사 유형 코드 옆에 붙이는 이름(#133) — 모르는 코드는 코드만 보인다. */
    inspectionTypeNames: { IQC: '수입검사' } as Record<string, string>,
    fields: {
      inspectionRequestNo: '의뢰번호',
      inspectionTypeCode: '검사 유형',
      /**
       * ⚠ 감추지 않는다. 검사 시점의 기준 버전이 그 검사에 **고정되고** 이후 기준이 바뀌어도
       * 이 검사는 당시 버전으로 남는다. 버전을 감추면 검사자도, 나중에 결과를 읽는 사람도
       * 어느 기준으로 잰 값인지 알 수 없다.
       */
      inspectionPlanVersionId: '적용 검사 기준',
      lotId: '대상 LOT',
      itemId: '품목',
      targetQty: '총 검사 수량',
      /** 의뢰가 만들어진 시각(`requestedAt`) — 목록 열 「의뢰 일시」와 같은 값이다. */
      requestedAt: '의뢰 일시',
      /** 품목의 현재 IQC 검사 수준 — 이 화면에서 바로 바꾼다(omf-all-around#133). */
      inspectionLevel: '검사 수준',
    },
    level: {
      unset: '미지정',
      loadFailed: '불러오지 못함',
      change: '변경',
      set: '지정',
    },
    /**
     * client#589 — 기준이 등록되지 않은 상태에서도 검사를 진행할 수 있어 이 칸이 빌 수 있다.
     * **없는 값과 모르는 값은 다른 모양이어야 한다**(공유계약 G-9) — 그래서 일반 빈 값
     * 표시(`emptyValue`)와 다른 전용 문구를 쓴다.
     */
    auxTabs: '검사 참고 정보',
    noPlanVersion: '기준 없음',
    planVersion: (version: number): string => `버전 ${String(version)}`,
    openPlan: '기준 조회',
  },

  /** 우측 창 — 수량 판정. 합계 제약이 이 구획을 지배한다. */
  result: {
    heading: '수량 판정',
    /** 수량 입력 구획의 제목. */
    sectionTitle: '검사 수량 입력',
    /** 종합 판정·임시 저장·판정 확정 구획의 제목. */
    judgmentSectionTitle: '판정',
    judgmentDetailTitle: '판정 상세 입력',
    judgmentDetailOpen: '판정 상세 입력',
    judgmentDetailCancel: '취소',
    judgmentDetailDone: '완료',
    round: (round: number): string => `${round}회차`,
    loading: '검사 결과를 불러오는 중입니다.',
    /**
     * 이 회차는 이미 확정됐다. ⛔ **고칠 수 있는 것처럼 보이지 않게 한다** — 이전 회차는
     * 정정하지 않고 재검사로 새 회차를 쌓는다.
     */
    confirmed: '확정된 회차입니다. 재검사는 회차를 추가하세요.',
    /** 끝난 의뢰(COMPLETED · 최신 회차 확정)의 읽기 전용 요약 — 입력 칸을 두지 않는다(3단계 검증). */
    closed: {
      title: '검사 완료',
      note: '이 의뢰의 검사는 끝났습니다. 최신 회차의 확정 결과입니다.',
      finalJudgment: '최종 판정',
      round: '회차',
      confirmedAt: '확정 시각',
      fourMChange: '4M 변경품',
    },
    fields: {
      inspectedQty: '총 검사 수량',
      accepted: '합격 수량',
      rejected: '불합격 수량',
      held: '보류 수량',
    },
    /** 진행 막대의 접근 이름. */
    progressLabel: '검사 수량 대비 입력 합계',
    /** 넘겼다. 0으로 깎아 감추지 않는다. */
    over: (over: string): string => `검사 수량보다 ${over} 많습니다.`,
    quantityInvalid: '0 이상의 숫자로 입력해 주세요. 소수점은 여섯 자리까지 됩니다.',
    /**
     * 임시 저장. ⭐ **합계가 맞지 않아도 눌린다** — 판정을 확정하는 것이 아니라 하던 일을
     * 남기는 것이고, 계약도 「작성중」은 합계 제약을 걸지 않는다(스펙 §6).
     */
    save: '임시 저장',
    saving: '저장 중',
    saved: '저장했습니다.',
    /**
     * 수량이 아닌 값이 남아 있어 저장할 수 없다. **막는 것은 이 경우뿐이다** — 보낼 수
     * 없는 값이라서지, 합계가 안 맞아서가 아니다.
     */
    saveBlockedByInvalid: '수량 칸을 고친 뒤 저장할 수 있습니다.',

    /** 종합 판정. ⛔ 값 목록을 화면에 고정하지 않는다 — 공통코드 조회로 채운다. */
    judgment: '최종 판정',
    judgmentPlaceholder: '최종 판정을 선택하세요',
    /**
     * 코드값 시드가 아직 안 들어가 목록이 빌 수 있다. ⛔ **감추지 않고 사유를 밝힌다**
     * (공유계약 G-2) — 감추면 그 자리가 왜 없는지 사용자가 알 수 없다.
     */
    judgmentUnavailable: '판정 값 목록이 아직 준비되지 않았습니다. 담당자에게 문의하세요.',
    /**
     * 저장된 판정이 지금 목록에 없다. 사용 중지된 코드일 수 있다 — 조용히 비우면 사용자가
     * 고르지 않았는데 고른 것이 지워진다.
     */
    judgmentUnknown: (code: string): string => `저장된 판정(${code})이 목록에 없습니다.`,

    confirm: '판정 확정',
    confirming: '확정 중',
    /**
     * ⛔ **되돌릴 수 없다.** 확정하는 순간 LOT 상태가 전이하고 보류 해제가 기록된다 —
     * 누르기 전에 그 사실을 알린다.
     */
    confirmNote: '판정 확정 후 수정이 불가합니다.',
    /**
     * 비활성 사유 — 무엇이 막혔는지와 어떻게 푸는지를 함께 말한다(공유계약 G-23).
     * 단추 바로 아래에 붙으므로 단추 이름을 되풀이하지 않는다.
     */
    confirmBlockedByTotals: '수량 합계가 검사 수량과 일치해야 합니다.',
    workerNotLinked:
      '이 계정에 연결된 작업자가 없어 판정을 저장할 수 없습니다. 사용자 관리에서 작업자를 연결해 주세요.',
    followUp: {
      title: '불량 LOT 입니다 — 재검사 대신 처분하세요',
      body: '불합격으로 확정된 LOT 은 재검사 회차를 확정할 수 없습니다. 처분 판정에서 재작업(재검)·폐기·정상을 고르거나, 공급사로 반품하세요.',
      toDisposition: '처분 판정으로 이동',
      toSupplierReturn: '공급사 반품으로 이동',
      noNonconformance:
        '처분을 기다리는 부적합을 찾지 못했습니다. 처분 판정 목록에서 이 LOT 을 찾아 주세요.',
    },
    rejection: {
      heading: '불합격 내용',
      major: '불량 대분류',
      minor: '불량 상세',
      description: '불합격 사유',
      descriptionPlaceholder: '불합격 사유를 입력하세요',
      required: '불합격인 경우 판정 상세를 입력해야 합니다.',
      minorRequired: '이 대분류에는 상세 코드가 있습니다. 상세 코드를 고르세요.',
      noCodes: '등록된 불량 코드가 없습니다. 기준정보 > 불량·원인 코드에서 먼저 등록하세요.',
      majorPlaceholder: '선택하세요',
      minorPlaceholder: '선택하세요',
      /** 대분류에 상세가 있으면 뜨는 상세 선택 창(#185). */
      minorPickerTitle: (major: string): string => `불량 상세 선택 — ${major}`,
      minorPickerClose: '닫기',
      /** 칸 아래 필수 누락 표시 — 확정이 막힌 이유(required·minorRequired)는 확정 단추 곁에 그대로 둔다. */
      majorMissing: '불량 대분류를 선택하세요.',
      minorMissing: '불량 상세를 선택하세요.',
      /**
       * 추정 원인(omf-all-around#130 · 담당자 결정 안 B) — 선택 입력이다(계약 `suspectedCauseCodeId` 와 같다).
       * 고르면 통합 대시보드 › 부적합 현황 「원인 구분별 구성」에 원인 대분류로 잡힌다.
       */
      cause: '추정 원인',
      causeNone: '선택 안 함',
      causeInactive: (label: string): string => `${label} (사용 중지)`,
    },
    /** 합격판정개수 기준 자동 판정(omf-all-around#125) — 기준에 합격판정개수가 있을 때만 선다. */
    /* 4M 변경품(omf-all-around#63) — 공급사가 사람·설비·자재·방법을 바꿔 보낸 자재 LOT. 내부 「4M 자원배정」과 다른 말이다. */
    fourMChange: {
      sectionTitle: '4M 변경 정보',
      label: '4M 변경품',
      hint: '사람·설비·자재·방법 중 변경 사항이 있는 경우 선택',
      remarks: '비고',
      remarksPlaceholder: '비고를 입력하세요',
      remarksMissing: '비고를 입력하세요.',
      remarksOpen: '비고 입력',
      remarksTitle: '4M 변경 비고 입력',
      remarksDone: '완료',
      blocked: '4M 변경품일 경우 비고를 입력해야 합니다.',
    },
    judgmentChange: {
      basis: (acceptanceNumber: number): string =>
        `자동 판정: 불합격 수량 ${String(acceptanceNumber)}개 이하 → 합격`,
      reason: '판정 변경 사유',
      reasonPlaceholder: '판정 변경 사유를 입력하세요',
      required: '자동 판정과 다른 판정은 변경 사유를 입력해야 확정할 수 있습니다.',
      reasonMissing: '판정 변경 사유를 입력하세요.',
    },
    confirmBlockedByJudgment: '최종 판정을 선택해주세요.',
    confirmBlockedByConfirmed: '이미 확정된 회차입니다.',
    /*
     * ⛔ 회차가 아직 없다. 확정은 회차 하나를 지목하는 쓰기라 지목할 것이 없으면 보낼 수
     * 없다 — 「오류가 났습니다」가 아니라 «먼저 할 일»을 말한다.
     */
    confirmBlockedByUnsaved: '임시 저장 후 판정 확정이 가능합니다.',
    /*
     * 확정이 끝났다. 저장은 「저장했습니다」를 내는데 확정만 아무 말이 없으면, 되돌릴 수
     * 없는 쓰기를 하고도 사용자는 그것이 됐는지 확인할 문장을 못 찾는다.
     */
    confirmSucceeded: '판정을 확정했습니다.',

    /*
     * 부분 입고 허용 — ⚠ **자리는 확정이고 규칙만 미정이다**(스펙 §8 #2 · omf-mes#64).
     * 불합격분을 떼고 나머지만 받을지가 고객사 협의 사항이라 관련 결정이 전부 유보돼 있다.
     *
     * ⛔ **감추지 않는다.** 감추면 이 화면에 그 갈래가 없는 것이 되고, 협의가 끝나 규칙이
     * 오면 사용자가 「없던 것이 생겼다」로 만난다 — 자리를 미리 보여 두면 「아직 못 쓴다」로
     * 만난다. 둘은 다른 경험이다.
     *
     * ⛔ **누를 수 있게 두지 않는다.** 눌리면 LOT 수량을 정정하는데 어떻게 정정할지가
     * 정해지지 않았다.
     */
    partialReceipt: '부분 입고',
    /** 「부분 입고 허용」 단추의 설명(마우스를 올리면 보이는 글). */
    partialReceiptPending: '부분 입고 허용은 업데이트 예정입니다.',

    /*
     * 재검사 — ⭐ 앞 회차를 고치는 것이 «아니라» 새 회차를 쌓는 일이라는 사실을 문면이
     * 먼저 말한다. 「수정」으로 읽히면 검사자가 앞 판정이 사라지는 줄 알고 망설인다.
     */
    reinspect: '재검사 회차 추가',
    reinspectCancel: '재검사 그만두기',
    reinspectLotNotPending: 'LOT 이 검사 대기 상태가 아니라 재검사할 수 없습니다.',
    /** 아직 만들어지지 않은 회차다 — 번호를 화면이 세지 않으므로 번호 없이 말한다. */
    reinspectRound: '새 회차 (재검사)',
    /**
     * ⭐ **저장해야 회차가 생긴다.** 「검사 시작」 버튼을 두지 않고 첫 임시 저장을 검사 시작
     * 으로 삼은 것과 같은 규율이다 — 누르기만 하고 떠나면 빈 회차가 남지 않는다.
     */
    reinspectNote: '수량을 넣고 임시 저장하면 새 회차가 만들어집니다. 앞 회차는 그대로 남습니다.',
    /**
     * ⛔ **사유를 지어내지 않는다.** 계약은 재검사 사유를 선택으로 받지만 고를 값 목록이
     * 아직 정해지지 않았다. 칸을 감추지 않고 왜 없는지 밝힌다(공유계약 G-2).
     */
    reinspectReasonPending:
      '재검사 사유는 아직 고를 수 없습니다. 사유 목록이 정해지면 이 자리에 추가됩니다.',
  },

  /**
   * 이전 회차 — ⛔ **읽기 전용이다.** 정정하지 않고 새 회차를 쌓는다(스펙 §5-3).
   */
  history: {
    heading: '이전 회차',
    /** 최종 판정 거르기 칩(#185). */
    filterLabel: '최종 판정 거르기',
    filterAll: '전체',
    caption: '이전 검사 회차',
    columns: {
      round: '회차',
      judgment: '최종 판정',
      accepted: '합격',
      rejected: '불합격',
      held: '보류',
      confirmedAt: '확정 시각',
    },
    /** 아직 확정되지 않은 회차의 확정 시각 — 없는 것을 빈칸으로 두지 않는다. */
    notConfirmed: '미확정',
  },

  /** 항목별 측정치 그리드(스펙 §4-C). 줄은 「항목 × 샘플」이다. */
  measurements: {
    heading: '점검 항목',
    caption: '검사 항목별 결과',
    loading: '점검 항목을 불러오는 중입니다.',
    /** 기준 버전에 항목이 하나도 없다. 화면이 고칠 수 있는 것이 아니다. */
    noItems: '등록된 검사 항목이 없습니다.',
    noItemsHint: '검사 기준 정보를 확인해 주세요.',
    columns: {
      item: '검사 항목',
      spec: '규격',
      sample: '측정 회차',
      value: '측정 결과',
      judgment: '판정',
    },
    /** 필수 항목 표시. 라벨 문자열에 붙이지 않고 따로 낸다 — 접근 이름이 흐려지지 않게. */
    requiredMark: '필수',
    /** 측정치 판정(`INSPECTION_MEASUREMENT_JUDGMENT`)의 화면 이름(#133) — 모르는 코드는 코드 그대로 보인다. */
    judgmentNames: { ACCEPTED: '합격', REJECTED: '불합격' } as Record<string, string>,
    /** 판정 거르기 칩(#185). */
    filterLabel: '판정 거르기',
    filterAll: '전체',
    /** 「2회차」 — 이 항목을 기준이 정한 횟수만큼 잴 때 몇 번째인가(#133). */
    sampleOf: (sampleNo: number): string => `${String(sampleNo)}회차`,
    /** 예/아니오 항목의 결과(#133). */
    booleanTrue: '양호',
    booleanFalse: '불량',
    /**
     * 규격 — **한쪽만 있는 것도 규격이다.** 계약이 상하한을 「둘 다 있을 때만」 견주므로
     * 한쪽만 있는 항목이 정상이고, 「9.9 이상」 같은 공차는 실제 검사기준에 흔하다.
     * ⛔ 둘 다 있을 때만 내면 화면이 「규격 없음」이라고 말해 검사자가 공차를 모르고 잰다.
     */
    range: (lower: number, upper: number): string => `${lower} ~ ${upper}`,
    atLeast: (lower: number): string => `${lower} 이상`,
    atMost: (upper: number): string => `${upper} 이하`,
    target: (value: number): string => `기준값 ${value}`,
    /** 기준값과 상하한이 대칭일 때(#133). */
    tolerance: (value: number, delta: number): string => `${value} ± ${delta}`,
    withTarget: (limits: string, value: number): string => `${limits} (기준값 ${value})`,
    /** 아직 재지 않았다. 빈 칸으로 두면 「없음」인지 「못 불러왔는지」 구분되지 않는다. */
    notMeasured: '—',
    /**
     * ⚠ 계측기 교정이 만료된 상태로 잰 값이 있다. ⛔ **차단하지 않는다** — 무효화 정책이
     * 아직 정해지지 않았고(스펙 §8-6), 계약도 서버 판정 플래그를 내려 줄 뿐 자동 제외하지
     * 않는다. 화면은 **알리기만** 한다.
     */
    calibrationWarningTitle: '교정이 만료된 계측기로 잰 값이 있습니다',
    calibrationWarning:
      '해당 측정치를 다시 확인하세요. 검사를 막지는 않습니다 — 계측기 교정은 설비 담당자에게 문의하세요.',
    calibrationExpired: '교정 만료',
  },

  pageNav: {
    label: '검사 대기 목록 쪽 이동',
    /** 「51–100 / 전체 120건」 — 총계를 밝혀야 조건을 더 좁힐지 판단할 수 있다. */
    range: (start: number, end: number, total: number): string =>
      `${start}–${end} / 전체 ${total}건`,
    /** 보이는 것이 없을 때. **범위를 지어내지 않고** 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `전체 ${total}건`,
    previous: '이전',
    next: '다음',
    /** 결과는 있는데 이 쪽에는 없다. 조건이 아니라 쪽이 문제이므로 앞쪽으로 가라고 말한다. */
    beyondLast: '이 쪽에는 결과가 없습니다. 앞쪽으로 돌아가 보세요.',
    toFirstPage: '첫 쪽으로',
  },
} as const;
