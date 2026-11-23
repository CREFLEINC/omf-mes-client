/**
 * M-01-01 입하 등록(005 · omf-all-around#254) — 자재 관리 LOT 라벨을 스캔하면 **스캔마다 하나씩 바로 등록**한다.
 *
 * 화면은 두 가지만 크게 보인다(사용자 지시 2026-11-20 「정말로 중요한 것만」) — 방금 찍은 라벨이 맞는지(품목코드 ·
 * 품목명 · 수량), 지금까지 몇 개를 찍었는지(공급사 › 품목 표, 행 번호). 입하 LOT 번호 · 상태 칩 · 등록 시각 ·
 * IQC 요청 번호는 작업자가 쓰지 않아 화면에 두지 않는다. 받아야 할 개수(「몇 개 중 몇 개」)는 물건이 여러 날에 걸쳐
 * 오기도 해 두지 않는다.
 *
 * 작업자에게 P/O 는 보이지 않는다 — 마감 때 시스템이 매칭한다. 마감하지 않은 입하는 화면을 떠나도 「입하 중」으로
 * 남고, 공장 날짜가 바뀌면 시스템이 자동 마감한다.
 */
export const inboundReceipt = {
  title: '입하 등록',
  scan: {
    label: '자재 관리 LOT 라벨',
    /** 화면에는 보이지 않는다 — 스캔 칸의 설명(화면 낭독기). */
    prompt: '자재 관리 LOT 라벨을 스캔하세요',
    results: '스캔 결과',
    /** 알림 줄 오른쪽 ✕ — 그 줄을 지운다(사용자 지시 2026-11-18). */
    dismiss: '알림 지우기',
  },
  /** 방금 찍은 라벨 칸 — 늘 하나다(다음 스캔이 덮는다). */
  last: {
    ok: '등록됨',
    /** 방금 찍은 라벨의 등록을 되돌린다 — 「취소」만으로는 무엇을 취소하는지 몰랐다(사용자 지시 2026-11-23). */
    undo: '스캔 취소',
    /** 칸 머리 오른쪽 ✕ — 칸을 내린다(사용자 지시 2026-11-23). 등록은 그대로다. */
    dismiss: '닫기',
    undoLabel: (lotNo: string) => `${lotNo} 스캔 취소`,
    loading: '품목을 불러오는 중입니다',
    autoClosed: '지난 날짜의 입하는 자동으로 마감됐습니다',
    rejected: '등록 안 됨',
    /** 입하 표에 이미 있는 라벨 — 서버에 다시 보내지 않는다. */
    duplicate: '이미 찍은 라벨입니다',
    offline: '전송 대기',
    offlineBody: '연결되면 자동으로 등록합니다',
    closed: '등록 안 됨',
    closedBody: '이미 마감된 입하입니다',
  },
  /** 거부 까닭 — 등록 없음. */
  reject: {
    refused: '등록할 수 없는 라벨입니다',
    voided: '폐기된 라벨입니다',
    alreadyReceived: '이미 입하된 라벨입니다',
    /** 어디에 들어가 있는지 — 서버가 알려 줄 때만. */
    alreadyReceivedIn: (receiving: boolean): string =>
      receiving ? '다른 기기에서 입하 중입니다' : '입하가 끝난 라벨입니다',
    notMaterialLot: '자재 관리 LOT 라벨이 아닙니다',
    alreadyQueued: '이미 전송 대기에 있습니다',
    failed: '등록하지 못했습니다. 잠시 뒤 다시 스캔하세요.',
  },
  offline: {
    title: (count: number) => `전송 대기 ${count}`,
    /** 연결되자 저절로 보낸 결과 — 다 들어갔으면 건수만, 아니면 들어가지 않은 건수까지(사용자 지시 2026-11-23). */
    flushed: (count: number, registered: number, rejected: number) =>
      rejected === 0
        ? `전송 대기 ${count}건 등록`
        : `전송 대기 ${count}건 중 ${registered}건 등록, ${rejected}건 등록 안 됨`,
    queueFailed: '전송 대기에 담지 못했습니다. 다시 스캔하세요.',
  },
  /**
   * 입하 표 — 공급사 머리 줄 아래 품목 줄. 품목코드 위 · 품목명 아래로 잘리지 않게(사용자 지시 2026-11-20).
   * 제목은 공장 날짜(YY.MM.DD) + 「입하」, 오른쪽은 찍은 라벨 수(사용자 지시 2026-11-23 — 「이번 입하 N개」에서 바꿈).
   */
  tally: {
    title: (date: string) => `${date} 입하`,
    total: (count: number) => `${count}건 Scan`, // ui-check-ignore: C-13 사용자 지시 표기 「N건 Scan」(2026-11-23)
    empty: '아직 등록한 자재 관리 LOT가 없습니다',
    columns: { no: 'No', scannedAt: '스캔 시각', item: '품목', count: '개수', qty: '수량' },
    closed: '마감됨',
    open: (itemCode: string, itemName: string) => `${itemCode} ${itemName} LOT 보기`,
    loadFailed: '불러오지 못한 품목이 있습니다',
    retry: '다시 불러오기',
  },
  /** 품목 줄을 누르면 올라오는 시트 — 그 품목으로 찍은 자재 관리 LOT. 하나씩 빼기 · 공급사 LOT · 이 품목만 마감. */
  lots: {
    label: '자재 관리 LOT 목록',
    /** 품목 시트 제목 — 품목명은 머리에 두지 않고 품목코드와 같은 줄 수준으로(사용자 지시 2026-11-20). */
    title: '입하 품목',
    fields: { itemCode: '품목코드', itemName: '품목명', supplier: '공급사', received: '수량' },
    summary: (count: number, total: string) => `${count}개 ${total}`,
    columns: { no: 'No', lotNo: '번호', qty: '수량', supplierLot: '공급사 LOT' },
    package: (uomCode: string, count: number) => ` · ${uomCode} ${String(count)}`, // ui-check-ignore: C-13 설계 확정 표기 「1,000 EA · 봉지 10」(screens/M-01-01.md)
    noSupplierLot: '없음',
    editSupplierLot: (lotNo: string) => `${lotNo} 공급사 LOT 번호 고치기`,
    unregister: '해제',
  },
  /** 바닥 단추 — 보통은 모두 한 번에, 품목 화면에서는 그 품목만(사용자 지시 2026-11-20). */
  /**
   * 마감 — 하루 몇 번 쓰는 일이라 늘 떠 있는 큰 단추로 두지 않는다(사용자 지시 2026-11-20 시안 A). 이번 입하 머리
   * 오른쪽의 작은 [마감](이름은 무엇을 마감하는지까지), 품목 시트의 [이 품목만 마감].
   */
  close: {
    allShort: '마감',
    all: (items: number, lots: number) => `모두 입하 마감 (${items}품목 ${lots}개)`,
    one: (lots: number) => `이 품목만 마감 (${lots}개)`,
    /** 막힌 까닭(잠금 사유는 남긴다). */
    blockedOffline: '연결되면 마감할 수 있습니다',
    blockedPending: (count: number) => `전송 대기 ${count}건을 보낸 뒤 마감할 수 있습니다`,
  },
  /** 스캔 취소 · 해제 뒤 알림 — 무엇을 취소했는지만(사용자 지시 2026-11-23, 번호 끝 · 합계를 걷음). */
  unregistered: {
    done: (itemCode: string, itemName: string) => `${itemCode} ${itemName} 등록 취소`,
  },
  closeDialog: {
    titleAll: '모든 품목을 마감할까요?',
    titleOne: (itemName: string) => `${itemName} 입하를 마감할까요?`,
    summaryAll: (items: number, lots: number) => `${items}품목 ${lots}개를 마감합니다.`,
    summaryOne: (count: number, total: string) => `${count}개 ${total}`,
    body: '마감하면 더 찍거나 뺄 수 없고, 검사가 필요한 품목은 IQC 요청이 생깁니다.',
    /** 검사 불필요 품목 — M-01-03 확인 창 문구를 빌린다(screens/M-01-01.md 「시안과 다른 점」). */
    bodyNoInspection: '마감하면 IQC는 「검사 생략」으로 남고, 더 찍거나 뺄 수 없습니다.',
    /** 검사 불필요이고 IQC 기본 생략 기준이 없는 품목 — IQC 기록이 생기지 않는다(G2 L15 · US2-7). */
    bodyNoIqcRecord: '마감하면 IQC 기록이 생기지 않고, 더 찍거나 뺄 수 없습니다.',
    cancel: '계속 찍기',
    confirm: '마감',
    toastOne: (itemCode: string, itemName: string) => `${itemCode} ${itemName} 마감`,
    toastAll: (items: number) => `${items}품목 마감`,
    failed: '마감하지 못했습니다. 다시 시도하세요.',
  },
  sheet: {
    title: '공급사 LOT 번호',
    label: '공급사 LOT 번호 (선택)',
    applyRest: (count: number) => `같은 번호를 이 품목의 나머지 자재 관리 LOT ${count}개에도`,
    applyRestNote: (count: number) => `다른 번호가 있는 ${count}개도 바뀝니다`,
    cancel: '취소',
    save: '저장',
    tooLong: '공급사 LOT 번호는 100자까지입니다',
    saved: (no: string, count: number) => `공급사 LOT ${no} 저장 (${count}개)`,
    cleared: (count: number) => `공급사 LOT 번호 삭제 (${count}개)`,
    failed: '저장하지 못했습니다. 다시 시도하세요.',
  },
  /** 다른 화면(품목 고르기 부품)이 함께 쓴다 — 지우지 않는다. */
  itemPicker: {
    title: '품목 고르기',
    searchLabel: '품목 검색',
    searchPlaceholder: '품목코드나 품목명을 적으세요',
    more: (rest: string) => `더보기 (+${rest})`,
    loading: '품목을 찾는 중입니다',
    empty: '찾은 품목이 없습니다',
    failed: '품목을 찾지 못했습니다. 연결을 확인하세요.',
    cancel: '고르지 않고 돌아가기',
    toTop: '맨 위로',
  },
} as const;
