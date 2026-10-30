/** Lot Status 현황·변경이력 조회 화면. LOT의 현재 상태를 찾고 보류 사건 이력을 되짚는다. */
export const lotStatusHistory = {
  title: 'Lot Status 현황·변경이력 조회',
  breadcrumbRoot: '품질 관리',
  /** 조회 방식 — 조회 조건 카드 맨 위의 두 단추로 고른다(사용자 시안 2026-10-30). */
  modes: {
    label: '검색 기준',
    lot: 'LOT 번호',
    history: '변경 이력',
  },
  /** 두 조회 모드가 함께 쓰는 컨트롤 이름. */
  actions: {
    search: '조회',
    reset: '초기화',
    retry: '다시 시도',
    /** 다시 시도 단추가 여럿이라 어느 패널을 다시 부르는지 이름으로 가른다. */
    retryLabel: (name: string): string => `${name} 다시 시도`,
    previousPage: '이전',
    nextPage: '다음',
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
  lotFilter: {
    pane: 'LOT 조회 조건',
    /** 칸 안 안내 글자(사용자 시안 2026-10-30). 이력 방식의 LOT 번호 칸이 쓴다. */
    lotNoPlaceholder: 'LOT 번호',
    /** 조회 조건 칸 이름 — 검사 조회·판정 조회 줄과 같은 말투(사용자 2026-10-30). */
    labels: {
      lotType: 'LOT 유형',
      lotNo: 'LOT 번호',
      item: '품목 검색',
      warehouse: '창고 선택',
      location: '위치 선택',
    },
    lotNoScanPlaceholder: 'LOT 번호 입력 또는 스캔',
    /** LOT 번호 칸 옆 단추 — 그 번호로 바로 조회한다. */
    lotNoSearch: '검색',
    detailOpen: '상세 검색 펼치기',
    detailClose: '상세 검색 접기',
    /** 품목은 검색해서 고른다 — 품목 선택 창을 여는 단추와 고른 값을 지우는 단추. */
    itemPlaceholder: '품목을 입력하세요',
    itemClear: '품목 지우기',
    itemPick: '선택',
    /** 창고는 검색 팝업에서 고른다(사용자 2026-10-30). */
    warehousePicker: { title: '창고 선택', code: '창고 코드', name: '창고명' },
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
      lotTypeUnseeded: 'LOT 유형 기준값이 준비되지 않았습니다.',
      lotStatusUnseeded: '현재 상태 기준값이 준비되지 않았습니다.',
      locationNeedsWarehouse: '창고를 먼저 선택하세요',
      locationFailed: '위치 목록을 불러오지 못했습니다.',
      locationTruncated: '일부 위치만 표시됩니다.',
    },
  },
  historyFilter: {
    pane: '이력 조회 조건',
    fields: {
      period: '기간',
      actor: '행위자',
      lot: 'LOT 번호',
    },
    /** 고른 행위자가 목록에 없을 때 자리를 비우지 않고 고른 사실만 남긴다. */
    actorUnknownOption: '선택한 행위자 (이름 확인 불가)',
    actorUnknownNote: '선택한 행위자 이름을 확인하지 못했습니다.',
    /** 기간 입력창이 비었을 때 — 두 날짜가 필요하다는 것을 먼저 보인다. */
    periodPlaceholder: '시작일 ~ 종료일',
    /** 달력이 열려 있는 동안 지금 고를 날짜. */
    steps: {
      start: '시작일을 선택해 주세요.',
      end: '종료일을 선택해 주세요.',
    },
    /** 조회 단추를 막는 기간 사유. */
    reasons: {
      missing: '시작일을 선택한 후 종료일을 선택해 주세요.',
      invalid: '유효한 기간을 선택해 주세요.',
      reversed: '기간 종료는 시작보다 앞설 수 없습니다.',
    },
  },
  current: {
    pane: 'LOT 현황',
    columns: {
      lot: 'LOT 번호',
      item: '품목',
      status: '상태',
      onHand: '보유 수량',
      latestTransition: '최종 변경일',
      reason: '상태 사유',
    },
    /** 품목 이름을 아직 못 붙였을 때 왜 못 붙였는지를 칸에 그대로 적는다. */
    itemLabel: {
      loading: '불러오는 중…',
      failed: '품목 목록 조회 실패',
      unknown: '알 수 없음',
    },
    summary: {
      pane: '현재 상태 요약',
      loading: '현재 상태 요약을 불러오는 중',
      failed: '현재 상태 요약을 불러오지 못했습니다.',
      unknownCount: '집계 불가',
      unit: '건',
      /** 마지막으로 조회가 성공한 시각과 다시 부르는 단추 — 대시보드와 같은 문구(자동 갱신은 없다). */
      lastUpdated: (at: string): string => `마지막 갱신 ${at}`,
      refresh: '갱신',
      outOfScope: (count: number): string =>
        `조회 권한이 없는 LOT ${String(count)}건을 제외했습니다.`,
    },
    list: {
      title: 'LOT 목록',
      total: (total: string): string => `총 ${total}건`,
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
  /** 보류 등록·해제와 상태 변경을 한 표에 시간순으로 보인다(omf-all-around#24). */
  history: {
    pane: 'LOT 이력',
    columns: {
      occurredAt: '일시',
      lot: 'LOT',
      event: '구분',
      change: '상태 변경',
      actor: '행위자',
      reason: '사유',
    },
    events: {
      held: '보류 등록',
      released: '보류 해제',
      statusChanged: '상태 변경',
    },
    /** 상태 변경의 까닭. 서버 전이 코드 13종(W-03-01 §5-1 · 서버 C17~C20). */
    transitions: {
      C4: '합격',
      C5: '검사 보류',
      C6: '불합격',
      C7: '재판정 합격',
      C8: '재판정 불합격',
      C9: '클레임·리콜',
      C10: '의심자재 등록',
      C14: '합격판정개수 초과',
      C15: '전수 재검 양품',
      C17: '처분 재작업',
      C18: '처분 폐기',
      C19: '처분 정상',
      C20: '재고 재등록',
      C25: '특채 적용',
      C26: 'PQC 생략',
      C27: 'OQC 생략',
    },
    /** 최초 등록 전이는 이전 상태가 없다. */
    initialStatus: '최초',
    actorUnknown: '이름 미확인',
    beforeSearch: {
      title: '기간을 선택하고 조회하세요',
      description: '조회 기간을 모두 적용하면 보류 등록·해제와 상태 변경 이력이 표시됩니다.',
    },
    loading: 'LOT 이력을 불러오는 중',
    failed: 'LOT 이력을 불러오지 못했습니다.',
    refreshing: 'LOT 이력 갱신 중',
    refreshingText: 'LOT 이력을 갱신하는 중입니다.',
    empty: {
      title: '이 기간의 이력이 없습니다',
      description: '현재 LOT 상태와 일치하지 않아도 오류가 아닙니다.',
    },
    truncated: '보류 사건이 많아 일부만 표시합니다. 기간을 좁혀 조회하세요.',
    pagination: 'LOT 이력 쪽 이동',
  },
  /** LOT 상세의 이력. 표 모양은 「이력으로 찾기」와 같고 LOT 열만 없다. */
  timeline: {
    pane: 'LOT 변경 이력',
    loading: 'LOT 이력을 불러오는 중',
    failed: 'LOT 이력을 불러오지 못했습니다.',
    empty: '변경 이력이 없습니다',
    truncated: '보류 사건이 많아 일부만 표시합니다.',
    /** LOT 상세의 이력 표 머리 — 「이력으로 찾기」 표는 종전 이름 그대로다. */
    columns: {
      occurredAt: '처리 일시',
      event: '처리 유형',
      change: '변경 내용',
      actor: '처리자',
      reason: '사유',
    },
  },
  detail: {
    title: 'LOT 상세',
    loading: 'LOT 상세를 불러오는 중',
    failed: 'LOT 상세 정보를 불러오지 못했습니다.',
    /** LOT 상세 안의 다시 부르기 단추. */
    retry: '재시도',
    retryLabel: (name: string): string => `${name} 재시도`,
    /** 아직 고른 LOT 이 없을 때 상세 칸 안내. */
    pick: '목록에서 LOT을 선택해 주세요.',
    trace: '생산 이력 조회',
    /** LOT 상세 아래 이력 탭 묶음 이름(화면 읽기용). */
    historyTabs: 'LOT 이력',
    attributes: 'LOT 속성',
    fields: {
      lotNo: 'LOT 번호',
      item: '품목',
      lotType: 'LOT 유형',
      status: '상태',
      initialQty: '초기 수량',
      expiryDate: '유효기한',
      manufacturedAt: '제조 시각',
      fourMChange: '4M 변경품',
    },
  },
  holdDocuments: {
    pane: '보류 이력',
    columns: {
      times: '등록·해제 내역',
      reason: '사유',
      holdStatus: '상태',
      holdQty: '수량',
      releaseCondition: '해제 조건',
    },
    /** 등록·해제 칸의 줄 이름. */
    times: {
      held: '등록',
      released: '해제',
    },
    holdStates: {
      open: '보류 중',
      released: '해제',
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
