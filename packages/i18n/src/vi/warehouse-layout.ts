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
    remove: 'Bỏ khỏi bản đồ',
    removeNeedsMarker: 'Hãy chọn điểm đánh dấu cần bỏ trên bản đồ trước.',
    save: 'Lưu sơ đồ bố trí',
    saving: 'Đang lưu.',
    saved: 'Đã lưu sơ đồ bố trí.',
    reset: 'Hoàn tác',
    loadFailed: 'Không tải được sơ đồ bố trí.',
    lockLoading: 'Đang tải sơ đồ bố trí. Hãy lưu sau giây lát.',
    lockFailed: 'Không tải được sơ đồ bố trí nên không lưu được. Hãy thử lại.',
    /** ⛔ 도면 교체는 이번에 열지 않는다. */
    uploadLocked:
      'Tải bản vẽ lên hiện chưa mở. Khi xác định gắn tệp đính kèm vào loại đối tượng nào thì sẽ mở.',
    upload: 'Tải bản vẽ lên',
    /** ⚠ 도면을 갈면 점은 남지만 사람이 다시 봐야 한다. */
    replaceDrawingTitle: 'Thay bản vẽ?',
    replaceDrawingLead:
      'Các điểm đã đánh dấu được lưu theo tỷ lệ nên ở bản vẽ mới vẫn nằm đúng vị trí tương đối. Dù vậy vẫn cần người kiểm tra lại xem có khớp chỗ thật trên bản vẽ mới hay không.',
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
