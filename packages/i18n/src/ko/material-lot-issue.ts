/**
 * W-01-14 자재 관리 LOT 발행(005 · omf-all-around#254 · screens/W-01-14.md). 「구매 / 자재 관리 › 입고 관리」 탭.
 * ⭐ 라벨은 여기서 찍지 않는다 — POP 「자재 관리 LOT 라벨」(P-01-01)에서만 출력한다.
 *
 * 화면 머리 안내 띠 · 표 아래 설명 · 칸 아래 계산 규칙 설명은 두지 않는다(사용자 지시 2026-11-18 「불필요한 지시문 제거」).
 * 만든 LOT 은 대기 상태라 재고가 늘지 않고, POP 목록에 대기로 떠 거기서 라벨을 출력하며, PDA 입하 스캔 때 입하 LOT 에
 * 들어간다 — 이 사정은 주석에만 남긴다.
 */
export const materialLotIssue = {
  title: '자재 관리 LOT 발행',
  /** 목록 · 상세 사이 막대(입고 관리 짜임). */
  splitter: '끌어서 목록과 상세 폭 조절',
  listCollapse: '공급사와 품목 목록 접기',
  listExpand: '공급사와 품목 목록 펼치기',
  filters: {
    label: '조회 조건',
    plant: '공장',
    supplier: '공급사',
    supplierAll: '전체',
    item: '품목',
    itemPlaceholder: '품목 코드·이름', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
    view: '보기',
    waitingOnly: '대기 있는 것만',
  },
  list: {
    label: '공급사·품목', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
    issue: '자재 관리 LOT 발행',
    columns: {
      supplier: '공급사',
      itemCode: '품목코드',
      item: '품목',
      baseUom: '기본 단위',
      defaults: '기본 정보',
      waiting: '대기',
      unprinted: '라벨 미출력',
      lastIssued: '최근 발행',
    },
    open: (supplier: string, item: string) => `${supplier} · ${item} 열기`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
    empty: '조건에 맞는 공급사·품목이 없습니다.', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
  },
  /** 기본 정보 칸. */
  defaults: {
    noPackage: (qty: string) => `패키징 없음 · ${qty}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
    missing: '기본 정보 없음',
    fromStorage: (unit: string) => `품목 기본 보관 단위 「${unit}」으로 채움`,
    manual: '직접 입력',
  },
  detail: {
    label: '공급사·품목 상세', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
    choose: '공급사와 품목을 고르세요',
    baseUom: '기본 단위',
    storageUom: '품목 기본 보관 단위',
    storageNone: '없음',
    defaults: '기본 정보',
    waitingTitle: '대기 자재 관리 LOT',
    waitingCount: (count: number) => `${count}개 · 아직 입하 스캔 안 됨`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
    void: (count: number) => (count > 0 ? `${count}개 폐기` : '폐기'),
    issue: '자재 관리 LOT 발행',
    columns: {
      lotNo: '자재 관리 LOT 번호',
      qty: '재고 수량',
      package: '패키징',
      supplierLot: '공급사 LOT',
      status: '상태',
      label: '라벨',
      createdBy: '만든 곳',
    },
    pick: (lotNo: string) => `${lotNo} 선택`,
    status: { WAITING: '대기', VOIDED: '폐기', ACTIVE: '입하됨' },
    printed: (count: number) => `${count}회`,
    unprinted: '미출력',
    channel: { POP: 'POP', WEB: '관리웹' },
    empty: '대기 자재 관리 LOT가 없습니다.',
  },
  /**
   * 미입고 P/O — 입하 마감이 채우는 차례 그대로(사용자 지시 2026-11-19). 자재 관리 LOT 는 발행할 때 P/O 와
   * 묶이지 않아, 납기만 보이면 「이 LOT 은 그 P/O 몫」으로 읽힌다 — 그래서 채우는 차례를 함께 말한다.
   */
  poLines: {
    title: '미입고 P/O',
    count: (count: number) => `${count}건`,
    fillOrder: '입하하면 위에서부터 채워짐',
    columns: {
      purchaseOrderNo: 'P/O 번호',
      lineNo: 'No.',
      orderDate: '발주일',
      dueDate: '납기',
      remainingQty: '남은 수량',
    },
    empty: '미입고 P/O가 없습니다.',
  },
  /** 발행 창 — POP 「자재 관리 LOT 만들기」와 같은 칸·규칙(US1-8). */
  dialog: {
    title: '자재 관리 LOT 발행',
    target: '공급사 · 품목', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
    targetPlaceholder: '공급사·품목을 고르세요', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
    targetOption: (supplier: string, itemCode: string, itemName: string, uom: string) =>
      `${supplier} · ${itemCode} ${itemName} (${uom})`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
    source: {
      item: '품목 기본값에서 가져옴',
      default: '기본 정보에서 가져옴',
      itemStorage: '공급사·품목 기본 정보 없음 — 품목 기본 보관 단위로 채움', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
      none: '기본 정보 없음 — 직접 입력',
    },
    defaultsFailed: '기본 정보를 불러오지 못했습니다. 직접 넣어 발행할 수 있습니다.',
    package: '패키징',
    packageOptional: '(선택)',
    packageOn: '패키징 넣기',
    packageOff: '패키징 없음',
    packageUom: '패키징 단위',
    packageCount: '패키징 수',
    qtyPerPackage: (uom: string) => `패키징당 수량 (${uom})`,
    lotQty: '자재 관리 LOT당 재고 수량',
    unitLocked: '품목 기본 단위로 고정',
    supplierLotNo: '공급사 LOT 번호 (선택)',
    lotCount: '개수',
    lotCountHelp: '1~200개',
    errors: {
      packageCount: '패키징 수는 1 이상 정수입니다',
      qtyPerPackage: '패키징당 수량은 0보다 커야 합니다',
      packageUom: '패키징 단위를 고르세요',
      lotQty: '재고 수량을 넣으세요(0보다 큰 수)',
      integer: (uom: string) => `${uom}는 정수로 넣습니다`,
      mismatch: (qty: string, pkg: string, product: string) =>
        `${qty} ≠ ${pkg} = ${product} — 맞춰야 발행할 수 있습니다`,
      lotCount: '개수는 1~200 사이 정수입니다',
    },
    product: (pkg: string, product: string) => `${pkg} = ${product}`,
    summary: (
      count: number,
      each: string,
      pkg: string | null,
      total: string,
      supplierLot: string | null,
    ) =>
      `자재 관리 LOT ${count}개 · 각 ${each}${pkg === null ? '' : ` (${pkg})`} · 합계 ${total}${
        // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
        supplierLot === null ? '' : ` · 공급사 LOT ${supplierLot}`
      }`,
    summaryTail: (pattern: string) => `번호 예: ${pattern} …`,
    summaryEmpty: '개수를 넣으면 발행될 자재 관리 LOT가 여기 보입니다.',
    cancel: '취소',
    submit: (count: number | null) => (count === null ? '발행' : `${count}개 발행`),
  },
  void: {
    title: (count: number) => `대기 자재 관리 LOT ${count}개를 폐기할까요?`,
    body: '폐기하면 PDA 입하 스캔에서 거부되고 번호는 다시 매기지 않습니다.',
    printed: (count: number) => `라벨이 출력된 ${count}개는 현장에서 라벨을 떼어 버려야 합니다.`,
    cancel: '취소',
    confirm: (count: number) => `${count}개 폐기`,
  },
  toast: {
    issued: (count: number) => `자재 관리 LOT ${count}개를 발행했습니다`,
    voided: (count: number) => `자재 관리 LOT ${count}개를 폐기했습니다`,
    voidedPartly: (count: number, failed: number) =>
      `자재 관리 LOT ${count}개 폐기 · 실패 ${failed}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
  },
  /**
   * 피처 014 — 서버 쪽 목록 · 찾기, 상세 탭 넷(미출력은 P/O 몫을 만들면서) · [수정](omf-all-around#349 · 시안 W0114).
   * 알림 문구는 명세 그대로(FR-005 · FR-012 · FR-013). 라벨은 여전히 여기서 찍지 않는다.
   */
  precreate: {
    retry: '다시 불러오기',
    loadFailed: '자재 관리 LOT 목록을 불러오지 못했습니다.',
    search: '찾기',
    searchPlaceholder: '공급사 또는 품목의 코드나 이름',
    columns: { unprinted: '미출력', creatable: '생성 예정' },
    defaultPackaged: (qty: string, pkg: string) => `${qty} · ${pkg}`, // ui-check-ignore: C-13 설계 확정 문구(specs 014 mockups/W0114-W0605)
    defaultUnpackaged: (qty: string) => `${qty} · 패키징 없음`, // ui-check-ignore: C-13 설계 확정 문구(specs 014 mockups/W0114-W0605)
    noDefault: '기본 단위 설정 없음',
    noConversion: '품목 단위 환산 없음',
    headDefault: (text: string) => `${text} (품목·BOM 정보)`, // ui-check-ignore: C-13 설계 확정 문구(specs 014 mockups/W0114-W0605)
    tabsLabel: '자재 관리 LOT 상태',
    tabs: {
      UNPRINTED: '미출력',
      PRINTED: '출력됨(입하 전)',
      RECEIVED: '입하된 LOT',
      VOIDED: '폐기 LOT',
    },
    loading: '자재 관리 LOT 을 조회하고 생성하고 있습니다',
    loadingOther: '자재 관리 LOT 을 조회하고 있습니다',
    notes: {
      NO_DEFAULT: '기본 단위 설정이 안되어있습니다. 직접 생성해 주세요.',
      noDefaultHint: '[자재 관리 LOT 발행]으로 만든 LOT 은 미출력 탭에 그대로 보입니다.',
      NO_OPEN_PO: '입하 예정 계획이 없습니다. 관리자에게 문의하세요',
      NO_CONVERSION: '품목 단위 환산이 없어 LOT 을 만들 수 없습니다. 관리자에게 문의하세요',
      conflict: '자재 관리 LOT 번호가 겹쳐 만들지 못했습니다. 다시 불러오세요.',
    },
    empty: {
      UNPRINTED: '미출력 자재 관리 LOT 이 없습니다.',
      PRINTED: '출력했지만 입하 전인 LOT 이 없습니다.',
      RECEIVED: '입하 마감 전인 입하된 LOT 이 없습니다.',
      VOIDED: '폐기한 LOT 이 없습니다.',
    },
    notCreatedYet: (count: number) => `아직 만들지 않은 ${count}건 포함`,
    columns2: {
      seq: '차례',
      po: 'P/O',
      mode: '만든 방식',
      label: '라벨',
      lastPrinted: '최근 출력',
      receivedAt: '입하 일시',
      voidedAt: '폐기 일시',
      action: '동작',
    },
    mode: { AUTO: '자동', MANUAL: '수동' },
    poLine: (purchaseOrderNo: string, lineNo: number) => `${purchaseOrderNo} · ${lineNo}`, // ui-check-ignore: C-13 설계 확정 문구(specs 014 mockups/W0114-W0605)
    revise: {
      action: '수정',
      actionName: (lotNo: string) => `${lotNo} 수정`,
      title: '자재 관리 LOT 수정',
      lotNo: '자재 관리 LOT 번호',
      po: 'P/O',
      qty: '자재 관리 LOT당 재고 수량',
      qtyFixed: '품목 기본 단위로 고정',
      package: '패키징',
      packageOn: '패키징 넣기',
      packageOff: '패키징 없음',
      packageUom: '패키징 단위',
      packageCount: '패키징 수',
      qtyPerPackage: (uom: string) => `패키징당 수량 (${uom})`,
      mismatch: (qty: string, calc: string) => `${qty} ≠ ${calc} — 맞춰야 저장할 수 있습니다`,
      invalid: '재고 수량과 패키징 칸을 확인하세요(0보다 큰 수, 패키징 수는 정수)',
      renumber: '수량이 바뀌면 LOT 번호를 새로 받습니다',
      cancel: '취소',
      save: '저장',
      saved: (lotNo: string) => `${lotNo} 로 고쳤습니다`,
      alreadyPrinted: '이미 출력한 LOT 이라 고칠 수 없습니다. 목록을 다시 불러왔습니다.',
      stateLocked: '입하됐거나 폐기한 LOT 이라 고칠 수 없습니다. 목록을 다시 불러왔습니다.',
      conflict: 'LOT 번호가 겹쳐 저장하지 못했습니다. 다시 저장하세요.',
      failed: '수정하지 못했습니다.',
    },
  },
  noPlant: '볼 수 있는 공장이 없습니다.',
  today: (day: string) => day,
} as const;
