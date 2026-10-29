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
    printLabels: 'In nhãn hàng loạt',
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
    /** 서버가 만든 자리의 역할 이름 — 수정 창 머리에 단계 대신 보인다. */
    systemRoles: { PUTAWAY_STAGING: 'Chờ cất hàng', WAREHOUSE_WHOLE: 'Toàn kho' },
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
    collapseAll: 'Thu gọn tất cả',
    expandAll: 'Mở rộng tất cả',
    selectionLabel: 'Chọn Location',
  },
  dialog: {
    createTitle: 'Thêm Location',
    createZoneTitle: 'Thêm khu',
    createRackTitle: 'Thêm kệ',
    editRackTitle: 'Sửa kệ',
    editTitle: 'Sửa Location',
    /** 창 안의 묶음 제목 — 짧게. */
    sections: { basic: 'Thông tin cơ bản', layout: 'Bố trí tầng·ô' },
  },
  /** 위치 수정 창 안의 보관 품목(사용자 지시 2026-10-29) — 품목 무관 · 지정 품목만 둘 중 하나. 안내문 없이. */
  /** 정보 판에서 연필로 고치는 값(별칭). */
  factEdit: {
    start: (label: string): string => `Sửa ${label}`,
    done: (label: string): string => `Xong sửa ${label}`,
  },
  itemsSection: {
    title: 'Mặt hàng lưu trữ',
    anyItem: 'Mọi mặt hàng',
    listedOnly: 'Chỉ mặt hàng chỉ định',
    addItem: 'Thêm mặt hàng',
    remove: (itemCode: string): string => `Xóa ${itemCode}`,
    loading: 'Đang tải mặt hàng lưu trữ',
    loadFailed: 'Không tải được mặt hàng lưu trữ.',
    required: 'Hãy chọn ít nhất một mặt hàng.',
    /** 목록의 위치 코드 옆 표식. */
    restricted: 'Chỉ mặt hàng chỉ định',
  },
  /** 랙의 층 · 셀 설정 대화상자(사용자 지시 2026-10-29). */
  deleteLocation: {
    title: 'Xóa vị trí',
    /** 그 위치와 밑의 위치 수. */
    count: (count: number): string =>
      count > 1 ? `${String(count)} vị trí sẽ cùng bị xóa.` : '1 vị trí sẽ bị xóa.',
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
    alreadyIssued: (count: number): string => `${String(count)} mục đã được phát hành.`,
    reason: 'Lý do phát hành lại',
    confirm: 'Phát hành lại',
  },
  /** 라벨 일괄 출력(사용자 지시 2026-10-29) — 발행한 그림을 모아 보고 인쇄한다. */
  labelPreview: {
    title: 'In nhãn',
    seq: (issueSeq: number): string => `lượt ${String(issueSeq)}`,
    print: 'In',
  },
  /** 되돌리기 어려운 액션이라 확인을 한 단계 둔다. 무엇이 일어나는지 먼저 밝힌다. */
  deactivate: {
    title: 'Ngừng sử dụng?',
    description: 'Không xóa. Ngừng sử dụng thì không chọn được ở công việc mới.',
    confirm: 'Ngừng sử dụng',
    count: (count: number): string =>
      count > 1 ? `${String(count)} vị trí sẽ cùng ngừng sử dụng.` : '1 vị trí sẽ ngừng sử dụng.',
  },
  activate: {
    title: 'Dùng lại?',
    description: 'Dùng lại thì có thể chọn mục này ở công việc mới.',
    confirm: 'Dùng lại',
    count: (count: number): string =>
      count > 1 ? `${String(count)} vị trí sẽ cùng được dùng lại.` : '1 vị trí sẽ được dùng lại.',
  },
};
