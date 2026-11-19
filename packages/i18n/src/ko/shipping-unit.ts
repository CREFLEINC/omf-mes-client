/**
 * P-04-05 출하 단위 구성 — POP 에서 포장이 끝난 상자를 묶어 출하 단위를 만들고, 마감하면
 * 납품 라벨이 나간다(SHIP-UNIT-01 · 설계 §6). 본문은 #295 통일 시안을 따른다.
 */
export const shippingUnit = {
  title: '출하 단위 구성',

  /** POP 공통 헤더 — 연결 상태 표기는 다른 POP 머리줄과 같다. */
  header: {
    online: '온라인',
    offline: '오프라인',
  },

  /** 왼쪽 목록: 구성 대기(출하) · 구성 완료(마감한 출하 단위). */
  tabs: {
    label: '출하 목록',
    wait: '구성 대기',
    done: '구성 완료',
  },

  entry: {
    /** 서버가 「미구성 PACKED 상자가 있는 출하」만 걸러 준다(설계 §5-1). */
    label: '출하',
    loading: '출하를 불러오는 중입니다…',
    failed: '출하 목록을 불러오지 못했습니다.',
    empty: '구성할 출하가 없습니다',
    boxes: (count: number): string => `미등록 상자 ${String(count)}개`,
    pick: '출하를 선택하세요',
    pickHint: '왼쪽 「구성 대기」 목록에서 출하를 누르세요.',
  },

  closed: {
    loading: '마감한 출하 단위를 불러오는 중입니다…',
    failed: '마감한 출하 단위를 불러오지 못했습니다.',
    empty: '마감한 출하 단위가 없습니다',
    chip: '마감',
    shipment: '출하번호',
    boxes: (count: number): string => `상자 ${String(count)}개`,
    closedAt: '마감일시',
    pick: '출하 단위를 선택하세요',
    pickHint: '왼쪽 「구성 완료」 목록에서 단위를 누르면 마감 결과를 봅니다.',
  },

  steps: {
    label: '출하 단위 단계',
    boxes: '상자 등록',
    close: '납품 라벨 발행',
  },

  band: {
    shipment: '출하번호',
    type: '출하 단위 유형',
    unit: '출하 단위 번호',
    unassigned: '미등록 상자',
    closedAt: '마감일시',
    count: (count: number): string => `${String(count)}개`,
  },

  unit: {
    typeLabel: '출하 단위 유형',
    failed: '출하 단위를 만들지 못했습니다.',
  },

  scan: {
    /** 포장 라벨 스캔. 스캐너와 직접 입력이 같은 칸을 쓴다(설계 §5-2). */
    label: '상자 번호',
  },

  /**
   * 등록이 막힌 사유 — **다섯 갈래를 가른다**(설계 §5-3).
   *
   * ⛔ 모르는 사유를 다섯 중 하나로 접지 않는다 — 엉뚱한 안내는 담당에게 할 수 없는 조치를
   *    되풀이하게 만든다.
   */
  rejection: {
    unitClosed: '마감된 단위입니다. 새 출하 단위를 만드세요.',
    notPacked: '아직 포장이 끝나지 않았습니다.',
    noAllocation: '포장 실적이 없는 상자입니다.',
    otherShipment: '다른 출하의 상자입니다.',
    alreadyAssigned: '이미 다른 출하 단위에 들어 있습니다.',
    shipmentCancelled: '취소된 출하입니다.',
    notFound: '없는 상자입니다.',
    unknown: '등록하지 못했습니다.',
    /** 서버가 사유를 말했으면 그대로 보인다 — 화면이 지어내지 않는다. */
    spoken: (message: string): string => `등록하지 못했습니다: ${message}`,
  },

  boxes: {
    /** 상자 목록 구획 이름 · 줄 안 작은 칸 이름. */
    title: '등록된 상자',
    itemCode: '품목코드',
    qty: '수량',
    empty: '등록된 상자가 없습니다',
    emptyHint: '포장 라벨을 스캔하세요.',
    remove: (no: string): string => `${no} 빼기`,
    removeFailed: '상자를 빼지 못했습니다.',
    /** 한 상자에 여러 줄이 들어갈 수 있다 — 줄 하나의 모양. */
    content: (itemCode: string, lotNo: string, qty: string): string =>
      `${itemCode} ${qty} · ${lotNo}`,
    /** 아래 합계 줄 — 합은 서버가 준 품목별 합을 단위별로 더한 값이다. */
    sum: (count: number, total: string): string => `등록 ${String(count)}개 · 총 ${total}`,
  },

  preview: {
    /** 납품 라벨 미리보기 — 인쇄될 라벨 그림 그대로다. */
    sectionLabel: '납품 라벨 미리보기',
    empty: '상자를 먼저 등록해 주세요',
    /** 미리보기 제목 줄 오른쪽 — 발행될 라벨 장수. */
    sheets: (count: number): string => `${String(count)}장`,
  },

  close: {
    action: '마감 후 납품 라벨 출력',
    closing: '마감하는 중…',
    failed: '마감하지 못했습니다.',
    /** 인쇄까지 끝난 알림. */
    done: '납품 라벨 1장을 발행했습니다. 출하 단위에 부착하세요.',
    /** 마감은 됐는데 라벨이 못 나간 자리 — 발행 기록과 종이는 다른 걸음이다. */
    issued: (seq: number): string => `납품 라벨 1건 발행 · 회차 ${String(seq)}`,
    printed: '인쇄 성공',
    printFailed: (reason: string): string => `인쇄 실패 — ${reason}`,
    noPrinter: '프린터가 없어 인쇄하지 못했습니다. 발행 기록은 남았습니다.',
    noBridge: '이 자리에서는 프린터로 보낼 수 없습니다. 발행 기록은 남았습니다.',
    reissueHint: '라벨이 나오지 않았으면 재발행 화면에서 사유를 골라 다시 뽑으세요.',
  },

  actions: {
    prev: '이전',
    next: '다음',
  },

  /** 「구성 완료」 단위의 납품 라벨 재발행 — 출하 라벨 화면 재발행과 같은 사유 코드(REISSUE_REASON). */
  reissue: {
    action: '재발행',
    title: (no: string): string => `납품 라벨 재발행 · ${no}`,
    label: '재발행 사유',
    guide: '재발행하면 회차가 올라가고 이전 기록은 지워지지 않습니다. 인쇄면에도 회차가 찍힙니다.',
    empty: '고를 수 있는 재발행 사유가 아직 없습니다. 사유 없이는 재발행할 수 없습니다.',
    loadFailed: '재발행 사유를 불러오지 못했습니다.',
    cancel: '취소',
    issuing: '발행하는 중…',
    done: '납품 라벨을 재발행했습니다. 출하 단위에 부착하세요.',
    /** 회차 — 발행 이력(출하 라벨 화면과 같은 조회)에서 읽는다. 못 읽으면 「알 수 없음」. */
    nextSeq: '이번 회차',
    last: '최근 발행',
    seq: (seq: number): string => `${String(seq)}회차`,
    unknown: '알 수 없음',
    none: '발행 기록 없음',
    historyFailed: '발행 이력을 불러오지 못했습니다',
    outcome: {
      PENDING: '인쇄 결과 없음',
      SUCCEEDED: '인쇄됨',
      FAILED: '인쇄 실패',
    },
  },

  next: '새 단위',
} as const;
