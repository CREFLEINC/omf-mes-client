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
    configureRack: 'Thiết lập tầng·ô',
    generateLabel: 'Tạo ảnh nhãn',
    activate: 'Dùng lại',
  },
  actionReasons: {
    locationHierarchyUnavailable: 'Tải xong phân cấp Location rồi mới thêm được.',
    generateLabelNeedsSelection: 'Hãy chọn ít nhất một Location.',
    warehouseFixedInLocation: 'Cố định theo kho đã chọn ở bên trái.',
    systemLocation: 'Vị trí do hệ thống tạo, chỉ có thể đổi tên gọi khác.',
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
    locationNoneDescription: 'Hãy thêm Location cấp trên cùng.',
    locationNoMatchTitle: 'Không có Location khớp điều kiện',
    locationNoMatchDescription: 'Xóa từ khóa thì thấy lại toàn bộ phân cấp.',
    warehouseNotSelectedTitle: 'Thông tin kho',
    warehouseNotSelectedDescription: 'Hãy chọn kho trước',
  },
  filters: {
    searchLabel: 'Tìm kho',
    searchPlaceholder: 'Mã kho hoặc tên kho',
    locationSearchLabel: 'Tìm Location',
    locationSearchPlaceholder: 'Mã vị trí hoặc tên vị trí',
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
    locationName: 'Tên vị trí',
    locationLevel: 'Cấp',
    aliasName: 'Tên gọi khác',
    locationType: 'Loại vị trí',
    qualityZone: 'Khu vực chất lượng',
    storageCondition: 'Điều kiện bảo quản',
    allowMixedItem: 'Cho phép xếp lẫn mặt hàng',
    allowMixedLot: 'Cho phép xếp lẫn LOT',
    capacityQty: 'Sức chứa',
    capacityUom: 'Đơn vị sức chứa',
  },
  values: {
    active: 'Đang dùng',
    inactive: 'Ngừng dùng',
    noParent: 'Không có (cấp trên cùng)',
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
    capacityNeedsUom: 'Sức chứa và đơn vị phải cùng nhập hoặc cùng để trống.',
    capacityInvalid: 'Hãy nhập sức chứa bằng số từ 0 trở lên.',
    aliasTooLong: (max: number): string => `Tên gọi khác tối đa ${String(max)} ký tự.`,
    parentLocationUnavailable:
      'Không xác nhận được vị trí cấp trên trong toàn bộ danh sách Location.',
    locationDepthExceeded: 'Không thể đặt Location dưới ô (khu › giá › tầng › ô).',
    locationLevelChanged: 'Chỉ có thể chuyển sang cấp trên khác cùng cấp.',
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
    editTitle: 'Sửa Location',
  },
  /** 랙의 층 · 셀 설정 대화상자(사용자 지시 2026-10-29). */
  rackLayout: {
    title: 'Thiết lập tầng·ô',
    target: (code: string, name: string): string => `Kệ ${code} · ${name}`,
    levelCount: 'Số tầng',
    cellCount: 'Số ô mỗi tầng',
    countInvalid: (max: number): string => `Nhập số từ 1 đến ${String(max)}.`,
    cannotShrink: (count: number): string =>
      `Đã có ${String(count)} tầng. Để giảm, hãy ngừng dùng tầng.`,
    summary: (levels: number, cells: number): string =>
      `Sẽ tạo mới ${String(levels)} tầng · ${String(cells)} ô.`,
    nothingToCreate: 'Không có vị trí nào cần tạo mới.',
    previewLabel: 'Vị trí sẽ tạo mới',
    more: (count: number): string => `và ${String(count)} mục khác`,
    shrinkNote: 'Giữ nguyên tầng·ô đã có. Không giảm tầng có nhiều ô hơn.',
    submit: 'Tạo',
    saving: (done: number, total: number): string => `Đang tạo ${String(done)}/${String(total)}`,
    created: (count: number): string => `Đã tạo ${String(count)} vị trí.`,
    stopped: (done: number, reason: string): string =>
      `Đã dừng sau khi tạo ${String(done)} mục. ${reason} Nhấn Tạo lại để chỉ tạo phần còn lại.`,
  },
  labelPreview: {
    title: 'Xem trước nhãn Location',
    notice: (count: number): string =>
      `Đã tạo ${String(count)} bản ghi phát hành. Hãy xem ảnh do máy chủ tạo rồi tải về. Màn hình này không in vật lý.`,
    alt: (locationCode: string, issueSeq: number): string =>
      `Nhãn Location ${locationCode} lượt ${String(issueSeq)}`,
    /** 그림 아래 설명. 보이는 글자라 `alt`와 따로 둔다 — 둘은 같은 값이 아니다. */
    caption: (locationCode: string, issueSeq: number): string =>
      `${locationCode} · lượt ${String(issueSeq)}`,
    download: 'Tải ảnh về',
    loadFailed: 'Không tải được ảnh nhãn.',
    loadSummary: (success: number, failed: number, pending: number): string =>
      `Ảnh thành công ${String(success)} · thất bại ${String(failed)} · đang tải ${String(pending)}`,
    created: (count: number): string => `Đã tạo ${String(count)} nhãn Location.`,
  },
  labelIssue: {
    title: 'Tạo lại nhãn Location',
    notice: (count: number): string =>
      `Trong các Location đã chọn có ${String(count)} mục đã từng phát hành. Hãy chọn lý do tạo lượt mới.`,
    reason: 'Lý do phát hành lại',
    confirm: 'Tạo lượt mới',
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
