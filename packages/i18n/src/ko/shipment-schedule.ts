/**
 * W-04-02 출하 예정 목록. 관리웹 · 조회 전용이라 쓰기 어휘가 하나도 없다.
 *
 * **「요약」 구획을 두지 않는다.** 스펙(§4-B)은 필터 전체 기준의 집계 구획을 요구하지만
 * 계약(`GET /logistics/shipment-requests`)에 집계를 실을 자리가 없다 — 계산해서 만들면
 * 공유계약 L-2(파생 값은 서버가 계산)를 화면이 스스로 어긴다. 설계 검토 요청(omf-mes#232)
 * 등록 후 이번 슬라이스는 그 구획을 뺐다.
 *
 * **「검사」 열은 대상/`—` 두 상태뿐이다.** 계약에 검사 결과를 이을 필드가 없어 「대기」·「합격」을
 * 가를 근거가 없다(같은 검토 요청).
 */
export const shipmentSchedule = {
  title: '출하 예정 목록',
  breadcrumbRoot: '출하',
  panes: {
    list: '출하 예정 목록',
  },
  fields: {
    periodFrom: '출하일 시작',
    periodTo: '출하일 종료',
    customer: '고객',
    shipToPartner: '납품처',
    status: '상태',
    inspection: '검사 상태',
  },
  actions: {
    prevPage: '이전',
    nextPage: '다음',
    goFirstPage: '첫 쪽으로',
  },
  /** 비활성 사유·실패 사유는 그 컨트롤이나 대상의 이름으로 시작한다. */
  reasons: {
    periodRequired: '출하일 시작은 반드시 입력해야 합니다.',
    periodInvalid: '출하일은 있는 날짜여야 합니다. 시작일과 종료일을 다시 고르세요.',
    periodReversed: '출하일 종료는 시작보다 앞설 수 없습니다.',
    referencesFailed: '고객·납품처 이름을 불러오지 못했습니다. 이름 자리에 사유가 표시됩니다.',
  },
  loading: {
    list: '출하 예정 목록을 불러오는 중',
  },
  /** 목록 표의 머리글. 열 구성의 근거는 screens/shipment-schedule/shipment-table.tsx에 있다. */
  table: {
    requestedShipDate: '출하일',
    shipmentRequestNo: '작업지시번호',
    customer: '고객',
    shipToPartner: '납품처',
    qty: '요청 / 배정 / 출하',
    inspection: '검사',
    progress: '진행',
  },
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
    unknown: '알 수 없음',
    referenceLoading: '이름 불러오는 중',
    referenceFailed: '이름을 불러오지 못했습니다',
    inspectionTarget: '대상',
  },
  filters: {
    all: '전체',
    inspectionRequired: '대상',
    inspectionNotRequired: '대상 아님',
    /* 저장 컬럼이 없다는 사실은 스펙 §5-2가 확정한 것이다 — 없다고만 말하지 않고 왜 없는지를 밝힌다. */
    timeSlotNote: '시간대 필터는 저장 자리가 없어 제공하지 않습니다.',
    summaryNote: '집계 요약은 설계 확인 후 제공될 예정입니다.',
    statusNote:
      '상태는 아직 확정되지 않은 임시 목록입니다. 이번 조회 결과에 나온 값으로 만들어, 결과에 없는 값은 목록에 없습니다.',
    lookupTruncated: '선택지가 앞쪽 일부만 보입니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
    lookupFailed: '선택지를 불러오지 못했습니다.',
    chipCustomer: (value: string): string => `고객: ${value}`,
    chipShipToPartner: (value: string): string => `납품처: ${value}`,
    chipStatus: (value: string): string => `상태: ${value}`,
    chipInspection: (value: string): string => `검사: ${value}`,
    chipRemoveCustomer: '고객 조건 제거',
    chipRemoveShipToPartner: '납품처 조건 제거',
    chipRemoveStatus: '상태 조건 제거',
    chipRemoveInspection: '검사 조건 제거',
  },
  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
  },
  empty: {
    noResultTitle: '조건에 맞는 출하 예정이 없습니다',
    noResultDescription: '기간을 넓히거나 조건을 줄인 뒤 다시 조회하세요.',
    /* 출하일 시작이 없어 조회 자체가 나가지 않은 상태 — 「결과 없음」과 다른 안내를 낸다. */
    notQueriedTitle: '아직 조회하지 않았습니다',
    notQueriedDescription: '조건 줄의 안내에 따라 출하일 시작을 입력한 뒤 조회하세요.',
    beyondLastTitle: '이 쪽에는 결과가 없습니다',
    beyondLastDescription: '첫 쪽으로 이동하세요.',
  },
  notes: {
    /* 밝히지 않으면 사용자가 「현재 쪽 안에서만 정렬된 것」으로 읽는다 — 서버가 전체를 정렬해 쪽을 나눠 준다. */
    sortScope:
      '정렬은 전체 결과 기준입니다. 계약이 정렬 방향을 구분하지 않아 오름차순으로 표시합니다.',
  },
} as const;
