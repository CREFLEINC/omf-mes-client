/**
 * P-02-12 긴급 W/O 현장 투입·실적.
 *
 * ⭐ 이 화면은 **진입점**이다 — 긴급 작업지시를 보이고 정상 화면(자재 투입·실적 등록)으로
 * 보낸다. 긴급이라고 투입·실적 화면을 따로 두지 않는다는 것이 설계 확정이라, 문구도
 * 「여기서 무엇을 한다」가 아니라 **「어디로 간다」**를 말한다.
 *
 * ⛔ **빈 목록이 오류가 아니다.** 긴급 작업지시는 없는 것이 정상이고, 발행은 관리웹의 몫이다 —
 * 그래서 빈 모양이 「없습니다」에서 끝나지 않고 **어디서 만들어지는지**까지 적는다.
 * 문구는 POP 통일 시안(#295) 그대로다.
 */
export const emergencyWorkOrderField = {
  title: '긴급 작업지시',

  list: {
    title: '긴급 작업지시 목록',
    select: '선택',
    deselect: '선택 해제',
    item: '품목',
    releasedAt: '발행',

    empty: '긴급 작업지시가 없습니다.',
    emptyHint: '긴급 작업지시는 관리웹 「긴급 작업지시 발행」에서 발행합니다.',
    loadError: '긴급 작업지시 목록을 받지 못했습니다. 새로고침해 주세요.',

    /* 쪽 넘김 랜드마크 이름(#1005). */
    pageNav: '긴급 작업지시 목록 페이지 이동',
  },

  detail: {
    title: '작업지시 상세',
    notSelected: '왼쪽 목록에서 긴급 작업지시를 선택하세요.',
    workOrder: '작업지시',
    item: '품목',
    orderQty: '수량',
    releasedAt: '발행',

    /** 값을 아직 못 받았을 때 — 숫자 식별자를 그대로 보이지 않는다. */
    unknown: '확인 중',

    bypassTitle: '배정 없음 · 점검 통제 우회',
    bypassTitleAssigned: '점검 통제 우회',
    bypassBody: '긴급 작업지시는 배정과 작업 전 점검 없이 진행합니다.',
  },

  handoff: {
    materialInput: '자재 투입',
    productionResult: '실적 입력',
  },
} as const;
