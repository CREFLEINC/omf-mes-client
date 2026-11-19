/**
 * P-04-06 OQC 출하검사 판정(POP).
 *
 * 판정 규칙·조건은 관리웹 W-04-03(`oqcInspection`)과 같다. 문구만 현장 단말용으로 따로 둔다
 * (omf-all-around#109 UI/UX 개선 · 담당자 지시서) — 짧게, 한 문장에 한 가지, 할 일을 먼저.
 * 화면 모양·말은 POP 통일 시안(omf-all-around#295)을 따른다.
 * ⛔ 뜻을 바꾸지 않는다. 같은 조건에서 같은 사실을 말한다.
 */
export const popOqcInspection = {
  queue: {
    heading: '판정 대기',
    /** 판정을 마친 의뢰 탭(#291). */
    doneHeading: '판정 완료',
    viewLabel: '판정 목록 고르기',
    /** 왼쪽 목록 구획 이름(접기 단추). */
    listName: '판정 목록',
    caption: '판정 대기 의뢰 목록',
    columns: {
      item: '품목',
      qty: '검사 수량',
    },
    selectRow: (requestNo: string): string => `의뢰 ${requestNo} 선택`,
    loading: '판정 대기 목록을 불러오는 중입니다.',
    empty: '판정할 출하검사 의뢰가 없습니다.',
    doneEmpty: '판정을 마친 출하검사 의뢰가 없습니다.',
    unavailable: '판정 대기 목록을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도하세요.',
    pageNav: '판정 대기 목록 쪽 이동',
  },

  detail: {
    nothingSelectedTitle: '의뢰를 선택하세요',
    nothingSelected: '왼쪽 목록에서 의뢰를 누르면 수량과 판정을 입력합니다.',
    nothingSelectedDone: '왼쪽 목록에서 의뢰를 누르면 판정 결과를 봅니다.',
    loading: '의뢰 정보를 불러오는 중입니다.',
    bandLabel: '의뢰 정보',
    fields: {
      requestNo: '의뢰번호',
      requestedAt: '의뢰 일시',
      item: '품목',
      inspectionType: '검사 유형',
      targetQty: '총 검사 수량',
      target: '대상',
      lot: '대상 LOT',
      plan: '적용 기준',
      history: '회차 이력',
    },
    /** 대상 유형 코드의 표시명. 모르는 코드는 코드 그대로 보인다. */
    targetTypes: {
      SHIPMENT_REQUEST: '출하요청',
    } as Readonly<Record<string, string>>,
    target: (typeLabel: string, targetId: number): string => `${typeLabel} #${String(targetId)}`,
    /** 식별자 번호다 — 이름을 받지 못해 번호로 보인다. */
    idValue: (id: number): string => `#${String(id)}`,
    noPlanVersion: '기준 없음',
    /** [기준 조회] → 적용 기준 창. 기준 버전은 검사 시점 것으로 고정된다(W-04-03 과 같은 사실). */
    viewPlan: '기준 조회',
    planTitle: '적용 기준',
    planNo: '기준 번호',
    /** 기준 버전(서버 planVersion) — 번호(#id)가 아니라 버전으로 보인다(사용자 지시 2026-11-19). */
    planVersion: (no: number): string => `버전 ${String(no)}`,
    planValue: (label: string): string => `${label} · 검사 시점 고정`,
    guide: '검사 내용',
    noGuide: '등록된 검사 안내가 없습니다.',
  },

  result: {
    /** 작업 구획 제목 — 지금 단계 이름. */
    quantityTitle: '수량 입력',
    judgmentTitle: '최종 판정',
    resultTitle: '판정 결과',
    flowLabel: 'OQC 단계',
    round: (round: number): string => `${String(round)}회차`,
    reinspectRound: (round: number): string => `${String(round)}회차 · 재검사`,
    reinspectNote: (round: number): string =>
      `저장하면 ${String(round)}회차가 새로 추가됩니다. 앞 회차는 그대로 남습니다.`,
    draftElsewhere:
      '다른 곳에서 작성 중인 회차라 여기서 고칠 수 없습니다. 다시 판정하려면 [재검사 회차 추가]를 누르세요.',
    loading: '검사 결과를 불러오는 중입니다.',
    fields: {
      accepted: '합격 수량',
      rejected: '불합격 수량',
      held: '보류 수량',
    },
    quantityInvalid: '0 이상의 숫자만 넣을 수 있습니다(소수점 6자리까지).',
    keypadTitle: '입력',
    judgmentStep: '종합 판정',
    judgmentUnavailable: '판정 값 목록이 준비되지 않았습니다. 담당자에게 문의하세요.',
    judgmentUnknown: (code: string): string => `저장된 판정(${code})이 목록에 없습니다.`,
    /** 넣은 수량 요약 · 회차별 결과. */
    summary: {
      inspectedQty: '검사 수량',
      accepted: '합격',
      rejected: '불합격',
      held: '보류',
    },
    columns: { round: '회차', judgment: '종합 판정', confirmedAt: '확정 시각' },
    confirmedAt: (at: string): string => `확정 ${at}`,
  },

  /** [시리얼 검사 기록] 창 — 스캔 · OK/NG · 빼기. 닫아도 기록은 남고 판정과 함께 저장된다. */
  serial: {
    open: '시리얼 검사 기록',
    summary: (count: number, ng: number): string =>
      `검사 기기 ${String(count)}대 · NG ${String(ng)}대`,
    summaryHint: '판정과 함께 저장됩니다',
    label: '시리얼',
    count: (count: number, ng: number): string => `${String(count)}대 · NG ${String(ng)}대`,
    placeholder: '시리얼 번호를 스캔하세요',
    manualLabel: '시리얼 번호',
    emptyTitle: '스캔한 시리얼이 없습니다',
    emptyHint: '시리얼 없이 LOT 판정만 저장할 수도 있습니다.',
    remove: (serialNo: string): string => `${serialNo} 빼기`,
    pageNav: '시리얼 목록 쪽 이동',
  },

  /**
   * 저장 전 안내 — 판정 확정이 LOT 에 미치는 영향. 보이는 조건은 W-04-03 의 전이 경고와 같다.
   * ⭐ 상태 이름은 서버 전이표(`core/document-state/transitions.ts` C4·C5·C6)와 맞췄다 —
   *    합격 → 정상(다른 보류가 없을 때) · 보류 → 검사 대기 · 불합격 → 불량. 의뢰에 LOT 이 없으면(출하작업지시 OQC)
   *    서버가 그 지시가 집은 LOT 에 판정을 남긴다 — `picked*` 문장(omf-all-around#119 · 서버 P-83 · W-04-03 과 같은 말).
   */
  warning: {
    directionRelease: "저장 시 LOT 상태가 '정상'으로 바뀝니다(다른 보류가 없을 때).",
    directionHold: "저장 시 LOT 상태가 '불량'으로 바뀝니다.",
    directionPending: "저장 시 LOT 상태가 '검사 대기'로 바뀝니다.",
    directionUnknown: '저장 시 LOT 상태가 바뀝니다.',
    pickedDirectionRelease: '저장 시 이 LOT 이 출하할 수 있는 상태로 풀립니다.',
    pickedDirectionHold: '저장 시 이 출하작업지시가 집은 LOT 이 불량 상태가 됩니다.',
    pickedDirectionPending:
      '보류는 LOT 상태를 바꾸지 않습니다. 이 출하작업지시는 판정이 끝날 때까지 출하할 수 없습니다.',
    picking: '이 LOT 을 쓰는 진행 중 피킹이 막히고, 이미 피킹된 수량은 되돌아오지 않습니다.',
    noAmendment: '저장 후에는 고칠 수 없습니다. 바꾸려면 재검사합니다.',
    dispositionPath: '불합격 수량의 처분(재작업·폐기)은 이 화면에서 정하지 않습니다.',
  },

  /** 아래 작업 줄 — 꺼진 단추의 이유는 단추에 손을 올리면 보인다(`title`). */
  bar: {
    /** 1단계 → 2단계. */
    next: '저장',
    prev: '이전',
    save: '판정 저장',
    saving: '저장 중…',
    saved: (requestNo: string, judgment: string): string =>
      `${requestNo} 판정(${judgment})을 저장했습니다.`,
    blocked: {
      noSelection: '왼쪽 목록에서 의뢰를 선택하세요.',
      loading: '의뢰 정보를 불러오는 중입니다.',
      worker: '사번이 지정되지 않았습니다. [사용자 전환]에서 사번을 입력하세요.',
      confirmed: '확정된 회차입니다. 다시 판정하려면 재검사 회차를 추가하세요.',
      draftElsewhere: '다른 곳에서 작성 중인 회차입니다. 다시 판정하려면 재검사 회차를 추가하세요.',
      totals: '합격 + 불합격 + 보류가 검사 수량과 같아야 합니다.',
      judgmentOptions: '판정 값 목록이 없어 저장할 수 없습니다. 담당자에게 문의하세요.',
      judgment: '종합 판정을 선택하세요.',
    },
    reinspect: '재검사 회차 추가',
    reinspectCancel: '재검사 취소',
  },

  /** 저장 확인 창 — 쓰기는 이 창의 [판정 저장]에서만 나간다. */
  confirm: {
    title: '판정을 저장할까요?',
    request: '의뢰번호',
    judgment: '종합 판정',
    inspectedQty: '검사 수량',
    accepted: '합격',
    rejected: '불합격',
    held: '보류',
    serials: '시리얼',
    effects: '저장하면',
    caution: '주의',
    cancel: '취소',
    confirm: '판정 저장',
  },
};
