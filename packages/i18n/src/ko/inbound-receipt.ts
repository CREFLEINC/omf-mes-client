/**
 * M-01-01 입하 등록(005 · omf-all-around#254) — 자재 관리 LOT 라벨을 스캔하면 **스캔마다 하나씩 바로 등록**하고,
 * 같은 화면의 입하 LOT 카드에서 해제 · 공급사 LOT 번호 · 입하 마감을 한다(screens/M-01-01.md).
 *
 * 작업자에게 P/O 는 보이지 않는다 — 마감 때 시스템이 매칭한다.
 */
export const inboundReceipt = {
  title: '입하 등록',
  scan: {
    label: '자재 관리 LOT 라벨',
    prompt: '자재 관리 LOT 라벨을 스캔하세요 — 스캔하면 바로 등록',
    results: '스캔 결과',
    manual: '직접 입력',
    manualSubmit: '입력한 번호로 등록',
  },
  /** 마지막 스캔 결과 줄(성공). */
  result: {
    registered: (lotTail: string) => `등록됨 · ${lotTail}`, // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    created: (inboundLotNo: string) => `새 입하 LOT ${inboundLotNo} 생성`,
    added: (inboundLotNo: string, count: number) => `${inboundLotNo} 에 추가 (${count}개째)`,
    supplierLabel: '공급사 라벨 — 자재 관리 LOT를 스캔하면서 만들었습니다',
  },
  /** 거부 줄 — 등록 없음, 쌓인다. */
  reject: {
    title: (reason: string, lotTail: string) => `${reason} — 등록 안 됨 · ${lotTail}`, // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    refused: '거부됨',
    voided: '폐기됨',
    voidedBody: '발행 뒤 폐기된 라벨입니다. 재발행 라벨을 스캔하세요',
    alreadyReceived: '이미 입하됨',
    alreadyReceivedIn: (inboundLotNo: string, receiving: boolean) =>
      `${inboundLotNo}(${receiving ? '입하 중' : '입하 완료'})에 이미 등록된 자재 관리 LOT입니다`,
    alreadyReceivedBody: '이미 입하에 등록된 자재 관리 LOT입니다',
    notMaterialLot: '자재 관리 LOT 아님',
    notMaterialLotBody:
      '자재 관리 LOT 라벨이 아닙니다(생산 LOT 등). 자재 관리 LOT 라벨을 스캔하세요',
    alreadyQueued: '이미 전송 대기',
    alreadyQueuedBody: '이미 전송 대기에 있는 라벨입니다',
    failed: '등록하지 못했습니다. 잠시 뒤 다시 스캔하세요.',
    closedTitle: (lotTail: string) => `입하 LOT 마감됨 — 저장 안 됨 · ${lotTail}`, // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    closedBody: (inboundLotNo: string) =>
      `${inboundLotNo} 은 이미 마감됐습니다(M-01-03 또는 날짜 자동 마감). 마감 뒤에는 공급사 LOT 번호를 고칠 수 없습니다`,
    dismiss: '닫기',
  },
  autoClosed: (inboundLotNo: string) =>
    `어제 입하 중이던 ${inboundLotNo} 은 날짜가 바뀌어 자동 마감됐습니다(IQC 요청 생김). 이 스캔은 새 입하 LOT로 들어갔습니다.`,
  offline: {
    scanned: '오프라인 — 등록되지 않았습니다. 전송 대기에 두고 연결되면 저절로 보냅니다',
    title: (count: number) => `전송 대기 ${count}`,
    sub: '연결되면 저절로 보냅니다',
    note: '아직 등록되지 않았습니다. 어느 입하 LOT에 들어갈지, 거부될지는 보낸 뒤에 정해집니다.',
    chip: '전송 대기',
    flushed: (count: number, registered: number, rejected: number) =>
      `연결됨 — 전송 대기 ${count}개를 보냈습니다 · 등록 ${registered} · 거부 ${rejected}`, // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    queueFailed: '전송 대기에 담지 못했습니다. 다시 스캔하세요.',
  },
  cards: {
    title: (count: number) => `이번에 받은 입하 LOT ${count}`,
    sub: '공급사·품목마다 한 장', // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    empty:
      '아직 등록한 자재 관리 LOT가 없습니다. 공급사·품목이 섞여도 이어서 스캔하세요 — 공급사·품목별 입하 LOT 카드로 나뉘어 들어갑니다.', // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    splitHint:
      '100상자를 입하 LOT 2개로 나누려면: 50개 스캔 → [입하 마감] → 나머지를 스캔하면 새 입하 LOT 카드가 생깁니다.',
    stayHint:
      '마감하지 않은 입하 LOT는 이 화면을 떠나도 「입하 중」으로 남습니다 — 이어서 스캔하면 거기에 들어가고, M-01-03 에서도 마감할 수 있습니다. 공장 날짜가 바뀌면 시스템이 자동 마감하고, 그 뒤 스캔은 새 입하 LOT로 들어갑니다.',
  },
  card: {
    statusNew: '새 입하 LOT · 입하 중', // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    statusReceiving: '입하 중',
    statusClosed: '마감됨 · IQC 요청됨', // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    statusClosedNoIqc: '마감됨',
    statusVoided: '입하 취소',
    pair: (supplier: string, itemCode: string, itemName: string) =>
      `${supplier} · ${itemCode} ${itemName}`, // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    summary: (count: number, total: string) => `자재 관리 LOT ${count}개 · ${total}`, // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    loading: '입하 LOT를 불러오는 중입니다',
    loadFailed: '입하 LOT를 불러오지 못했습니다',
    retry: '다시 불러오기',
    justNow: '방금 등록',
    thisVisit: '이번에 등록',
    earlier: (time: string) => `앞서 등록 ${time}`,
    package: (uomCode: string, count: number) => ` · ${uomCode} ${String(count)}`, // ui-check-ignore: C-13 설계 확정 표기 「1,000 EA · 봉지 10」(screens/M-01-01.md)
    supplierLabel: '공급사 라벨',
    qualityPending: '검사 대기 · 보류', // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    qualityNormal: '정상',
    supplierLot: (no: string) => `공급사 LOT ${no}`,
    noSupplierLot: '공급사 LOT 없음',
    editSupplierLot: (lotNo: string) => `${lotNo} 공급사 LOT 번호 고치기`,
    unregister: '해제',
    close: '입하 마감',
    closedNote: (iqcNo: string | null) =>
      iqcNo === null
        ? '구성이 고정됐습니다 — 같은 공급사·품목을 다시 스캔하면 새 입하 LOT 카드가 생깁니다.' // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
        : `IQC 요청 ${iqcNo}. 구성이 고정됐습니다 — 같은 공급사·품목을 다시 스캔하면 새 입하 LOT 카드가 생깁니다.`, // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    closedElsewhere: '다른 기기(M-01-03) 또는 날짜 자동 마감으로 이미 마감됐습니다. ',
    noInspection: '검사 불필요 — 자재 관리 LOT 정상',
    readOnlySupplierLot: '마감 뒤에는 공급사 LOT 번호를 고칠 수 없습니다(읽기 전용).',
    blockedOffline: '오프라인 — 마감·해제·공급사 LOT 입력은 연결된 뒤에 할 수 있습니다', // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    blockedPending: (count: number) =>
      `이 공급사·품목의 전송 대기 ${count}개가 보내진 뒤 마감할 수 있습니다`, // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
  },
  unregistered: {
    toast: (lotTail: string, inboundLotNo: string, total: string) =>
      `등록을 풀었습니다 — ${lotTail} 대기로 · ${inboundLotNo} 합계 ${total}`, // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    lastToast: (inboundLotNo: string) =>
      `마지막 자재 관리 LOT를 풀었습니다 — 입하 LOT ${inboundLotNo} 없어짐(입하 취소)`,
    failed: '등록을 풀지 못했습니다.',
  },
  closeDialog: {
    title: (inboundLotNo: string) => `${inboundLotNo} 를 마감할까요?`,
    summary: (supplier: string, item: string, count: number, total: string) =>
      `${supplier} · ${item} · 자재 관리 LOT ${count}개 · ${total}`, // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    body: '마감하면 IQC 요청이 생기고, 이 입하 LOT에는 더 받거나 해제할 수 없습니다. 같은 공급사·품목을 다시 스캔하면 새 입하 LOT가 생깁니다.', // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    /** 검사 불필요 품목 — M-01-03 확인 창 문구를 빌린다(screens/M-01-01.md 「시안과 다른 점」). */
    bodyNoInspection:
      '마감하면 검사 불필요 품목이라 IQC는 「검사 생략」으로 남고, 이 입하 LOT에는 더 받거나 해제할 수 없습니다. 같은 공급사·품목을 다시 스캔하면 새 입하 LOT가 생깁니다.', // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    /** 검사 불필요이고 IQC 기본 생략 기준이 없는 품목 — IQC 기록이 생기지 않는다(G2 L15 · US2-7). */
    bodyNoIqcRecord:
      '마감하면 검사 불필요 품목이라 IQC 기록이 생기지 않고, 이 입하 LOT에는 더 받거나 해제할 수 없습니다. 같은 공급사·품목을 다시 스캔하면 새 입하 LOT가 생깁니다.', // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    cancel: '취소',
    confirm: '마감',
    toast: (inboundLotNo: string, iqcNo: string | null) =>
      iqcNo === null
        ? `${inboundLotNo} 입하 마감 — 검사 불필요, 자재 관리 LOT 정상`
        : `${inboundLotNo} 입하 마감 — IQC 요청 ${iqcNo}. 같은 공급사·품목을 다시 스캔하면 새 입하 LOT가 생깁니다`, // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    failed: '마감하지 못했습니다. 입하 LOT를 다시 불러왔습니다.',
  },
  sheet: {
    title: '공급사 LOT 번호',
    status: (inboundLotNo: string) =>
      `${inboundLotNo} · 입하 중 — 입하 마감 전까지 넣거나 고칠 수 있습니다`, // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    label: '공급사 LOT 번호 (선택)',
    prefilled: '공급사 라벨에 찍혀 온 번호를 채웠습니다. 다르면 고치세요.',
    applyRest: (count: number) => `같은 번호를 이 카드의 나머지 자재 관리 LOT ${count}개에도`,
    applyRestNote: (count: number) => `다른 번호가 있는 ${count}개도 바뀝니다`,
    note: '자재 관리 LOT 여러 개가 같은 공급사 LOT를 가질 수 있습니다(N : 1). [저장]하면 바로 등록됩니다.',
    cancel: '취소',
    save: '저장',
    tooLong: '공급사 LOT 번호는 100자까지입니다',
    saved: (no: string, count: number) => `공급사 LOT ${no} 저장 — 자재 관리 LOT ${count}개`,
    cleared: (lotTail: string, rest: number) =>
      rest === 0
        ? `공급사 LOT 번호를 지웠습니다 — ${lotTail}`
        : `공급사 LOT 번호를 지웠습니다 — ${lotTail} 외 ${rest}개`,
    failed: '저장하지 못했습니다.',
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
