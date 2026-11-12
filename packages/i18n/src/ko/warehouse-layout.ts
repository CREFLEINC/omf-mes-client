/**
 * W-CO-08 창고 배치도 — 도면 위에 위치를 찍어 둔다.
 *
 * ⭐ **좌표는 픽셀이 아니라 비율이다** — 도면을 갈아도 같은 상대 위치를 가리킨다.
 * ⭐ **저장은 도면과 점을 통째로 바꾼다** — 지도에서 뺀 위치는 지워진다.
 *
 * 화면에는 원리 · 조작법을 적지 않는다(사용자 지시 2026-10-30) — 제목 · 단추 · 짧은 상태 · 오류 한 줄만. 동작 설명은
 * 여기 주석에 둔다:
 * - 왼쪽 목록에서 위치를 선택한 뒤 도면을 누르면 그 자리에 찍힌다. 표식은 끌어 옮기거나, 선택해 화살표로 민다.
 * - 도면 없이도 점을 찍어 둘 수 있고, 나중에 도면을 올려도 찍어 둔 자리가 그대로 남는다(비율이라서).
 * - 도면을 바꿔도 점은 같은 상대 위치에 남지만, 새 도면의 실제 자리와 맞는지는 사람이 다시 본다.
 * - 저장하지 않은 점 변경이 있으면 도면 올리기를 막는다 — 저장하거나 되돌린 뒤 올린다.
 * - 409 뒤 「내 도면으로 바꾸기」는 지금 보이는 남의 도면 대신 내가 고른 도면을 저장한다.
 * - 목록에서 이름을 찾지 못한 표식(중지 · 삭제된 위치)은 위치 번호로 보인다.
 */
export const warehouseLayout = {
  title: '창고 배치도',
  breadcrumbRoot: '기준정보 관리',

  /* 입고 관리 짜임(사용자 지시 2026-10-29) — 위 창고 고르기 · 왼쪽 위치 목록 | 오른쪽 배치도. */
  splitter: '끌어서 목록·배치도 폭 조절',
  listCollapse: '위치 목록 접기',
  listExpand: '위치 목록 펼치기',
  panes: {
    map: '배치도',
    locations: '위치 목록',
  },

  warehouse: {
    select: '창고',
    selectPlaceholder: '창고 선택',
    lookupFailed: '창고 목록을 불러오지 못했습니다.',
    lookupTruncated: '목록의 일부만 보입니다.',
    emptyTitle: '창고를 선택하세요',
  },

  map: {
    imageLabel: '창고 도면',
    /** 도면이 아직 없다 — 점만 찍을 수는 있다. */
    noDrawing: '도면이 없습니다',
    /** ⭐ 도면은 첨부로 따로 받는다 — 「없다」와 「아직 못 받았다」를 가른다. */
    drawingLoading: '도면을 불러오는 중입니다.',
    /** ⚠ 그림만 못 받은 것이다 — 점은 그대로 있다. 다시 불러오거나 새 도면을 올린다. */
    drawingLoadFailed: '도면을 불러오지 못했습니다.',
    drawingRetry: '도면 다시 불러오기',
    /** 위치를 고르지 않고 도면을 눌렀다. */
    placeNeedsLocation: '찍을 위치를 선택하세요.',
    /**
     * ⭐ 잠긴 판이 **무엇을 막고 무엇은 허락하는지** 듣는 사람에게 전하는 말. 「사용 불가」로
     * 뭉뚱그리면 고르기까지 막힌 것으로 들린다 — 잠겨도 고르기는 된다.
     */
    boardLocked: '지금은 점을 찍거나 옮길 수 없습니다. 고르기는 됩니다.',
    /**
     * ⭐ 눈으로는 자리를 보지만 듣는 사람에게는 이 말이 자리 그 자체다 — 판 부품은 표현
     * 전용이라 말을 갖지 않으므로 화면이 넘겨 준다.
     */
    markerPosition: (xPercent: number, yPercent: number): string =>
      `가로 ${String(xPercent)}%, 세로 ${String(yPercent)}%`,
    /** 옮긴 뒤 한 번 읽어 주는 말 — 어느 표식이 어디로 갔는지. */
    markerMoved: (label: string, xPercent: number, yPercent: number): string =>
      `${label}: 가로 ${String(xPercent)}%, 세로 ${String(yPercent)}%`,
    /** 고른 표식의 크기 · 회전 칸(사용자 지시 2026-10-30). 너비 · 높이는 도면 폭 · 높이에 대한 백분율, 회전은 시계 방향 도. */
    shape: '표식 크기와 회전',
    width: '너비(%)',
    height: '높이(%)',
    rotation: '회전(°)',
    remove: '지도에서 빼기',
    removeNeedsMarker: '뺄 표식을 선택하세요.',
    save: '배치도 저장',
    saving: '저장하는 중입니다.',
    saved: '배치도를 저장했습니다.',
    reset: '되돌리기',
    /** 배치도 조회가 저장의 잠금 토큰을 준다 — 받기 전 · 못 받으면 저장할 수 없다. */
    lockLoading: '배치도를 불러오는 중입니다.',
    lockFailed: '배치도를 불러오지 못해 저장할 수 없습니다.',
    upload: '도면 올리기',
    /** ⛔ 요청 전에 화면이 거른다 — 서버가 받는 것은 PNG·JPEG 뿐이다. */
    fileTypeRejected: 'PNG 또는 JPEG 파일만 올릴 수 있습니다.',
    fileTooLarge: '10MB 이하 파일만 올릴 수 있습니다.',
    /**
     * ⛔ 저장하지 않은 점 편집이 있으면 올리기를 막는다 — 바로 반영이라 그 점을 함께 보낼지
     * 버릴지가 사용자 모르게 갈린다.
     */
    uploadNeedsCleanDraft: '저장하지 않은 표식 변경이 있습니다.',
    /** ⭐ 올리기와 저장은 이어지는 두 호출이다 — 지금 어느 쪽인지 글자로 말한다. */
    uploadingLabel: '올리는 중…',
    savingDrawingLabel: '저장하는 중…',
    drawingReplaced: '도면을 바꿨습니다.',
    /** ⭐ 올리기는 끝났고 저장만 남았다 — 다시 올리면 고아 첨부가 하나 더 생긴다. */
    retrySaveDrawing: '저장 다시 시도',
    /**
     * ⛔ **충돌로 멈춘 뒤의 그 버튼은 「다시 시도」가 아니다.** 재조회가 이미 남이 올린 도면을
     * 화면에 세워 두었으므로, 그대로 누르면 **지금 보이는 그 도면을 내 도면으로 덮는다** —
     * 하는 일이 다르니 말도 달라야 한다.
     */
    overwriteDrawing: '내 도면으로 바꾸기',
    /** ⚠ 도면을 갈면 점은 남지만 사람이 다시 봐야 한다. 확인 창은 제목과 고른 파일 이름만 보인다. */
    replaceDrawingTitle: '도면을 바꿀까요?',
    confirm: '진행',
    cancel: '취소',
  },

  /**
   * 편집 창(피처 006) — 조회 화면의 [수정]이 브라우저 창을 채우는 편집 창을 연다. 편집 규칙(찍기 · 옮기기 · 크기 · 빼기 ·
   * 되돌리기 · 도면 올리기 · 저장)은 `map` 문구를 그대로 쓴다. 저장하지 않은 변경이 있으면 닫을 때 버릴지 묻는다.
   */
  /** 편집 창 목록의 별칭 고치기(#267 FR-007a) — 위치마다 바로 저장, 배치도 저장과 따로. */
  aliasPopover: {
    title: (code: string): string => `${code} 별칭`,
    note: '바로 저장됩니다. 배치도 저장과는 따로입니다.',
  },
  editor: {
    open: '수정',
    title: (warehouse: string): string => `배치도 수정 — ${warehouse}`,
    cancel: '취소',
    discardTitle: '변경을 버리고 닫을까요?',
    discardBody: '저장하지 않은 표식 변경이 사라집니다.',
    keepEditing: '계속 편집',
    discard: '버리고 닫기',
    /**
     * 도면에는 구역 · 랙만 둔다(2차 · FR-016). 이미 저장된 층 · 셀 표식은 그리지 않고 다음 저장 때 빠진다 — 그 수를 알린다.
     * 이 알림만으로는 저장할 변경이 아니다(닫을 때 묻지 않는다).
     */
    legacyMarkers: (count: number): string => `층·셀 표식 ${String(count)}개는 저장하면 빠집니다.`, // ui-check-ignore: C-13 승인 시안 W-CO-08-r2 문구(#266)
    /** 창을 먼저 띄우고 판은 다음에 그린다(2차 · FR-017) — 표식 그리기 · 글자 맞추기가 끝날 때까지 판 위에 선다. */
    drawingBoard: '배치를 그리는 중',
    /** 편집 창 목록은 배치 대상(구역 · 랙)만이다 — 그것이 없을 때. */
    emptyPlaceable: '도면에 둘 구역·랙이 없습니다', // ui-check-ignore: C-13 승인 tasks T037 문구(#266)
  },

  /**
   * 조회 화면의 재고(피처 006). 표식은 재고 있음(지금 모양) / 비어 있음(회색) 두 모양이고, 위치를 고르면 판 아래에 그 위치와
   * 하위 위치의 재고 표가 선다. 같은 품목 · LOT 이라도 위치가 다르면 줄을 나눈다(수량을 더하지 않는다).
   */
  stock: {
    legendStocked: '재고 있음',
    legendEmpty: '비어 있음',
    legendNote: '도면에 없는 위치는 목록의 「아직」',
    title: (locationCode: string): string => `${locationCode} 재고`,
    location: '위치',
    item: '품목',
    lot: 'LOT',
    onHand: '현재고',
    qualityStatus: '품질 상태',
    pickHint: '위치를 고르면 재고가 보입니다',
    empty: '재고 없음',
    loadFailed: '재고를 불러오지 못했습니다.',
    retry: '다시 시도',
    truncated: '재고 일부만 보입니다.',
  },

  locations: {
    code: '위치 코드',
    name: '이름',
    /** Location 목록의 「구분」과 같은 열 — 단계 이름, 서버가 만든 위치는 역할 이름. */
    level: '구분',
    placed: '도면',
    onMap: '찍음',
    notOnMap: '아직',
    /** 위치는 창고·Location 화면에서 등록한다. */
    emptyTitle: '위치가 없습니다',
    /** 위치가 없는 창고 — 이 화면은 위치를 만들지 않는다(FR-012). 받는 것은 등록하는 화면의 이름이다. */
    emptyGuide: (screenName: string): string => `${screenName} 화면에서 위치를 등록하세요.`,
    /** 고른 위치에 표식이 없다(FR-002). */
    notOnDrawing: '도면에 없음',
    /** 층 · 셀은 도면에 두지 않는다 — 고르면 그 위치가 든 랙(없으면 구역) 표식을 강조하고 이 말을 붙인다(2차 · FR-015). */
    insideOnDrawing: (locationCode: string): string => `도면에서 ${locationCode} 안`,
    includeInactive: '중지된 위치도 보기',
    /** ⚠ 목록에 없는 위치(중지 · 삭제)가 지도에 남아 있을 수 있다 — 그 표식의 이름. */
    unknown: (locationId: number): string => `위치 ${String(locationId)}`,
  },
} as const;
