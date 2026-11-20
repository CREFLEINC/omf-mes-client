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
      qty: '총 검사량',
    },
    selectRow: (requestNo: string): string => `의뢰 ${requestNo} 선택`,
    loading: '판정 대기 목록을 불러오는 중입니다.',
    empty: '판정할 출하검사 의뢰가 없습니다.',
    doneEmpty: '판정을 마친 출하검사 의뢰가 없습니다.',
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
      requestedAt: '의뢰일시',
      item: '품목',
      inspectionType: '검사 유형',
      targetQty: '총 검사량',
      target: '대상',
      lot: '대상 LOT 번호',
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
      accepted: '합격량',
      rejected: '불합격량',
      held: '보류량',
    },
    quantityInvalid: '0 이상의 숫자만 넣을 수 있습니다(소수점 6자리까지).',
    keypadTitle: '입력',
    judgmentStep: '종합 판정',
    judgmentUnavailable: '판정 값 목록이 준비되지 않았습니다. 담당자에게 문의하세요.',
    judgmentUnknown: (code: string): string => `저장된 판정(${code})이 목록에 없습니다.`,
    /** 넣은 수량 요약 · 회차별 결과. */
    summary: {
      inspectedQty: '검사량',
      accepted: '합격량',
      rejected: '불합격량',
      held: '보류량',
    },
    columns: { round: '회차', judgment: '종합 판정', confirmedAt: '확정일시' },
    confirmedAt: (at: string): string => `확정 ${at}`,
  },

  /** [시리얼 검사 기록] 창 — 스캔 · OK/NG · 빼기. 닫아도 기록은 남고 판정과 함께 저장된다. */
  serial: {
    open: '시리얼 검사 기록',
    summary: (count: number, ng: number): string =>
      `검사 기기 ${String(count)}대 · NG ${String(ng)}대`,
    summaryHint: '판정과 함께 저장됩니다',
    label: '시리얼 번호',
    count: (count: number, ng: number): string => `${String(count)}대 · NG ${String(ng)}대`,
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
    dispositionPath: '불합격량의 처분(재작업·폐기)은 이 화면에서 정하지 않습니다.',
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
      totals: '합격 + 불합격 + 보류가 검사량과 같아야 합니다.',
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
    inspectedQty: '검사량',
    accepted: '합격량',
    rejected: '불합격량',
    held: '보류량',
    serials: '시리얼',
    effects: '저장하면',
    caution: '주의',
    cancel: '취소',
    confirm: '판정 저장',
  },
  /**
   * 출하 OQC 새 흐름(피처 010) — 결과 추가만(고치기 · 지우기는 관리웹 W-04-03), 저장 확인 창 없음. 판정은 출하 완료 때 확정된다.
   */
  shipment: {
    /** 목록 카드 둘째 줄 — 「FG-A100 · 피킹 LOT 3개」. */
    card: (item: string, count: number, qty: string): string =>
      `${item} · 피킹 LOT ${String(count)}개 · ${qty}`, // ui-check-ignore: C-13 시안 P0406 목록 카드
    /** 머리 품목 칸 — 「FG-A100 센서 모듈 A」. */
    itemValue: (code: string, name: string): string => (name === '' ? code : `${code} ${name}`),
    /** 적치 대기 자리 몫의 위치 이름(시스템 코드 대신). */
    staging: '적치 대기',
    /** 교체로 빠진 LOT 줄 — 시안 「2회차 불합격 · PDA 교체 11-18 11:02 김작업 · 부적합 NC-…」. */
    replacedLine: (
      round: number | null,
      judgment: string,
      at: string,
      worker: string,
      nonconformanceNo: string | null,
    ): string =>
      [
        round === null ? judgment : `${String(round)}회차 ${judgment}`,
        `PDA 교체 ${at}${worker === '' ? '' : ` ${worker}`}`,
        ...(nonconformanceNo === null ? [] : [`부적합 ${nonconformanceNo}`]),
      ].join(' · '), // ui-check-ignore: C-13 시안 P0406 교체로 빠진 LOT 줄
    /** 머리 정보 띠 수량 — 출하 완료(P-04-07)와 같은 말. */
    target: '지시량',
    picked: '피킹량',
    over: '초과량',
    bandLabel: '출하 지시서 정보',
    /** 피킹 LOT 이 없을 때 한 줄(출하 완료와 같은 문구). */
    lotsEmpty: '피킹된 LOT이 없습니다.',
    refs: {
      request: '의뢰번호',
      customer: '고객',
      shipTo: '납품처',
      plan: '검사 기준',
      requestedAt: '의뢰 일시',
    },
    lotsReplacedHeading: '교체로 빠진 LOT — 판정 대상 아님',
    appliedNone: '적용 검사 없음',
    form: {
      heading: (seqNo: number): string => `${String(seqNo)}회차 검사 결과 추가`,
      matchHint: '이 결과의 판정이 고른 LOT 에 걸립니다.',
      judgmentHint: '하나만 고릅니다. 수량은 넣지 않습니다.',
      serialHeading: '검사한 시리얼',
      serialOptional: '(선택)',
      noLots: '피킹된 LOT 이 없어 결과를 기록할 수 없습니다.',
    },
    bar: {
      save: '결과 저장',
      saving: '저장 중…',
      saved: (seqNo: number): string => `${String(seqNo)}회차 결과를 저장했습니다.`,
      ready: '저장할 수 있습니다. 판정은 출하 완료 때 확정됩니다.',
      blocked: {
        match: '피킹 LOT 을 1개 이상 고르세요.',
        judgment: '판정을 고르세요.',
        reason: '이 결과가 불합격이나 보류 판정을 바꿉니다. 재검 사유를 고르세요.',
        noLots: '피킹된 LOT 이 없어 결과를 기록할 수 없습니다.',
        skipped: '이 의뢰는 OQC 생략으로 닫혔습니다. 결과를 더하지 않습니다.',
        completed: '출하 완료로 판정이 확정된 의뢰입니다. 결과를 더하지 않습니다.',
        /** 검사 항목 측정 값 오류(FR-009 · T052) — 수치 항목에 숫자가 아닌 값 등. */
        measurement: '검사 항목 측정 값의 오류를 고친 뒤 저장할 수 있습니다.',
      },
    },
  },
};
