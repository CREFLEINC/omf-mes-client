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
    /** 대기열 위 안내(screens/W-01-01.md 「화면 구조」). */
    closingHint: '입하 마감 전(입하 중)인 입하 LOT는 대기열에 나오지 않습니다',
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
      REQUESTED: '검사 대기',
      IN_PROGRESS: '검사 진행 중',
      CONFIRMED: '판정 확정',
    },
    /** 확정 전 종합 판정 미리 보기. */
    preview: (judgment: string) => `${judgment} (미리 보기)`,
    previewTitle: '확정 전 미리 보기',
    /** 표 아래 건수 — 지금 쪽의 줄로 센다. */
    counts: (total: number, requested: number, inProgress: number, confirmed: number) =>
      `전체 ${total}건 · 대기 ${requested} · 진행 ${inProgress} · 확정 ${confirmed}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
  },
  detail: {
    title: '상세',
    lotsHeading: (count: number) => `자재 관리 LOT ${count}개`,
    lotsNote: '상태는 판정 확정 때만 바뀝니다',
    facts: {
      item: '품목',
      supplier: '공급사',
      request: '검사 의뢰',
      inspectedQty: '검사 수량',
      inspectedQtyValue: (qty: string, count: number) => `${qty} (자재 관리 LOT ${count}개 합)`,
      received: '입하',
      receivedValue: (when: string, channel: string | null) =>
        channel === null ? when : `${when} (${channel})`,
      plan: '검사 조건',
      splitFrom: '분리 원천',
    },
    status: {
      REQUESTED: '검사 대기',
      IN_PROGRESS: '검사 진행 중',
      CONFIRMED: '판정 확정',
    },
    preview: (judgment: string) => `${judgment} (미리 보기)`,
    noPermission: '판정 확정·확정 취소는 확정 권한(W-01-15)이 있는 사람이 합니다', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
    columns: {
      lotNo: '자재 관리 LOT 번호',
      qty: '수량 · 패키징', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
      status: '품질 상태',
      matched: '매칭 결과',
    },
    noPackage: '패키징 없음',
    lotStatus: {
      INSPECTION_PENDING: '검사 대기',
      NORMAL: '정상',
      DEFECTIVE: '불량',
      SUSPECT_HOLD: '의심 보류',
    },
    goodsReceived: '입고됨',
    matchedChip: (seqNo: number) => `결과 ${seqNo}`,
    none: '없음',
    lockedComposition:
      '입하 마감으로 구성이 고정되었습니다. 바꾸려면 IQC 결과를 모두 지운 뒤 PDA에서 마감 취소, 또는 자재 관리 LOT 분리',
    lockedConfirmed:
      '판정 확정된 입하 LOT 입니다. 자재 관리 LOT 해제·추가·분리를 할 수 없습니다. 분리가 필요하면 확정 취소 뒤 분리하거나, 불합격이면 처분 단계 선별(W-03-10)을 쓰세요.', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
    poHeading: '입하 LOT P/O 매칭(참고)',
    poLine: (no: string, lineNo: number, qty: string) => `${no}/${lineNo} · ${qty}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
    poNone: (qty: string) => `P/O 없음 ${qty}`,
    poJoin: (parts: readonly string[]) => parts.join(' · '), // ui-check-ignore: C-13 설계 확정 표기(screens/W-01-01.md)
    poEmpty: '입하 마감 전이라 P/O 매칭이 없습니다',
    banner: {
      preview: (judgment: string, count: number) =>
        `종합 판정 미리 보기: ${judgment} — 결과 ${count}건 기준(불합격 > 보류 > 합격). 확정 전이라 자재 관리 LOT 상태는 검사 대기 그대로입니다.`,
      empty:
        '아직 결과가 없습니다. [결과 추가]로 검사 결과를 기록하세요. 결과가 1건 이상이어야 판정 확정할 수 있습니다.',
      accepted: (count: number) =>
        `판정 확정됨 · 합격 — 자재 관리 LOT ${count}개 모두 정상(검사 대기 보류 해제). 입고할 수 있습니다.`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
      rejected: (count: number) => `판정 확정됨 · 불합격 — 자재 관리 LOT ${count}개 모두 불량.`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
      ncLabel: '부적합',
      rejectedNcTail:
        '(판정 대기)에 자재 관리 LOT 전부를 담았고 불합격 알림을 보냈습니다. 양품으로 쓰려면 부적합 처분 관리(W-03-10)에서 선별·특채합니다.', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
      held: '판정 확정됨 · 보류 — 자재 관리 LOT 는 검사 대기로 남습니다. 다시 검사하려면 확정 취소 뒤 결과를 더하세요.', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
      by: (who: string, when: string) => `${who} · ${when}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
    },
    pick: '검사 의뢰를 선택하세요.',
    loadFailed: '검사 의뢰를 불러오지 못했습니다.',
    retry: '다시 불러오기',
    loading: '검사 의뢰를 불러오는 중입니다',
  },
  results: {
    heading: (count: number) => `검사 결과 ${count}건`,
    add: '결과 추가',
    columns: {
      seq: '순번',
      judgment: '판정',
      inspectedQty: '검사 수량',
      defects: '불량 · 유형', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
      matched: '매칭 자재 관리 LOT',
      inspector: '검사자',
      actions: '작업',
    },
    seq: (seqNo: number) => `결과 ${seqNo}`,
    noMatch: '매칭 없음',
    edit: '수정',
    remove: '삭제',
    lockedRow: '확정됨',
    lockedHead: '판정 확정됨 — 결과를 고칠 수 없습니다',
    empty: '기록된 결과가 없습니다.',
    noJudgment: '판정 없음',
    deleteTitle: (seqNo: number) => `결과 ${seqNo}를 지울까요?`,
    deleteBody:
      '측정값·불량·매칭이 함께 지워집니다. 지운 순번은 다시 쓰지 않고, 누가 언제 지웠는지 변경 이력에 남습니다.', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
    deleteCancel: '취소',
    deleteConfirm: '지우기',
    deleted: (seqNo: number) => `결과 ${seqNo}를 지웠습니다.`,
    deleteFailed: '결과를 지우지 못했습니다.',
    conflict: '이미 바뀌었습니다',
    reload: '다시 불러오기',
    lockedWrite: '판정 확정됨 — 결과를 고칠 수 없습니다',
    /** 자재 관리 LOT 별 판정(FR-023 · 2026-11-12). */
    lotJudgments: {
      heading: '자재 관리 LOT 별 판정',
      help: '자재 관리 LOT 마다 그 LOT 를 매칭한 마지막 결과(순번이 가장 큰 결과)로 판정하고, 종합 판정은 그중 가장 나쁜 것입니다(불합격 > 보류 > 합격).',
      byResult: (seqNo: number) => `결과 ${seqNo}`,
      /** 「LOT 0001: 결과 1 불합격 → 결과 2 합격(사유)」 */
      superseded: (
        lotTail: string,
        beforeSeq: number,
        before: string,
        afterSeq: number,
        after: string,
        reason: string | null,
      ) =>
        `LOT ${lotTail}: 결과 ${beforeSeq} ${before} → 결과 ${afterSeq} ${after}${reason === null ? '' : `(${reason})`}`,
      unmatched: (count: number) =>
        `매칭한 결과가 없는 자재 관리 LOT ${count}개는 판정에서 빠집니다`,
    },
    /** 결과 행의 재검 사유. */
    reason: (name: string) => `재검 사유: ${name}`,
  },
  drawer: {
    addTitle: (seqNo: number) => `결과 ${seqNo} 추가`,
    editTitle: (seqNo: number) => `결과 ${seqNo} 수정`,
    matchHeading: '자재 관리 LOT 매칭',
    matchHelp:
      '이 결과가 어느 자재 관리 LOT 를 보고 기록됐는지 1개 이상 고르세요. 이 입하 LOT 의 자재 관리 LOT 만 보입니다.',
    matchNote:
      '표본을 섞어 검사했으면 [전부 선택]을 누르세요. 같은 자재 관리 LOT 를 여러 결과에 매칭할 수 있습니다. 자재 관리 LOT 마다 그 LOT 를 매칭한 마지막 결과(순번이 가장 큰 결과)로 판정합니다.',
    selectAll: '전부 선택',
    matchRequired: '자재 관리 LOT를 1개 이상 고르세요',
    reasonHeading: '재검 사유',
    reasonPlaceholder: '재검 사유 선택',
    /** 사유가 필요한 까닭 — 「LOT 0001: 결과 1 불합격 → 합격」을 줄마다. */
    reasonHelp: '이 결과가 아래 자재 관리 LOT 의 판정을 바꿉니다. 재검 사유를 고르세요.',
    reasonLine: (lotTail: string, seqNo: number, before: string, after: string) =>
      `LOT ${lotTail}: 결과 ${seqNo} ${before} → 이 결과 ${after}`,
    reasonRequired: '재검 사유를 고르세요',
    reasonLoadFailed: '재검 사유 목록을 불러오지 못했습니다.',
    /** 서버 400 — 판정 규칙(2026-11-12). */
    ruleErrors: {
      MATCHED_LOT_REQUIRED: '자재 관리 LOT를 1개 이상 고르세요',
      REINSPECTION_REASON_REQUIRED:
        '이 결과가 불합격이나 보류 판정을 바꿉니다. 재검 사유를 고르세요',
    },
    alsoMatched: (seqNos: string) => `결과 ${seqNos}에도 매칭됨`,
    inputNote: '지금 IQC 양식 그대로 · 회차 없음', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
    saveNote: '저장하면 결과 목록과 종합 판정 미리 보기가 바뀝니다',
    judgmentRequired: '판정을 고르세요.',
    cancel: '취소',
    save: '저장',
    discardBody: '입력한 내용이 사라집니다. 닫을까요?',
    discardStay: '계속 입력',
    discardLeave: '닫기',
    added: (seqNo: number, judgment: string) =>
      `결과 ${seqNo}를 기록했습니다. 종합 판정 미리 보기: ${judgment}`,
    updated: (seqNo: number) => `결과 ${seqNo}를 고쳤습니다.`,
    loading: '결과를 불러오는 중입니다',
  },
  history: {
    open: '변경 이력',
    title: (inboundLotNo: string) => `변경 이력 · ${inboundLotNo}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
    help: '결과 기록·수정·삭제, 판정 확정·취소, 자재 관리 LOT 분리를 누가·언제·무엇을 했는지 남깁니다.', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
    columns: { when: '시각', who: '누구', what: '무엇', detail: '내용' },
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
      `${round === null ? '결과' : `결과 ${String(round)}`} 수정 — ${before} → ${after}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
    /** 분리(떠난 쪽) — 「0003, 0004 → IL-…」. 번호를 못 읽으면 개수로. */
    splitOut: (lotTails: readonly string[] | null, count: number, toInboundLotNo: string | null) =>
      `${lotTails === null ? `자재 관리 LOT ${String(count)}개` : lotTails.join(', ')} → ${toInboundLotNo ?? '새 입하 LOT'}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
    /** 분리(생긴 쪽) — 「IL-… 에서 자재 관리 LOT n개」. */
    splitIn: (fromInboundLotNo: string | null, count: number) =>
      `${fromInboundLotNo ?? '원래 입하 LOT'} 에서 자재 관리 LOT ${String(count)}개`,
    loadFailed: '변경 이력을 불러오지 못했습니다.',
    close: '닫기',
  },
  /** 자재 관리 LOT 분리 창(권한 W-01-01 · 확정 전만 · T092 · T093). */
  split: {
    open: '자재 관리 LOT 분리',
    title: '자재 관리 LOT 분리',
    /* 「P/O 배분」은 안내에서 뺀다 — 옮겨질 배정은 미리 보기 「옮겨지는 P/O 매칭」이 보인다(screens/W-01-01.md 시안과 다른 점). */
    intro:
      '고른 자재 관리 LOT 를 같은 품목·공급사의 새 입하 LOT 로 옮깁니다. 두 입하 LOT 는 각각 판정 확정합니다.', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
    introFollow: '자재 관리 LOT 번호·라벨은 그대로 따라갑니다.', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
    lotList: '분리할 자재 관리 LOT',
    resultChip: (seqNo: number) => `결과 ${String(seqNo)}`,
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
    reason: '사유 (선택)',
    reasonPlaceholder: '예: 0003 외관 찍힘 — 따로 판정',
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
    title: (inboundLotNo: string) => `${inboundLotNo} 판정 확정`,
    counts: (total: number, accepted: number, rejected: number, held: number) =>
      `결과 ${total}건 — 합격 ${accepted} · 불합격 ${rejected} · 보류 ${held}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
    applyHeading: '적용',
    apply: {
      ACCEPTED: (count: number) =>
        `자재 관리 LOT ${count}개 전부 → 정상 (검사 대기 보류 해제, 입고 가능)`,
      REJECTED: (count: number) =>
        `자재 관리 LOT ${count}개 전부 → 불량 부적합 1건(판정 대기)에 자재 관리 LOT 전부를 담고, 불합격 알림을 보냅니다.`,
      HELD: (count: number) => `자재 관리 LOT ${count}개 → 검사 대기 유지(보류)`,
    },
    note: '확정하면 결과를 고치거나 더하거나 지울 수 없습니다. 잘못 확정했으면 [확정 취소]로 되돌립니다(입고·처분 전까지).', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
    back: '돌아가기',
    proceed: (judgment: string) => `${judgment}${ro(judgment)} 판정 확정`,
    doneRejected: (ncNo: string | null) =>
      ncNo === null
        ? '불합격으로 확정했습니다. 부적합이 생겼습니다.'
        : `불합격으로 확정했습니다. 부적합 ${ncNo} 이 생겼습니다.`,
    done: (judgment: string) => `${judgment}${ro(judgment)} 확정했습니다.`,
    conflict: '이미 바뀌었습니다',
    reload: '다시 불러오기',
    failed: '판정을 확정하지 못했습니다.',
    noPermission: '판정 확정·확정 취소는 확정 권한(W-01-15)이 있는 사람이 합니다', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
  },
  cancel: {
    open: '확정 취소',
    title: (inboundLotNo: string) => `${inboundLotNo} 판정 확정 취소`,
    lots: (count: number) => `자재 관리 LOT ${count}개 → 검사 대기 · 보류 로 돌아갑니다`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-01.md)
    nonconformance: (ncNo: string) => `부적합 ${ncNo} 은 취소 상태가 됩니다`,
    results: '결과를 다시 고치고 더할 수 있습니다. 이전 확정 내용은 변경 이력에 남습니다',
    alerts: '이미 보낸 알림은 되돌리지 않습니다',
    reason: '사유 (선택)',
    back: '돌아가기',
    proceed: '확정 취소',
    done: '판정 확정을 취소했습니다. 결과를 다시 고칠 수 있습니다.',
    blockedTitle: '확정을 취소할 수 없습니다',
    blockedLead: '아래 일이 이미 진행되어 판정 확정을 되돌릴 수 없습니다.',
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
