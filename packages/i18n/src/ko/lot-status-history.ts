/** Lot Status 현황·변경이력 조회 화면. LOT의 현재 상태를 찾고 보류 사건 이력을 되짚는다. */
export const lotStatusHistory = {
  title: 'Lot Status 현황·변경이력 조회',
  breadcrumbRoot: '품질관리',
  modes: {
    label: 'Lot Status 조회 모드',
    lot: 'LOT으로 찾기',
    history: '이력으로 찾기',
  },
  /** 두 조회 모드가 함께 쓰는 컨트롤 이름. */
  actions: {
    search: '조회',
    reset: '초기화',
    retry: '다시 시도',
    /** 다시 시도 단추가 여럿이라 어느 패널을 다시 부르는지 이름으로 가른다. */
    retryLabel: (name: string): string => `${name} 다시 시도`,
    previousPage: '이전 쪽',
    nextPage: '다음 쪽',
  },
  /** 쪽 이동 줄의 건수 표기. 숫자 서식은 부르는 쪽이 맞춘다. */
  range: {
    total: (total: string): string => `전체 ${total}건`,
    span: (start: string, end: string, total: string): string =>
      `${start}–${end} / 전체 ${total}건`,
  },
  /** 기준값 목록이 아직 덜 왔음을 알리는 공통 안내. 목록 이름은 부르는 쪽이 넣는다. */
  optionNotes: {
    loading: (name: string): string => `${name} 목록을 불러오는 중입니다.`,
    failed: (name: string): string => `${name} 목록을 불러오지 못했습니다.`,
    truncated: (name: string): string => `일부 ${name}만 표시됩니다.`,
  },
  values: {
    all: '전체',
    /** 더 쓰지 않는 기준값. 지난 자료에는 남아 있어 목록에서 감추지 않는다. */
    inactive: (label: string): string => `${label} (미사용)`,
    /** 기준값 목록에 없는 코드. 코드를 감추면 무엇이 어긋났는지 알 길이 없다. */
    unlisted: (value: string): string => `${value} (목록 미확정)`,
  },
  /** 이력에 담기는 범위를 미리 알린다. 보류 문서 목록과 보류 사건 이력이 함께 쓴다. */
  scopeNotice: '보류 등록·해제 이력만 표시하며 전체 상태 전이는 기록되지 않습니다.',
  lotFilter: {
    pane: 'LOT 조회 조건',
    fields: {
      lotType: 'LOT 유형',
      lotNo: 'LOT 번호',
      item: '품목',
      status: '현재 상태',
      warehouse: '창고',
      location: '위치',
    },
    notes: {
      lotTypeTruncated: '일부 LOT 유형만 표시됩니다.',
      lotStatusUnseeded: '현재 상태 기준값이 준비되지 않았습니다.',
      locationNeedsWarehouse: '창고를 먼저 선택하세요.',
      locationFailed: '위치 목록을 불러오지 못했습니다.',
      locationTruncated: '일부 위치만 표시됩니다.',
    },
    /** 조회 단추를 막는 사유. */
    reasons: {
      lotTypeRequired: 'LOT 유형을 선택하세요.',
      lotTypeLoading: 'LOT 유형 기준값을 불러오는 중입니다.',
      lotTypeFailed: 'LOT 유형 기준값을 불러오지 못했습니다.',
      lotTypeUnseeded: 'LOT 유형 기준값이 준비되지 않았습니다.',
    },
  },
  historyFilter: {
    pane: '이력 조회 조건',
    fields: {
      period: '기간',
      actor: '행위자',
      lot: 'LOT',
    },
    /** 고른 행위자가 목록에 없을 때 자리를 비우지 않고 고른 사실만 남긴다. */
    actorUnknownOption: '선택한 행위자 (이름 확인 불가)',
    actorUnknownNote: '선택한 행위자 이름을 확인하지 못했습니다.',
    /** 조회 단추를 막는 기간 사유. */
    reasons: {
      missing: '기간을 모두 선택한 뒤 조회할 수 있습니다.',
      invalid: '유효한 기간을 선택해 주세요.',
      reversed: '기간 종료는 시작보다 앞설 수 없습니다.',
    },
  },
  current: {
    pane: '현재 LOT 상태',
    beforeSearch: {
      title: 'LOT 유형을 선택하고 조회하세요',
      description: '조회 조건을 적용하면 현재 상태 요약과 LOT 목록이 표시됩니다.',
    },
    columns: {
      lot: 'LOT',
      item: '품목',
      status: '현재 상태',
      onHand: '보유',
      latestTransition: '최근 전이',
      reason: '사유',
    },
    /** 품목 이름을 아직 못 붙였을 때 왜 못 붙였는지를 칸에 그대로 적는다. */
    itemLabel: {
      loading: '불러오는 중…',
      failed: '품목 목록 조회 실패',
      unknown: '알 수 없음',
    },
    openDetail: (lotNo: string): string => `${lotNo} 상세 보기`,
    summary: {
      pane: '현재 상태 요약',
      loading: '현재 상태 요약을 불러오는 중',
      failed: '현재 상태 요약을 불러오지 못했습니다.',
      unknownCount: '집계 미확정',
      unit: '건',
      asOf: (at: string): string => `기준 시각 ${at}`,
      outOfScope: (count: number): string => `권한 범위 밖 ${String(count)}건이 제외되었습니다.`,
    },
    list: {
      title: 'LOT 목록',
      loading: 'LOT 목록을 불러오는 중',
      failed: 'LOT 목록을 불러오지 못했습니다.',
      refreshing: 'LOT 목록 갱신 중',
      refreshingText: 'LOT 목록을 갱신하는 중입니다.',
      emptyPage: '이 쪽에는 결과가 없습니다',
      empty: '조건에 맞는 LOT이 없습니다',
      firstPage: '첫 쪽으로',
      pagination: 'LOT 목록 쪽 이동',
    },
  },
  history: {
    pane: '보류 사건 이력',
    columns: {
      occurredAt: '일시',
      lot: 'LOT',
      event: '전이/사건',
      actor: '행위자',
      reason: '사유',
    },
    events: {
      held: '보류 등록',
      released: '보류 해제',
    },
    actorUnknown: '이름 미확인',
    beforeSearch: {
      title: '기간을 선택하고 조회하세요',
      description: '조회 기간을 모두 적용하면 보류 사건 이력이 표시됩니다.',
    },
    loading: '보류 사건 이력을 불러오는 중',
    failed: '보류 사건 이력을 불러오지 못했습니다.',
    refreshing: '보류 사건 이력 갱신 중',
    refreshingText: '보류 사건 이력을 갱신하는 중입니다.',
    empty: {
      title: '이 기간의 보류 사건이 없습니다',
      description: '현재 LOT 상태와 일치하지 않아도 오류가 아닙니다.',
    },
    pagination: '보류 사건 이력 쪽 이동',
  },
  detail: {
    title: 'LOT 상세',
    loading: 'LOT 상세를 불러오는 중',
    failed: 'LOT 상세를 불러오지 못했습니다.',
    close: '닫기',
    attributes: 'LOT 속성',
    fields: {
      lotNo: 'LOT 번호',
      item: '품목',
      lotType: 'LOT 유형',
      status: '현재 상태',
      initialQty: '초기 수량',
      expiryDate: '유효기한',
      manufacturedAt: '제조 시각',
    },
    transition: '판정·전이 처리',
    transitionNote: 'W-03-02 화면이 제공되면 사용할 수 있습니다.',
    suspiciousNote: '의심자재 등록은 W-03-03 화면에서 진행하세요.',
  },
  holdDocuments: {
    pane: '보류 문서',
    columns: {
      times: '등록·해제',
      reason: '사유',
      holdStatus: '보류 건 상태',
      holdQty: '보류 수량',
      releaseCondition: '해제 조건',
    },
    /** 수량을 비운 보류는 적용 시점의 전량을 뜻한다. */
    fullQty: '전량',
    actorPending: '확인 중…',
    loading: '보류 문서를 불러오는 중',
    failed: '보류 문서를 불러오지 못했습니다.',
    refreshingText: '보류 문서를 갱신하는 중입니다.',
    empty: '보류 문서가 없습니다',
    pagination: '보류 문서 쪽 이동',
    actorsLimited: '일부 행위자 이름을 확인하지 못해 사용자 번호를 표시합니다.',
  },
} as const;
