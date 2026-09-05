/** W-04-04 출하 처리(상차·실물 출고). */
export const shipmentProcessing = {
  title: '출하 처리(상차·실물 출고)',
  breadcrumbRoot: '출하',
  panes: {
    list: '확정 대기 출하작업지시 목록',
    lines: '출하 내역',
    loadingInfo: '상차 정보',
    outcome: '확정하면 일어나는 일',
    gate: '처리 관문',
  },
  filter: {
    shipDateFrom: '출하일 시작',
    shipDateTo: '출하일 종료',
    pickingCompleteOnly: '피킹완료만',
    pickingCompleteOnlyNote: '서버가 계산한 출하 진행 상태를 기준으로 전체 결과에 적용됩니다.',
    search: '조회',
    reset: '초기화',
    shipDateFromRequired: '출하일 시작은 필수입니다.',
    dateRange: '출하일 종료는 시작보다 앞설 수 없습니다.',
  },
  list: {
    pane: '확정 대기 출하작업지시 목록',
    fields: {
      shipmentRequestNo: '출하작업지시번호',
      customer: '고객',
      requestedShipDate: '출하일',
      status: '진행상태',
      gate: '처리 가능 여부',
    },
    values: {
      missingCustomer: '고객 정보 없음',
      ready: '처리 가능',
    },
    blockers: {
      LINES_UNAVAILABLE: '라인 정보 없음',
      PICKING_INCOMPLETE: '피킹 미완료',
      INSPECTION_NOT_PASSED: '출하검사 미완료',
    },
    empty: {
      title: '조회 결과가 없습니다.',
      description: '출하일을 확인하고 다시 조회해 주세요.',
      beyondTitle: '이 쪽에는 결과가 없습니다.',
      beyondDescription: '쪽 번호를 확인해 주세요.',
    },
    loading: '목록을 불러오는 중입니다.',
    actions: {
      select: (shipmentRequestNo: string) => `${shipmentRequestNo} 선택`,
    },
  },
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number) =>
      `${String(start)}–${String(end)} / 총 ${String(total)}건`,
    totalOnly: (total: number) => `총 ${String(total)}건`,
    actions: {
      prevPage: '이전 쪽',
      nextPage: '다음 쪽',
    },
  },
  detail: {
    selection: {
      title: '출하작업지시를 선택하세요.',
      description: '좌측 목록에서 출하작업지시를 고르면 출하 처리 내용을 입력할 수 있습니다.',
    },
    unavailable: '상세 정보를 불러오지 못했습니다.',
  },
  gate: {
    complete: '모든 관문을 통과했습니다.',
    checking: '관문을 확인하는 중입니다.',
    blockers: {
      LINES_UNAVAILABLE: '라인 정보를 불러오지 못해 처리 가능 여부를 판정할 수 없습니다.',
      PICKING_INCOMPLETE:
        '피킹이 끝나지 않아 출하 처리를 할 수 없습니다. 모든 라인의 피킹을 완료해 주세요.',
      INSPECTION_NOT_PASSED:
        '출하검사가 끝나지 않아 출하 처리를 할 수 없습니다. 검사 결과를 확인해 주세요.',
      ALLOCATION_UNBALANCED:
        '출하 내역의 LOT 배분이 맞지 않아 출하 처리를 할 수 없습니다. 라인별 출하수량과 LOT 배분 합을 맞춰 주세요.',
      WAREHOUSE_UNRESOLVED: '출하 창고를 정할 수 없어 출하 처리를 할 수 없습니다.',
    },
  },
  lines: {
    fields: {
      line: '라인',
      item: '품목',
      requestedQty: '요청',
      allocatedQty: '배정',
      pickedQty: '피킹',
      shippedQty: '출하수량',
      lot: 'LOT',
      qty: '수량',
      manage: '관리',
    },
    values: {
      itemLabel: (itemId: number) => `품목 ID ${String(itemId)}`,
      noAllocations: '선택된 LOT이 없습니다.',
      heldSuffix: ' (보류 — 선택 불가)',
    },
    actions: {
      addLot: 'LOT 추가',
      removeLot: '이 LOT 배분 삭제',
    },
    issues: {
      SHIPPED_QTY_INVALID: '출하수량을 입력해 주세요.',
      NO_ALLOCATIONS: 'LOT을 하나 이상 선택해 주세요.',
      LOT_NOT_SELECTED: '선택하지 않은 LOT이 있습니다.',
      ALLOCATION_QTY_INVALID: 'LOT별 수량을 입력해 주세요.',
      DUPLICATE_LOT: '같은 LOT을 두 번 이상 선택할 수 없습니다.',
      SUM_MISMATCH: '출하수량과 LOT 배분 합이 다릅니다.',
    },
    lotSelectPlaceholder: 'LOT 선택',
    lotUnavailable: '이 품목의 LOT 후보를 불러오지 못했습니다.',
    lotTruncated: '이 품목의 LOT 후보가 많아 일부만 보입니다.',
    lotLoading: 'LOT 후보를 불러오는 중입니다.',
  },
  loadingInfo: {
    fields: {
      vehicleNo: '차량번호',
      driverName: '운전자명',
      sealNo: '봉인번호',
      transportDocumentNo: '운송장번호',
      loadingWorker: '상차담당자',
      carrier: '운송사',
      warehouse: '출하 창고',
    },
    unselected: '(미지정)',
    warehouse: {
      resolved: (label: string) => `${label} — 활성 창고가 하나뿐이라 자동으로 정했습니다.`,
      none: '활성 창고가 없어 출하 처리를 할 수 없습니다. 기준정보에서 창고를 등록해 주세요.',
      ambiguous:
        '활성 창고가 여러 곳입니다. 출하 창고 출처가 스펙에 없어 임시로 직접 선택하게 했습니다 — 설계 확인 필요.',
      loadFailed: '창고 목록을 불러오지 못했습니다.',
      loading: '창고 목록을 불러오는 중입니다.',
    },
    lookupFailed: {
      workers: '상차담당자 목록을 불러오지 못했습니다.',
      carriers: '운송사 목록을 불러오지 못했습니다.',
    },
  },
  outcome: {
    inventory: '이 출하 내역의 LOT 배분만큼 재고가 즉시 차감되고, 그 LOT의 genealogy가 종결됩니다.',
    unconfirmed:
      '이 처리는 출하를 미확정 상태로 만듭니다 — 이 화면은 확정하지 않으며, 확정·취소는 별도 화면에서 진행합니다.',
    irreversible: '되돌릴 수 없습니다.',
  },
  confirm: {
    title: (shipmentRequestNo: string) => `${shipmentRequestNo} 출하 처리`,
    target: (shipmentRequestNo: string) => `${shipmentRequestNo}을(를) 출하 처리합니다.`,
    irreversible: '이 처리는 되돌릴 수 없습니다 — 재고가 즉시 차감되고 LOT genealogy가 종결됩니다.',
    unconfirmedNote: '처리 후에도 출하는 미확정 상태입니다. 확정은 별도 화면에서 진행합니다.',
    cancel: '취소',
    confirm: '출하 처리',
  },
  submit: '출하 처리',
  processedToast: '출하가 미확정 상태로 생성되었습니다.',
} as const;
