/**
 * W-04-03 OQC 출하검사 판정.
 *
 * 이 화면의 문구는 **검사자가 쓰는 말**로 쓴다 — 「의뢰」·「회차」·「판정」은 현장 어휘이고,
 * 「멱등 키」·「낙관적 잠금」 같은 구현 어휘는 화면에 내지 않는다.
 *
 * ⭐ **이 화면의 저장은 한 번이고 되돌릴 수 없다.** 임시 저장이 없으므로 문구도 「저장했습니다」가
 * 아니라 「판정을 저장했습니다」로 끝난다 — 다음에 고칠 기회가 없다는 사실을 문면이 먼저 말한다.
 */
export const oqcInspection = {
  /* 화면 스펙 §1 의 이름 그대로다 — 사이드바 항목과 같은 글자여야 길을 잃지 않는다. */
  title: 'OQC (출하검사) 조회·판정',
  /** 머리는 관리웹 사이드바 묶음을 따른다 — 「품질 관리 > OQC (출하검사) 조회·판정」. */
  breadcrumbRoot: '품질 관리',

  queue: {
    heading: '검사 대상',
    /**
     * 표 머리. 좌측 창이 화면의 약 1/3 폭이라(스펙 §3) **고르는 데 필요한 넷만** 둔다.
     * 대상 LOT·기준 버전 같은 나머지는 고른 뒤 우측 창이 보인다.
     */
    columns: {
      inspectionRequestNo: '의뢰번호',
      itemId: '품목',
      targetQty: '검사수량',
      statusCode: '상태',
    },
    /** OQC 목록의 「의뢰 일시」 열(#136). 종전 표(PQC 도 쓴다)의 `columns` 와 따로 둔다. */
    requestedAtColumn: '의뢰 일시',
    serialColumn: '시리얼 번호',
    /** OQC 목록의 수량 열 — IQC 와 같은 띄어쓰기(#136). 종전 표(PQC)의 `columns.targetQty` 는 그대로 둔다. */
    targetQtyColumn: '검사 수량',
    serialUnregistered: '미등록',
    /** 대상 유형 코드의 이름(omf-all-around#136) — POP OQC 와 같은 말. 모르는 코드는 코드 그대로다. */
    targetTypes: {
      SHIPMENT_REQUEST: '출하요청',
    } as Readonly<Record<string, string>>,
    /** 「출하요청 #12」 — 대상 유형 이름과 대상번호(#136). */
    target: (typeLabel: string, targetId: number): string => `${typeLabel} #${String(targetId)}`,
    /**
     * 줄의 둘째 행에 서는 대상번호. **머리글이 가리지 못하는 자리라 값이 스스로 이름을 단다** —
     * 좁은 창에 열을 더 세우는 대신 스펙 §3 처럼 한 줄을 두 행으로 쓴다.
     */
    targetId: (targetId: number): string => `대상 ${String(targetId)}`,
    /** 값이 없는 칸. 빈 칸으로 두면 「없음」인지 「못 불러왔는지」 구분되지 않는다. */
    emptyValue: '—',
    /** 이 줄을 여는 버튼의 접근 이름 — 화면에는 의뢰번호만 보이므로 무엇을 여는지 밝힌다. */
    openRow: (inspectionRequestNo: string): string => `검사 의뢰 ${inspectionRequestNo} 열기`,
    caption: '출하검사 대상 목록',
    /**
     * 조회는 됐는데 결과가 없다. 조건을 바꾸는 것이 사용자가 할 수 있는 유일한 조치다.
     *
     * ⛔ **기간을 가리키지 않는다** — 이 화면에 기간 조건이 없다. 없는 컨트롤을 넓히라고 하면
     * 사용자는 찾을 수 없는 것을 찾는다.
     */
    empty: '조회된 검사 의뢰가 없습니다.',
    /** 빈 목록 아래 안내 — 제목과 함께 `EmptyState` 로 보인다(omf-all-around#171). */
    emptyHint: '검색 조건을 변경하거나 필터를 초기화하세요.',
    /**
     * 조회 자체가 실패했다. ⛔ **조건을 넓히라고 말하지 않는다** — 조건은 멀쩡한데 요청이
     * 실패한 것이라, 넓히라고 하면 사용자가 조건을 넓히다가 결국 못 찾는다.
     */
    unavailable: '목록을 표시할 수 없습니다.',
    loading: '검사 의뢰를 불러오는 중입니다.',
  },

  /**
   * 좌측 창의 조건 — **셋뿐이다.**
   *
   * ⭐ 검사 유형(OQC)은 조건이 아니라 **이 화면이 무엇인지의 정의**라서 조건 줄에 두지 않는다.
   * ⛔ 상태 코드를 조건으로 두지 않는다 — 두려면 값 목록을 화면에 고정해야 하는데, 「아직 안 한
   * 것」과 「전부」를 가르는 데는 아래 토글 하나면 된다.
   * ⛔ **기간 조건을 만들지 않는다** — 계약에 자리가 없고, 화면이 다른 날짜로 거르게 된다.
   */
  filters: {
    item: '품목',
    itemPlaceholder: '품목을 입력하세요',
    itemPick: '선택',
    itemClear: '품목 조건 지우기',
    keyword: '의뢰번호 검색',
    keywordPlaceholder: '의뢰번호를 입력하세요',
    /** 기본으로 켜져 있다 — 이 화면에 들어오는 이유가 「아직 판정하지 않은 것」이기 때문이다. */
    pendingOnly: '대기·진행만 보기',
    apply: '조회',
    reset: '초기화',
  },

  /**
   * 상태 배지 — **다섯 값을 가른다.** 「대기·진행만 보기」를 끄면 끝난 의뢰도 함께 온다.
   *
   * ⚠ 생략과 취소를 **합치지 않는다** — 앞은 검사를 안 하기로 승인된 정상 종결이고 뒤는 의뢰가
   * 무효가 된 것이다. 합치면 「검사를 몇 건 생략했나」를 셀 수 없다.
   */
  status: {
    requested: '대기',
    inProgress: '진행',
    completed: '완료',
    skipped: '생략',
    cancelled: '취소',
  },

  /** 우측 창 ① — 고른 의뢰의 대상 정보(스펙 §4-A). */
  detail: {
    /**
     * 우측 창 전체의 이름. **구획 이름(`heading`)과 갈라 둔다** — 같은 글자를 쓰면 랜드마크가
     * 둘 다 「대상 정보」가 되어, 보조기술 사용자가 창과 그 안의 구획을 구분할 수 없다.
     */
    paneLabel: '판정 대상',
    heading: '대상 정보',
    /** 상세 맨 위 — 목록으로 돌아간다. 저장하지 않은 입력이 있으면 한 번 묻는다(IQC #133 과 같다 · #136). */
    backToList: '← 목록',
    leaveUnsaved: '변경사항을 저장하지 않았습니다',
    leaveUnsavedNote: '저장하지 않고 이동하면 입력한 내용이 사라집니다.',
    keepEditing: '계속 작성',
    leaveAnyway: '저장하지 않고 이동',
    /** 쪽 머리 경로의 마지막 마디 — 상세(판정)를 열었을 때(#136). */
    sectionTitle: '검사 기본 정보',
    /** 검사 이력 접는 줄 오른쪽 끝의 건수(#136). */
    historyCount: (count: number): string => `${String(count)}건`,
    /** 검사 이력 탭 안 제목(#136). */
    historyTitle: '검사 처리 이력',
    /** 검사 유형 코드 옆에 붙이는 이름(#136) — 모르는 코드는 코드만 보인다. */
    inspectionTypeNames: { OQC: '출하검사' } as Readonly<Record<string, string>>,
    loading: '의뢰를 불러오는 중입니다.',
    fields: {
      inspectionRequestNo: '의뢰번호',
      inspectionTypeCode: '검사 유형',
      /** 대상 유형 · 대상번호를 한 칸으로(「출하요청 #12」 · #136). */
      target: '대상',
      lotId: '대상 LOT',
      itemId: '품목',
      targetQty: '총 검사 수량',
      /**
       * ⚠ 감추지 않는다. 검사 시점의 기준 버전이 그 검사에 **고정되고** 이후 기준이 바뀌어도
       * 이 검사는 당시 버전으로 남는다. 버전을 감추면 검사자도, 나중에 결과를 읽는 사람도
       * 어느 기준으로 잰 값인지 알 수 없다.
       */
      inspectionPlanVersionId: '적용 기준',
      requestedAt: '의뢰 일시',
    },
    /**
     * 기준이 등록되지 않은 상태에서도 검사를 진행할 수 있어 이 칸이 빌 수 있다.
     * **없는 값과 모르는 값은 다른 모양이어야 한다** — 그래서 일반 빈 값 표시와 다른 글자를 쓴다.
     */
    noPlanVersion: '기준 없음',
    /** OA 사업부 계정은 대상 LOT 대신 시리얼 번호를 본다(#136). */
    serialNo: '시리얼 번호',
    /** 시리얼·피킹 LOT 이 아직 없을 때 — 목록의 「미등록」과 같은 말. */
    unregistered: '미등록',
    more: (first: string, rest: number): string => `${first} 외 ${String(rest)}건`,
  },

  /** 우측 창 ② — 판정 입력. 합계 제약이 이 구획을 지배한다. */
  result: {
    heading: '판정 입력',
    round: (round: number): string => `${round}회차`,
    /** 아직 만들어지지 않은 회차다 — 번호를 화면이 세지 않으므로 번호 없이 말한다. */
    reinspectRound: '새 회차 (재검사)',
    loading: '검사 결과를 불러오는 중입니다.',
    /**
     * 이 회차는 이미 확정됐다. ⛔ **고칠 수 있는 것처럼 보이지 않게 한다** — 판정은 수정하지
     * 않고 재검사로 새 회차를 쌓는다.
     */
    confirmed: '이 회차는 확정되어 고칠 수 없습니다. 다시 판정하려면 재검사 회차를 추가합니다.',
    /**
     * ⭐ **다른 곳에서 만든 「작성중」 회차다.** 이 화면은 임시 저장을 두지 않아 그 회차를 이어
     * 쓰거나 확정할 길이 없다 — 막다른 길로 두지 않고, 여기서 할 수 있는 일(재검사)을 말한다.
     */
    draftElsewhere:
      '이 회차는 다른 곳에서 작성 중이라 이 화면에서는 고칠 수 없습니다. 다시 판정하려면 재검사 회차를 추가합니다.',
    fields: {
      inspectedQty: '총 검사 수량',
      accepted: '합격 수량',
      rejected: '불합격 수량',
      held: '보류 수량',
    },
    /** 실시간 합계. 어긋난 값을 감추지 않는다. */
    sum: '입력 완료',
    remaining: '미입력',
    /** 합계가 검사 수량을 넘었을 때 오른쪽 상태(#136). */
    overBy: (over: string): string => `${over} 초과`,
    /** 입력 현황 막대의 접근 이름(#136). */
    progressLabel: '검사 수량 대비 입력 합계',
    /** 검사 수량 구획 · 판정 구획 제목(IQC #133 과 같은 말 · #136). */
    sectionTitle: '검사 수량 입력',
    judgmentSectionTitle: '판정',
    /** 저장 단추 왼쪽 경고 — 저장이 곧 확정이라 되돌릴 수 없다(#136). */
    saveNote: '판정 저장 후 수정이 불가합니다.',
    /** 넘겼다. 0으로 깎아 감추지 않는다. */
    over: (over: string): string => `검사 수량보다 ${over} 많습니다.`,
    quantityInvalid: '수량은 0 이상, 소수점 여섯 자리까지 넣을 수 있습니다.',

    /** 종합 판정. ⛔ 값 목록을 화면에 고정하지 않는다 — 공통코드 조회로 채운다. */
    judgment: '종합 판정',
    judgmentPlaceholder: '판정을 선택하세요',
    /** 불합격 사유(선택 · #136) — 저장에는 비고로 실린다. */
    rejectionReason: '불합격 사유 (선택)',
    rejectionReasonPlaceholder: '불합격 사유를 입력하세요',
    /**
     * 코드값 시드가 아직 안 들어가 목록이 빌 수 있다. ⛔ **감추지 않고 사유를 밝힌다** —
     * 감추면 그 자리가 왜 없는지 사용자가 알 수 없다.
     */
    judgmentUnavailable: '판정 값 목록이 아직 준비되지 않았습니다. 담당자에게 문의하세요.',
    /**
     * 저장된 판정이 지금 목록에 없다. 사용 중지된 코드일 수 있다 — 조용히 비우면 사용자가
     * 고르지 않았는데 고른 것이 지워진다.
     */
    judgmentUnknown: (code: string): string => `저장된 판정(${code})이 목록에 없습니다.`,

    /**
     * ⭐ **임시 저장이 없다.** 이 버튼 하나가 곧 확정이며, 누르면 확인 창을 거친다.
     */
    save: '판정 저장',
    saving: '저장 중',
    saved: '판정을 저장했습니다.',
    /** 수량이 아닌 값이 남아 있어 확인 창을 열 수 없다. */
    saveBlockedByInvalid: '수량 칸을 고친 뒤 저장할 수 있습니다.',
    /**
     * 비활성 사유 — **뭉개지 않는다.** 푸는 방법이 서로 다르다(스펙 §6).
     */
    blockedByConfirmed: '이미 확정된 회차입니다. 재검사로 새 회차를 쌓으세요.',
    blockedByDraftElsewhere: '다른 곳에서 작성 중인 회차입니다. 재검사로 새 회차를 쌓으세요.',
    blockedByTotals: '입력 수량이 총 검사 수량과 같아야 저장 가능합니다.',
    blockedByJudgmentOptions:
      '판정 값 목록이 준비되지 않아 저장할 수 없습니다. 담당자에게 문의하세요.',
    blockedByJudgment: '종합 판정을 선택해야 저장 가능합니다.',
    /** 합격판정개수 기준 자동 판정(omf-all-around#126) — 기준에 합격판정개수가 있을 때만 선다. IQC(#125)와 같은 규칙이다. */
    judgmentChange: {
      basis: (acceptanceNumber: number): string =>
        `합격판정개수 ${String(acceptanceNumber)} 기준 자동 판정`,
      expected: (judgment: string): string => `자동 판정: ${judgment}`,
      reason: '판정 변경 사유',
      reasonPlaceholder: '판정 변경 사유를 입력하세요',
      required: '자동 판정과 다른 판정은 변경 사유를 입력해야 저장 가능합니다.',
      reasonMissing: '판정 변경 사유를 입력하세요.',
    },

    /*
     * 재검사 — ⭐ 앞 회차를 고치는 것이 «아니라» 새 회차를 쌓는 일이라는 사실을 문면이 먼저
     * 말한다. 「수정」으로 읽히면 검사자가 앞 판정이 사라지는 줄 알고 망설인다.
     */
    reinspect: '재검사 회차 추가',
    reinspectCancel: '재검사 그만두기',
    reinspectNote: '수량과 판정을 넣고 저장하면 새 회차가 만들어집니다. 앞 회차는 그대로 남습니다.',
    /**
     * ⛔ **사유를 지어내지 않는다.** 고를 값 목록이 아직 정해지지 않았다. 칸을 감추지 않고
     * 왜 없는지 밝힌다.
     */
    reinspectReasonPending:
      '재검사 사유는 아직 고를 수 없습니다. 사유 목록이 정해지면 이 자리에 추가됩니다.',

    /*
     * 검사성적서 발행 — ⚠ **자리를 두되 비활성으로 시작한다.**
     *
     * ⛔ 감추지 않는다. 감추면 이 화면에 그 갈래가 «없는 것»이 되고, 계약이 오면 사용자는
     * 「없던 것이 생겼다」로 만난다 — 자리가 보이면 「아직 못 쓴다」로 만난다. 둘은 다른 경험이다.
     */
    coaIssue: '검사성적서 발행',
    coaPending: '검사성적서 발행은 아직 열리지 않았습니다 — 출력물 발행 계약이 준비되면 열립니다.',
  },

  /**
   * 전이 경고 — 되돌릴 수 없는 쓰기 **앞에** 선다.
   *
   * ⛔ **셀 수 없으면 아예 그리지 않는다** — 수량이 수량이 아닌 동안에는 숫자가 거짓이 된다.
   */
  transition: {
    title: '확정하면 LOT 상태가 바뀝니다',
    /** ① 대상 규모를 숫자로 — 지금 친 값을 그대로 되읽는다. */
    quantities: (accepted: string, rejected: string, held: string): string =>
      `합격 ${accepted} · 불합격 ${rejected} · 보류 ${held}`,
    /**
     * 아는 판정일 때만 방향을 말한다. ⛔ 모르는 코드에 방향을 지어내지 않는다.
     * ⭐ 상태 이름은 서버 전이표(`core/document-state/transitions.ts` C4·C5·C6)와 같다 — 합격 → 정상
     *    (다른 보류가 남아 있으면 그대로) · 불합격 → 불량 · 보류 → 검사 대기. POP P-04-06 과 같은 말이다.
     *    대상 LOT 이 있는 의뢰(`lotId`)의 말이다.
     */
    directionRelease: "확정하면 이 LOT 이 '정상' 상태가 됩니다(다른 보류가 없을 때).",
    directionHold: "확정하면 이 LOT 이 '불량' 상태가 됩니다.",
    directionPending: "확정하면 이 LOT 이 '검사 대기' 상태가 됩니다.",
    /**
     * 대상 LOT 이 없는 의뢰 = 출하작업지시(헤더) OQC — 서버가 그 품목 검사 대상 라인이 집은(피킹) LOT 에
     * 판정을 남긴다(`inspection-confirm.service.ts` movePickedOqcLots · omf-all-around#119 · 서버 P-83).
     */
    pickedDirectionRelease: '확정하면 이 LOT 이 출하할 수 있는 상태로 풀립니다.',
    /** 불합격 — 서버가 피킹 LOT 을 불량(C6)으로 옮긴다(omf-all-around#119 D6-c · 서버 P-83). */
    pickedDirectionHold: '확정하면 이 출하작업지시가 집은 LOT 이 불량 상태가 됩니다.',
    /** 보류 — LOT 을 옮기지 않는다(omf-all-around#119 · 2026-10-20 결정 (A) · 서버 P-83). 출하는 관문이 막는다. */
    pickedDirectionPending:
      '보류는 LOT 상태를 바꾸지 않습니다. 이 출하작업지시는 판정이 끝날 때까지 출하할 수 없습니다.',
    /** 모르는 판정 코드 — 방향을 빼고 사실만 남긴다. */
    directionUnknown: '확정하면 LOT 상태가 바뀝니다.',
    /** ② 다른 화면에 미치는 영향. ⚠ 건수를 쓰지 않는다 — 셀 자리가 이 화면에 없다. */
    pickingImpact: '이 LOT 을 쓰는 진행 중 피킹이 함께 막힙니다.',
    /** ③ 되돌림 비용. */
    pickedNotReturned: '이미 피킹된 분은 이 전이로 회수되지 않습니다.',
    noAmendment: '판정은 수정할 수 없습니다 — 번복은 재검사입니다.',
    /**
     * ④ 푸는 경로.
     *
     * ⚠ **링크를 걸지 않고, 사이드바에 없는 이름을 부르지도 않는다.** 처분을 «의뢰»하는 화면이
     * 아직 없어서, 이름을 대면 사용자가 찾을 수 없는 것을 찾는다. 대신 **이 화면이 처분을 정하지
     * 않는다는 사실**과 그 자리가 아직 열리지 않았다는 것을 말한다.
     */
    dispositionPath:
      '불합격분의 처분(재작업·폐기)은 이 화면에서 정하지 않습니다 — 처분 의뢰 화면이 열리면 그곳에서 합니다.',
    /** 판정 구획의 「판정 확정 안내」 상자(#136) — 수량 · 고른 판정 · 되돌릴 수 없음 · LOT 영향. */
    guide: {
      title: '판정 확정 안내',
      quantities: '판정 수량',
      accepted: (qty: string): string => `합격 ${qty}`,
      rejected: (qty: string): string => `불합격 ${qty}`,
      held: (qty: string): string => `보류 ${qty}`,
      selected: '선택한 판정',
      notSelected: '미선택',
      irreversible: '확정 후에는 판정을 수정할 수 없습니다.',
      irreversibleHint: '변경이 필요한 경우 재검사를 진행해야 합니다.',
    },
  },

  /** 확인 창 — **쓰기는 이 창의 버튼에서만 나간다.** */
  confirm: {
    title: (inspectionRequestNo: string): string => `${inspectionRequestNo} 판정 저장`,
    judgment: (label: string): string => `종합 판정: ${label}`,
    /* ⛔ 수량 셋을 여기서 따로 내지 않는다 — 전이 경고 본문의 첫 규칙이 이미 그 세 값이다. */
    irreversible: '저장하면 되돌릴 수 없습니다.',
    cancel: '취소',
    confirm: '판정 저장',
  },

  /**
   * 회차 이력 — ⛔ **읽기 전용이다.** 판정은 정정하지 않고 새 회차를 쌓는다(스펙 §5-3).
   */
  history: {
    heading: '회차 이력',
    /** 회차 한 줄의 보조 설명. 수량 셋과 확정 시각을 함께 낸다. */
    quantities: (accepted: string, rejected: string, held: string): string =>
      `합격 ${accepted} · 불합격 ${rejected} · 보류 ${held}`,
    confirmedAt: (at: string): string => `확정 ${at}`,
    /** 아직 확정되지 않은 회차 — 없는 것을 빈칸으로 두지 않는다. */
    notConfirmed: '미확정',
    /** 판정 코드가 비어 온 회차. 지어내지 않는다. */
    noJudgment: '판정 없음',
  },

  pageNav: {
    label: '검사 대상 목록 쪽 이동',
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

  /**
   * 저장 실패를 화면의 말로 되말한 것.
   *
   * ⭐ 서버가 주는 코드는 **계약**이고 원문은 **말씨**다. 이 둘은 원인별 문구를 실어 오지 않아
   * 공유 배너가 일반 안내밖에 못 내는데, 사용자가 할 일은 서로 다르다.
   */
  save: {
    duplicateRound: '이미 같은 회차가 저장돼 있습니다. 최신 내용을 불러온 뒤 확인하세요.',
    invalidState: '판정은 수정할 수 없습니다 — 재검사로 진행하세요.',
  },

  /**
   * OQC 생략(omf-all-around#119 · 서버 선행 P-83) — 요청 → 「특채·한도승인 승인 처리」 결재 → 여기서 실행.
   * ⭐ 단위는 출하작업지시 하나다 — 실행하면 그 출하작업지시의 열린 OQC 의뢰가 함께 생략된다.
   */
  skip: {
    heading: 'OQC (출하검사) 생략 요청',
    /** 요청 → 승인 → 실행 단계(#136). */
    steps: ['1. 생략 요청', '2. 승인 처리', '3. 생략 실행'],
    /** 실행 뒤 결과 — 무엇이 바뀌는지(#136). */
    result: '요청 후 생략을 승인하면 남은 출하검사가 생략되고, 검사 결과는 합격으로 처리됩니다.',
    reason: '생략 사유',
    reasonPlaceholder: '생략 사유를 입력하세요',
    /** 요청한 그 건의 결재 화면으로(#136) — 「특채·한도승인 승인 처리」. 요청이 결재 대기일 때만 선다. */
    openApproval: '요청 건 승인 처리로 이동',
    currentStep: '현재 단계',
    /** 입력한 글자 수 — 상한은 없다(계약은 비우지만 않으면 된다 · #136). */
    reasonCount: (count: number): string => `${String(count)}자`,
    reasonRequired: '생략 사유를 입력하세요.',
    /** 구획의 단추 — 사유를 쓰는 창을 연다(#136). */
    openRequest: '생략 요청',
    cancel: '취소',
    request: '생략 승인 요청',
    requesting: '요청하는 중…',
    execute: 'OQC 생략 실행',
    executing: '실행하는 중…',
    requested: 'OQC 생략을 요청했습니다. 결재가 끝나면 여기서 실행하세요.',
    pending: '결재가 아직 진행 중입니다.',
    approved: '생략이 승인됐습니다. 실행하면 이 출하작업지시의 OQC 가 생략됩니다.',
    rejected: '직전 생략 요청이 반려됐습니다. 다시 요청할 수 있습니다.',
    executed: 'OQC 를 생략했습니다. 출하검사가 통과로 바뀌었습니다.',
    skipped: '이 의뢰는 OQC 생략으로 닫혔습니다.',
    loading: '생략 결재 상태를 불러오는 중입니다.',
    loadFailed: '생략 결재 상태를 불러오지 못했습니다.',
  },
  /**
   * 시리얼 OQC(omf-all-around#68 · 서버 선행 P-101) — 검사한 시리얼과 OK/NG 를 판정과 함께 저장한다.
   * 시리얼 판정은 시리얼당 한 줄로 남는다. 재검 회차는 1차를 그대로 두고 최종만 바꾼다.
   */
  serials: {
    openByScan: '시리얼 번호 스캔',
    openByScanHelp: '시리얼 번호를 입력하면 해당 OQC 검사 의뢰를 조회합니다.',
    openByScanPlaceholder: '시리얼 번호 스캔 또는 번호를 입력하세요',
    openByScanNotFound: '등록되지 않은 시리얼 번호입니다.',
    /** 관리웹 판정 화면의 「시리얼별 검사 결과」 구획(#136). POP 는 위 공용 키를 그대로 쓴다. */
    judge: {
      heading: '시리얼별 검사 결과',
      inspected: (count: number): string => `검사 ${String(count)}건`,
      accepted: (count: number): string => `합격 ${String(count)}건`,
      rejected: (count: number): string => `불합격 ${String(count)}건`,
      scanLabel: '시리얼 번호',
      scanPlaceholder: '시리얼 번호를 스캔하거나 입력한 후 Enter',
      notFound: '등록되지 않은 시리얼 번호입니다.',
      columns: {
        serialNo: '시리얼 번호',
        lotNo: 'LOT',
        previous: '이전 검사 결과',
        judgment: '판정',
      },
      emptyTitle: '등록된 검사 시리얼이 없습니다.',
      emptyDescription: '위에서 시리얼 번호를 스캔하거나 입력하세요.',
      lotOnlyNote: 'LOT 단위로 판정하는 경우 사용하지 않습니다.',
    },
    scanLabel: '시리얼 스캔',
    scanPlaceholder: '시리얼 번호를 스캔하거나 입력 후 Enter',
    scanning: '시리얼을 확인하는 중…',
    heading: '검사한 시리얼',
    help: '검사한 시리얼을 스캔하고 OK/NG 를 고릅니다. 판정과 함께 저장되고 시리얼별 출하검사 기록으로 남습니다.',
    notFound: (serialNo: string): string => `없는 시리얼입니다: ${serialNo}`,
    noPickedRequest: (serialNo: string): string =>
      `시리얼 ${serialNo} 의 LOT 을 피킹한 OQC 의뢰가 없습니다.`,
    completedRequest: (requestNo: string): string => `${requestNo} (완료, 재검사)`,
    pickRequest: '이 시리얼의 LOT 을 피킹한 OQC 의뢰가 여럿입니다. 열 의뢰를 고르세요.',
    duplicate: (serialNo: string): string => `이미 목록에 있는 시리얼입니다: ${serialNo}`,
    otherItem: (serialNo: string): string => `시리얼 ${serialNo} 은 이 의뢰의 품목이 아닙니다.`,
    notPicked: (serialNo: string): string =>
      `시리얼 ${serialNo} 의 LOT 은 이 출하작업지시가 피킹한 LOT 이 아닙니다.`,
    lookupFailed: '시리얼을 확인하지 못했습니다. 다시 스캔하세요.',
    columns: { serialNo: '시리얼', lotNo: 'LOT', previous: '이전 기록', judgment: '판정' },
    previous: (first: string, final: string): string => `1차 ${first} → 최종 ${final}`,
    firstOkLocked: '1차 OK — NG 로 바꿀 수 없습니다',
    remove: '빼기',
    ok: 'OK',
    ng: 'NG',
    empty: '스캔한 시리얼이 없습니다. 시리얼 없이 LOT 판정만 저장할 수도 있습니다.',
    tooMany: '검사한 시리얼 수가 검사 수량보다 많습니다.',
    tooManyNg: 'NG 시리얼 수가 불합격 수량보다 많습니다. 불합격 수량을 확인하세요.',
    count: (total: number, ng: number): string => `시리얼 ${total}대, NG ${ng}대`,
    recordHeading: '시리얼별 출하검사 이력',
    /** 참고 정보 탭 이름(#136). */
    recordTab: '시리얼별 검사 이력',
    recordHelp: '시리얼별 최초 검사와 재검사 결과를 확인할 수 있습니다.',
    recordEmpty: '출하검사 이력이 없습니다.',
    recordEmptyDescription: '검사 결과가 기록되면 이곳에 표시됩니다.',
    recordCount: (count: number): string => `${String(count)}건`,
    recordLoading: '시리얼 출하검사를 불러오는 중입니다.',
    recordFailed: '시리얼 출하검사를 불러오지 못했습니다.',
    recordColumns: {
      serialNo: '시리얼 번호',
      lotNo: 'LOT',
      first: '최초 판정',
      final: '최종 판정',
      round: '검사 회차',
      inspector: '검사자',
      inspectedAt: '검사 시각',
    },
    round: (round: number): string => `${round}회차`,
  },
} as const;
