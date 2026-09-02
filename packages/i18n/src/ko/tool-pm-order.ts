/**
 * W-05-02 툴 보전오더 생성(예방보전 도래 조회) — 도래한 툴을 보고 오더를 낸다.
 *
 * ⭐ **도래 판정을 서버가 한다.** 화면은 날짜도 초과율도 계산하지 않고, 서버가 준 값과
 * 「왜 도래했는가」를 그대로 옮긴다. 그래서 문구가 「산출 불가」·「기준 없음」을 0과 가른다.
 *
 * ⭐ **한 오더 = 한 툴이다.** 여럿을 고르면 오더가 여럿 만들어지고, 일부만 성공할 수 있다.
 * 그 사실과 결과를 화면이 말한다.
 */
export const toolPmOrder = {
  title: '툴 보전오더 생성',
  breadcrumbRoot: '설비/툴',

  panes: {
    filters: '조회 조건',
    list: '예방보전 도래',
    form: '오더 만들기',
  },

  filters: {
    plant: '공장',
    dueOnly: '도래한 것만',
    withoutOpenOrder: '열린 오더 없는 것만',
    guaranteedMissing: '적정타수 없는 것만',
    sort: '정렬',
    sortShotUsage: '초과율 높은 순',
    sortNextPm: '다음 예정일 이른 순',
    sortCode: '코드 순',
    all: '전체',
    search: '조회',
    reset: '초기화',
    /** 기본 조회가 「적체를 보는」 조회임을 밝힌다. */
    defaultNote:
      '기본은 도래했고 열린 오더가 없는 툴이며 초과율 높은 순으로 보입니다 — 경과일보다 초과율이 위험의 크기입니다.',
    plantLookupFailed: '공장 목록을 불러오지 못해 지금은 고를 수 없습니다. 다시 시도해 주세요.',
    lookupTruncated: '목록의 일부만 보입니다. 찾는 값이 없으면 담당자에게 문의하세요.',
  },

  table: {
    mold: '툴',
    shotUsage: '초과율',
    currentShot: '누계 타발수',
    guaranteed: '적정타수',
    available: '사용 가능',
    nextPm: '다음 예정일',
    dueAxis: '도래 사유',
    /** ⛔ 적정타수가 없으면 0이 아니라 「산출 불가」다. */
    notComputable: '산출 불가',
    /** ⛔ 기준일이나 주기가 없으면 「기준 없음」이다. */
    noBaseline: '기준 없음',
    notDue: '도래하지 않음',
    axisShot: '타발수 도달',
    axisDate: '날짜 도달',
    notAvailable: '—',
    /** 초과율이 100을 넘을 수 있다 — 진행 표시는 100에서 멈추되 색으로 가른다. */
    overLimit: '초과',
    emptyTitle: '도래한 툴이 없습니다',
    empty: '조건에 맞는 툴이 없습니다. 조건을 줄여 보세요.',
    beyondLastTitle: '이 쪽에는 툴이 없습니다',
    beyondLast: '조건에 맞는 툴은 있지만 이 쪽에는 없습니다. 첫 쪽으로 돌아가세요.',
    firstPage: '첫 쪽으로',
  },

  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
    prev: '이전',
    next: '다음',
  },

  form: {
    selected: (count: number): string => `${String(count)}개 툴을 골랐습니다`,
    /** ⭐ 한 오더 = 한 툴 — 여럿을 고르면 오더가 여럿이다. */
    oneOrderPerTool: (count: number): string =>
      `고른 툴마다 오더가 하나씩 만들어집니다 — 오더 ${String(count)}건이 됩니다.`,
    plannedDate: '예정일',
    assignee: '담당자',
    baseDate: '주기 기준일',
    baseDateNote: '다음 주기가 이 날부터 시작합니다. 비우면 서버가 정합니다.',
    orderNote: '지시 내용',
    items: '지시 항목',
    /** ⭐ 툴은 항목 마스터가 없어 이름을 직접 적는다. */
    itemsFreeInput:
      '툴 예방보전에는 항목 마스터가 없어 이름을 직접 적습니다. 한 줄에 하나씩 적으세요.',
    itemName: '항목 이름',
    addItem: '항목 더하기',
    removeItem: '빼기',
    submit: '오더 만들기',
    reset: '입력 지우기',

    requiredSelection: '툴을 하나 이상 고르세요.',
    requiredPlannedDate: '예정일을 고르세요.',
    invalidPlannedDate: '달력에 없는 날짜입니다. 예정일을 다시 고르세요.',
    requiredAssignee: '담당자를 고르세요.',
    requiredItem: '지시 항목을 하나 이상 적으세요.',
    emptyItemName: '빈 항목이 있습니다. 이름을 적거나 그 줄을 빼세요.',
    userLookupFailed: '사용자 목록을 불러오지 못해 지금은 고를 수 없습니다. 다시 시도해 주세요.',
    selectPlaceholder: '고르세요',
  },

  result: {
    /** ⭐ 일부만 성공할 수 있다 — 결과를 툴마다 말한다. */
    heading: '만들기 결과',
    succeeded: (count: number): string => `${String(count)}건 만들었습니다.`,
    failed: (count: number): string => `${String(count)}건이 실패했습니다.`,
    retryFailed: '실패한 것만 다시 시도',
    /** 실패한 툴은 고른 채로 남는다 — 다시 고를 필요가 없다. */
    failedKept: '실패한 툴은 고른 채로 남겨 두었습니다. 원인을 고치고 다시 시도하세요.',
    ok: '만듦',
    error: '실패',
  },
} as const;
