/**
 * M-01-01 입하 등록(005 · omf-all-around#254) — 자재 관리 LOT 라벨을 스캔하면 **스캔마다 하나씩 바로 등록**하고,
 * 같은 화면의 입하 LOT 카드에서 해제 · 공급사 LOT 번호 · 입하 마감을 한다(screens/M-01-01.md).
 *
 * 작업자에게 P/O 는 보이지 않는다 — 마감 때 시스템이 매칭한다.
 *
 * 화면에 원리 · 요령 설명 문단을 두지 않는다(사용자 지시 2026-11-18 「불필요한 지시문 제거」). 마감하지 않은 입하 LOT 은
 * 화면을 떠나도 「입하 중」으로 남고, 공장 날짜가 바뀌면 시스템이 자동 마감한다 — 이 사정은 여기 주석에만 남긴다.
 */
export const inboundReceipt = {
  title: '입하 등록',
  scan: {
    label: '자재 관리 LOT 라벨',
    /** 화면에는 보이지 않는다 — 스캔 칸의 설명(화면 낭독기). */
    prompt: '자재 관리 LOT 라벨을 스캔하세요',
    results: '스캔 결과',
    /** 결과 · 알림 줄 오른쪽 ✕ — 그 줄을 지운다(사용자 지시 2026-11-18). */
    dismiss: '알림 지우기',
    manual: '직접 입력',
    manualSubmit: '입력한 번호로 등록',
  },
  /** 마지막 스캔 결과 줄(성공) — 결과 줄은 늘 하나다(다음 스캔이 덮는다). */
  result: {
    registered: (lotTail: string) => `등록됨 · ${lotTail}`, // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    created: (inboundLotNo: string) => `새 입하 LOT ${inboundLotNo} 생성`,
    added: (inboundLotNo: string, count: number) => `${inboundLotNo} 에 추가 (${count}개째)`,
    /** 이 스캔 때 지난 날짜의 「입하 중」이 자동 마감됐다. */
    autoClosed: (inboundLotNo: string) => `${inboundLotNo} 날짜 바뀜 자동 마감`,
  },
  /** 거부 줄 — 등록 없음. 결과 줄 하나를 덮는다(쌓지 않는다). */
  reject: {
    title: (reason: string, lotTail: string) => `${reason} — 등록 안 됨 · ${lotTail}`, // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    refused: '거부됨',
    voided: '폐기됨',
    alreadyReceived: '이미 입하됨',
    /** 어느 입하 LOT 에 들어가 있는지 — 서버가 알려 줄 때만. */
    alreadyReceivedIn: (inboundLotNo: string, receiving: boolean) =>
      `${inboundLotNo} (${receiving ? '입하 중' : '입하 완료'})`,
    notMaterialLot: '자재 관리 LOT 아님',
    alreadyQueued: '이미 전송 대기',
    failed: '등록하지 못했습니다. 잠시 뒤 다시 스캔하세요.',
    closedTitle: (lotTail: string) => `입하 LOT 마감됨 — 저장 안 됨 · ${lotTail}`, // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    closedBody: (inboundLotNo: string) => `${inboundLotNo} 은 이미 마감됐습니다`,
  },
  offline: {
    scanned: '오프라인 — 전송 대기에 담았습니다',
    title: (count: number) => `전송 대기 ${count}`,
    flushed: (count: number, registered: number, rejected: number) =>
      `전송 대기 ${count}개를 보냈습니다 · 등록 ${registered} · 거부 ${rejected}`, // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    queueFailed: '전송 대기에 담지 못했습니다. 다시 스캔하세요.',
  },
  cards: {
    /**
     * 이 화면에서 스캔해 만들거나 더한 입하 LOT 카드 — 화면을 떠나면 비워진다. 제목 오른쪽에 건수를 다른 색 배지로 따로
     * 둔다(사용자 지시 2026-11-18 「등록된 입하 LOT 목록」).
     */
    title: '등록된 입하 LOT 목록',
    count: (count: number) => `${count}건`,
    empty: '아직 등록한 자재 관리 LOT가 없습니다',
  },
  card: {
    statusNew: '새 입하 LOT · 입하 중', // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    statusReceiving: '입하 중',
    statusClosed: '마감됨 · IQC 요청됨', // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    statusClosedNoIqc: '마감됨',
    statusVoided: '입하 취소',
    /** 카드 머리 아래 이름표 붙은 칸 — 공급사 · 품목 · LOT 수 · 전체 수량 · 품질(사용자 지시 2026-11-18 「명시적인 타이틀」). */
    facts: {
      supplier: '공급사',
      item: '품목',
      lotCount: 'LOT 수',
      totalQty: '전체 수량',
    },
    /** 카드 머리 단추 — 입하 LOT 마다 자재 관리 LOT 표를 접고 편다. */
    expand: (inboundLotNo: string) => `${inboundLotNo} 펼치기`,
    collapse: (inboundLotNo: string) => `${inboundLotNo} 접기`,
    lotCount: (count: number) => `${count}개`,
    loading: '입하 LOT를 불러오는 중입니다',
    loadFailed: '입하 LOT를 불러오지 못했습니다',
    retry: '다시 불러오기',
    /** 카드 아래 자재 관리 LOT 표 — 행은 한 줄(번호 · 수량 · 등록 시각 · 공급사 LOT · ✕). 번호는 보통 끝 일련번호. */
    lotsLabel: '자재 관리 LOT 목록',
    columns: { no: '번호', qty: '수량', registered: '등록', supplierLot: '공급사 LOT' },
    /** 등록 칸 — 마지막 스캔은 「방금」, 나머지는 등록 시각. */
    justNow: '방금',
    package: (uomCode: string, count: number) => ` · ${uomCode} ${String(count)}`, // ui-check-ignore: C-13 설계 확정 표기 「1,000 EA · 봉지 10」(screens/M-01-01.md)
    supplierLabel: '공급사 라벨',
    noSupplierLot: '없음',
    editSupplierLot: (lotNo: string) => `${lotNo} 공급사 LOT 번호 고치기`,
    unregister: '해제',
    close: '입하 마감',
    /** 마감된 카드 — 생긴 IQC 요청 번호만 적는다. */
    iqcRequest: (iqcNo: string) => `IQC 요청 ${iqcNo}`,
    /** [입하 마감]이 막힌 까닭(잠금 사유는 남긴다). */
    blockedOffline: '오프라인 — 연결된 뒤에 할 수 있습니다',
    blockedPending: (count: number) => `전송 대기 ${count}개를 보낸 뒤 마감할 수 있습니다`,
  },
  unregistered: {
    toast: (lotTail: string, inboundLotNo: string, total: string) =>
      `등록 해제 — ${lotTail} · ${inboundLotNo} 합계 ${total}`, // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    lastToast: (inboundLotNo: string) => `${inboundLotNo} 입하 취소 — 마지막 자재 관리 LOT 해제`,
    failed: '등록을 해제하지 못했습니다.',
  },
  closeDialog: {
    title: (inboundLotNo: string) => `${inboundLotNo} 를 마감할까요?`,
    summary: (supplier: string, item: string, count: number, total: string) =>
      `${supplier} · ${item} · 자재 관리 LOT ${count}개 · ${total}`, // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    body: '마감하면 IQC 요청이 생기고, 더 받거나 해제할 수 없습니다.',
    /** 검사 불필요 품목 — M-01-03 확인 창 문구를 빌린다(screens/M-01-01.md 「시안과 다른 점」). */
    bodyNoInspection: '마감하면 IQC는 「검사 생략」으로 남고, 더 받거나 해제할 수 없습니다.',
    /** 검사 불필요이고 IQC 기본 생략 기준이 없는 품목 — IQC 기록이 생기지 않는다(G2 L15 · US2-7). */
    bodyNoIqcRecord: '마감하면 IQC 기록이 생기지 않고, 더 받거나 해제할 수 없습니다.',
    cancel: '취소',
    confirm: '마감',
    toast: (inboundLotNo: string, iqcNo: string | null) =>
      iqcNo === null
        ? `${inboundLotNo} 입하 마감`
        : `${inboundLotNo} 입하 마감 — IQC 요청 ${iqcNo}`,
    failed: '마감하지 못했습니다. 입하 LOT를 다시 불러왔습니다.',
  },
  sheet: {
    title: '공급사 LOT 번호',
    status: (inboundLotNo: string) => `${inboundLotNo} · 입하 중`, // ui-check-ignore: C-13 설계 확정 문구(screens/M-01-01.md)
    label: '공급사 LOT 번호 (선택)',
    applyRest: (count: number) => `같은 번호를 이 카드의 나머지 자재 관리 LOT ${count}개에도`,
    applyRestNote: (count: number) => `다른 번호가 있는 ${count}개도 바뀝니다`,
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
