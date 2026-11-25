/**
 * W-CO-14 인계작업 알림 설정 — 공장 × 인계 작업 종류마다 알림·Zalo·담당자(최대 5명)를 정한다
 * (피처 002, omf-all-around#190). 작업 이름은 서버 목록(`/app/handover-alert-types`)이 정본이고,
 * 이 파일은 「언제」·「처리」 안내만 든다.
 */
export const handoverAlertSettings = {
  panes: {
    types: '인계 작업',
    setting: (typeName: string): string => `${typeName} 알림 설정`,
  },
  fields: {
    plant: '공장 선택',
    plantPlaceholder: '공장을 선택하세요',
    when: '알림 시점',
    where: '처리 화면',
    /** 끄면 알림센터 · Zalo 모두 보내지 않는다(서버 `EVENT_DISABLED`) — 알림 전체 사용 여부. */
    enabled: '알림 사용',
    zalo: 'Zalo 발송',
    recipients: (count: number): string => `수신자 ${String(count)}명`,
    recipientMax: (max: number): string => `최대 ${String(max)}명`,
  },
  columns: {
    type: '작업명',
    enabled: '알림',
    zalo: 'Zalo',
    recipients: '수신자',
  },
  values: {
    on: 'ON',
    off: 'OFF',
    /** Zalo 연결이 ACTIVE 가 아닐 때 Zalo 발송 옆 노란 칩. */
    notConnected: '미연결',
    /** US2-4 — 이 사람은 Zalo 를 받지 못하고 알림센터로만 받는다. */
    noPhone: '전화번호 없음',
    inactive: '미사용',
    noPhoneCount: (count: number): string => `전화번호 없는 수신자 ${String(count)}명`,
    recipientCount: (count: number): string => `${String(count)}명`,
  },
  actions: {
    add: '수신자 추가',
    remove: '제거',
    revert: '취소',
    save: '저장',
    reload: '다시 불러오기',
    openConnection: 'Zalo 연결 설정',
  },
  state: {
    noPlants: '선택할 수 있는 공장이 없습니다.',
    noTypes: '설정할 인계 작업이 없습니다.',
    noRecipients: '지정한 수신자가 없습니다.',
    /** US2-5 — 켜 두었는데 받을 사람이 없다. 저장은 막지 않는다. */
    /** US2-3 — 상한이 찼다. 서버도 400 으로 막는다. */
    limitReached: (max: number): string =>
      `최대 ${String(max)}명까지 지정할 수 있습니다. 바꾸려면 먼저 한 명을 제거하세요.`,
    noPhoneNotice: (count: number): string =>
      `전화번호가 없는 수신자 ${String(count)}명은 알림센터로만 받습니다.`,
    zaloNeedsEnabled: '알림 사용을 ON으로 해야 Zalo로 보낼 수 있습니다.',
    /** 연결 전 Zalo 건은 보내지 않고 대기한다(러너 CONNECTION_NOT_READY · 24시간 뒤 만료). 알림센터 행은 바로 생긴다. */
    zaloNotActive: 'Zalo가 연결되지 않아 Zalo는 보내지 않습니다. 알림센터로는 바로 받습니다.',
    /** 발송 건마다 ZBS 잔액 · OA 일일 한도를 쓴다. 한도 초과(-144 · -147)는 다음 07:00(현장 시각)으로 미룬다. */
    zaloQuota:
      '발송 요금은 ZBS 잔액에서 차감됩니다. 일일 발송 한도를 초과한 알림은 다음 날 오전 7시(현장 시간)에 발송됩니다.',
    unsaved: '저장되지 않은 변경 사항',
    saved: '저장했습니다.',
    conflict: '다른 사람이 먼저 저장했습니다. 다시 불러온 뒤 저장하세요.',
  },
  errors: {
    inactiveRecipients: (count: number): string =>
      `미사용 계정 ${String(count)}명이 있습니다. 제거해야 저장할 수 있습니다.`,
  },
  /** 종류별 「언제」(알림이 생기는 때)·「처리」(처리하는 화면). 화면 이름은 메뉴 글자 그대로다. */
  types: {
    IQC_INSPECTION_REQUESTED: {
      when: 'IQC 검사 의뢰가 생성되면 입하 건당 한 번 알림을 보냅니다. 알림에는 LOT 수가 표시됩니다.',
      // ui-check-ignore: C-13 메뉴 이름 「검사 조회·판정」 그대로
      where: '품질 관리 › 검사 조회·판정 › IQC',
    },
    IQC_INSPECTION_REJECTED: {
      when: 'IQC 판정이 불합격으로 확정될 때 알립니다. 불합격 LOT 1건에 한 번 보냅니다.',
      /* 피처 009 — 관리웹 입고 처리가 없어졌다. 불합격 LOT 도 PDA 적치로 불량창고에 입고한다(FR-003). */
      // ui-check-ignore: C-13 PDA 화면 이름 「적치·입고 완료」 그대로
      where: '모바일 PDA › 창고 › 적치·입고 완료 (PDA 적치로 불량창고에 입고)',
    },
    /** 피처 009(omf-all-around#294) — 지시 없이 적치할 LOT 이 생겼다(FR-034). */
    PUTAWAY_PENDING: {
      when: 'IQC 판정 확정 또는 검사 불필요 입하 마감으로 적치할 LOT이 생길 때 알립니다. 입하 1건에 한 번 보내고 LOT 수를 내용에 적습니다.',
      // ui-check-ignore: C-13 PDA 화면 이름 「적치·입고 완료」 그대로
      where: '모바일 PDA › 창고 › 적치·입고 완료',
    },
    PUTAWAY_REQUESTED: {
      when: '입고 처리로 적치 지시가 생길 때 알립니다. 입고 1건에 한 번 보내고 적치 지시 수를 내용에 적습니다.',
      where: '모바일 PDA › 창고 › 적치',
    },
    MATERIAL_PICKING_REQUESTED: {
      when: '출고 요청이 배포돼 피킹 지시가 생길 때(출고 작업일 00:00 또는 바로) 알립니다. 피킹 지시마다 보냅니다.',
      // ui-check-ignore: C-13 메뉴 이름 「자재 출고·피킹」 그대로
      where: '모바일 PDA › 창고 › 자재 출고·피킹',
    },
    STOCK_TRANSFER_ARRIVAL_PENDING: {
      when: '창고 이동이 반출될 때 도착 창고 공장의 수신자에게 알립니다.',
      where: '모바일 PDA › 창고 › 재고 이동(도착)',
    },
    WORK_ORDER_RELEASED: {
      when: '일반 W/O가 배포될 때 알립니다.',
      where: 'POP › 작업 시작',
    },
    EMERGENCY_WORK_ORDER_RELEASED: {
      when: '긴급 W/O가 배포될 때 알립니다.',
      where: 'POP › 긴급 W/O',
    },
    REWORK_WORK_ORDER_CREATED: {
      when: '부적합 처분으로 재작업 W/O가 생길 때 알립니다.',
      where: 'POP › 재작업 실적 등록',
    },
    OQC_INSPECTION_REQUESTED: {
      when: '출하지시 등록으로 OQC 의뢰가 생길 때 알립니다. 출하지시 1건에 한 번 보내고 의뢰 수를 내용에 적습니다.',
      where: 'POP › OQC 출하검사 판정',
    },
    SHIPMENT_PICKING_REQUESTED: {
      when: '출하지시가 공장이 정해진 채 등록되거나 공장이 처음 정해질 때 알립니다.',
      where: '모바일 PDA › 제품 출하 › 제품 출하 피킹',
    },
    SHIPMENT_PACKING_REQUESTED: {
      when: '관리웹 출하 처리로 출하가 생길 때 알립니다.',
      where: 'POP › 출하 포장',
    },
  },
  /** 조회 조건 · 목록 · 상세 통일 배치(omf-all-around#358). */
  workspace: {
    list: '인계 작업 목록',
    search: '작업명 검색',
    searchPlaceholder: '작업명을 입력하세요',
    apply: '조회',
    clear: '초기화',
    selectTypeTitle: '인계 작업을 선택하세요.',
    selectType: '인계 작업을 선택하면 알림 사용, Zalo 발송, 수신자를 정할 수 있습니다.',
  },
} as const;
