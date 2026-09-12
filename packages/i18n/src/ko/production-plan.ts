/**
 * W-04-03 W/O 전개·편성.
 *
 * 받은 생산 P/O 하나를 골라 ① 쓸 BOM·Routing 개정을 점검하고 ② 생산계획 줄을 채운 뒤
 * ③ 계획을 확정해 공정별 W/O 로 전개한다. 세 단계가 위에서 아래로 한 화면에 서므로 문구도
 * 「지금 어느 단계인가」와 「무엇이 막혔는가」를 말한다.
 *
 * ⚠ **확정은 되돌릴 수 없다.** 확정 뒤에는 수정도 삭제도 없다 — 그 사실을 확정 앞에서 미리
 * 말하는 문구가 `confirmDialog` 다.
 */
export const productionPlan = {
  title: 'W/O 전개·편성',
  breadcrumbRoot: '생산',
  breadcrumbGroup: '계획·지시',

  /** 고른 P/O 를 되짚어 주는 머리말. 어느 P/O 를 편성하는 중인지 화면을 떠나지 않고 확인한다. */
  order: {
    pane: '선택 생산 P/O',
    heading: '선택 생산 P/O',
    due: (dueDate: string): string => ` · 납기 ${dueDate}`,
  },

  /**
   * ① 마스터 점검. 계획을 적기 전에 **쓸 개정이 실제로 있는지**부터 본다.
   *
   * ⚠ 없는 것과 못 받은 것을 가른다 — 「불러오지 못했습니다」와 「없어 전개할 수 없습니다」는
   * 사용자가 갈 곳이 다르다(다시 시도 · 기준정보 등록).
   */
  masterCheck: {
    pane: '마스터 점검',
    heading: '마스터 점검',
    bomCard: 'BOM (ERP 정본)',
    routingCard: 'Routing (MES 정본)',
    selected: '선택됨',
    revisionLabel: (kind: string): string => `${kind} Rev`,
    revisionPlaceholder: '사용할 개정을 선택하세요',
    effectivePeriod: (period: string): string => `유효기간 ${period}`,
    periodFrom: '시작일 미확인',
    periodTo: '종료일 없음',
    loadFailed: (kind: string): string => `${kind} 개정을 불러오지 못했습니다.`,
    retry: (kind: string): string => `${kind} 다시 시도`,
    bomMissing: 'BOM이 없어 전개할 수 없습니다.',
    routingMissing: 'Routing이 없어 전개할 수 없습니다.',
    openRouting: 'Routing 등록으로 이동',
    bomAutoSelected: '기본 BOM Rev를 자동으로 선택했습니다.',
    bomAmbiguous: '기본 BOM Rev를 하나로 판단할 수 없습니다.',
    routingNoDefault: 'Routing 기본 Rev 플래그가 없습니다. 사용할 개정을 직접 선택하세요.',
  },

  /** 생산라인은 P/O 의 공장에 딸린다. 공장이 없으면 고를 것도 없으므로 그 사실을 미리 말한다. */
  lines: {
    loading: '생산라인을 불러오는 중',
    loadFailed: '생산라인을 불러오지 못했습니다.',
    retry: '생산라인 다시 시도',
    plantMissing: 'P/O에 공장이 없어 생산라인은 미지정으로 저장합니다.',
    parentUnknown: '상위 라인',
    inactiveSuffix: ' · 비활성',
  },

  /** ② 생산계획 편집. 줄 하나가 계획 하나이고, 줄마다 따로 저장한다. */
  editor: {
    pane: '생산계획 편집',
    heading: '생산계획',
    add: '+ 계획 추가',
    tableCaption: 'P/O 생산계획 편집 표',
    empty: '등록된 계획이 없습니다.',
    loading: '생산계획을 불러오는 중',
    loadFailed: '생산계획을 불러오지 못했습니다.',
    staleTitle: '최신 생산계획을 확인하지 못했습니다.',
    staleDescription: '현재 편집 내용은 유지됩니다. 다시 조회한 뒤 신규 계획을 추가하세요.',
    retry: '다시 시도',
    newRow: (displayNo: number): string => `신규 계획 ${String(displayNo)}`,
    newStatus: '신규',
    columns: {
      planNo: '계획번호',
      planDate: '계획일',
      plannedQty: '수량',
      bomId: 'BOM Rev',
      routingId: 'Routing Rev',
      plannedLineId: '라인',
      status: '상태',
      remarks: '비고',
      actions: '작업',
    },
    /** 줄 이름을 앞에 두어, 표가 좁아져 열 머리가 끊겨도 어느 줄의 무엇인지 남는다. */
    fieldLabel: (rowName: string, field: string): string => `${rowName} ${field}`,
    quantityField: '계획수량',
    lineUnset: '미지정',
    selectPlaceholder: '선택',
    confirmedLock: '확정된 계획은 수정할 수 없습니다.',
    confirmedChip: '확정 · 편집 불가',
    savingChip: '저장 중',
    remove: '삭제',
    totalLabel: '합계',
    totalUnknown: '합계 계산 불가',
    total: (planned: string, ordered: string, uomLabel: string): string =>
      `${planned} / ${ordered} ${uomLabel}`,
  },

  /**
   * 계획 수량 합계와 P/O 수량의 관계. **네 갈래가 서로 다른 일을 하라고 말한다** —
   * 고치라(오류) · 더하라(없음) · 정책을 보라(초과) · 계속하라(부족) · 됐다(일치).
   */
  quantitySummary: {
    invalid: '계획 수량 오류를 먼저 수정하세요.',
    empty: '계획을 1건 이상 추가해야 전개할 수 있습니다.',
    over: (amount: string, uomLabel: string): string =>
      `P/O 수량보다 ${amount} ${uomLabel} 초과합니다.`,
    overDescription: '초과 생산 정책을 확인하세요.',
    under: (amount: string, uomLabel: string): string =>
      `P/O 수량보다 ${amount} ${uomLabel} 부족합니다.`,
    underDescription: '나눠 계획하는 중이면 계속 편집하세요.',
    matched: '계획 수량 합계가 P/O 수량과 일치합니다.',
  },

  /** 줄마다 붙는 단추. 확정과 전개 결과는 저장이 끝난 줄에만 선다. */
  rowActions: {
    save: '저장',
    remove: '삭제',
    confirm: '전개 확정',
    showResults: '전개 결과',
    lockLoadFailed: '저장 잠금 정보를 불러오지 못했습니다.',
    retry: '다시 시도',
    fallbackPlanNo: (productionPlanId: number): string => `계획 ${String(productionPlanId)}`,
  },

  /** ③ 확정 전 마지막 물음. 무엇이 함께 생기고 무엇을 잃는지 둘 다 적는다. */
  confirmDialog: {
    title: (planNo: string): string => `${planNo} 전개 확정`,
    cancel: '취소',
    confirm: '전개 확정',
    effect: '계획을 확정하면 Routing 공정별 W/O와 공정 의존 관계를 함께 생성합니다.',
    irreversible: '서버가 한 트랜잭션으로 처리하며, 확정된 계획은 수정하거나 삭제할 수 없습니다.',
  },

  /** 전개 결과. 확정이 만든 W/O 를 그 자리에서 확인한다. */
  result: {
    pane: '전개된 작업지시',
    heading: (planName: string): string => `${planName} 전개 결과`,
    fallbackPlanName: (productionPlanId: number): string => `생산계획 ${String(productionPlanId)}`,
    loading: '전개 결과를 불러오는 중',
    loadFailed: '전개 결과를 불러오지 못했습니다.',
    ownerMismatch: '다른 계획의 전개 결과가 반환되었습니다.',
    retry: '다시 시도',
    empty: '생성된 작업지시가 없습니다.',
    columns: {
      workOrderNo: 'W/O 번호',
      operation: '공정',
      orderQty: '수량',
      workOrderType: 'W/O 유형',
      status: '상태',
    },
    operationUnknown: '공정 이름 확인 불가',
    quantity: (amount: string, uomLabel: string): string => `${amount} ${uomLabel}`,
  },

  /**
   * 줄 입력이 틀렸을 때. **무엇이 틀렸는지**를 말하고 고칠 방향을 함께 준다 —
   * 「값이 잘못되었습니다」로 뭉뚱그리면 어느 칸을 어떻게 고칠지 알 수 없다.
   */
  draftErrors: {
    REQUIRED: '필수 값입니다.',
    INVALID_DATE: '올바른 날짜를 선택하세요.',
    INVALID_QUANTITY: '0보다 큰 수량을 입력하세요.',
    INVALID_SELECTION: '올바른 항목을 선택하세요.',
  },

  /** 화면 전체가 서지 못하는 자리. P/O 없이는 편성할 것이 없다. */
  screen: {
    unselected: '생산 P/O를 먼저 선택하세요.',
    openProductionOrders: 'P/O 수신·조회로 이동',
    loading: '생산 P/O를 불러오는 중',
    ownerMismatch: '요청한 생산 P/O와 다른 상세가 반환되었습니다.',
    loadFailed: '생산 P/O를 불러오지 못했습니다.',
    stale: '최신 생산 P/O를 확인하지 못했습니다.',
    retry: '다시 시도',
    keepsEdits: '현재 편집 내용은 유지됩니다.',
    lotNotice: '생산 LOT 크기와 선발행은 W/O 확정·배포 단계에서 입력합니다.',
  },
} as const;
