/**
 * W-CO-14 인계작업 알림 설정 — 공장 × 인계 작업 종류마다 알림·Zalo·담당자(최대 5명)를 정한다
 * (피처 002, omf-all-around#190). 작업 이름은 서버 목록(`/app/handover-alert-types`)이 정본이고,
 * 이 파일은 「언제」·「처리」 안내만 든다.
 */
export const handoverAlertSettings = {
  /* 설계 W-CO-14·사이드바와 같은 글자다. */
  title: '인계작업 알림 설정',
  breadcrumbRoot: '시스템 관리',
  description:
    '인계 작업이 생기면 누구에게 알릴지 작업마다 정합니다. 알림센터로 받고, 켜면 Zalo 로도 받습니다.',
  intro:
    '처음에는 모두 꺼져 있습니다. Zalo 를 켜면 고객사 Zalo 발송량(요금과 일일 한도)이 늘어납니다.',
  panes: {
    types: '인계 작업',
    setting: (typeName: string): string => `설정: ${typeName}`,
  },
  fields: {
    plant: '공장',
    when: '언제',
    where: '처리',
    enabled: '알림 받기',
    zalo: 'Zalo로도 보내기',
    recipients: (count: number, max: number): string => `수신자 (${String(count)}/${String(max)})`,
  },
  columns: {
    type: '작업',
    enabled: '알림',
    zalo: 'Zalo',
    recipients: '수신자',
  },
  values: {
    on: '켬',
    off: '끔',
    /** US2-4 — 이 사람은 Zalo 를 받지 못하고 알림센터로만 받는다. */
    noPhone: '전화번호 없음 — 알림센터로만 받음',
    inactive: '비활성',
    noPhoneCount: (count: number): string => `전화번호 없는 수신자 ${String(count)}명`,
  },
  actions: {
    add: '추가',
    remove: '해제',
    revert: '되돌리기',
    save: '저장',
    reload: '다시 불러오기',
    openConnection: '알림 연결 설정 열기',
    cancel: '취소',
    discard: '버리고 이동',
  },
  state: {
    noPlants: '고를 수 있는 공장이 없습니다.',
    noTypes: '설정할 인계 작업이 없습니다.',
    noRecipients: '지정한 수신자가 없습니다.',
    /** US2-5 — 켜 두었는데 받을 사람이 없다. 저장은 막지 않는다. */
    noRecipientsWarning: '담당자가 없어 알림이 가지 않습니다.',
    /** US2-3 — 상한이 찼다. 서버도 400 으로 막는다. */
    limitReached: (max: number): string =>
      `최대 ${String(max)}명까지 지정할 수 있습니다. 바꾸려면 먼저 한 명을 해제하세요.`,
    noPhoneNotice: (count: number): string =>
      `전화번호가 없는 수신자 ${String(count)}명은 알림센터로만 받습니다`,
    zaloHelp:
      '전화번호가 있는 수신자에게 영문 Zalo 메시지를 보냅니다. 실패해도 알림센터는 받습니다.',
    zaloNeedsEnabled: 'Zalo 는 알림을 켠 뒤에 켤 수 있습니다.',
    zaloNotActive: 'Zalo 연결이 설정되지 않아 지금은 알림센터로만 갑니다',
    saved: '저장했습니다',
    conflict: '다른 사람이 먼저 저장했습니다. 다시 불러온 뒤 고쳐 주세요.',
    unsavedTitle: '저장하지 않은 변경이 있습니다',
    unsavedBody: '이동하면 고친 내용이 사라집니다. 버리고 이동할까요?',
  },
  errors: {
    inactiveRecipients: (count: number): string =>
      `비활성 계정 ${String(count)}명이 있습니다. 해제해야 저장할 수 있습니다.`,
  },
  /** 수신자 고르기 창의 상한 안내(D-11). */
  picker: {
    slotsLeft: (left: number, max: number): string =>
      `남은 자리 ${String(left)}명 — 한 작업에 최대 ${String(max)}명까지 지정할 수 있습니다`,
    full: (max: number): string =>
      `최대 ${String(max)}명까지 지정할 수 있습니다 — 남은 사람은 고를 수 없습니다`,
  },
  /** 종류별 「언제」(알림이 생기는 때)·「처리」(처리하는 화면). 화면 이름은 메뉴 글자 그대로다. */
  types: {
    IQC_INSPECTION_REQUESTED: {
      when: '입하 LOT 이 등록돼 IQC 의뢰가 생길 때 — 입하 1건에 1번(LOT 수를 내용에)',
      // ui-check-ignore: C-13 메뉴 이름 「검사 조회·판정」 그대로
      where: '관리웹 품질 관리 › 검사 조회·판정 (IQC 탭)',
    },
    PUTAWAY_REQUESTED: {
      when: '입고 처리로 적치 지시가 생길 때 — 입고 1건에 1번(적치 지시 수를 내용에)',
      where: '모바일 PDA › 창고 › 적치',
    },
    MATERIAL_PICKING_REQUESTED: {
      when: '출고 요청(W/O 배포, 추가 출고 요청)으로 피킹 지시가 생길 때 — 피킹 지시마다',
      // ui-check-ignore: C-13 메뉴 이름 「자재 출고·피킹」 그대로
      where: '모바일 PDA › 창고 › 자재 출고·피킹',
    },
    STOCK_TRANSFER_ARRIVAL_PENDING: {
      when: '창고 이동이 반출될 때 — 도착 창고 공장의 담당자에게',
      where: '모바일 PDA › 창고 › 재고 이동(도착)',
    },
    WORK_ORDER_RELEASED: {
      when: '일반 W/O 가 배포될 때',
      where: 'POP › 작업 시작',
    },
    EMERGENCY_WORK_ORDER_RELEASED: {
      when: '긴급 W/O 가 배포될 때',
      where: 'POP › 긴급 W/O',
    },
    REWORK_WORK_ORDER_CREATED: {
      when: '부적합 처분으로 재작업 W/O 가 생길 때',
      where: 'POP › 재작업 실적 등록',
    },
    OQC_INSPECTION_REQUESTED: {
      when: '출하지시 등록으로 OQC 의뢰가 생길 때 — 출하지시 1건에 1번(의뢰 수를 내용에)',
      where: 'POP › OQC 출하검사 판정',
    },
    SHIPMENT_PICKING_REQUESTED: {
      when: '출하지시가 공장이 정해진 채 등록되거나 공장이 처음 정해질 때',
      where: '모바일 PDA › 제품 출하 › 제품 출하 피킹',
    },
    SHIPMENT_PACKING_REQUESTED: {
      when: '관리웹 출하 처리로 출하가 생길 때',
      where: 'POP › 출하 포장',
    },
  },
} as const;
