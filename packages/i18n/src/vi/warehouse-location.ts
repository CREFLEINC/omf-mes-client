import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-06-02 창고·Location. `Location` 은 계약·화면이 영어 그대로 쓰므로 옮기지 않는다.
 * 계층은 `phân cấp`, 발행 회차는 `lượt` 으로 한 벌로 맞춘다.
 */
export const warehouseLocation: Translated<typeof ko.warehouseLocation> = {
  title: 'Kho · Location',
  breadcrumbRoot: 'Dữ liệu gốc',
  tabs: {
    warehouse: 'Thông tin kho',
    location: 'Location',
  },
  actions: {
    addWarehouse: 'Thêm kho',
    addRootLocation: 'Thêm cấp trên cùng',
    addChildLocation: 'Thêm cấp dưới',
    generateLabel: 'Tạo ảnh nhãn',
    changeHistory: 'Lịch sử thay đổi',
    activate: 'Dùng lại',
  },
  actionReasons: {
    addChildNeedsSingleSelection: 'Thêm cấp dưới chỉ dùng được khi chọn đúng một Location.',
    locationsDisabledByManagementLevel: 'Mức quản lý là kho thì không đăng ký Location.',
    locationDepthLimitReached: 'Ở mức quản lý hiện tại không thêm được Location cấp dưới nữa.',
    locationHierarchyUnavailable: 'Tải xong phân cấp Location rồi mới thêm được.',
    generateLabelNeedsSelection: 'Hãy chọn ít nhất một Location để tạo ảnh nhãn.',
    changeHistoryUnavailable:
      'Lịch sử thay đổi hiện chưa xem được. Khi chức năng tra cứu sẵn sàng thì có thể dùng nút này.',
    plantFixedAfterCreate:
      'Sau khi đăng ký thì không đổi được nhà máy. Nếu là nhà máy khác thì hãy đăng ký kho mới.',
    warehouseFixedInLocation: 'Cố định theo kho đã chọn ở bên trái.',
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
    'Chỉ hiển thị một phần danh sách chọn. Không thấy giá trị cần tìm thì hãy báo người phụ trách.',
  optionsLoadFailed: 'Không tải được danh sách chọn. Chỉ hiển thị giá trị đang lưu.',
  empty: {
    warehouseNoneTitle: 'Chưa đăng ký kho nào',
    warehouseNoneDescription: 'Hãy đăng ký kho đầu tiên bằng «Thêm kho».',
    warehouseNoMatchTitle: 'Không có kết quả khớp điều kiện',
    warehouseNoMatchDescription: 'Hãy giảm bớt hoặc đặt lại điều kiện rồi tra cứu lại.',
    locationNoneTitle: 'Chưa đăng ký Location',
    locationNoneDescription: 'Hãy đăng ký Location đầu tiên bằng «Thêm cấp trên cùng».',
    locationNoMatchTitle: 'Không có Location khớp điều kiện',
    locationNoMatchDescription: 'Xóa từ khóa thì thấy lại toàn bộ phân cấp.',
    warehouseNotSelected: 'Hãy chọn kho ở bên trái trước',
  },
  filters: {
    searchLabel: 'Tìm kho',
    searchPlaceholder: 'Mã kho hoặc tên kho',
    locationSearchLabel: 'Tìm Location',
    locationSearchPlaceholder: 'Mã vị trí hoặc tên vị trí',
    typeAll: 'Tất cả loại',
    chipRemoveKeyword: 'Bỏ điều kiện từ khóa',
    chipRemoveType: 'Bỏ điều kiện loại kho',
    chipRemoveIncludeInactive: 'Bỏ điều kiện gồm cả mục ngừng dùng',
    chipKeyword: (value: string): string => `Từ khóa: ${value}`,
    chipType: (label: string): string => `Loại kho: ${label}`,
  },
  fields: {
    plant: 'Nhà máy',
    businessUnit: 'Đơn vị kinh doanh',
    warehouseCode: 'Mã kho',
    warehouseName: 'Tên kho',
    warehouseType: 'Loại kho',
    managementLevel: 'Mức quản lý',
    isExternal: 'Kho bên ngoài',
    partner: 'Đối tác',
    isDefect: 'Kho hàng lỗi',

    isActive: 'Sử dụng',
    warehouse: 'Kho',
    parentLocation: 'Vị trí cấp trên',
    locationCode: 'Mã vị trí',
    locationName: 'Tên vị trí',
    locationType: 'Loại vị trí',
    qualityZone: 'Khu vực chất lượng',
    storageCondition: 'Điều kiện bảo quản',
    allowMixedItem: 'Cho phép xếp lẫn mặt hàng',
    allowMixedLot: 'Cho phép xếp lẫn LOT',
    capacityQty: 'Sức chứa',
    capacityUom: 'Đơn vị sức chứa',
    code: 'Mã',
    name: 'Tên',
  },
  values: {
    active: 'Đang dùng',
    inactive: 'Ngừng dùng',
    noParent: 'Không có (cấp trên cùng)',
    currentParentOutsideList: 'Vị trí cấp trên hiện tại (ngoài danh sách tra cứu)',
    /** 미사용 항목을 선택지에 남길 때 라벨 뒤에 붙인다. */
    inactiveSuffix: ' (ngừng dùng)',
  },
  validation: {
    required: 'Đây là mục bắt buộc.',
    codeBlank: 'Mã không được chỉ gồm khoảng trắng.',
    codeDuplicated: 'Mã này đang được dùng. Hãy nhập mã khác.',
    partnerRequiredForExternal: 'Là kho bên ngoài thì phải chỉ định đối tác.',
    capacityNeedsUom: 'Sức chứa và đơn vị phải cùng nhập hoặc cùng để trống.',
    capacityInvalid: 'Hãy nhập sức chứa bằng số từ 0 trở lên.',
    locationsDisabledByManagementLevel: 'Ở mức quản lý kho hiện tại không lưu được Location.',
    parentLocationUnavailable:
      'Không xác nhận được vị trí cấp trên trong toàn bộ danh sách Location.',
    locationDepthExceeded: 'Đã vượt độ sâu phân cấp mà mức quản lý kho hiện tại cho phép.',
    locationHierarchyUnavailable: 'Tải xong phân cấp Location rồi mới đổi được mức quản lý.',
    managementLevelTooShallow:
      'Không đổi sang mức quản lý thấp hơn phân cấp Location hiện có được.',
  },
  locationTable: {
    expand: 'Mở cấp dưới',
    collapse: 'Thu cấp dưới',
    selectionLabel: 'Chọn Location',
  },
  dialog: {
    createTitle: 'Thêm Location',
    editTitle: 'Sửa Location',
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
