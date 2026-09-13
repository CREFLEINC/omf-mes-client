import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-05-12 설비·설비그룹 마스터. 화면이 부르는 말은 「설비 그룹」(`nhóm thiết bị`)이고,
 * 저장처 이름(`productionLineId`)은 옮기지 않는다.
 */
export const equipmentMaster: Translated<typeof ko.equipmentMaster> = {
  title: 'Dữ liệu gốc thiết bị · nhóm thiết bị',
  breadcrumbRoot: 'Thiết bị / Công cụ',
  actions: {
    addGroup: 'Thêm nhóm',
    addEquipment: 'Thêm thiết bị',
    disposeEquipment: 'Xử lý thanh lý',
    keepEditing: 'Tiếp tục sửa',
    discardChanges: 'Bỏ thay đổi',
  },
  actionReasons: {
    plantFixedAfterCreate:
      'Sau khi đăng ký không đổi được nhà máy. Nếu là nhà máy khác, hãy đăng ký nhóm mới.',
    parentExcludesSelfAndDescendants:
      'Không chọn được chính nó và nhóm con làm nhóm cha. Sẽ sinh ra vòng lặp.',
    calibrationCycleOwnedElsewhere:
      'Chu kỳ hiệu chuẩn được đặt ở dữ liệu gốc thiết bị đo. Ở đây chỉ xem được.',
    calibrationNeedsCycle:
      'Chưa có chu kỳ hiệu chuẩn nên không bật được. Hãy đặt chu kỳ ở dữ liệu gốc thiết bị đo trước.',
    calibrationDatesReadOnly:
      'Ngày hiệu chuẩn được đặt khi đăng ký lịch sử hiệu chuẩn. Ở đây chỉ xem được.',
    /** 폐기(`thanh lý`)와 사용 중지(`ngừng sử dụng`)가 다른 축이라는 말을 그대로 옮긴다. */
    statusNotEditableHere:
      'Trạng thái vận hành chỉ đổi bằng thanh lý. Đây là trục khác với ngừng sử dụng.',
    codeLockUnknown: 'Chưa tải được thông tin thiết bị nên không đổi được mã.',
    equipmentPlantFixed: 'Nhà máy của thiết bị theo nhà máy của nhóm trực thuộc.',
    disposeUnavailable:
      'Chưa tải được danh sách giá trị trạng thái tài sản nên không dùng được thanh lý. Khi danh sách sẵn sàng thì dùng được nút này.',
    deactivateNeedsCleanForm:
      'Còn thay đổi chưa lưu thì không dùng được ngừng sử dụng. Hãy lưu hoặc hủy trước.',
  },
  loading: {
    groups: 'Đang tải nhóm thiết bị',
    groupDetail: 'Đang tải thông tin nhóm thiết bị',
    equipments: 'Đang tải danh sách thiết bị',
  },
  listTruncated: (shown: number, total: number): string =>
    `Hiển thị ${shown} trong tổng ${total} mục. Hãy thu hẹp điều kiện rồi tra cứu.`,
  equipmentListTruncated: (shown: number, total: number): string =>
    `Hiển thị ${shown} trong tổng ${total} thiết bị. Hãy thu hẹp điều kiện rồi tra cứu.`,
  optionsTruncated:
    'Danh sách lựa chọn chỉ hiển thị một phần. Không thấy giá trị cần tìm thì hãy báo người phụ trách.',
  optionsLoadFailed: 'Không tải được danh sách lựa chọn. Chỉ hiển thị giá trị đang lưu.',
  empty: {
    groupNoneTitle: 'Chưa có nhóm thiết bị nào được đăng ký',
    groupNoneDescription:
      'Phải đăng ký nhóm thiết bị trước thì mới đặt được thiết bị vào dưới nhóm.',
    groupNoMatchTitle: 'Không có kết quả khớp điều kiện',
    groupNoMatchDescription: 'Hãy bớt điều kiện hoặc đặt lại rồi tra cứu lại.',
    groupNotSelected: 'Hãy chọn nhóm thiết bị ở bên trái trước',
    equipmentNoneTitle: 'Nhóm này chưa có thiết bị nào được đăng ký',
    equipmentNoneDescription: 'Đăng ký thiết bị thì thiết bị sẽ hiện dưới nhóm này.',
    equipmentNoMatchTitle: 'Không có thiết bị khớp điều kiện',
    equipmentNoMatchDescription: 'Hãy bớt điều kiện hoặc đặt lại rồi tra cứu lại.',
  },
  views: {
    assets: 'Thiết bị · nhóm thiết bị',
  },
  panes: {
    groupList: 'Danh sách nhóm thiết bị',
    groupDetail: 'Chi tiết nhóm thiết bị',
  },
  tabs: {
    group: 'Thông tin nhóm',
    equipment: 'Thiết bị',
    /** 부여(`gán`) 탭이다 — 마스터(`dữ liệu gốc`)는 화면 수준 탭이 따로 갖는다. */
    inspection: 'Gán hạng mục kiểm tra định kỳ',
  },
  dialog: {
    discardTitle: 'Bỏ nội dung đã nhập?',
  },
  dispose: {
    title: 'Xử lý thanh lý?',
    target: (label: string): string => `Thanh lý ${label}.`,
    impact:
      'Đây là xử lý khác với ngừng sử dụng. Ngừng sử dụng là ẩn khỏi danh sách, còn thanh lý là tài sản đã kết thúc.',
    notReversible: 'Không thể hoàn tác. Sau khi thanh lý thì tải lại cũng không mở được chỉnh sửa.',
    confirm: 'Xử lý thanh lý',
  },
  deactivate: {
    title: 'Ngừng sử dụng?',
    equipmentTitle: 'Ngừng sử dụng thiết bị?',
    equipmentImpact:
      'Bản ghi thiết bị này để lại vẫn còn nguyên, chỉ khi chọn mới thì thiết bị mới không còn trong danh sách.',
    target: (label: string): string => `Ngừng sử dụng ${label}.`,
    membersNone: 'Nhóm này không có thiết bị trực thuộc.',
    members: (count: number): string =>
      `Nhóm này có ${count} thiết bị trực thuộc. Trực thuộc vẫn giữ nguyên, chỉ khi chọn mới thì nhóm này mới không còn trong danh sách.`,
    notReversibleHere:
      'Không xóa. Nhưng màn hình này không có cách bật lại, muốn hoàn tác thì phải nhờ người phụ trách.',
    confirm: 'Ngừng sử dụng',
  },
  form: {
    createTitle: 'Đăng ký nhóm thiết bị',
    editTitle: 'Thông tin nhóm thiết bị',
    parentNone: 'Không có (cấp cao nhất)',
  },
  equipmentForm: {
    createTitle: 'Đăng ký thiết bị',
    editTitle: 'Sửa thiết bị',
    groupNone: 'Không thuộc nhóm',
    processNone: 'Không chỉ định',
  },
  validation: {
    required: 'Đây là mục bắt buộc nhập.',
    codeBlank: 'Không đặt được mã chỉ gồm khoảng trắng.',
    parentCycle: 'Chọn nhóm này làm nhóm cha sẽ sinh ra vòng lặp. Hãy chọn nhóm khác.',
    equipmentGroupRequired: 'Hãy chọn ở bên trái nhóm để đăng ký thiết bị trước.',
  },
  equipmentFilters: {
    searchLabel: 'Tìm thiết bị',
    includeDisposed: 'Gồm cả mục đã thanh lý',
    chipRemoveIncludeDisposed: 'Bỏ điều kiện gồm cả mục đã thanh lý',
    searchPlaceholder: 'Mã thiết bị hoặc tên thiết bị',
    typeAll: 'Tất cả loại',
    calibrationRequiredOnly: 'Chỉ đối tượng hiệu chuẩn',
    chipRemoveKeyword: 'Bỏ điều kiện từ khóa',
    chipRemoveType: 'Bỏ điều kiện loại thiết bị',
    chipRemoveCalibration: 'Bỏ điều kiện đối tượng hiệu chuẩn',
    chipRemoveIncludeInactive: 'Bỏ điều kiện gồm cả mục ngừng dùng',
    chipKeyword: (value: string): string => `Từ khóa: ${value}`,
    chipType: (label: string): string => `Loại thiết bị: ${label}`,
  },
  filters: {
    searchLabel: 'Tìm nhóm thiết bị',
    searchPlaceholder: 'Mã nhóm hoặc tên nhóm',
    plantAll: 'Tất cả nhà máy',
    chipRemoveKeyword: 'Bỏ điều kiện từ khóa',
    chipRemovePlant: 'Bỏ điều kiện nhà máy',
    chipRemoveIncludeInactive: 'Bỏ điều kiện gồm cả mục ngừng dùng',
    chipKeyword: (value: string): string => `Từ khóa: ${value}`,
    chipPlant: (label: string): string => `Nhà máy: ${label}`,
  },
  fields: {
    plant: 'Nhà máy',
    hierarchy: 'Vị trí thiết bị',
    process: 'Công đoạn trực thuộc',
    lastCalibrationDate: 'Ngày hiệu chuẩn gần nhất',
    calibrationDueDate: 'Ngày hiệu chuẩn dự kiến kế tiếp',
    calibrationCycle: 'Chu kỳ hiệu chuẩn',
    /** 선택칸의 «Không chỉ định» 과 글자가 겹치면 안 된다 — 값 없음이 아니라 기록 없음이다. */
    notRecorded: 'Không có ghi nhận',
    equipmentCode: 'Mã thiết bị',
    equipmentName: 'Tên thiết bị',
    equipmentType: 'Loại thiết bị',
    status: 'Trạng thái vận hành',
    calibrationRequired: 'Đối tượng hiệu chuẩn',
    groupCode: 'Mã nhóm',
    groupName: 'Tên nhóm',
    groupType: 'Loại nhóm',
    parentGroup: 'Nhóm cha',
    isActive: 'Sử dụng',
  },
  /** 계약이 닫은 두 값. 라인은 생산 라인이라 `chuyền sản xuất`, 작업구역은 `khu vực làm việc`. */
  groupTypes: {
    LINE: 'Chuyền sản xuất',
    WORK_AREA: 'Khu vực làm việc',
  },
  values: {
    active: 'Đang sử dụng',
    inactive: 'Ngừng dùng',
    noParent: 'Không có (cấp cao nhất)',
    inactiveSuffix: ' (ngừng dùng)',
    parentCycleSuffix: ' (vòng lặp — hãy chọn giá trị khác)',
    parentUnresolved: (value: string): string => `Số hiệu ${value} (chưa xác nhận được tên)`,
    calibrationYes: 'Đối tượng',
    calibrationNo: 'Không phải đối tượng',
    calibrationCycle: (interval: number, unitLabel: string): string => `${interval} ${unitLabel}`,
    noGroupAssigned: 'Không có nhóm trực thuộc',
  },
  groupTable: {
    expand: 'Mở rộng nhóm con',
    collapse: 'Thu gọn nhóm con',
  },
  inspection: {
    paneTitle: 'Hạng mục kiểm tra định kỳ',
    description:
      'Đây là hạng mục kiểm tra định kỳ mà thiết bị thuộc nhóm này thực hiện. Nếu gán riêng cho thiết bị thì bên đó thắng.',
    loading: 'Đang tải hạng mục kiểm tra định kỳ',
    emptyTitle: 'Chưa gán hạng mục kiểm tra định kỳ nào',
    emptyDescription:
      'Gán hạng mục kiểm tra định kỳ thì thiết bị của nhóm này sẽ thực hiện hạng mục đó.',
    editAction: 'Gán hạng mục kiểm tra định kỳ',
    dialogTitle: 'Gán hạng mục kiểm tra định kỳ',
    dialogLead: 'Những gì còn lại trong cửa sổ này sẽ là tất cả — dòng đã xóa thì gán được gỡ.',
    addLabel: 'Thêm hạng mục',
    addPlaceholder: 'Hãy chọn hạng mục kiểm tra định kỳ để gán',
    allAssigned: 'Đã gán hết hạng mục kiểm tra định kỳ của dữ liệu gốc.',
    /** 「어디서 만드나」를 같은 화면의 탭 이름으로 짚는다 — 탭 이름과 글자를 맞춘다. */
    masterEmpty:
      'Không có hạng mục kiểm tra định kỳ nào được đăng ký. Hãy tạo hạng mục ở tab «Hạng mục kiểm tra định kỳ» phía trên rồi gán.',
    masterLoadFailed: 'Không tải được danh sách hạng mục kiểm tra định kỳ.',
    removeAction: 'Gỡ gán',
    removeLabel: (itemName: string): string => `Gỡ gán ${itemName}`,
    fields: {
      plant: 'Nhà máy',
      itemCode: 'Mã hạng mục',
      itemName: 'Tên hạng mục',
      inspectionType: 'Loại kiểm tra định kỳ',
      cycle: 'Chu kỳ',
      cycleType: 'Đơn vị chu kỳ',
      cycleInterval: 'Khoảng chu kỳ',
      cycleBaseDate: 'Ngày cơ sở',
      activation: 'Sử dụng',
    },
    /** 베트남어는 수를 뒤에 두지 못한다 — `Mỗi 3 ngày` 처럼 앞에 «Mỗi» 를 세운다. */
    cycleText: (interval: number, unitLabel: string): string =>
      `Mỗi ${String(interval)} ${unitLabel}`,
    baseDateNote: 'Để trống thì ngày gán trở thành ngày cơ sở.',
    validation: {
      required: 'Mục bắt buộc.',
      intervalPositive: 'Khoảng chu kỳ phải là số nguyên từ 1 trở lên.',
    },
    needsGroupReason: 'Chọn nhóm thì gán được hạng mục kiểm tra định kỳ.',
    resolution: {
      label: 'Căn cứ áp dụng',
      equipment: 'Đây là hạng mục gán trực tiếp cho thiết bị này.',
      group: (groupLabel: string): string => `Áp dụng hạng mục của nhóm trực thuộc ${groupLabel}.`,
      groupUnknown: 'Áp dụng hạng mục của nhóm trực thuộc.',
      none: 'Thiết bị này không phải đối tượng kiểm tra định kỳ. Không có hạng mục nào được gán cho thiết bị hoặc nhóm trực thuộc.',
    },
    equipmentPaneTitle: 'Hạng mục kiểm tra định kỳ',
    equipmentDescription: 'Đây là hạng mục kiểm tra định kỳ mà thiết bị này thực hiện.',
    equipmentEditAction: 'Gán cho thiết bị này',
    equipmentOpenLabel: (equipmentCode: string): string =>
      `Gán hạng mục kiểm tra định kỳ của ${equipmentCode}`,
    equipmentDialogTitle: 'Gán hạng mục kiểm tra định kỳ của thiết bị',
    equipmentDialogLead:
      'Hạng mục gán cho thiết bị này thắng hạng mục của nhóm trực thuộc. Xóa hết thì hạng mục của nhóm trực thuộc lại được áp dụng.',
  },
  inspectionItem: {
    tabLabel: 'Hạng mục kiểm tra định kỳ',
    paneTitle: 'Dữ liệu gốc hạng mục kiểm tra định kỳ',
    description: 'Tạo tại đây hạng mục kiểm tra định kỳ để gán cho thiết bị và nhóm thiết bị.',
    loading: 'Đang tải hạng mục kiểm tra định kỳ',
    emptyTitle: 'Không có hạng mục kiểm tra định kỳ nào được đăng ký',
    emptyDescription: 'Tạo hạng mục kiểm tra định kỳ thì gán được cho thiết bị · nhóm thiết bị.',
    noMatchTitle: 'Không có hạng mục kiểm tra định kỳ khớp điều kiện',
    noMatchDescription: 'Hãy bớt điều kiện hoặc đặt lại rồi xem lại.',
    addAction: 'Thêm hạng mục kiểm tra định kỳ',
    createTitle: 'Đăng ký hạng mục kiểm tra định kỳ',
    editTitle: 'Sửa hạng mục kiểm tra định kỳ',
    searchLabel: 'Tìm hạng mục kiểm tra định kỳ',
    searchPlaceholder: 'Mã hạng mục hoặc tên hạng mục',
    typeAll: 'Tất cả loại',
    openLabel: (itemCode: string, itemName: string): string => `Sửa ${itemCode} ${itemName}`,
    fields: {
      plant: 'Nhà máy',
      itemCode: 'Mã hạng mục',
      itemName: 'Tên hạng mục',
      inspectionType: 'Loại kiểm tra định kỳ',
      judgmentMethod: 'Cách đánh giá',
      uom: 'Đơn vị đo',
      lowerLimit: 'Giới hạn dưới',
      upperLimit: 'Giới hạn trên',
      requiredFlag: 'Bắt buộc hay không',
      inspectionPoint: 'Vị trí kiểm tra định kỳ',
      sequenceNo: 'Thứ tự hiển thị',
      isActive: 'Sử dụng',
    },
    placeholders: {
      plant: 'Hãy chọn nhà máy',
      inspectionType: 'Hãy chọn loại kiểm tra định kỳ',
      judgmentMethod: 'Hãy chọn cách đánh giá',
      uom: 'Hãy chọn đơn vị',
    },
    measurementNote: 'Nếu cách đánh giá là «giá trị đo» thì cần cả đơn vị và giới hạn trên · dưới.',
    plantFixed: 'Nhà máy được định khi đăng ký và không thể chuyển ở màn hình này.',
    assignmentCount: (count: number): string =>
      count === 0
        ? 'Chưa được gán ở đâu cả.'
        : `Đã được gán tại ${count} thiết bị · nhóm thiết bị.`,
    inactiveNote: 'Tắt sử dụng thì không gán mới được. Những nơi đã gán vẫn giữ nguyên.',
    validation: {
      required: 'Mục bắt buộc.',
      mustBeNumber: 'Hãy nhập bằng số.',
      sequencePositive: 'Thứ tự hiển thị phải là số nguyên từ 1 trở lên.',
      limitOrder: 'Giới hạn trên phải lớn hơn hoặc bằng giới hạn dưới.',
    },
    values: {
      requiredYes: 'Bắt buộc',
      requiredNo: 'Tùy chọn',
    },
  },
};
