/**
 * W-02-11 출고 요청 현황(003 계획 기반 출고 요청, omf-all-around#66 · US5 · US6). 출고 요청을 한곳에서 보고,
 * 피킹 전 요청을 고치거나 취소하고, 생산 창고 부족을 본다.
 */
export const materialIssueStatus = {
  /* 설계 W-02-11 · 탭 이름과 같은 글자다(검토 1). */
  title: '출고 요청 현황',
  breadcrumb: { root: '구매 / 자재 관리', parent: '출고 관리' },
  today: (date: string): string => `오늘 ${date}`,
  views: {
    label: '보기',
    list: '요청 목록',
    shortage: '부족',
    shortageCount: (count: number): string => `부족 ${String(count)}`,
  },
  filters: {
    label: '조회 조건',
    plant: '공장',
    issueWorkDate: '출고 작업일',
    productionDate: '생산일',
    workOrder: 'W/O',
    workOrderPlaceholder: 'W/O 번호',
    sourceWarehouse: '출발 생산 창고',
    all: '전체',
    status: '상태',
    hasShortage: '부족 있는 요청만',
    releaseFailed: '배포 실패만',
    groupByPlan: '계획별 묶음 보기',
    search: '조회',
    reset: '초기화',
  },
  columns: {
    requestNo: '요청번호',
    workOrder: 'W/O',
    productionDate: '생산일',
    issueWorkDate: '출고 작업일',
    sourceWarehouse: '출발 생산 창고',
    destination: '입고지(생산 현장)',
    lineCount: '품목 수',
    status: '상태',
    shortage: '부족',
  },
  status: {
    WAITING: '대기',
    RELEASED: '배포',
    IN_PROGRESS: '진행 중',
    DONE: '완료',
    CANCELLED: '취소',
  },
  /** 닫힌 요청(완료)의 사유 — 「완료, W/O 취소」. */
  closeReasons: {
    WORK_ORDER_CANCELLED: 'W/O 취소',
    WORK_ORDER_CLOSED: 'W/O 마감',
  } as Record<string, string>,
  statusWithReason: (status: string, reason: string): string => `${status}, ${reason}`,
  releaseFailed: '배포 실패',
  shortageChip: (qty: string): string => `부족 ${qty}`,
  planGroup: {
    title: (planNo: string): string => `생산계획 ${planNo}`,
    none: '생산계획 없음',
    meta: (count: number, shortCount: number): string =>
      shortCount > 0
        ? `요청 ${String(count)}장, 부족 ${String(shortCount)}장`
        : `요청 ${String(count)}장`,
  },
  pager: {
    total: (count: number): string => `전체 ${String(count)}건`,
    previous: '이전',
    next: '다음',
  },
  empty: {
    title: '조건에 맞는 출고 요청이 없습니다',
    description: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
    noPlant: '조회할 공장이 없습니다.',
  },
  detail: {
    label: '출고 요청 상세',
    close: '닫기',
    plan: (planNo: string): string => `생산계획 ${planNo}`,
    productionDate: (date: string): string => `생산일 ${date}`,
    releaseFailed: (text: string): string =>
      `배포하지 못했습니다. 원인: ${text} 원인을 고치면 다음 처리 때 다시 배포합니다.`,
    locked:
      '피킹이 시작돼 출고 작업일, 출발지, 입고지를 바꾸거나 취소할 수 없습니다. 요청 수량만 기출고량 이상으로 고칠 수 있습니다.',
    legacy: '생산 창고 규칙 전에 만든 요청이라 고칠 수 없습니다.',
    cancelled: '취소된 요청입니다. 고칠 수 없습니다.',
    done: '출고를 마친 요청입니다. 고칠 수 없습니다.',
    closed: (reason: string, picked: string): string =>
      picked === ''
        ? `${reason}로 미출고분을 닫았습니다.`
        : `${reason}로 미출고분을 닫았습니다. 집었지만 출고하지 않은 ${picked} 은 그대로 있습니다.`,
    issueWorkDate: '출고 작업일',
    changeDate: '변경',
    sourceWarehouse: '출발 생산 창고',
    destination: '입고지',
    hints: {
      WAITING: '그날 00:00 에 배포됩니다',
      RELEASED: '미래로 미루면 대기로 돌아갑니다',
    } as Record<string, string>,
    lines: {
      label: '요청 품목',
      item: '품목',
      requested: '요청',
      picked: '집음',
      issued: '출고',
      outstanding: '미출고',
      shortage: '부족',
      qtyLabel: (item: string): string => `${item} 요청 수량`,
      belowIssued: (item: string, issued: string): string =>
        `${item} 요청 수량은 기출고량(${issued})보다 적을 수 없습니다.`,
    },
    history: '이력',
    noHistory: '이력이 없습니다.',
    /** 러너 배포처럼 사람이 없는 사건(`actorName` null). */
    systemActor: '자동 배포',
    /**
     * 이력 문장 — 서버는 `eventCode` 와 `detail` 만 준다(계약 §1 history). 값이 없으면 그 부분을 뺀다.
     */
    events: {
      CREATED: (): string => '생성, 대기',
      RELEASED: (): string => '배포',
      RELEASE_FAILED: (error: string): string =>
        error === '' ? '배포 실패' : `배포 실패: ${error}`,
      REVERTED_TO_WAITING: (): string => '대기로 되돌림(피킹 지시 닫음)',
      ISSUE_DATE_CHANGED: (before: string, after: string): string =>
        `출고 작업일 변경 ${before} → ${after}`,
      SOURCE_CHANGED: (before: string, after: string): string =>
        `출발 생산 창고 변경 ${before} → ${after}`,
      DESTINATION_CHANGED: (before: string, after: string): string =>
        `입고지 변경 ${before} → ${after}`,
      QTY_CHANGED: (item: string, before: string, after: string): string =>
        `${item} 요청 수량 변경 ${before} → ${after}`,
      CANCELLED: (reason: string): string => (reason === '' ? '취소' : `취소: ${reason}`),
      CLOSED: (reason: string): string =>
        reason === '' ? '미출고분 닫음' : `미출고분 닫음: ${reason}`,
    },
    cancel: '요청 취소',
    cancelLocked: '일부 진행돼 취소할 수 없습니다',
    revert: '되돌리기',
    save: '저장',
  },
  dateDialog: {
    title: '출고 작업일 변경',
    current: (requestNo: string, date: string): string => `${requestNo}, 지금 ${date}`,
    field: '새 출고 작업일',
    pickFirst: '날짜를 고르세요.',
    releaseNow:
      '오늘이거나 지난 날짜라 저장하면 바로 배포됩니다(피킹 지시가 생기고 담당자에게 알림).',
    backToWaiting: (date: string): string =>
      `${date} 로 미루면 「대기」로 돌아가고 피킹 지시가 닫혀 현장 목록과 배지에서 빠집니다.`,
    scheduled: (date: string): string => `${date} 00:00 에 배포됩니다.`,
    cancel: '취소',
    submit: '변경',
  },
  holidayDialog: {
    title: '휴일입니다',
    body: (date: string): string =>
      `${date} 은 이 공장의 휴일입니다. 그래도 이 날을 출고 작업일로 할까요?`,
    note: '그날 00:00 에 배포되고, 생산 창고 담당자에게 인계 작업 알림이 갑니다.',
    back: '날짜 다시 고르기',
    submit: '그래도 변경',
  },
  cancelDialog: {
    title: (requestNo: string): string => `${requestNo} 를 취소할까요?`,
    released:
      '배포된 요청입니다. 취소하면 피킹 지시도 닫히고 출고 예정이 풀립니다. 되돌릴 수 없습니다.',
    waiting: '취소하면 출고 예정이 풀립니다. 되돌릴 수 없습니다.',
    reason: '취소 사유 (선택)',
    reasonPlaceholder: '예: 계획 변경',
    close: '닫기',
    submit: '요청 취소',
  },
  toast: {
    saved: '요청을 저장했습니다. 출고 예정을 맞췄습니다',
    releasedNow: (date: string): string => `출고 작업일을 ${date}로 바꾸고 바로 배포했습니다`,
    dateChanged: (date: string): string => `출고 작업일을 ${date}로 바꿨습니다`,
    cancelled: (requestNo: string): string => `${requestNo} 를 취소했습니다. 출고 예정을 풀었습니다`,
  },
  errors: {
    versionConflict: '다른 사람이 먼저 이 요청을 바꿨습니다. 다시 불러온 뒤 고치세요.',
    stateLocked: '그 사이 피킹이 시작돼 이 변경을 저장할 수 없습니다. 다시 불러왔습니다.',
    reload: '다시 불러오기',
  },
  shortage: {
    intro:
      '위 묶음은 재고 있는 생산 창고가 없어 요청에 넣지 못한 자재(W/O 단위), 아래는 생산 창고의 가용 재고보다 출고 예정이 많은 품목입니다. 생산 창고 보충은 창고 이동으로 하고, 급하면 「보충 요청」으로 추가 출고 요청을 엽니다.',
    warehouse: '생산 창고',
    item: '품목',
    itemPlaceholder: '품목 코드 또는 이름',
    tableLabel: '생산 창고 부족',
    columns: {
      warehouse: '생산 창고',
      item: '품목',
      available: '가용',
      planned: '출고 예정',
      shortage: '부족',
      allocation: '요청 배분 (출고 작업일 늦은 요청부터 부족)',
    },
    unsourcedTitle: '재고 있는 생산 창고 없음',
    unsourcedNote: (count: number): string =>
      `W/O ${String(count)}건. 배포 때 부서의 어느 생산 창고에도 재고가 없어 출고 요청에 넣지 못한 자재입니다. 생산 창고를 채운 뒤 보충 요청하세요. 재고가 생겨도 자동으로 요청하지 않습니다.`,
    none: '없음',
    warehouseGroup: '생산 창고별 부족',
    warehouseGroupCount: (count: number): string => `품목 ${String(count)}건`,
    workOrderLine: (workOrderNo: string, date: string): string =>
      date === '' ? workOrderNo : `${workOrderNo}, 생산일 ${date}`,
    allocation: (workOrderNo: string, date: string, planned: string): string =>
      `${workOrderNo}, 출고 ${date}, 예정 ${planned}`,
    replenish: '보충 요청 →',
    replenishLabel: (target: string): string => `${target} 보충 요청`,
    replenished: (requestNo: string): string => `보충 요청됨 (${requestNo})`,
    empty: '부족한 품목이 없습니다.',
  },
};
