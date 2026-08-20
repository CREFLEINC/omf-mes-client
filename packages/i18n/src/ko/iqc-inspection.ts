/**
 * W-01-01 IQC 수입검사·판정.
 *
 * 이 화면의 문구는 **검사자가 쓰는 말**로 쓴다 — 「의뢰」·「회차」·「판정」은 현장 어휘이고,
 * 「낙관적 잠금」·「멱등 키」 같은 구현 어휘는 화면에 내지 않는다.
 */
export const iqcInspection = {
  title: '수입검사·판정',
  /** 화면 스펙 §3 의 머리 — 「자재창고 > IQC 수입검사·판정」. */
  breadcrumbRoot: '자재창고',

  queue: {
    heading: '검사 대기',
    /**
     * 표 머리. 좌측 큐가 약 1/3 폭이라 **고르는 데 필요한 넷만** 둔다(화면 스펙 §3).
     * 품목·수량 같은 나머지는 고른 뒤 우측 창이 보인다.
     */
    columns: {
      inspectionRequestNo: '의뢰번호',
      lotId: '자재 LOT',
      statusCode: '상태',
      requestedAt: '의뢰 일시',
    },
    /** 값이 없는 칸. 빈 칸으로 두면 「없음」인지 「못 불러왔는지」 구분되지 않는다. */
    emptyValue: '—',
    /** 이 줄을 여는 버튼의 접근 이름 — 화면에는 의뢰번호만 보이므로 무엇을 여는지 밝힌다. */
    openRow: (inspectionRequestNo: string): string => `검사 의뢰 ${inspectionRequestNo} 열기`,
    caption: '검사 대기 목록',
    /** 조회는 됐는데 결과가 없다. 조건을 바꾸는 것이 사용자가 할 수 있는 유일한 조치다. */
    empty: '조건에 맞는 검사 의뢰가 없습니다. 기간이나 조건을 넓혀 보세요.',
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
    item: '품목',
    itemPlaceholder: '품목 번호',
    supplier: '공급사',
    supplierPlaceholder: '공급사 번호',
    keyword: '의뢰번호',
    keywordPlaceholder: '의뢰번호로 검색',
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
