import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-CO-08 창고 배치도 — 도면 위에 위치를 찍어 둔다.
 *
 * ⭐ 좌표는 픽셀이 아니라 비율이라 도면을 갈아도 같은 상대 위치를 가리킨다.
 * ⭐ 저장은 도면과 점을 통째로 바꾼다 — 지도에서 뺀 위치는 지워진다.
 */
export const warehouseLayout: Translated<typeof ko.warehouseLayout> = {
  title: 'Sơ đồ bố trí kho',
  breadcrumbRoot: 'Dữ liệu gốc',

  panes: {
    map: 'Sơ đồ bố trí',
    locations: 'Danh sách vị trí',
  },

  warehouse: {
    select: 'Kho',
    selectPlaceholder: 'Hãy chọn kho',
    lookupFailed: 'Không tải được danh sách kho nên hiện chưa chọn được. Hãy thử lại.',
    lookupTruncated:
      'Chỉ hiển thị một phần danh sách. Không thấy mục cần tìm thì hãy hỏi người phụ trách.',
    emptyTitle: 'Hãy chọn kho',
    empty: 'Chọn kho ở phía trên thì sẽ thấy sơ đồ bố trí của kho đó.',
  },

  map: {
    imageLabel: 'Bản vẽ kho',
    /** 도면이 아직 없다 — 점만 찍을 수는 있다. */
    noDrawing:
      'Chưa có bản vẽ. Không có bản vẽ vẫn đánh dấu vị trí được, và khi tải bản vẽ lên sau thì các điểm đã đánh dấu vẫn giữ nguyên.',
    /** ⭐ 도면은 첨부로 따로 받는다 — 「없다」와 「아직 못 받았다」를 가른다. */
    drawingLoading: 'Đang tải bản vẽ.',
    /** ⚠ 그림만 못 받은 것이다 — 점은 그대로 있다. */
    drawingLoadFailed:
      'Không tải được bản vẽ. Các điểm đã đánh dấu vẫn còn nguyên — hãy tải lại hoặc tải bản vẽ mới lên.',
    drawingRetry: 'Tải lại bản vẽ',
    /** ⭐ 비율이라 도면을 갈아도 어긋나지 않는다. */
    ratioNote:
      'Chỗ của điểm đánh dấu được lưu theo tỷ lệ so với kích thước bản vẽ — thu nhỏ cửa sổ hay thay bản vẽ thì vẫn chỉ đúng chỗ đó.',
    /** ⭐ 빠진 위치는 지워진다. */
    replaceNote:
      'Lưu thì sơ đồ bố trí này thành bố trí của kho này — vị trí đã bỏ khỏi bản đồ sẽ bị xóa.',
    place: 'Đánh dấu vị trí đã chọn lên bản vẽ',
    placeHint: 'Chọn vị trí ở bên trái rồi bấm lên bản vẽ thì điểm đánh dấu hiện ở chỗ đó.',
    placeNeedsLocation: 'Hãy chọn vị trí cần đánh dấu trong danh sách trước.',
    move: 'Có thể kéo điểm đánh dấu để di chuyển, hoặc chọn rồi đẩy bằng phím mũi tên.',
    /**
     * ⭐ 잠긴 판이 **무엇을 막고 무엇은 허락하는지** 듣는 사람에게 전하는 말. 「사용 불가」로
     * 뭉뚱그리면 고르기까지 막힌 것으로 들린다 — 잠겨도 고르기는 된다.
     */
    boardLocked: 'Bây giờ không đánh dấu hay di chuyển điểm được. Vẫn chọn được.',
    /**
     * ⭐ 눈으로는 자리를 보지만 듣는 사람에게는 이 말이 자리 그 자체다 — 판 부품은 표현
     * 전용이라 말을 갖지 않으므로 화면이 넘겨 준다.
     */
    markerPosition: (xPercent: number, yPercent: number): string =>
      `Ngang ${String(xPercent)}%, dọc ${String(yPercent)}%`,
    /** 옮긴 뒤 한 번 읽어 주는 말 — 어느 표식이 어디로 갔는지. */
    markerMoved: (label: string, xPercent: number, yPercent: number): string =>
      `${label}: Ngang ${String(xPercent)}%, dọc ${String(yPercent)}%`,
    remove: 'Bỏ khỏi bản đồ',
    removeNeedsMarker: 'Hãy chọn điểm đánh dấu cần bỏ trên bản đồ trước.',
    save: 'Lưu sơ đồ bố trí',
    saving: 'Đang lưu.',
    saved: 'Đã lưu sơ đồ bố trí.',
    reset: 'Hoàn tác',
    loadFailed: 'Không tải được sơ đồ bố trí.',
    lockLoading: 'Đang tải sơ đồ bố trí. Hãy lưu sau giây lát.',
    lockFailed: 'Không tải được sơ đồ bố trí nên không lưu được. Hãy thử lại.',
    upload: 'Tải bản vẽ lên',
    /** ⛔ 요청 전에 화면이 거른다 — 서버가 받는 것은 PNG·JPEG 뿐이다. */
    fileTypeRejected: 'Chỉ tải lên được tệp PNG hoặc JPEG. Định dạng khác thì máy chủ không nhận.',
    fileTooLarge: 'Chỉ tải lên được tệp từ 10MB trở xuống.',
    /**
     * ⛔ 저장하지 않은 점 편집이 있으면 올리기를 막는다 — 바로 반영이라 그 점을 함께 보낼지
     * 버릴지가 사용자 모르게 갈린다.
     */
    uploadNeedsCleanDraft:
      'Có thay đổi điểm đánh dấu chưa lưu. Hãy lưu hoặc hoàn tác thay đổi đó rồi mới tải bản vẽ lên.',
    /** ⭐ 올리기와 저장은 이어지는 두 호출이다 — 지금 어느 쪽인지 글자로 말한다. */
    uploadingLabel: 'Đang tải lên…',
    savingDrawingLabel: 'Đang lưu bản vẽ…',
    drawingReplaced: 'Đã thay bản vẽ.',
    /** ⭐ 올리기는 끝났고 저장만 남았다 — 다시 올리면 고아 첨부가 하나 더 생긴다. */
    retrySaveDrawing: 'Thử lưu lại',
    /**
     * ⛔ **충돌로 멈춘 뒤의 그 버튼은 「다시 시도」가 아니다.** 재조회가 이미 남이 올린 도면을
     * 화면에 세워 두었으므로, 그대로 누르면 **지금 보이는 그 도면을 내 도면으로 덮는다** —
     * 하는 일이 다르니 말도 달라야 한다.
     */
    overwriteDrawing: 'Đổi sang bản vẽ của tôi',
    overwriteDrawingNote:
      'Bản vẽ người dùng khác tải lên đang hiển thị. Bấm vào thì bản vẽ tôi đã chọn sẽ được lưu thay cho bản vẽ đó.',
    /** ⚠ 도면을 갈면 점은 남지만 사람이 다시 봐야 한다. */
    replaceDrawingTitle: 'Thay bản vẽ?',
    replaceDrawingLead: (markerCount: number): string =>
      `${String(markerCount)} điểm đã đánh dấu được lưu theo tỷ lệ nên ở bản vẽ mới vẫn nằm đúng vị trí tương đối. Dù vậy vẫn cần người kiểm tra lại xem có khớp chỗ thật trên bản vẽ mới hay không.`,
    confirm: 'Tiến hành',
    cancel: 'Hủy',
  },

  locations: {
    code: 'Mã vị trí',
    name: 'Tên',
    placed: 'Bản vẽ',
    onMap: 'Đã đánh dấu',
    notOnMap: 'Chưa',
    emptyTitle: 'Không có vị trí',
    empty: 'Kho này chưa đăng ký vị trí nào. Hãy đăng ký trước ở màn hình Kho · Location.',
    loadFailed: 'Không tải được danh sách vị trí.',
    includeInactive: 'Xem cả vị trí đã ngừng',
    /** ⚠ 목록에 없는 위치가 지도에 남아 있을 수 있다. */
    orphanNote:
      'Có điểm đánh dấu không tìm được tên. Vị trí đó có thể đã ngừng hoặc đã bị xóa — hiển thị bằng mã vị trí.',
    unknown: (locationId: number): string => `Vị trí ${String(locationId)}`,
  },

  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)}`,
    totalOnly: (total: number): string => `Tổng ${String(total)}`,
    prev: 'Trước',
    next: 'Sau',
  },
};
