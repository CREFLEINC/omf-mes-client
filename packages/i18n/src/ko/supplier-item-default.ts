/**
 * W-06-25 공급사·품목 기본 정보(005 · omf-all-around#254 · screens/W-06-25.md).
 * 조사가 붙는 자리(`…WithTopic`)는 화면이 `patterns/josa` 로 붙여 넘긴다(C-5).
 */
export const supplierItemDefault = {
  title: '공급사·품목 기본 정보', // ui-check-ignore: C-13 설계 확정 화면 이름·용어 「공급사·품목」(screens/W-06-25.md)
  breadcrumbRoot: '기준정보 관리',
  intro:
    '자재 관리 LOT를 발행할 때(POP P-01-01, 관리웹 W-01-14) 패키징과 자재 관리 LOT당 재고 수량을 이 값으로 미리 채웁니다. 발행 화면에서 바꿀 수 있습니다. 여기에 없는 공급사와 품목은 품목 기본 보관 단위로 채우고, 그것도 없으면 직접 넣습니다.',
  filters: {
    label: '조건',
    plant: '공장',
    supplier: '공급사',
    supplierPlaceholder: '공급사 이름 또는 코드',
    item: '품목',
    itemPlaceholder: '품목 코드 또는 이름',
    reset: '초기화',
  },
  count: (count: number) => `공급사·품목 ${count}건`, // ui-check-ignore: C-13 설계 확정 화면 이름·용어 「공급사·품목」(screens/W-06-25.md)
  /** 목록 머리 오른쪽 — 지금 공장(명세 가정 「공장마다 따로 둔다」). */
  plantNote: (plantName: string) => `공장: ${plantName}`,
  add: '추가',
  tableLabel: '공급사·품목 기본 정보 목록', // ui-check-ignore: C-13 설계 확정 화면 이름·용어 「공급사·품목」(screens/W-06-25.md)
  columns: {
    supplier: '공급사',
    item: '품목',
    baseUom: '기본 단위',
    packageUom: '패키징 단위',
    qtyPerPackage: '패키징 수량 (기본 단위)',
    lotQty: '자재 관리 LOT당 재고 수량',
    preview: '라벨 미리 보기',
    updated: '바꾼 때',
    actions: '관리',
  },
  values: {
    noPackage: '없음',
    none: '—',
    updated: (at: string, by: string | null) => (by === null ? at : `${at}, ${by}`),
  },
  edit: '수정',
  delete: '삭제',
  editRow: (supplier: string, item: string) => `${supplier} ${item} 수정`,
  deleteRow: (supplier: string, item: string) => `${supplier} ${item} 삭제`,
  empty: '찾는 공급사·품목이 없습니다. 「추가」로 만드세요.', // ui-check-ignore: C-13 설계 확정 화면 이름·용어 「공급사·품목」(screens/W-06-25.md)
  help: '패키징 수량 = 패키징 1개에 든 기본 단위 수량. 자재 관리 LOT당 재고 수량은 패키징 수량의 정수배여야 합니다(예: 봉지 100 EA × 10 = 1,000 EA).',
  noPlant: '데이터 범위 안에 공장이 없습니다.',
  dialog: {
    addTitle: '공급사·품목 기본 정보 추가', // ui-check-ignore: C-13 설계 확정 화면 이름·용어 「공급사·품목」(screens/W-06-25.md)
    editTitle: '기본 정보 수정',
    supplier: '공급사',
    item: '품목',
    pick: '고르세요',
    baseUom: '기본 단위',
    storage: (uomCode: string, qty: string, baseUomCode: string) =>
      `품목 기본 보관 단위: ${uomCode} ${qty} ${baseUomCode}`,
    storageUnitOnly: (uomCode: string) => `품목 기본 보관 단위: ${uomCode}`,
    storageNone: '품목 기본 보관 단위 없음',
    packageUom: '패키징 단위',
    noPackage: '없음',
    qtyPerPackage: '패키징 수량',
    qtyPerPackageHelp: (baseUomCode: string) =>
      baseUomCode === ''
        ? '패키징 1개에 든 기본 단위 수량'
        : `패키징 1개에 든 기본 단위(${baseUomCode}) 수량`,
    lotQty: '자재 관리 LOT당 재고 수량',
    /** 재고 수량 옆 — 「= 봉지 10개」. */
    countOf: (uomCode: string, count: string) => `= ${uomCode} ${count}개`,
    remarks: '비고 (선택)',
    footHint: '발행 화면에서는 「기본 정보에서 가져옴」으로 표시되고 바꿀 수 있습니다.',
    /** 수정 창 — 고쳐도 이미 만든 LOT 는 그대로다(US1-9). */
    unchanged: '이미 만든 자재 관리 LOT는 바뀌지 않습니다',
    /** 삭제 확인 창의 대상 줄. */
    deleteTarget: (supplier: string, itemCode: string, itemName: string) =>
      `${supplier}, ${itemCode} ${itemName}`,
    cancel: '취소',
    save: '저장',
    close: '닫기',
  },
  errors: {
    pick: '공급사와 품목을 고르세요',
    duplicate: (supplier: string, _item: string, itemWithTopic: string) =>
      `${supplier}, ${itemWithTopic} 이미 있습니다 — 목록에서 수정하세요`,
    duplicateServer: '같은 공급사와 품목의 기본 정보가 이미 있습니다 — 목록에서 수정하세요',
    qtyPerPackage: '패키징 수량은 0보다 커야 합니다',
    lotQty: '자재 관리 LOT당 재고 수량을 넣으세요(0보다 큰 수)',
    integer: (_uomCode: string, uomWithTopic: string) => `${uomWithTopic} 정수로 넣습니다`,
    multiple: (_lotQty: string, lotQtyWithTopic: string, qtyPerPackage: string) =>
      `자재 관리 LOT당 재고 수량 ${lotQtyWithTopic} 패키징 수량 ${qtyPerPackage}의 정수배여야 합니다`,
    invalid: '재고 수량이 패키징 곱과 맞지 않습니다',
    conflict: '다른 사람이 먼저 고쳤습니다',
    reload: '다시 불러오기',
  },
  deleteDialog: {
    title: '기본 정보를 지울까요?',
    body: '이미 발행한 자재 관리 LOT는 바뀌지 않습니다. 지운 뒤 발행할 때는 품목 기본 보관 단위로 채우거나 직접 넣습니다.',
    cancel: '취소',
    confirm: '지우기',
  },
  toast: {
    saved: (supplier: string, item: string) => `${supplier} · ${item} 기본 정보를 저장했습니다`, // ui-check-ignore: C-13 설계 확정 저장 알림(screens/W-06-25.md · G2 L18)
    deleted: '지웠습니다',
  },
} as const;
