/**
 * P-04-06 OQC 출하검사 판정(POP).
 *
 * 판정 규칙·조건은 관리웹 W-04-03(`oqcInspection`)과 같다. 문구만 현장 단말용으로 따로 둔다
 * (omf-all-around#109 UI/UX 개선 · 담당자 지시서) — 짧게, 한 문장에 한 가지, 할 일을 먼저.
 * ⛔ 뜻을 바꾸지 않는다. 같은 조건에서 같은 사실을 말한다.
 */
export const popOqcInspection = {
  /** 메뉴 이름(`pop-screen-catalog.ts`)과 같은 말이다. */
  title: 'OQC 출하검사 판정',

  queue: {
    heading: '판정 대기',
    caption: '판정 대기 의뢰 목록',
    count: (total: number): string => `${String(total)}건`,
    columns: {
      request: '의뢰번호',
      item: '품목',
      qty: '검사수량',
      status: '상태',
    },
    selectRow: (requestNo: string): string => `의뢰 ${requestNo} 선택`,
    loading: '판정 대기 목록을 불러오는 중입니다.',
    empty: '판정할 출하검사 의뢰가 없습니다.',
    unavailable: '판정 대기 목록을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도하세요.',
    pageNav: '판정 대기 목록 쪽 이동',
  },

  detail: {
    paneLabel: '판정',
    nothingSelectedTitle: '의뢰를 선택하세요',
    nothingSelected: '왼쪽 판정 대기 목록에서 의뢰를 누르면 여기에서 판정합니다.',
    loading: '의뢰 정보를 불러오는 중입니다.',
    fields: {
      inspectionType: '검사 유형',
      target: '검사 대상',
      lot: '대상 LOT',
      item: '품목',
      targetQty: '검사수량',
      plan: '검사 기준',
      requestedAt: '의뢰 일시',
    },
    /** 대상 유형 코드의 표시명. 모르는 코드는 코드 그대로 보인다. */
    targetTypes: {
      SHIPMENT_REQUEST: '출하요청',
    } as Readonly<Record<string, string>>,
    target: (typeLabel: string, targetId: number): string => `${typeLabel} #${String(targetId)}`,
    /** 식별자 번호다 — 이름을 받지 못해 번호로 보인다. */
    idValue: (id: number): string => `#${String(id)}`,
    noPlanVersion: '기준 없음',
    /** 기준 버전은 검사 시점 것으로 고정된다(W-04-03 과 같은 사실) — 값 옆에 짧게 붙인다. */
    planValue: (id: number): string => `#${String(id)} · 검사 시점 고정`,
  },

  result: {
    heading: '판정 입력',
    firstRound: '첫 검사',
    round: (round: number): string => `${String(round)}회차`,
    reinspectRound: '재검사 · 새 회차',
    reinspectNote: '저장하면 새 회차가 추가됩니다. 앞 회차는 그대로 남습니다.',
    reinspectReasonPending: '재검사 사유 선택은 아직 준비 중입니다.',
    confirmed: '확정된 회차라 고칠 수 없습니다. 다시 판정하려면 [재검사 회차 추가]를 누르세요.',
    draftElsewhere:
      '다른 곳에서 작성 중인 회차라 여기서 고칠 수 없습니다. 다시 판정하려면 [재검사 회차 추가]를 누르세요.',
    loading: '검사 결과를 불러오는 중입니다.',

    quantityStep: '수량 입력',
    quantityHint: '합격 + 불합격 + 보류 = 검사수량',
    fields: {
      accepted: '합격 수량',
      rejected: '불합격 수량',
      held: '보류 수량',
    },
    inspectedQty: '검사수량',
    sum: '입력 합계',
    remaining: '남은 수량',
    matched: '수량 입력 완료',
    short: (remaining: string): string => `남은 수량(${remaining})이 없어야 합니다.`,
    over: (over: string): string => `${over}개 많습니다. 줄여 주세요.`,
    uncountable: '숫자만 입력해 주세요.',
    quantityInvalid: '0 이상의 숫자만 넣을 수 있습니다(소수점 6자리까지).',

    judgmentStep: '종합 판정',
    judgmentHint: '수량과 별도로, 의뢰 전체의 결과를 고릅니다.',
    judgmentUnavailable: '판정 값 목록이 준비되지 않았습니다. 담당자에게 문의하세요.',
    judgmentUnknown: (code: string): string => `저장된 판정(${code})이 목록에 없습니다.`,
  },

  /**
   * 저장 전 안내 — 판정 확정이 LOT 에 미치는 영향. 보이는 조건은 W-04-03 의 전이 경고와 같다.
   * ⭐ 상태 이름은 서버 전이표(`core/document-state/transitions.ts` C4·C5·C6)와 맞췄다 —
   *    합격 → 정상(다른 보류가 없을 때) · 보류 → 검사 대기 · 불합격 → 불량. 의뢰에 LOT 이 없으면
   *    서버가 전이 없이 확정만 한다(`inspection-confirm.service.ts` moveTargetLot).
   */
  warning: {
    title: 'LOT 상태 변경',
    directionRelease: "저장 시 LOT 상태가 '정상'으로 바뀝니다(다른 보류가 없을 때).",
    directionHold: "저장 시 LOT 상태가 '불량'으로 바뀝니다.",
    directionPending: "저장 시 LOT 상태가 '검사 대기'로 바뀝니다.",
    directionUnknown: '저장 시 LOT 상태가 바뀝니다.',
    noLot: '대상 LOT 이 없어 LOT 상태는 바뀌지 않습니다.',
    picking: '이 LOT 을 쓰는 진행 중 피킹이 막히고, 이미 피킹된 수량은 되돌아오지 않습니다.',
    noAmendment: '저장 후에는 고칠 수 없습니다. 바꾸려면 재검사합니다.',
    dispositionPath: '불합격 수량의 처분(재작업·폐기)은 이 화면에서 정하지 않습니다.',
  },

  /** 화면 바닥 띠 — 저장 가능 여부와 그 이유를 늘 같은 자리에서 말한다. */
  bar: {
    save: '판정 저장',
    saving: '저장 중…',
    saved: '판정을 저장했습니다.',
    ready: '저장할 수 있습니다.',
    blocked: {
      noSelection: '왼쪽 목록에서 의뢰를 선택하세요.',
      loading: '의뢰 정보를 불러오는 중입니다.',
      worker: '사번이 지정되지 않았습니다. [사용자 전환]에서 사번을 입력하세요.',
      confirmed: '확정된 회차입니다. 다시 판정하려면 재검사 회차를 추가하세요.',
      draftElsewhere: '다른 곳에서 작성 중인 회차입니다. 다시 판정하려면 재검사 회차를 추가하세요.',
      totals: '수량 합계를 검사수량과 맞춰 주세요.',
      judgmentOptions: '판정 값 목록이 없어 저장할 수 없습니다. 담당자에게 문의하세요.',
      judgment: '종합 판정을 선택하세요.',
      invalid: '수량 칸의 오류를 고친 뒤 저장할 수 있습니다.',
    },
    reinspect: '재검사 회차 추가',
    reinspectCancel: '재검사 취소',
    coaIssue: '검사성적서 발행',
    coaPending: '준비 중',
  },

  /** 저장 확인 창 — 쓰기는 이 창의 [판정 저장]에서만 나간다. */
  confirm: {
    title: '판정을 저장할까요?',
    request: '의뢰번호',
    judgment: '종합 판정',
    inspectedQty: '검사수량',
    accepted: '합격',
    rejected: '불합격',
    held: '보류',
    effects: '저장하면',
    caution: '주의',
    cancel: '취소',
    confirm: '판정 저장',
  },
};
