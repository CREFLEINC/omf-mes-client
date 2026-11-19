/**
 * W-01-01 IQC 수입검사 · 판정 — 새 흐름(입하 LOT 하나 = 검사 의뢰 하나, 005 · omf-all-around#254 · screens/W-01-01.md).
 * OA(`iqc-inspection`) · 부품(`parts-iqc-inspection`) 두 변형이 함께 쓴다. 이전 데이터 IQC(대상 LOT)는 기존 문구 그대로.
 *
 * 구획: queue(대기열 행) · detail(머리 · LOT 표 · 배너) · results(결과 표) · drawer(결과 드로어) · history(변경 이력)
 * · split(분리 창) · confirm(판정 확정 · C4) · cancel(확정 취소 · C4).
 */
/** 「으로/로」 — 받침이 없거나 ㄹ 받침이면 「로」(보류로 · 합격으로). */
const ro = (word: string): string => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const final = code >= 0 && code < 11172 ? code % 28 : 0;

  return final === 0 || final === 8 ? '로' : '으로';
};

export const iqcInboundLot = {
  queue: {
    columns: {
      /** 입하 LOT 행이 있으면 첫 칸 머리가 이것이 된다. */
      inboundLotNo: '입하 LOT',
      lotCount: '자재 관리 LOT',
      overallJudgment: '종합 판정',
    },
    /** 첫 칸 아래 줄 — 분리로 생긴 입하 LOT 이면 원천 번호의 끝 4자리. */
    splitFrom: (tail: string) => `분리 ← ${tail}`,
    /** 자재 관리 LOT 칸 — 「3개」 아래 「3,000 EA」. */
    lotCount: (count: number) => `${count}개`,
    /** 입하 LOT 행의 상태(시안 W0101-After). */
    status: {
      REQUESTED: '대기',
      IN_PROGRESS: '진행',
      /* 판정 확정된 의뢰의 상태는 「완료」(사용자 지시 2026-11-16 · #274). */
      CONFIRMED: '완료',
    },
  },
  detail: {
    title: '상세',
    lotsHeading: (count: number) => `자재 관리 LOT ${count}개`,
    /** 상자 제목 「자재 관리 LOT (2건)」(사용자 시안 2026-11-16 · #274). */
    lotsTitle: '자재 관리 LOT',
    lotsCount: (count: number) => `(${count}건)`,
    /** 상자 제목 오른쪽 「총 2,000 EA」(사용자 시안 2026-11-16 · #274). */
    lotsTotal: (qty: string) => `총 ${qty}`,
    facts: {
      inboundLot: '입하 LOT',
      status: '상태',
      judgment: '종합 판정',
      item: '품목',
      supplier: '공급사',
      request: '검사 의뢰',
      requestedAt: '의뢰 일시',
      inspectedQty: '검사 수량',
      received: '입하',
      plan: '검사 조건',
      splitFrom: '분리 원천',
    },
    status: {
      REQUESTED: '대기',
      IN_PROGRESS: '진행',
      /* 판정 확정된 의뢰의 상태는 「완료」(사용자 지시 2026-11-16 · #274). */
      CONFIRMED: '완료',
    },
    noPermission: '판정 확정·판정 수정은 확정 권한(W-01-15)이 있는 사람이 합니다', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
    columns: {
      lotNo: 'LOT 번호',
      qty: '수량',
      status: '품질 상태',
      /* LOT 마다 적용된(최신) 검사 회차와 그 판정(사용자 시안 2026-11-16 · #274). */
      /* 확정 전에도 「판정」(「판정(예상)」에서 정정 · omf-all-around#296). */
      judgment: '판정',
      applied: '적용 검사',
    },
    noJudgment: '미판정',
    appliedNone: '없음',
    noPackage: '패키징 없음',
    lotStatus: {
      INSPECTION_PENDING: '대기',
      NORMAL: '정상',
      DEFECTIVE: '불량',
      SUSPECT_HOLD: '의심 보류',
    },
    goodsReceived: '입고 완료',
    /* 「결과 n」 → 「n회차」(사용자 지시 2026-11-16 · omf-all-around#274) — 이 파일의 결과 한 건 표기 모두. */
    appliedSeq: (seqNo: number) => `${seqNo}회차`,
    poHeading: '발주 정보',
    poLine: (no: string, lineNo: number, qty: string) => `${no}/${lineNo} · ${qty}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
    poNone: (qty: string) => `P/O 없음 ${qty}`,
    poJoin: (parts: readonly string[]) => parts.join(' · '), // ui-check-ignore: C-13 설계 확정 표기(screens/W-01-01.md)
    poEmpty: '입하 마감 전이라 P/O 매칭이 없습니다',
    banner: {
      acceptedTitle: '검사 합격 확정',
      accepted: (count: number) =>
        `자재 관리 LOT ${count}개가 모두 정상 처리되었습니다. 입고할 수 있습니다.`,
      /* 불합격 확정 안내(사용자 시안 2026-11-16 · #274). */
      rejectedTitle: '검사 불합격 확정',
      rejected: (count: number, ncNo: string | null) =>
        ncNo === null
          ? `자재 관리 LOT ${count}개가 모두 불량 처리되었습니다.`
          : `자재 관리 LOT ${count}개가 모두 불량 처리되었습니다. 부적합 ${ncNo}에서 후속 처분을 진행하세요.`,
      ncOpen: '부적합 처분 관리로 이동',
      heldTitle: '검사 보류 확정',
      held: '자재 관리 LOT는 검사 대기로 남습니다. 다시 검사하려면 판정 수정 후 검사 결과를 추가하세요.',
    },
    pick: '검사 의뢰를 선택하세요.',
    loadFailed: '검사 의뢰를 불러오지 못했습니다.',
    retry: '다시 불러오기',
    loading: '검사 의뢰를 불러오는 중입니다',
  },
  results: {
    heading: (count: number) => `검사 결과 ${count}건`,
    /** 상자 제목 「검사 결과 (0건)」(사용자 시안 2026-11-16 · #274) — 자재 관리 LOT 상자와 같은 모양. */
    title: '검사 결과',
    count: (count: number) => `(${count}건)`,
    add: '검사 결과 추가',
    columns: {
      /* 머리 · 빈 값 표기(사용자 시안 2026-11-16 · #274). */
      seq: '검사 회차',
      judgment: '판정',
      inspectedQty: '검사 수량',
      defects: '불량',
      matched: '적용 LOT 번호',
      inspector: '검사자',
      actions: '상태',
    },
    seq: (seqNo: number) => `${seqNo}회차`,
    noMatch: '매칭 없음',
    edit: '수정',
    remove: '삭제',
    lockedRow: '확정',
    empty: '등록된 검사 결과가 없습니다.',
    noJudgment: '판정 없음',
    /** 지우기 확인(사용자 시안 2026-11-16 · #274) — 숫자 끝소리에 맞춰 「을/를」. */
    deleteTitle: (seqNo: number) => `${seqNo}회차 검사 결과를 삭제하시겠습니까?`,
    deleteBody: '측정값, 불량 내역 및 LOT 매칭 정보가 함께 삭제됩니다.',
    noDefects: '없음',
    deleteCancel: '취소',
    deleteConfirm: '삭제',
    deleted: (seqNo: number) => `${seqNo}회차 검사 결과를 삭제했습니다.`,
    deleteFailed: '결과를 지우지 못했습니다.',
    conflict: '이미 바뀌었습니다',
    reload: '다시 불러오기',
    lockedWrite: '판정 확정됨 — 결과를 고칠 수 없습니다',
    /** 자재 관리 LOT 별 판정(FR-023 · 2026-11-12). */
    lotJudgments: {
      /* 상자 · 안내 문구(사용자 시안 2026-11-16 · omf-all-around#274). 「최신」은 순번이 가장 큰(마지막으로 등록한) 결과다. */
      heading: 'LOT별 판정 변경',
      /** 「LOT 0001: 결과 1 불합격 → 결과 2 합격(사유)」 */
      superseded: (
        lotTail: string,
        beforeSeq: number,
        before: string,
        afterSeq: number,
        after: string,
        reason: string | null,
      ) =>
        `LOT ${lotTail}: ${beforeSeq}회차 ${before} → ${afterSeq}회차 ${after}${reason === null ? '' : `(${reason})`}`,
    },
    /** 결과 행의 재검 사유. */
    reason: (name: string) => `재검 사유: ${name}`,
  },
  drawer: {
    addTitle: (seqNo: number) => `${seqNo}회차 검사 결과 추가`,
    editTitle: (seqNo: number) => `${seqNo}회차 검사 결과 수정`,
    matchHeading: '자재 관리 LOT 매칭',
    selectAll: '전부 선택',
    /** 고른 LOT 을 모두 푼다(사용자 지시 2026-11-16 · #274). */
    selectNone: '전부 해제',
    matchRequired: '자재 관리 LOT를 1개 이상 고르세요',
    reasonHeading: '재검 사유',
    reasonPlaceholder: '재검 사유 선택',
    /** 사유가 필요한 까닭 — 「LOT 0001: 결과 1 불합격 → 합격」을 줄마다. */
    reasonHelp: '이 결과가 아래 자재 관리 LOT 의 판정을 바꿉니다. 재검 사유를 고르세요.',
    reasonLine: (lotTail: string, seqNo: number, before: string, after: string) =>
      `LOT ${lotTail}: ${seqNo}회차 ${before} → 이 회차 ${after}`,
    reasonRequired: '재검 사유를 고르세요',
    reasonLoadFailed: '재검 사유 목록을 불러오지 못했습니다.',
    /** 서버 400 — 판정 규칙(2026-11-12). */
    ruleErrors: {
      MATCHED_LOT_REQUIRED: '자재 관리 LOT를 1개 이상 고르세요',
      REINSPECTION_REASON_REQUIRED:
        '이 결과가 불합격이나 보류 판정을 바꿉니다. 재검 사유를 고르세요',
    },
    alsoMatched: (seqNos: string) => `${seqNos}회차에도 매칭됨`,
    judgmentRequired: '판정을 고르세요.',
    cancel: '취소',
    /** 사용자 지시 2026-11-16 · #274 — 「저장」에서 정정. */
    save: '제출',
    discardBody: '입력한 내용이 사라집니다. 닫을까요?',
    discardStay: '계속 입력',
    discardLeave: '닫기',
    added: (seqNo: number, judgment: string) =>
      `${seqNo}회차 검사 결과를 기록했습니다. 종합 판정 미리 보기: ${judgment}`,
    updated: (seqNo: number) => `${seqNo}회차 검사 결과를 고쳤습니다.`,
    loading: '결과를 불러오는 중입니다',
  },
  history: {
    /** 탭 이름 — 「변경 이력」에서 정정(사용자 지시 2026-11-16 · omf-all-around#274). */
    open: '작업 이력',
    /** 상세 탭 이름 — 결과 · 판정 확정 · 분리 등은 이 탭 안에(#274). */
    detailTab: '상세 정보',
    title: (inboundLotNo: string) => `작업 이력 · ${inboundLotNo}`, // ui-check-ignore: C-13 표 이름(화면에 보이지 않음)
    columns: { when: '일시', who: '작업자', what: '작업 유형', detail: '상세 내용' },
    events: {
      /** 의뢰가 생김(입하 마감) — 서버가 이력 첫 줄로 싣는다(G2 L1). */
      REQUESTED: '검사 의뢰 생성',
      RESULT_ADDED: '결과 기록',
      RESULT_UPDATED: '결과 수정',
      RESULT_DELETED: '결과 삭제',
      CONFIRMED: '판정 확정',
      CONFIRM_CANCELLED: '판정 확정 취소',
      REOPENED_BY_REWORK: '재작업으로 다시 열림',
      SKIPPED: '검사 생략',
      SKIP_VOIDED: '검사 생략 무효(마감 취소)',
      SPLIT_OUT: '자재 관리 LOT 분리',
      SPLIT_IN: '분리로 생김',
      CANCELLED_BY_REOPEN: '마감 취소로 의뢰 취소',
    } as Record<string, string>,
    empty: '남은 이력이 없습니다.',
    /** 「내용」의 재검 사유(G2 M4). */
    reinspectionReason: (name: string) => `재검 사유: ${name}`,
    /** 결과 요약 — 「합격 · 검사 200 · 매칭 0001, 0002」(T139 · 서버 이력 한 줄과 같은 모양). */
    noJudgment: '판정 없음',
    inspected: (qty: string) => `검사 ${qty}`,
    /** 판정 수량 — 「합격 150」(T142). */
    judgedQty: (judgment: string, qty: string) => `${judgment} ${qty}`,
    matched: (lotTails: readonly string[]) => `매칭 ${lotTails.join(', ')}`,
    /** 결과 수정 — 「결과 2 수정 — {전} → {후}」(screens/W-01-01 「변경 이력」). */
    resultUpdated: (round: number | null, before: string, after: string) =>
      `${round === null ? '결과' : `${String(round)}회차`} 수정 · ${before} → ${after}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
    /** 분리(떠난 쪽) — 「0003, 0004 → IL-…」. 번호를 못 읽으면 개수로. */
    splitOut: (lotTails: readonly string[] | null, count: number, toInboundLotNo: string | null) =>
      `${lotTails === null ? `자재 관리 LOT ${String(count)}개` : lotTails.join(', ')} → ${toInboundLotNo ?? '새 입하 LOT'}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
    /** 분리(생긴 쪽) — 「IL-… 에서 자재 관리 LOT n개」. */
    splitIn: (fromInboundLotNo: string | null, count: number) =>
      `${fromInboundLotNo ?? '원래 입하 LOT'} 에서 자재 관리 LOT ${String(count)}개`,
    loadFailed: '변경 이력을 불러오지 못했습니다.',
    close: '닫기',
  },
  /**
   * 검사 결과 상자의 파일 첨부(사용자 지시 2026-11-18 · omf-all-around#296) — [파일 첨부] → 연결할 자재 관리 LOT 고르기 → [저장].
   * 파일은 고른 LOT 마다 붙고(서버 첨부 대상은 LOT), 표는 이 입하 LOT 의 LOT 첨부를 파일 하나에 한 줄로 모은다.
   */
  attachments: {
    open: '파일 첨부',
    title: '파일 첨부',
    fileHeading: '첨부할 파일',
    pick: '파일 선택',
    removeFile: (name: string) => `${name} 제거`,
    fileRequired: '첨부할 파일을 고르세요',
    lotHeading: '연결할 자재 관리 LOT',
    lotRequired: '자재 관리 LOT를 1개 이상 고르세요',
    cancel: '취소',
    save: '저장',
    saved: (count: number) => `파일 ${count}개를 첨부했습니다.`,
    failed: '일부 파일을 올리지 못했습니다. 다시 저장하면 남은 것만 올립니다.',
    tableTitle: '첨부 파일',
    count: (count: number) => `(${count}건)`,
    columns: {
      fileName: '파일명',
      lots: '연결 LOT 번호',
      size: '크기',
      uploadedAt: '등록 일시',
    },
    empty: '첨부한 파일이 없습니다.',
    loadFailed: '첨부 파일을 불러오지 못했습니다.',
    download: (name: string) => `${name} 내려받기`,
    downloadFailed: '파일을 내려받지 못했습니다. 다시 시도하세요.',
  },
  /** 자재 관리 LOT 분리 창(권한 W-01-01 · 확정 전만 · T092 · T093). */
  split: {
    open: '자재 관리 LOT 분리',
    title: '자재 관리 LOT 분리',
    /* 「P/O 배분」은 안내에서 뺀다 — 옮겨질 배정은 미리 보기 「옮겨지는 P/O 매칭」이 보인다(screens/W-01-01.md 시안과 다른 점). */
    /** 안내 한 줄 · 목록 제목 · 고른 수(사용자 시안 2026-11-16 · omf-all-around#274). */
    intro: '선택한 LOT를 별도의 입하 LOT로 분리하여 판정합니다.',
    lotList: '분리할 LOT',
    pickedCount: (picked: number, total: number) => `${String(picked)}/${String(total)}개 선택`,
    resultChip: (seqNo: number) => `${String(seqNo)}회차`,
    allSelected:
      '원래 입하 LOT 에 자재 관리 LOT 가 하나 이상 남아야 합니다. 모두 불량이면 분리하지 말고 이 입하 LOT 를 그대로 확정·처분하세요.', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
    noneSelected: '분리할 자재 관리 LOT 를 고르세요.',
    noVersion: '입하 LOT 정보를 다시 불러온 뒤 분리하세요.',
    preview: '미리 보기',
    previewLoading: '미리 보기를 불러오는 중입니다.',
    previewFailed: '미리 보기를 불러오지 못했습니다. 다시 고르거나 창을 닫고 다시 여세요.',
    newLot: (count: number, qty: string, inProgress: boolean) =>
      `새 입하 LOT — 자재 관리 LOT ${String(count)}개 · ${qty}, IQC 검사 새로 생김(${inProgress ? '검사 진행 중' : '검사 대기'})`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
    remaining: (inboundLotNo: string, before: string, after: string, count: number) =>
      `${inboundLotNo} 입하 수량 ${before} → ${after} (자재 관리 LOT ${String(count)}개 남음)`,
    movedResults: '옮겨지는 결과',
    movedResultsNote: '(옮긴 LOT 에만 매칭)',
    renumber: '새 검사에서 순번 1부터 다시 매깁니다',
    unmatchedResults: '남고 매칭만 빠지는 결과',
    unmatchedResultsNote: '(다른 LOT 와 함께 매칭)',
    matchRemoved: (tails: string) => `${tails} 매칭 제거`,
    keptResults: '그대로 남는 결과',
    noMatch: '(매칭 없음)',
    movedAllocations: '옮겨지는 P/O 매칭',
    noPo: 'P/O 없음',
    poLine: (purchaseOrderNo: string, lineNo: number) => `${purchaseOrderNo}/${String(lineNo)}`,
    toNewLot: '→ 새 입하 LOT',
    none: '없음',
    reason: '분리 사유 (선택)',
    reasonPlaceholder: '분리 사유를 입력하세요',
    cancel: '취소',
    submit: '분리',
    done: (newInboundLotNo: string, count: number) =>
      `${newInboundLotNo} 로 자재 관리 LOT ${String(count)}개를 분리했습니다. 두 입하 LOT 를 각각 판정 확정하세요.`,
    lockedConfirmed: '판정 확정 뒤에는 분리할 수 없습니다',
    lockedSingle: '자재 관리 LOT 가 2개 이상이어야 합니다',
    finalized: '최종 마감된 입하 LOT 는 분리할 수 없습니다',
    conflict: '다른 사용자가 먼저 바꿨습니다. 창을 닫고 다시 불러온 뒤 분리하세요.',
    failed: '분리하지 못했습니다. 창을 닫고 다시 불러온 뒤 다시 시도하세요.',
  },
  confirm: {
    open: '판정 확정',
    lockedNoResults: '결과가 1건 이상이어야 합니다',
    /** 재작업으로 다시 연 뒤 새 결과가 없다(G2 L2). */
    lockedNoNewResult: '다시 열린 검사입니다. 새 결과를 1건 이상 기록하세요',
    lockedNoJudgment: '판정이 없는 결과가 있습니다',
    /**
     * 확인 창은 PQC · OQC 와 같은 `JudgmentConfirmDialog` — 안내 글만 IQC 것을 준다. 「확정 시 적용 사항」 구획은 두지 않는다
     * (사용자 지시 2026-11-18 · omf-all-around#296).
     */
    note: '확정 후 확정 취소로 수정할 수 있습니다.', // ui-check-ignore: C-13 사용자 지정 문구(omf-all-around#296)
    doneRejected: (ncNo: string | null) =>
      ncNo === null
        ? '불합격으로 확정했습니다. 부적합이 생겼습니다.'
        : `불합격으로 확정했습니다. 부적합 ${ncNo} 이 생겼습니다.`,
    done: (judgment: string) => `${judgment}${ro(judgment)} 확정했습니다.`,
    conflict: '이미 바뀌었습니다',
    reload: '다시 불러오기',
    failed: '판정을 확정하지 못했습니다.',
    noPermission: '판정 확정·판정 수정은 확정 권한(W-01-15)이 있는 사람이 합니다', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
  },
  cancel: {
    /* 단추 이름 「확정 취소」 → 「판정 수정」(사용자 지시 2026-11-18 · omf-all-around#296). 서버 동작(:cancel-confirm)은 같다. */
    open: '판정 수정',
    /* 확인 창(사용자 시안 2026-11-17 · omf-all-around#286) — 질문 제목 · 대상 · 「취소 시 변경 사항」 상자 · 안내 한 줄. */
    title: '판정을 수정하시겠습니까?',
    target: (inboundLotNo: string) => `대상 LOT: ${inboundLotNo}`,
    changesHeading: '취소 시 변경 사항',
    /* 변경 사항 상자 — LOT 묶음(LOT 수 · 품질 상태) · 결과 묶음(사용자 시안 2026-11-19 · omf-all-around#296). */
    lotsLabel: '자재 관리 LOT',
    lotsCount: (count: number) => `${count}개`,
    qualityState: '품질 상태',
    lotsFrom: '확정',
    lotsTo: '검사 대기 · 보류', // ui-check-ignore: C-13 사용자 시안 표기(omf-all-around#286)
    nonconformance: (ncNo: string) => `부적합 ${ncNo}`,
    nonconformanceTo: '취소 상태로 변경',
    /* 검사 결과 · 적용 검사 일시 줄(사용자 지시 2026-11-18 · omf-all-around#296) — 결과는 지워지지 않고 그대로 남는다. */
    resultsLabel: '검사 결과',
    resultsKept: (count: number) => `${count}건 유지`,
    applied: '적용 검사',
    appliedValue: (seqNo: number, when: string) => `${seqNo}회차 (${when})`,
    /* 안내는 한 줄로(사용자 시안 2026-11-19) — 결과는 남는다는 말을 앞에. */
    note: '기존 검사 결과는 유지됩니다. 판정 수정 후 결과를 수정하고 다시 확정할 수 있습니다. 기존 확정 내역과 알림은 유지됩니다.',
    reason: '취소 사유 (선택)',
    reasonPlaceholder: '취소 사유를 입력해 주세요.',
    back: '취소',
    proceed: '판정 수정',
    done: '판정 확정을 취소했습니다. 결과를 다시 고칠 수 있습니다.',
    blockedTitle: '판정을 수정할 수 없습니다',
    blockedLead: '아래 일이 이미 진행되어 판정을 수정할 수 없습니다.',
    blockedTail:
      '입고를 취소하거나 상태 변경을 되돌린 뒤 다시 시도하세요. 불합격 건의 처분·특채가 시작됐으면 W-03-10 에서 처리합니다.', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
    blockedOk: '확인',
    blockers: {
      GOODS_RECEIVED: '입고된 자재 관리 LOT 가 있습니다',
      LOT_STATUS_CHANGED: 'IQC 밖에서 상태가 바뀐 자재 관리 LOT 가 있습니다 (의심 보류 등)',
      DISPOSITION_STARTED: '부적합 처분이 시작됐습니다',
      CONCESSION_EXISTS: '특채 요청이 있습니다',
      INBOUND_LOT_FINALIZED: '최종 마감된 입하 LOT 입니다(W-01-16)',
    } as Record<string, string>,
    failed: '확정을 취소하지 못했습니다.',
  },
} as const;
