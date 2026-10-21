/**
 * W-01-03 입하 등록(옛 「초과 입하 분리」). **자재창고 도메인의 첫 쓰기**다 — 화면이 아니라 입하 예정 조회의
 * 오른쪽 창이다(사용자 지시 2026-10-21).
 *
 * 고른 발주의 라인마다 이번 도착 수량과 공급사 LOT 을 넣어 입하 전표 한 건으로 등록한다
 * (`POST /logistics/inbound-receipts:split` · `NORMAL_ONLY`).
 *
 * **줄 하나 · LOT 하나다**(서버 장부 P-100 · 사용자 결정 2026-10-21). 발주보다 많이 와도 줄을 가르지 않고,
 * 「P/O 반영」과 「초과분」 두 몫으로 나눠 보인다 — 초과분은 그 줄의 `excessQty` 로 실려 P/O 에 넣지 않고,
 * ERP 가 만든 추가 발주에 나중에 연결한다(「입하 예정 조회」의 초과분 연결).
 *
 * **두 몫은 화면이 만든 값이다.** 발주 + 초과 허용치 − 누적 입하까지가 P/O 반영, 그보다 많이
 * 도착한 몫이 초과분이다 — 요청 조립도 같은 계산을 받는다(`split-calc.ts`).
 *
 * **LOT 은 전표 줄마다 하나다**(계약 `InboundReceiptLineUpsert`). 서버가 LOT 번호 없는 줄을
 * 받지 않으므로(없으면 「라벨 없음」과 사유가 필수) 수량을 넣은 줄마다 LOT 칸이 선다.
 *
 * **참조 값(공급사·공장·품목·단위)의 표기가 네 갈래다** — 아직 오지 않음 · 목록에 없음 ·
 * 불러오기 실패 · 정상. 넷을 뭉개면 정상 값이 「알 수 없음」으로 보여 뜻이 반대로 읽힌다.
 */
export const overReceiptSplit = {
  title: '입하 등록',
  panes: {
    lines: '고른 발주의 라인',
    register: '등록 정보',
    result: '등록 결과',
  },
  fields: {
    /** 계약 필수. 영업일도 이 값의 날짜에서 나온다. */
    receiptDatetime: '입하 일시',
    deliveryNoteNo: '거래명세서번호',
    remarks: '비고',
  },
  actions: {
    /** 등록 단추는 **하나다**(사용자 지시 2026-10-21 — 절차를 몰라도 진행할 수 있게). 전표는 늘 한 건이다. */
    register: '입하 등록',
    /** 등록 확인 창의 두 단추. 「확인/취소」로 두면 무엇을 누르는지 창을 다시 읽어야 한다. */
    confirmRegister: '등록',
    backToEdit: '돌아가기',
    /** 초안 파기 확인 창의 확인 버튼. */
    discardDraft: '입력을 버린다',
    keepEditing: '계속 입력',
    /** 라인마다 잔량을 이번 도착 수량으로 넣는다 — 「전부 왔다」가 이 화면의 흔한 출발점이다. */
    fillRemaining: '잔량으로 채우기',
  },
  /** 실패 사유는 그 대상의 이름으로 시작한다(배치 규범 4). */
  reasons: {
    lineReferencesFailed:
      '공급사·품목·단위·공장 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
  },
  /**
   * 등록 버튼이 잠긴 사유(배치 규범 4). **버튼 이름으로 시작한다** — 다만 아직 아무 수량도
   * 넣지 않은 상태는 세 버튼이 함께 잠기므로 무엇에 대한 안내인지로 시작한다.
   */
  actionReasons: {
    noQty: '아직 넣은 도착 수량이 없습니다. 라인에 이번 도착 수량을 넣으면 등록할 수 있습니다.',
  },
  /**
   * 단계 안내 — 절차를 모르는 사람도 지금 무엇을 하면 되는지 읽는다(사용자 지시 2026-10-21).
   * 단계는 화면 상태에서 정한다(`guide.ts`). 단추를 숨기지는 않는다 — 안내일 뿐이다.
   */
  guide: {
    label: '진행 단계',
    steps: {
      select: '발주 선택',
      lines: '도착 수량 · LOT',
      info: '입하 정보',
      register: '등록',
    },
    hints: {
      select: '도착한 자재의 발주를 선택하세요.',
      lines: '라벨을 스캔하거나 「이번 도착」에 수량을 입력하세요.',
      info: '입하 일시를 확인하세요.',
      register: '「입하 등록」을 눌러 등록하세요.',
    },
  },
  loading: {
    lines: '발주 라인을 불러오는 중',
  },
  /**
   * 라인 표의 머리글과 칸 문구. 수량은 열마다 따로 선다 — 천 단위 구분이 있는 숫자가 한 칸에
   * 둘 있으면 어느 수가 어느 것인지 눈으로 가르기 어렵다.
   */
  lineTable: {
    lineNo: 'No.',
    itemCode: '품목코드',
    itemName: '품목명',
    ordered: '발주',
    received: '기입하',
    /** 「5,000 (+0)」 — 괄호 안이 초과 허용치다. */
    remaining: '잔량 (+허용)',
    arrivedQty: '이번 도착',
    uom: '단위',
    /** 이번 도착 중 P/O 라인에 넣는 몫. */
    normal: 'P/O 반영',
    /** P/O 에 넣지 않고 추가 P/O 를 기다리는 몫(`excessQty`). */
    excess: '초과분',
    /** 「60 (+5)」 */
    remainingPair: (remainingQty: string, toleranceOverQty: string): string =>
      `${remainingQty} (+${toleranceOverQty})`,
    /*
     * 표 안의 입력칸이라 보이는 라벨을 둘 자리가 없다(배치 규범 3의 이탈 조건).
     * **줄번호를 접근 이름에 넣는다** — 같은 이름이 줄마다 되풀이되면 어느 줄인지 알 수 없다.
     */
    arrivedQtyLabel: (lineNo: number): string => `${String(lineNo)}번 줄 이번 도착 수량`,
    /** 수입검사 대상 품목의 표식. 서버가 품목 기준정보로 정한다 — 화면이 보내는 값이 아니다. */
    iqc: 'IQC',
    iqcTitle: '수입검사 대상 품목입니다. 등록하면 검사 의뢰가 함께 만들어집니다.',
    /** LOT 줄의 머리. 줄 하나에 LOT 하나다 — 초과분도 같은 LOT 이다. */
    lotHead: '공급사 LOT',
    lotNoLabel: (lineNo: number): string => `${String(lineNo)}번 줄 공급사 LOT 번호`,
    lotMissingLabel: (lineNo: number): string => `${String(lineNo)}번 줄 라벨 없음`,
    lotReasonLabel: (lineNo: number): string => `${String(lineNo)}번 줄 대체 LOT 사유`,
    lotNoPlaceholder: '라벨을 스캔하거나 LOT 번호 입력',
    lotMissing: '라벨 없음',
    lotReasonPlaceholder: '사유 선택',
  },
  /** 라벨 스캔 칸 — 라벨의 품목코드로 줄을 찾아 수량과 LOT 을 채운다. */
  scan: {
    label: '라벨 스캔',
    placeholder: '공급사 LOT 라벨을 스캔하세요',
    /** 「3번 줄에 담았습니다 — 수량 5,000」 */
    added: (lineNo: number, qty: string): string =>
      `${String(lineNo)}번 줄에 담았습니다 — 수량 ${qty}`,
    notFound: (itemCode: string): string => `「${itemCode}」 품목은 이 발주에 없습니다.`,
    invalid: '라벨 형식이 아닙니다. 품목코드·수량·날짜·공급사·번호 다섯 칸이어야 합니다.',
    itemsPending: '품목 정보를 아직 불러오지 못했습니다. 잠시 뒤 다시 스캔하세요.',
    /** 줄 하나에 라벨 하나다 — 같은 품목의 빈 줄이 없으면 담지 않는다. */
    lotFilled: (lineNo: number): string =>
      `${String(lineNo)}번 줄은 LOT 이 이미 들어 있습니다. 라벨을 바꾸려면 칸을 비운 뒤 다시 스캔하세요.`,
  },
  /** 고른 발주의 제목줄. **목록 표에 두지 않은 값(공장)이 여기서 보인다.** */
  summary: {
    label: '고른 발주',
    purchaseOrderNo: '발주번호',
    supplier: '공급사',
    plant: '공장',
    orderDate: '발주일',
    expectedReceiptDate: '입고 예정일',
  },
  /** 등록 단추 위의 요약 — 누르기 전에 무엇이 만들어지는지 읽힌다. */
  totals: {
    label: '만들어질 전표',
    receipt: (lines: number): string => `입하 전표 1건 (${String(lines)}줄)`,
    excess: (lines: number): string => `그중 초과분이 있는 줄 ${String(lines)}개`,
    none: '아직 넣은 도착 수량이 없습니다',
  },
  /** 입력 구획의 제목과 보조 표식. */
  form: {
    linesTitle: '도착 수량과 LOT',
    headerTitle: '입하 정보',
    optional: '(선택)',
  },
  filters: {
    lookupTruncated: '선택지가 앞쪽 일부만 보입니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
    lookupFailed: '선택지를 불러오지 못했습니다.',
  },
  empty: {
    noLinesTitle: '이 발주에는 라인이 없습니다',
    noLinesDescription: '발주에 담긴 품목 줄이 하나도 없어 받을 것을 정할 수 없습니다.',
  },
  values: {
    empty: '—',
    unknown: '알 수 없음',
    referenceLoading: '이름 불러오는 중',
    referenceFailed: '이름을 불러오지 못했습니다',
    /** 수량을 넣지 않았거나 넣은 값이 수량이 아니어서 아직 가를 것이 없다. */
    notSplit: '—',
    /** 전표 진행 상태(`LOGISTICS_DOCUMENT_STATUS`). 모르는 코드는 그대로 낸다. */
    docStatus: {
      REGISTERED: '등록',
      POSTED: '전기완료',
      CANCEL_REQUESTED: '취소요청',
      CANCELLED: '취소완료',
    } as Record<string, string> & {
      REGISTERED: string;
      POSTED: string;
      CANCEL_REQUESTED: string;
      CANCELLED: string;
    },
  },
  errors: {
    qtyNotNumber: '수량은 숫자로 넣으세요.',
    qtyNotPositive: '수량은 0보다 커야 합니다.',
    receiptDatetimeRequired: '입하 일시를 넣으세요.',
    deliveryNoteNoTooLong: (max: number): string =>
      `거래명세서번호는 ${String(max)}자를 넘을 수 없습니다.`,
    /**
     * 이미 다 받은 줄(발주 + 허용치 − 누적 입하 = 0)에 수량을 넣었다 — 전부 초과분인 줄은 서버가 받지 않는다
     * (`excessQty` 는 `receivedQty` 보다 작아야 한다). 추가 발주가 오면 그 발주로 받는다.
     */
    qtyNoRoom: '발주 수량을 모두 받은 줄입니다. 추가 발주로 받으세요.',
    /** LOT — 서버가 LOT 번호 없는 줄을 받지 않는다. 번호가 없으면 「라벨 없음」과 사유가 선다. */
    lotRequired: 'LOT 번호를 넣거나 「라벨 없음」을 고르세요.',
    lotReasonRequired: '라벨이 없으면 대체 LOT 사유를 고르세요.',
    lotFormat:
      '라벨 형식이 아닙니다. 번호를 받아 적은 것이면 「라벨 없음」을 켜고 번호를 넣으세요.',
    lotItemMismatch: (itemCode: string): string =>
      `라벨의 품목코드가 이 줄의 품목(${itemCode})과 다릅니다.`,
    /*
     * 사유가 붙은 줄을 그대로 두고 등록하면 **그 줄만 빠진 전표**가 만들어진다.
     * 되돌릴 수 없는 쓰기라 빠뜨린 줄을 나중에 알아채면 고칠 방법이 없다.
     */
    lineInvalidBlocked: (lineNos: string): string =>
      `${lineNos}번 줄에 고칠 것이 있어 등록하지 않았습니다. 사유가 붙은 수량·LOT 칸을 고친 뒤 다시 등록하세요.`,
  },
  /** 막지는 않지만 한 번 더 보게 하는 안내. */
  warnings: {
    /** 자릿수 실수를 잡는다 — 발주의 몇 배가 한 번에 오는 일은 드물다. */
    qtyFarOverOrdered: (times: string): string =>
      `발주 수량의 ${times}배입니다. 자릿수를 확인하세요.`,
  },
  notes: {
    headerShared: '영업일은 입하 일시의 날짜입니다.',
    registerRecheck:
      '등록됐는지 확인한 뒤 다시 시도하세요. 확인하지 않고 다시 보내면 같은 입하가 두 번 등록될 수 있습니다.',
  },
  /** 등록 결과. **전표 번호는 사용자 대면 업무 번호라 낸다.** 사라지는 알림으로 내지 않는다. */
  result: {
    count: (count: number): string => `전표 ${String(count)}건을 만들었습니다.`,
    receiptNo: '전표번호',
    status: '상태',
    /** 초과분을 실었으면 그 몫과 연결할 자리. */
    excessLine: (lineNo: number, qty: string): string => `${String(lineNo)}번 줄 ${qty}`,
    excessWaiting: (lines: string): string => `미연결 초과분: ${lines}`,
    goLinkExcess: '초과분 발주 연결',
  },
  dialog: {
    discardTitle: '입력한 도착 수량을 버립니다',
    /** 등록 확인 — 되돌릴 수 없는 쓰기라 보내기 전에 무엇이 나가는지 한 번 더 보인다. */
    registerTitle: '입하를 등록합니다',
    registerLead: (lines: number, excessLines: number): string =>
      excessLines === 0
        ? `입하 전표 1건에 ${String(lines)}줄을 등록합니다.`
        : `입하 전표 1건에 ${String(lines)}줄을 등록합니다. 그중 ${String(excessLines)}줄에 초과분이 있습니다.`,
    registerGroupLines: '실리는 줄',
    registerGroupHeader: '입하 정보',
    registerIrreversible: '등록한 전표는 이 화면에서 되돌릴 수 없습니다. 취소는 승인을 거칩니다.',
    registerEffects:
      '발주 라인의 누적 입하가 늘고, 수입검사 대상 품목은 검사 의뢰가 함께 만들어집니다.',
    /** 「P/O 반영 4,500 · 초과분 500」 */
    excessOf: (normalQty: string, excessQty: string): string =>
      `P/O 반영 ${normalQty} · 초과분 ${excessQty}`,
    lotOf: (lotNo: string): string => `LOT ${lotNo}`,
    lotMissingOf: (reason: string): string => `라벨 없음 (${reason})`,
  },
} as const;
