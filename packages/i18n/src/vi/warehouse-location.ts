import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-06-02 창고·Location. `Location` 은 계약·화면이 영어 그대로 쓰므로 옮기지 않는다.
 * 계층은 `phân cấp`, 발행 회차는 `lượt` 으로 한 벌로 맞춘다.
 */
export const warehouseLocation: Translated<typeof ko.warehouseLocation> = {
  title: 'Kho · Location',
  breadcrumbRoot: 'Quản lý dữ liệu gốc',
  splitter: 'Kéo để chỉnh độ rộng danh sách · chi tiết',
  listCollapse: 'Thu gọn danh sách kho',
  listExpand: 'Mở danh sách kho',
  panes: {
    filters: 'Điều kiện tra cứu kho',
    list: 'Danh sách kho',
    detail: 'Chi tiết kho',
  },
  tabs: {
    warehouse: 'Thông tin kho',
    location: 'Location',
    putaway: 'Quy tắc cất hàng',
  },
  actions: {
    addWarehouse: 'Thêm kho',
    addZone: 'Thêm khu',
    addRack: 'Thêm kệ',
    activate: 'Dùng lại',
  },
  actionReasons: {
    locationHierarchyUnavailable: 'Tải xong phân cấp Location rồi mới thêm được.',
  },
  loading: {
    warehouses: 'Đang tải danh sách kho',
    warehouseDetail: 'Đang tải thông tin kho',
    locations: 'Đang tải Location',
    locationDetail: 'Đang tải thông tin Location mới nhất.',
  },
  /** 서버가 목록을 잘라 내려보냈을 때. 잘림을 감추지 않고 조건을 좁힐 방법을 함께 알린다. */
  listTruncated: (shown: number, total: number): string =>
    `Hiển thị ${shown} trong tổng số ${total}. Hãy thu hẹp điều kiện rồi tra cứu.`,
  optionsTruncated:
    'Có thể chỉ hiển thị một phần các mục có thể chọn. Nếu không thấy mục cần tìm, hãy liên hệ người phụ trách.',
  optionsLoadFailed: 'Không tải được danh sách chọn. Chỉ hiển thị giá trị đang lưu.',
  empty: {
    warehouseNoneTitle: 'Chưa đăng ký kho nào',
    warehouseNoMatchTitle: 'Không có kết quả khớp điều kiện',
    locationNoneTitle: 'Chưa đăng ký Location',
    locationNoneDescription: 'Hãy thêm khu.',
    locationNoMatchTitle: 'Không có Location khớp điều kiện',
    locationNoMatchDescription: 'Xóa từ khóa thì thấy lại toàn bộ phân cấp.',
    warehouseNotSelectedTitle: 'Thông tin kho',
    warehouseNotSelectedDescription: 'Hãy chọn kho trước',
  },
  filters: {
    searchLabel: 'Tìm kho',
    searchPlaceholder: 'Mã kho hoặc tên kho',
    locationSearchLabel: 'Tìm Location',
    locationSearchPlaceholder: 'Mã vị trí hoặc tên gọi khác',
    plantAll: 'Tất cả nhà máy',
    typeAll: 'Tất cả loại',
  },
  fields: {
    plant: 'Nhà máy',
    businessUnit: 'Đơn vị kinh doanh',
    warehouseCode: 'Mã kho',
    warehouseName: 'Tên kho',
    warehouseType: 'Loại kho',
    isExternal: 'Kho bên ngoài',
    isDefect: 'Kho hàng lỗi',

    isActive: 'Trạng thái sử dụng',
    warehouse: 'Kho',
    parentLocation: 'Vị trí cấp trên',
    locationCode: 'Mã vị trí',
    locationLevel: 'Cấp',
    aliasName: 'Tên gọi khác',
    allowMixedItem: 'Cho phép xếp lẫn mặt hàng',
    allowMixedLot: 'Cho phép xếp lẫn LOT',
  },
  values: {
    active: 'Đang dùng',
    inactive: 'Ngừng dùng',
    currentParentOutsideList: 'Vị trí cấp trên hiện tại (ngoài danh sách tra cứu)',
    /** 미사용 항목을 선택지에 남길 때 라벨 뒤에 붙인다. */
    inactiveSuffix: ' (ngừng dùng)',
    /** 위치 단계(서버 `locationLevelCode`) — 창고 › 구역 › 랙 › 층 › 셀. */
    locationLevels: { ZONE: 'Khu', RACK: 'Kệ', LEVEL: 'Tầng', CELL: 'Ô' },
  },
  validation: {
    required: 'Đây là mục bắt buộc.',
    codeBlank: 'Mã không được chỉ gồm khoảng trắng.',
    codeDuplicated: 'Mã này đang được dùng. Hãy nhập mã khác.',
    aliasTooLong: (max: number): string => `Tên gọi khác tối đa ${String(max)} ký tự.`,
  },
  locationTable: {
    expand: 'Mở cấp dưới',
    collapse: 'Thu cấp dưới',
    selectionLabel: 'Chọn Location',
  },
  dialog: {
    createTitle: 'Thêm Location',
    createZoneTitle: 'Thêm khu',
    createRackTitle: 'Thêm kệ',
    editRackTitle: 'Sửa kệ',
    editTitle: 'Sửa Location',
  },
  /** 랙의 층 · 셀 설정 대화상자(사용자 지시 2026-10-29). */
  deleteLocation: {
    title: 'Xóa vị trí',
    description: (code: string): string => `Xóa ${code} và tất cả vị trí bên dưới?`,
    confirm: 'Xóa',
    deleted: 'Đã xóa',
  },
  rackLayout: {
    levelCount: 'Hàng (số tầng)',
    cellCount: 'Cột (số ô mỗi tầng)',
    countInvalid: (min: number, max: number): string =>
      `Nhập số từ ${String(min)} đến ${String(max)}.`,
    previewLabel: 'Bố trí tầng·ô',
    levelHeader: 'Tầng',
    rowHeader: (levelNo: number): string => `Tầng ${String(levelNo)}`,
    columnHeader: (cellNo: number): string => `Cột ${String(cellNo)}`,
    saving: (done: number, total: number): string => `Đang tạo ${String(done)}/${String(total)}`,
    stopped: (done: number, reason: string): string =>
      `Đã dừng sau khi tạo ${String(done)} mục. ${reason} Lưu lại để chỉ tạo phần còn lại.`,
  },
  /** 위치 수정 창 안의 라벨(사용자 지시 2026-10-29) — 안내문 없이 그림과 단추만. */
  labelSection: {
    title: 'Nhãn',
    loading: 'Đang tải nhãn',
    listFailed: 'Không tải được nhãn.',
    imageFailed: 'Không tải được ảnh nhãn.',
    alt: (locationCode: string, issueSeq: number): string =>
      `Nhãn ${locationCode} lượt ${String(issueSeq)}`,
    issue: 'Phát hành nhãn',
    reissue: 'Phát hành lại',
    download: 'Tải ảnh về',
    issued: 'Đã phát hành nhãn.',
  },
  labelIssue: {
    title: 'Phát hành lại nhãn',
    reason: 'Lý do phát hành lại',
    confirm: 'Phát hành lại',
  },
  /** 되돌리기 어려운 액션이라 확인을 한 단계 둔다. 무엇이 일어나는지 먼저 밝힌다. */
  deactivate: {
    title: 'Ngừng sử dụng?',
    description: 'Không xóa. Ngừng sử dụng thì không chọn được ở công việc mới.',
    confirm: 'Ngừng sử dụng',
  },
  activate: {
    title: 'Dùng lại?',
    description: 'Dùng lại thì có thể chọn mục này ở công việc mới.',
    confirm: 'Dùng lại',
  },
};
