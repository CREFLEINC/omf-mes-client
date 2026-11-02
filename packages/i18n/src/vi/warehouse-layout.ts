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
  breadcrumbRoot: 'Quản lý dữ liệu gốc',

  splitter: 'Kéo để chỉnh độ rộng danh sách · sơ đồ',
  listCollapse: 'Thu gọn danh sách vị trí',
  listExpand: 'Mở danh sách vị trí',
  panes: {
    map: 'Sơ đồ bố trí',
    locations: 'Danh sách vị trí',
  },

  warehouse: {
    select: 'Kho',
    selectPlaceholder: 'Chọn kho',
    lookupFailed: 'Không tải được danh sách kho.',
    lookupTruncated: 'Chỉ hiển thị một phần danh sách.',
    emptyTitle: 'Hãy chọn kho',
  },

  map: {
    imageLabel: 'Bản vẽ kho',
    /** 도면이 아직 없다 — 점만 찍을 수는 있다. */
    noDrawing: 'Chưa có bản vẽ',
    /** ⭐ 도면은 첨부로 따로 받는다 — 「없다」와 「아직 못 받았다」를 가른다. */
    drawingLoading: 'Đang tải bản vẽ.',
    /** ⚠ 그림만 못 받은 것이다 — 점은 그대로 있다. */
    drawingLoadFailed: 'Không tải được bản vẽ.',
    drawingRetry: 'Tải lại bản vẽ',
    placeNeedsLocation: 'Hãy chọn vị trí cần đánh dấu.',
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
    shape: 'Kích thước · xoay điểm đánh dấu',
    width: 'Rộng (%)',
    height: 'Cao (%)',
    rotation: 'Xoay (°)',
    remove: 'Bỏ khỏi bản đồ',
    removeNeedsMarker: 'Hãy chọn điểm đánh dấu cần bỏ.',
    save: 'Lưu sơ đồ bố trí',
    saving: 'Đang lưu.',
    saved: 'Đã lưu sơ đồ bố trí.',
    reset: 'Hoàn tác',
    lockLoading: 'Đang tải sơ đồ bố trí.',
    lockFailed: 'Không tải được sơ đồ bố trí nên không lưu được.',
    upload: 'Tải bản vẽ lên',
    /** ⛔ 요청 전에 화면이 거른다 — 서버가 받는 것은 PNG·JPEG 뿐이다. */
    fileTypeRejected: 'Chỉ tải lên được tệp PNG hoặc JPEG.',
    fileTooLarge: 'Chỉ tải lên được tệp từ 10MB trở xuống.',
    /**
     * ⛔ 저장하지 않은 점 편집이 있으면 올리기를 막는다 — 바로 반영이라 그 점을 함께 보낼지
     * 버릴지가 사용자 모르게 갈린다.
     */
    uploadNeedsCleanDraft: 'Có thay đổi điểm đánh dấu chưa lưu.',
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
    /** ⚠ 도면을 갈면 점은 남지만 사람이 다시 봐야 한다. */
    replaceDrawingTitle: 'Thay bản vẽ?',
    confirm: 'Tiến hành',
    cancel: 'Hủy',
  },

  locations: {
    code: 'Mã vị trí',
    name: 'Tên',
    level: 'Phân loại',
    placed: 'Bản vẽ',
    onMap: 'Đã đánh dấu',
    notOnMap: 'Chưa',
    emptyTitle: 'Không có vị trí',
    includeInactive: 'Xem cả vị trí đã ngừng',
    unknown: (locationId: number): string => `Vị trí ${String(locationId)}`,
  },
};
