/**
 * W-05-07 수집 채널 매핑 관리.
 *
 * ⭐ **이 화면이 하는 일은 「설비가 보내오는 이름」을 「검사 항목」에 잇는 것 하나다**(스펙 §5-1).
 * 통신 설정도, 수신 로그 조회도 여기 있지 않다.
 *
 * ⛔ **잇지 않은 채널의 값은 버려진다** — 그 사실을 화면이 말한다(스펙 §9-2). 「매핑 없음」만으로는
 * 결과를 알 수 없다. 설정한 사람은 저장되고 있다고 믿는다.
 */
export const collectionChannel = {
  title: '수집 채널 매핑 관리',
  breadcrumbRoot: '설비/툴',
  optionsTruncated: '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
  optionsLoadFailed: '선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.',
  equipment: {
    paneTitle: '설비',
    searchLabel: '설비 검색',
    searchPlaceholder: '설비번호 또는 설비명',
    plantAll: '전체 공장',
    loading: '설비 목록을 불러오는 중',
    emptyTitle: '등록된 설비가 없습니다',
    emptyDescription: '설비를 등록하면 여기에 나타납니다.',
    noMatchTitle: '조건에 맞는 설비가 없습니다',
    noMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 조회하세요.',
    /** 잘림을 감추지 않는다 — 찾는 설비가 목록에 없을 수 있다. */
    truncated: (shown: number, total: number): string =>
      `전체 ${total}건 중 ${shown}건을 표시합니다. 조건을 좁혀 조회하세요.`,
    /** 행이 곧 손잡이다 — 접근 이름에 무엇이 열리는지 담는다. */
    selectLabel: (code: string, name: string): string => `${code} ${name}의 수집 채널 보기`,
    chipRemoveKeyword: '검색어 조건 제거',
    chipRemovePlant: '공장 조건 제거',
    chipKeyword: (value: string): string => `검색어: ${value}`,
    chipPlant: (label: string): string => `공장: ${label}`,
  },
  channels: {
    paneTitle: '채널 매핑',
    /** 무엇의 채널을 보고 있는지 페인 머리에 남긴다 — 좌우가 멀어지면 고른 것을 잊는다. */
    paneOf: (code: string, name: string): string => `${code} · ${name}의 수집 채널`,
    /** 설비를 고르기 전에는 조회 자체가 없다 — 빈 표가 아니라 무엇을 해야 하는지 말한다. */
    noEquipmentTitle: '설비를 고르세요',
    noEquipmentDescription: '왼쪽에서 설비를 고르면 그 설비의 수집 채널이 나타납니다.',
    loading: '수집 채널 목록을 불러오는 중',
    emptyTitle: '등록된 수집 채널이 없습니다',
    emptyDescription: '이 설비에서 받을 신호를 채널로 등록하면 여기에 나타납니다.',
    noMatchTitle: '조건에 맞는 수집 채널이 없습니다',
    noMatchDescription: '조건을 줄이거나 초기화한 뒤 다시 보세요.',
    unmappedOnly: '미매핑만 보기',
    /**
     * ⭐ **버려진다고 명시한다**(스펙 §9-2). 「매핑 없음」이라고만 쓰면 결과를 알 수 없다.
     *
     * ⛔ **「로그에는 남습니다」라고 말하지 않는다** — 설비 수신이 연계 메시지에 담기는지가
     * 아직 확인되지 않았다. 확인되지 않은 것을 위로로 삼으면 없는 경로를 찾아 헤매게 된다.
     */
    unmappedSummary: (count: number): string =>
      `대상 검사 항목이 없는 채널이 ${count}개 있습니다. 이 채널로 들어오는 값은 저장되지 않고 버려집니다.`,
    unmappedSummaryTitle: '받아도 쓰이지 않는 채널이 있습니다',
    /**
     * ⚠ 미매핑 조건은 화면이 걸고, 서버가 목록을 자르면 **받아 온 것만** 덮는다.
     * 그 사실을 감추면 잘려 나간 쪽의 미매핑 채널이 없는 것처럼 보인다.
     */
    unmappedOnLoadedOnly:
      '미매핑 조건은 지금 불러온 목록에만 적용됩니다. 잘린 부분에 미매핑 채널이 더 있을 수 있으니 조건을 좁혀 조회하세요.',
    /** ⛔ 「다 보여 주고 있다」고 말하지 않는다 — 전체 건수가 오지 않으면 알 수 없다. */
    listTruncated: (shown: number, total: number): string =>
      `전체 ${total}건 중 ${shown}건을 표시합니다.`,
    mayHaveMore: (shown: number): string => `${shown}건을 표시합니다. 더 있을 수 있습니다.`,
  },
  fields: {
    plant: '공장',
    equipmentCode: '설비번호',
    equipmentName: '설비명',
    channelKey: '채널명',
    signalName: '신호 이름',
    unit: '단위',
    inspectionItem: '대상 검사 항목',
    isActive: '사용',
    notRecorded: '기록 없음',
  },
  /**
   * ⭐ **연결 여부는 두 값이 아니라 세 값이다**(공유계약 G-9 확장 · 스펙 §9-2).
   *
   * ⛔ **「미매핑」과 「연결됨」을 같은 말로 그리지 않는다** — 앞은 값이 버려진다는 뜻이고
   * 뒤는 정상이다. 그리고 **「연결됨」은 「무엇에 연결됐는지 안다」는 뜻이 아니다** — 목록에는
   * 항목의 이름이 오지 않는다. 아는 척하지 않고 아는 만큼만 적는다.
   */
  mapping: {
    unmapped: '미매핑',
    mapped: '연결됨',
    nameUnavailable: '연결된 검사 항목의 이름은 이 목록에 오지 않습니다 — 연결 여부만 표시합니다.',
  },
  values: {
    active: '사용 중',
    inactive: '미사용',
    inactiveSuffix: ' (미사용)',
  },
} as const;
