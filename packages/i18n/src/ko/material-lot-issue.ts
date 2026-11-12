/**
 * W-01-14 자재 관리 LOT 발행(005 · omf-all-around#254 · screens/W-01-14.md). 「구매 / 자재 관리 › 입고 관리」 탭.
 * ⭐ 라벨은 여기서 찍지 않는다 — POP 「자재 관리 LOT 라벨」(P-01-01)에서만 출력한다.
 */
export const materialLotIssue = {
  title: '자재 관리 LOT 발행',
  banner:
    '자재 관리 LOT는 공급사·품목으로 미리 만듭니다. 라벨은 POP 「자재 관리 LOT 라벨」(P-01-01)에서만 출력하고, 여기서 만든 것도 POP 목록에 대기로 뜹니다. 입하 LOT는 PDA 입하(M-01-01) 스캔 때 저절로 생기므로 여기서 만들지 않습니다.', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
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
    count: (count: number) => `공급사·품목 ${count}건`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
    note: (plant: string, today: string) =>
      `${plant} · 오늘 ${today} · 행을 누르면 대기 자재 관리 LOT가 열립니다`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
    issue: '자재 관리 LOT 발행',
    columns: {
      supplier: '공급사',
      item: '품목',
      baseUom: '기본 단위',
      defaults: '기본 정보 (패키징 · 자재 관리 LOT당 재고 수량)', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
      waiting: '대기',
      unprinted: '라벨 미출력',
      lastIssued: '최근 발행',
    },
    open: (supplier: string, item: string) => `${supplier} · ${item} 열기`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
    empty: '조건에 맞는 공급사·품목이 없습니다.', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
    help: '대기 = 만들었지만 아직 PDA 입하 스캔이 안 된 자재 관리 LOT(재고 없음). 기본 정보는 기준정보 관리 「공급사·품목 기본 정보」에서 정합니다.', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
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
    empty:
      '대기 자재 관리 LOT가 없습니다. 「자재 관리 LOT 발행」으로 만들고 POP에서 라벨을 출력하세요.',
    help: '대기 자재 관리 LOT는 재고가 없고 출고·투입 스캔에서 거부됩니다. PDA에서 스캔하면 이 공급사·품목의 「입하 중」 입하 LOT에 들어가거나 새 입하 LOT가 생깁니다. 폐기하면 PDA 입하 스캔에서도 거부되며 번호는 다시 쓰지 않습니다.', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
    close: '닫기',
  },
  /** 발행 창 — POP 「자재 관리 LOT 만들기」와 같은 칸·규칙(US1-8). */
  dialog: {
    title: '자재 관리 LOT 발행',
    target: '공급사 · 품목', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
    targetPlaceholder: '공급사·품목을 고르세요', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
    targetOption: (supplier: string, itemCode: string, itemName: string, uom: string) =>
      `${supplier} · ${itemCode} ${itemName} (${uom})`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
    source: {
      default: '기본 정보에서 가져옴 — 바꿀 수 있습니다',
      itemStorage: '공급사·품목 기본 정보 없음 — 품목 기본 보관 단위로 채움, 수량은 직접 입력', // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
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
    packageNone: {
      default: '기본 정보가 「패키징 없음」입니다. 필요하면 넣을 수 있습니다.',
      itemStorage: '패키징 없이 만들면 기본 단위 수량만 남습니다(낱개가 섞인 상자 등).',
      none: '기본 정보도, 품목 기본 보관 단위도 없어 패키징 없이 시작합니다. 필요하면 넣을 수 있습니다.',
    },
    lotQty: '자재 관리 LOT당 재고 수량',
    lotQtyHelpPackage: (uom: string) =>
      `패키징 수 × 패키징당 수량으로 채워집니다. 직접 고치면 곱과 같아야 합니다. 단위는 품목 기본 단위(${uom}) 고정.`,
    lotQtyHelp: (uom: string) => `단위는 품목 기본 단위(${uom})로 정해져 있고 고르지 않습니다.`,
    unitLocked: '품목 기본 단위로 고정',
    supplierLotNo: '공급사 LOT 번호 (선택)',
    supplierLotHelp: '만드는 자재 관리 LOT 모두에 같은 값',
    lotCount: '개수',
    lotCountHelp: '한 번에 1~200개',
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
    summaryTail: (pattern: string) =>
      `번호 예: ${pattern} … · 대기 상태로 만들어지며 재고는 늘지 않습니다. 라벨은 POP에서 출력합니다.`,
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
    issued: (count: number) =>
      `자재 관리 LOT ${count}개를 대기 상태로 발행했습니다 — 라벨은 POP 「자재 관리 LOT 라벨」에서 출력하세요`,
    voided: (count: number) => `자재 관리 LOT ${count}개를 폐기했습니다`,
    voidedPartly: (count: number, failed: number) =>
      `자재 관리 LOT ${count}개 폐기 · 실패 ${failed}`, // ui-check-ignore: C-13 설계 확정 문구(screens/W-01-14.md · 시안 W0114-After)
  },
  noPlant: '볼 수 있는 공장이 없습니다.',
  today: (day: string) => day,
} as const;
