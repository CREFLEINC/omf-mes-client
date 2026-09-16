/**
 * P-04-05 출하 단위 구성 — POP 에서 포장이 끝난 상자를 묶어 출하 단위를 만들고, 마감하면
 * 납품 라벨이 나간다(SHIP-UNIT-01 · 설계 §6).
 */
export const shippingUnit = {
  title: '출하 단위 구성',

  entry: {
    /** ① 출하 선택. 서버가 「미구성 PACKED 상자가 있는 출하」만 걸러 준다(설계 §5-1). */
    label: '출하',
    placeholder: '출하를 고르세요',
    loading: '출하를 불러오는 중입니다…',
    failed: '출하 목록을 불러오지 못했습니다.',
    empty: '구성할 상자가 남은 출하가 없습니다.',
    boxes: (count: number): string => `미구성 상자 ${String(count)}개`,
  },

  unit: {
    /** ② 출하 단위. 유형을 고르고 새로 만든다. */
    label: '출하 단위',
    typeLabel: '유형',
    typePlaceholder: '유형을 고르세요',
    create: '새 출하 단위',
    creating: '만드는 중…',
    none: '아직 만들지 않았습니다. 유형을 고르고 [새 출하 단위]를 누르세요.',
    status: { OPEN: '구성 중', CLOSED: '마감' },
    failed: '출하 단위를 만들지 못했습니다.',
  },

  scan: {
    /** ③ 포장 라벨 스캔. 스캐너와 직접 입력이 같은 칸을 쓴다(설계 §5-2). */
    label: '포장 라벨',
    placeholder: '상자 번호를 읽거나 입력하세요',
    locked: '출하 단위를 먼저 만드세요',
    scanning: '등록하는 중…',
    added: (no: string): string => `${no} 을(를) 등록했습니다.`,
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
    sectionLabel: '등록된 상자',
    empty: '아직 등록한 상자가 없습니다.',
    columnSeq: '#',
    columnNo: '상자 번호',
    columnContents: '내용물',
    columnAction: '',
    remove: '빼기',
    removing: '빼는 중…',
    removeFailed: '상자를 빼지 못했습니다.',
    /** 한 상자에 여러 줄이 들어갈 수 있다 — 줄 하나의 모양. */
    content: (itemCode: string, lotNo: string, qty: string): string =>
      `${itemCode} · ${lotNo} · ${qty}`,
  },

  preview: {
    /** ④ 납품 라벨 미리보기 = 품목별 합. 라벨 본문과 같은 값이다. */
    sectionLabel: '납품 라벨 미리보기',
    empty: '상자를 등록하면 품목별 합이 보입니다.',
    item: (itemCode: string, itemName: string, qty: string): string =>
      `${itemCode} ${itemName} ${qty}`,
    more: (count: number): string => `외 ${String(count)}건`,
    boxCount: (count: number): string => `상자 ${String(count)}개`,
  },

  close: {
    action: '마감하고 납품 라벨 출력',
    closing: '마감하는 중…',
    /** ⛔ 되돌릴 수 없다 — 확인창이 그 사실을 먼저 말한다(설계 §5-4). */
    confirmTitle: '이 출하 단위를 마감할까요?',
    confirmBody: '마감하면 되돌릴 수 없습니다. 상자를 더 넣거나 뺄 수 없게 됩니다.',
    confirmAction: '마감',
    cancel: '취소',
    needsBox: '상자를 하나 이상 등록해야 마감할 수 있습니다.',
    failed: '마감하지 못했습니다.',
    /** 마감은 됐는데 라벨이 못 나간 자리 — 발행 기록과 종이는 다른 걸음이다. */
    issued: (seq: number): string => `납품 라벨 1건 발행 · 회차 ${String(seq)}`,
    printed: '인쇄 성공',
    printFailed: (reason: string): string => `인쇄 실패 — ${reason}`,
    noPrinter: '프린터가 없어 인쇄하지 못했습니다. 발행 기록은 남았습니다.',
    noBridge: '이 자리에서는 프린터로 보낼 수 없습니다. 발행 기록은 남았습니다.',
    reissueHint: '라벨이 나오지 않았으면 재발행 화면에서 사유를 골라 다시 뽑으세요.',
  },

  next: '새 단위',
} as const;
