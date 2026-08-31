/**
 * W-05-05 보전지시 발행 — 고장·점검 불합격·주기 도래를 묶어 보전 지시를 낸다.
 *
 * ⛔ **일괄 발행 경로가 없다.** 이 화면은 트리거 여럿을 지시 **하나**로 묶고, 툴 예방보전
 * 화면은 툴 하나마다 지시 하나를 낸다 — **카디널리티가 반대**다. 그래서 이 화면의 문구는
 * 「지금 무엇을 하나로 묶고 있는가」를 계속 말한다.
 */
export const maintenanceOrder = {
  title: '보전지시 발행',
  breadcrumbRoot: '설비/툴',

  panes: {
    triggers: '발행 대상',
    form: '지시 발행',
    list: '발행된 지시',
  },

  triggers: {
    heading: '아직 지시가 나가지 않은 것',
    /** ⭐ 같은 설비끼리만 묶인다 — 고르는 순간 다른 설비의 줄이 잠긴다. */
    sameEquipmentOnly:
      '한 지시에는 같은 설비의 트리거만 묶입니다. 설비를 하나 고르면 다른 설비의 줄은 잠깁니다.',
    lockedOtherEquipment: '다른 설비의 트리거입니다. 고른 설비를 해제하면 고를 수 있습니다.',
    breakdownTab: '고장',
    inspectionTab: '점검 불합격',
    pmDueTab: '주기 도래',
    /** ⛔ 주기 도래는 가리킬 기록이 없다 — 목록이 아니라 직접 더하는 자리다. */
    pmDueLead:
      '주기 도래는 저장된 기록이 아니라 파생 조건이라 고를 목록이 없습니다. 설비를 고르고 아래 버튼으로 트리거에 더하세요.',
    addPmDue: '주기 도래 트리거 더하기',
    pmDueAdded: '주기 도래',
    selected: (count: number): string => `${String(count)}건 골랐습니다`,
    none: '고른 트리거가 없습니다.',
    remove: '빼기',

    breakdownNo: '고장 번호',
    inspectionNo: '점검 번호',
    equipment: '설비',
    symptom: '증상',
    reportedAt: '보고 시각',
    inspectedAt: '점검 시각',
    inspector: '점검자',
    result: '결과',
    emptyTitle: '대상이 없습니다',
    emptyBreakdown: '지시가 나가지 않은 고장이 없습니다.',
    emptyInspection: '지시가 나가지 않은 점검 불합격이 없습니다.',
  },

  form: {
    target: '대상 설비',
    plannedDate: '예정일',
    assignee: '담당자',
    assigneeNone: '지정하지 않음',
    /** ⚠ 담당자 칸이 내부 사용자만 가리킨다 — 외주는 지시 내용에 적는다. */
    assigneeExternalNote:
      '외주 인력은 이 칸에 담을 수 없습니다. 담당자를 비우고 지시 내용에 업체와 담당자를 적으세요.',
    baseDate: '주기 기준일',
    baseDateNote: '다음 주기가 이 날부터 시작합니다. 예방보전에만 적습니다.',
    baseDateCorrective: '사후 보전에는 주기 기준일을 적지 않습니다.',
    orderNote: '지시 내용',
    orderNoteHint: '담당자가 읽고 판단할 내용을 적으세요. 외주면 업체와 연락처도 함께 적습니다.',
    items: '지시 항목',
    itemsLead:
      '설비 보전은 점검·보전 항목 마스터에서 고릅니다. 마스터에 없는 것은 지시 내용에 적으세요.',
    addItem: '항목 더하기',
    removeItem: '항목 빼기',
    itemPlaceholder: '항목을 고르세요',
    maintenanceType: '보전 유형',
    /** ⭐ 유형은 트리거 조합이 정한다 — 화면이 고르지 않는다. */
    maintenanceTypeDerived:
      '보전 유형은 트리거 조합이 정합니다 — 고장이 하나라도 섞이면 사후입니다.',
    corrective: '사후',
    preventive: '예방',
    /** ⛔ 예지는 트리거가 없다 — 값은 두되 고를 수 없다. */
    predictive: '예지',
    predictiveLocked: '예지 보전은 트리거가 아직 없어 고를 수 없습니다.',

    submit: '지시 발행',
    reset: '입력 지우기',
    requiredTarget: '대상 설비를 고르세요.',
    requiredPlannedDate: '예정일을 고르세요.',
    invalidPlannedDate: '달력에 없는 날짜입니다. 예정일을 다시 고르세요.',
    requiredAssignee: '담당자를 고르세요.',
    requiredTrigger: '트리거를 하나 이상 고르세요.',
    requiredItem: '지시 항목을 하나 이상 고르세요.',
    mixedEquipment: '한 지시에는 같은 설비의 트리거만 묶을 수 있습니다.',
    userLookupFailed: '사용자 목록을 불러오지 못해 지금은 고를 수 없습니다. 다시 시도해 주세요.',
    itemLookupFailed: '항목 마스터를 불러오지 못해 지금은 고를 수 없습니다. 다시 시도해 주세요.',
    equipmentLookupFailed: '설비 목록을 불러오지 못해 지금은 고를 수 없습니다. 다시 시도해 주세요.',
    lookupTruncated: '목록의 일부만 보입니다. 찾는 값이 없으면 담당자에게 문의하세요.',
  },

  confirm: {
    title: '이 지시를 발행할까요?',
    lead: '아래 내용으로 지시 하나가 만들어집니다.',
    triggerCount: (count: number): string => `트리거 ${String(count)}건`,
    itemCount: (count: number): string => `항목 ${String(count)}개`,
    submit: '발행',
    cancel: '취소',
  },

  list: {
    orderNo: '지시 번호',
    target: '대상',
    type: '유형',
    plannedDate: '예정일',
    status: '상태',
    assignee: '담당자',
    notAvailable: '—',
    emptyTitle: '발행된 지시가 없습니다',
    empty: '조건에 맞는 지시가 없습니다.',
    cancel: '취소',
    /** ⛔ 실적이 있으면 취소할 수 없다 — 서버 판정이지만 화면도 사유를 말한다. */
    cancelConfirmTitle: '이 지시를 취소할까요?',
    cancelConfirm: '실적이 하나도 없을 때만 취소됩니다. 실적이 있으면 서버가 거부합니다.',
    cancelLockedStatus: '발행 상태의 지시만 취소할 수 있습니다.',
  },

  status: {
    issued: '발행',
    done: '완료',
    cancelled: '취소',
  },

  filters: {
    status: '상태',
    period: '예정일 기간',
    all: '전체',
    search: '조회',
    reset: '초기화',
    periodInvalid: '달력에 없는 날짜입니다. 시작일과 종료일을 다시 고르세요.',
    periodReversed: '종료일이 시작일보다 앞섭니다. 두 날짜를 바꿔 주세요.',
  },

  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
    prev: '이전',
    next: '다음',
  },
} as const;
