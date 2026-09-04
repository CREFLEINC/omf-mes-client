/**
 * M-01-12 재생재 등록 — 재생재를 자재 묶음으로 세우고 그 수량만큼 재고를 늘린다.
 *
 * 자재 묶음 번호를 서버가 매긴다. 화면이 미리 보이지 못하므로, 저장 전에 그 사실을 먼저
 * 말하고 저장 뒤 응답에 실려 온 번호를 보인다.
 */
export const recycleEntry = {
  title: '재생재 등록',
  /** 되돌아온 기록 목록에서 이 기록이 무엇인지 알리는 이름. */
  record: '재생재 등록',
  item: {
    legend: '품목',
    label: '품목코드',
    placeholder: '품목코드를 비추거나 적으세요',
    manualSubmit: '찾기',
    searching: '품목을 찾는 중입니다',
    loadFailed: '품목을 확인할 수 없습니다',
    /* 이 화면은 품목을 만들지 않는다. 없으면 어디서 만드는지 알린다. */
    notRecycled: '등록되지 않은 재생재 품목입니다',
    notRecycledWhy: '재생재 품목 행을 관리웹에서 먼저 등록해야 합니다.',
    chosen: (code: string, name: string) => `${code} ${name}`,
    /* 단위는 품목의 기본 단위를 서버가 쓴다. 화면은 읽기만 한다. */
    uom: (code: string) => `단위 ${code}`,
    uomUnknown: '단위를 확인할 수 없습니다',
    clear: '품목 지우기',
  },
  place: {
    legend: '창고·위치',
    warehouseLabel: '창고',
    warehousePlaceholder: '창고를 고르세요',
    warehouseLoading: '창고를 불러오는 중입니다',
    warehouseLoadFailed: '창고를 확인할 수 없습니다',
    warehouseNone: '고를 창고가 없습니다',
    locationLabel: '위치',
    locationPlaceholder: '위치를 고르세요',
    locationLoading: '위치를 불러오는 중입니다',
    locationLoadFailed: '위치를 확인할 수 없습니다',
    locationNone: '이 창고에 위치가 없습니다',
  },
  qty: {
    legend: '수량',
    label: '수량',
    remarks: '비고',
    empty: '수량을 적으세요',
    notNumber: '수량은 숫자로 적으세요',
    notPositive: '수량은 0보다 커야 합니다',
  },
  /* 번호를 화면이 정하면 오프라인 두 단말이 같은 번호를 만든다. 서버가 매긴다. */
  numberLater: '자재 묶음 번호는 저장 후 정해집니다',
  submit: '재생재 등록',
  sent: {
    title: '재생재를 등록했습니다',
    lotNo: (lotNo: string) => `자재 묶음 ${lotNo}`,
  },
  queued: {
    title: '재생재 등록을 담아 두었습니다',
    /* 버려지는 것이 아니라 미뤄지는 것임이 드러나야 한다. */
    description: '연결되면 전송됩니다. 번호는 전송 후 정해집니다.',
    /* 번호가 아직 없고 라벨은 서버가 그린다. */
    labelLater: '라벨은 번호가 정해진 뒤에 인쇄할 수 있습니다',
  },
  rejected: {
    title: '재생재 등록이 되돌아왔습니다',
    description: '되돌아온 건에서 사유를 확인하세요. ',
    action: '되돌아온 건 보기',
  },
  saveFailed: {
    title: '재생재 등록을 담아 두지 못했습니다',
    description: '등록되지 않았습니다. 다시 시도하세요.',
  },
  noWorker: '사번을 확인한 뒤에 기록할 수 있습니다',
  another: '다음 재생재',
} as const;
