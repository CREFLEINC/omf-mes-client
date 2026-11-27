/**
 * W-CO-09 결재함. 올라온 승인 요청을 모아 보고 결재하는 자리다.
 *
 * **판정을 화면이 다시 말하지 않는다.** 「지금 몇 단계인가」·「내 차례인가」는 서버가 판정해
 * 내려 주므로 문구도 그 값을 그대로 옮기는 형태만 둔다 — 화면이 사유를 지어내면
 * 서버와 갈리는 순간 사용자에게 거짓 확신을 준다.
 */
export const approvalInbox = {
  panes: {
    list: '승인 요청 목록',
    detail: '요청 상세',
    /** 아래 구획 안의 세 덩어리. 차례는 「무엇을 결재하는가 → 어디에 있는가 → 어디까지 왔는가」다. */
    request: '요청 정보',
    target: '대상',
    progress: '결재 진행',
    /** 사유 **전문**이 서는 자리. 줄마다 한 칸이라 값 하나짜리 칸과 구조가 다르다. */
    reason: '요청 사유',
    /**
     * 결재 액션이 서는 자리. **진행 구획 바로 아래**다 — 의견은 내 단계에 남는 말이라
     * 단계 목록 옆이 가장 가깝고, 위의 둘(사유·대상)은 「무엇을 결재하는가」로 축이 다르다.
     */
    decision: '결재',
  },
  /**
   * 탭은 **조회 조건 그 자체**다. 이름이 곧 그 탭이 무엇을 보여 주는지여야 한다 —
   * 「내 결재 대기」와 「내가 올린 것」은 걸러 내는 축이 서로 다르다(내가 승인자인가 / 내가 올렸는가).
   */
  tabs: {
    label: '결재함 보기',
    pending: '내 결재 대기',
    requested: '내가 올린 요청',
    all: '전체',
    /**
     * 대기 건수 뱃지의 접근 이름. 수치만 읽히면 무엇의 수인지 알 수 없다.
     * **탭이 보여 주는 목록의 건수가 아니라 「지금 내가 결재할 수 있는」 건수다.**
     */
    pendingBadge: (count: number): string => `대기 ${String(count)}건`,
  },
  fields: {
    approvalRequestNo: '요청번호',
    reason: '사유',
    requestedByName: '상신자',
    /** 목록 열 이름. 계약이 이 값을 시각까지 실어 주고 목록도 시각까지 보인다. */
    requestedAt: '상신 일시',
    status: '상태',
    approvalTypeCode: '승인 유형',
    /**
     * 조건 줄의 기간 라벨. **열 이름과 낱말이 다른 것이 맞다** — 계약의 두 조건
     * (`requestedAtFrom`·`requestedAtTo`)이 `format: date`라 **날짜 단위로** 좁힌다.
     * 여기에 「일시」를 쓰면 시각까지 지정할 수 있다고 읽힌다.
     */
    periodFrom: '상신 시작일',
    periodTo: '상신 종료일',
    q: '요청번호 검색',
    qPlaceholder: '요청번호를 입력하세요',
    datePlaceholder: '날짜를 선택하세요',
  },
  actions: {
    goFirstPage: '첫 페이지로',
  },
  loading: {
    list: '승인 요청 목록 불러오는 중',
    detail: '요청 상세를 불러오는 중',
  },
  /**
   * 대상 구획. **결재함은 대상 문서의 내용을 그리지 않는다** — 계약이 그렇게 적었고
   * 상세 응답에 대상 본문이 아예 없다. 표시명과 「열기」뿐이다.
   */
  target: {
    open: '열기',
    /** 결재함이 무엇을 하지 않는지 밝힌다(대상 제목 옆 ⓘ) — 여기서 문서를 읽을 수 있다고 오해하지 않게. */
    note: '문서 내용은 [열기]를 눌러 해당 화면에서 확인하세요.',
  },
  /**
   * 결재 진행. **여기 있는 값은 전부 서버가 준 것을 그대로 옮긴 것이다** —
   * 단계 배열을 훑어 다시 계산하지 않는다(계획 결정 7).
   */
  progress: {
    /** 몇 단계 중 몇 번째인가. **`currentStepNo`·`totalStepNo` 그대로다.** */
    position: (current: number, total: number): string =>
      `${String(current)} / ${String(total)} 단계`,
    /** 기다리는 단계가 없다(`currentStepNo`가 비었다). **0으로 메우지 않는다.** */
    finished: (total: number): string => `결재 완료 · 전체 ${String(total)}단계`,
    /**
     * 지금 이 요청을 결재할 수 있는가 — **`isMyTurn` 그대로다.**
     *
     * **왜 아닌지는 말하지 않는다.** 앞 단계가 안 끝난 것인지, 내가 승인자가 아닌 것인지,
     * 이미 끝난 요청인지 화면은 판정할 수 없다 — 아는 것만 말하고 이유를 지어내지 않는다.
     */
    myTurn: '내가 결재할 차례입니다',
    notMyTurn: '지금은 내 결재 차례가 아닙니다',
    /**
     * 아직 결재되지 않은 단계의 보조 라벨. **디자인 시스템의 상태 낱말이 스크린리더 전용**이라
     * 보이는 글자를 이 자리가 맡는다 — 색·아이콘에만 기대지 않는다.
     */
    waitingCurrent: '결재 대기 중',
    waitingPending: '앞 단계 결재 후 진행',
    /** 로그인 사용자가 승인자인 단계(`isMine`). */
    mine: '내 단계',
    /** 단계 배열이 비어 왔다. 계약이 배열을 필수로 두었으나 빈 배열은 스키마를 통과한다. */
    noSteps: '결재 단계 정보가 없습니다',
  },
  filters: {
    all: '전체',
    chipApprovalType: (value: string): string => `승인 유형: ${value}`,
    chipStatus: (value: string): string => `상태: ${value}`,
    chipPeriod: (from: string, to: string): string => `상신일: ${from} ~ ${to}`,
    chipPeriodFrom: (from: string): string => `상신일: ${from}부터`,
    chipPeriodTo: (to: string): string => `상신일: ${to}까지`,
    chipKeyword: (value: string): string => `요청번호: ${value}`,
    chipRemoveApprovalType: '승인 유형 조건 제거',
    chipRemoveStatus: '상태 조건 제거',
    chipRemovePeriod: '상신일 조건 제거',
    chipRemoveKeyword: '요청번호 조건 제거',
  },
  /** 빈 상태는 **세 갈래**다. 사용자가 할 조치가 서로 다르다(완료 조건 C12). */
  empty: {
    noResultTitle: '조건에 맞는 승인 요청이 없습니다',
    noResultDescription: '조회 조건을 바꾸거나 다른 탭을 확인하세요.',
    beyondLastTitle: '이 페이지에는 결과가 없습니다',
    beyondLastDescription: '첫 페이지로 이동하세요.',
    noSelectionTitle: '승인 요청을 선택하세요.',
    noSelectionDescription: '선택한 요청의 상세 정보가 표시됩니다.',
    /**
     * 상세가 **404**. 「없는 것」이라 주소에서 고른 번호를 정리한다 —
     * 남겨 두면 새로고침·공유가 같은 빈자리로 되돌아온다.
     */
    notFoundTitle: '요청을 찾을 수 없습니다',
    notFoundDescription: '이미 처리되었거나 삭제된 요청입니다. 목록에서 다시 선택하세요.',
    /**
     * 상세가 **403**. 「있는데 내 것이 아닌 것」이라 고른 번호를 **정리하지 않는다** —
     * 지우면 사용자가 무엇을 열려 했는지 잃는다. **다시 시도를 두지 않는다**:
     * 같은 권한으로 다시 불러도 같은 답이 온다.
     */
    forbiddenTitle: '이 요청을 볼 권한이 없습니다',
    forbiddenDescription: '승인자나 상신자만 볼 수 있습니다. 담당자에게 문의하세요.',
  },
  /**
   * 결재(승인·반려) — **되돌릴 수 없는 조작이라 문구가 겹으로 선다.**
   *
   * 계약에 수정·취소 오퍼레이션이 없다. 잘못 누른 승인을 되돌리는 길이 화면에도 서버에도
   * 없으므로, 사용자가 무엇을 하는지 **누르기 전에** 알아야 한다.
   */
  decision: {
    /**
     * **결재 구획 제목 옆 ⓘ 와 승인 확인 창의 문장.** 성공 알림에 넣지 않는다 — 알림은 사라지지만
     * 이 문장은 결재함을 보는 내내 참인 사실이고, 버튼이 잠겨 있을 때도 참이다.
     *
     * 계약이 승인 오퍼레이션 설명에 그대로 적었다: 승인은 요청의 상태만 바꾸고
     * 전기·출고 반영은 대상 화면이 따로 한다.
     */
    lockNote:
      '승인하면 처리할 수 있는 상태가 될 뿐입니다. 실제 처리(전기·출고 등)는 해당 화면에서 따로 진행하세요.',
    /**
     * 의견 입력칸 — **하나뿐이다.**
     *
     * 승인이면 선택이고 반려면 필수라 빨간 * 대신 라벨에 「반려 시 필수」를 적는다(#361 사용자 지시).
     */
    commentLabel: '결재 의견 (반려 시 필수)',
    commentHelp: '승인할 때는 비워도 되고, 반려할 때는 반드시 입력해야 합니다.',
    /**
     * 내 차례가 아니면 입력칸도 잠근다 — 보낼 수 없는 말을 적어 두는 자리가 아니다.
     * **결재 진행 구획의 같은 뜻 문장과 글자가 다르다**: 저기는 요청의 상태를 말하고
     * 여기는 **이 컨트롤이 왜 잠겼는지**를 말한다(배치 규범 4 — 사유는 컨트롤 이름으로 시작한다).
     */
    commentDisabledReason: '내 결재 차례가 되면 결재할 수 있습니다',
    /** 전송 중 잠금 사유. 같은 잠금을 여러 컨트롤이 나눠 쓰므로 무엇이 도는 중인지 밝힌다. */
    commentSendingReason: '결재를 처리하는 중입니다',
    /**
     * **보내는 자리가 다시 본 결과.** 버튼이 이미 막지만, 확인 창이 열린 사이 값이 비면
     * 여기서 걸린다 — 서버 목이 공백만인 의견을 그대로 받아 주므로 막는 곳이 화면뿐이다.
     */
    commentRequired: '반려 의견을 입력하세요',
    approve: '승인',
    reject: '반려',
    /** 비활성 사유는 **그 컨트롤의 이름으로 시작한다**(배치 규범 4). */
    blockedNotMyTurn: (action: string): string => '내 결재 차례가 되면 결재할 수 있습니다',
    /**
     * **뒤에 조작 이름을 되풀이하지 않는다.** 이 함수의 유일한 호출이 반려라 「반려: 반려
     * 의견을…」로 어절이 겹쳤다. 앞머리가 이미 어느 컨트롤의 사유인지 말하므로 뒤는 무엇이
     * 모자란지만 말한다.
     */
    blockedNoComment: (action: string): string => '반려하려면 결재 의견을 입력하세요',
    /**
     * **네트워크가 끊긴 갈래에만** 덧붙인다. 요청이 서버에 닿았는지 화면이 알 수 없고,
     * 다시 누르면 **새 요청으로 나가** 두 번 결재될 수 있다는 사실을 숨기지 않는다.
     */
    deliveryUnknown:
      '처리 결과를 확인하지 못했습니다. [조회]로 결재 진행을 확인한 뒤 다시 시도하세요.',
  },
  /**
   * 확인 창 — **입력받지 않고 확인만 한다.** 의견은 아래 구획에서 이미 적었고,
   * 이 창은 「정말 보낼 것인가」만 묻는다.
   */
  dialog: {
    approveTitle: '이 요청을 승인하시겠습니까?',
    rejectTitle: '이 요청을 반려하시겠습니까?',
    /** 무엇을 결재하는지 창 안에서도 밝힌다. 업무 번호라 그대로 낸다 — 내부 번호가 아니다. */
    subject: (approvalRequestNo: string): string => `요청번호 ${approvalRequestNo}`,
    commentHeading: '결재 의견',
    /** 승인은 의견이 선택이라 비어 있을 수 있다. 빈 칸 대신 그 사실을 적는다. */
    noComment: '의견 없이 승인합니다.',
    /** 계약 문면 그대로 — 이 값은 결재 기록(그 단계의 의견)에 남는다. */
    commentRecorded: '이 의견은 결재 기록에 남습니다.',
    /** **되돌릴 수 없음을 명시한다**(계약에 수정·취소 오퍼레이션이 없다). */
    irreversible: '결재한 뒤에는 취소할 수 없습니다. 바꾸려면 새 요청을 올려야 합니다.',
  },
  /**
   * 결재 성공 알림. **자물쇠 문구를 여기에 넣지 않는다** — 사라지는 자리에 두면
   * 그 사실을 다시 확인할 방법이 없다.
   */
  toast: {
    approved: '승인했습니다',
    rejected: '반려했습니다',
  },
  /**
   * 승인 유형 코드 → 사람이 읽는 이름(#353). 서버 알림 이름(`approval-type-names.ts`)과 같은 말이다.
   * 목록 밖 코드는 코드 그대로 보인다(`approvalTypeLabelOf`).
   */
  approvalTypeNames: {
    GOODS_ISSUE_DISPOSAL: '폐기 출고',
    INVENTORY_ADJUSTMENT: '재고 조정',
    PURCHASE_ORDER: 'P/O',
    INBOUND_RECEIPT_CANCEL: '입하 취소',
    GOODS_RECEIPT_CANCEL: '입고 취소',
    GOODS_ISSUE_CANCEL: '출고 취소',
    SHIPMENT_CANCEL: '출하 취소',
    PRODUCTION_RESULT_CORRECT: '생산 실적 정정',
  } as Record<string, string | undefined>,
  /** 요청 상태 이름(omf-all-around#353). 목록 밖 코드는 코드 그대로. */
  requestStatusNames: { PENDING: '결재 대기', APPROVED: '승인', REJECTED: '반려' } as Record<
    string,
    string
  >,
  values: {
    /** 이름이 오지 않았다. **번호를 대신 내지 않는다.** */
    unknownRequester: '상신자 정보 없음',
    /** 사유는 필수 값이라 빈 경우가 정상은 아니다. 그래도 빈 칸을 내지 않고 사실을 적는다. */
    emptyReason: '입력된 사유 없음',
    /** 승인자 이름이 오지 않았다. 같은 규율 — **`approverId`를 대신 내지 않는다**. */
    unknownApprover: '승인자 정보 없음',
    /** 대상 표시명이 비어 왔다. 서버가 만드는 값이라 화면이 지어낼 근거가 없다. */
    unknownTarget: '대상 이름 없음',
  },
} as const;
