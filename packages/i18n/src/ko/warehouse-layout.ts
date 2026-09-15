/**
 * W-CO-08 창고 배치도 — 도면 위에 위치를 찍어 둔다.
 *
 * ⭐ **좌표는 픽셀이 아니라 비율이다** — 도면을 갈아도 같은 상대 위치를 가리킨다.
 * ⭐ **저장은 도면과 점을 통째로 바꾼다** — 지도에서 뺀 위치는 지워진다.
 */
export const warehouseLayout = {
  title: '창고 배치도',
  breadcrumbRoot: '기준정보',

  panes: {
    map: '배치도',
    locations: '위치 목록',
  },

  warehouse: {
    select: '창고',
    selectPlaceholder: '창고를 고르세요',
    lookupFailed: '창고 목록을 불러오지 못해 지금은 고를 수 없습니다. 다시 시도해 주세요.',
    lookupTruncated: '목록의 일부만 보입니다. 찾는 것이 없으면 담당자에게 문의하세요.',
    emptyTitle: '창고를 고르세요',
    empty: '위에서 창고를 고르면 그 창고의 배치도가 보입니다.',
  },

  map: {
    imageLabel: '창고 도면',
    /** 도면이 아직 없다 — 점만 찍을 수는 있다. */
    noDrawing:
      '도면이 아직 없습니다. 도면 없이도 위치를 찍어 둘 수 있고, 나중에 도면을 올리면 찍어 둔 자리가 그대로 남습니다.',
    /** ⭐ 도면은 첨부로 따로 받는다 — 「없다」와 「아직 못 받았다」를 가른다. */
    drawingLoading: '도면을 불러오는 중입니다.',
    /** ⚠ 그림만 못 받은 것이다 — 점은 그대로 있다. */
    drawingLoadFailed:
      '도면을 불러오지 못했습니다. 찍어 둔 점은 그대로 있습니다 — 다시 불러오거나 새 도면을 올리세요.',
    drawingRetry: '도면 다시 불러오기',
    /** ⭐ 비율이라 도면을 갈아도 어긋나지 않는다. */
    ratioNote:
      '점의 자리는 도면 크기에 대한 비율로 저장됩니다 — 창을 줄이거나 도면을 갈아도 같은 자리를 가리킵니다.',
    /** ⭐ 빠진 위치는 지워진다. */
    replaceNote:
      '저장하면 이 배치도가 그대로 이 창고의 배치가 됩니다 — 지도에서 뺀 위치는 지워집니다.',
    place: '고른 위치를 도면에 찍기',
    placeHint: '왼쪽에서 위치를 고른 뒤 도면을 누르면 그 자리에 찍힙니다.',
    placeNeedsLocation: '먼저 목록에서 찍을 위치를 고르세요.',
    move: '표식을 끌어 옮기거나, 골라서 화살표로 밀 수 있습니다.',
    remove: '지도에서 빼기',
    removeNeedsMarker: '먼저 지도에서 뺄 표식을 고르세요.',
    save: '배치도 저장',
    saving: '저장하는 중입니다.',
    saved: '배치도를 저장했습니다.',
    reset: '되돌리기',
    loadFailed: '배치도를 불러오지 못했습니다.',
    lockLoading: '배치도를 불러오는 중입니다. 잠시 뒤 저장하세요.',
    lockFailed: '배치도를 불러오지 못해 저장할 수 없습니다. 다시 시도해 주세요.',
    upload: '도면 올리기',
    /** ⛔ 요청 전에 화면이 거른다 — 서버가 받는 것은 PNG·JPEG 뿐이다. */
    fileTypeRejected: 'PNG 또는 JPEG 파일만 올릴 수 있습니다. 다른 형식은 서버가 받지 않습니다.',
    fileTooLarge: '10MB 이하 파일만 올릴 수 있습니다.',
    /**
     * ⛔ 저장하지 않은 점 편집이 있으면 올리기를 막는다 — 바로 반영이라 그 점을 함께 보낼지
     * 버릴지가 사용자 모르게 갈린다.
     */
    uploadNeedsCleanDraft:
      '저장하지 않은 점 변경이 있습니다. 점 변경을 저장하거나 되돌린 뒤 도면을 올리세요.',
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
    overwriteDrawingNote:
      '다른 사용자가 올린 도면이 지금 보입니다. 누르면 그 도면 대신 내가 고른 도면이 저장됩니다.',
    /** ⚠ 도면을 갈면 점은 남지만 사람이 다시 봐야 한다. */
    replaceDrawingTitle: '도면을 바꿀까요?',
    replaceDrawingLead: (markerCount: number): string =>
      `찍어 둔 점 ${String(markerCount)}개는 비율로 저장돼 새 도면에서도 같은 상대 위치에 남습니다. 그래도 새 도면의 실제 자리와 맞는지는 사람이 다시 봐야 합니다.`,
    confirm: '진행',
    cancel: '취소',
  },

  locations: {
    code: '위치 코드',
    name: '이름',
    placed: '도면',
    onMap: '찍음',
    notOnMap: '아직',
    emptyTitle: '위치가 없습니다',
    empty: '이 창고에 등록된 위치가 없습니다. 창고·Location 화면에서 먼저 등록하세요.',
    loadFailed: '위치 목록을 불러오지 못했습니다.',
    includeInactive: '중지된 위치도 보기',
    /** ⚠ 목록에 없는 위치가 지도에 남아 있을 수 있다. */
    orphanNote:
      '이름을 찾지 못한 표식이 있습니다. 그 위치가 중지됐거나 지워졌을 수 있습니다 — 위치 코드로 보입니다.',
    unknown: (locationId: number): string => `위치 ${String(locationId)}`,
  },

  pageNav: {
    label: '쪽 이동',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / 전체 ${String(total)}건`,
    totalOnly: (total: number): string => `전체 ${String(total)}건`,
    prev: '이전',
    next: '다음',
  },
} as const;
