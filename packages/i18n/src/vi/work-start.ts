import type { ko } from '../ko';
import { named } from '../named';
import type { Translated } from './translated';

/** P-02-01 작업 지시 목록. */
export const workStart: Translated<typeof ko.workStart> = {
  title: 'Danh sách lệnh sản xuất',

  worker: {
    title: 'Người làm',
    fieldLabel: 'Mã nhân viên',
    keypadLabel: 'Bàn phím số nhập mã nhân viên',
    backspace: 'Xóa một ký tự',
    clear: 'Xóa hết',
    confirm: 'Xác nhận',
    cancel: 'Hủy',
    checking: 'Đang kiểm tra',
    empty: 'Chưa nhập mã nhân viên.',
    open: 'Nhập mã nhân viên',
    dialogTitle: 'Nhập mã nhân viên',

    unknown: 'Mã nhân viên chưa được đăng ký ở nhà máy này. Hãy nhập lại mã nhân viên.',
    inactive: 'Mã nhân viên này không còn làm việc. Hãy nhập lại mã nhân viên.',
    lookupFailed: 'Không xác nhận được mã nhân viên. Hãy thử lại.',
    retry: 'Thử lại',
  },

  coWorkers: {
    title: 'Người làm',
    count: (count: number, max: number): string => `${String(count)}/${String(max)}`,
    main: 'Chính',
    sub: 'Phụ',
    name: (workerName: string, workerNo: string): string => named(workerName, workerNo),
    add: '+ Người phụ',
    remove: (name: string): string => `Bỏ ${name}`,
    dialogTitle: 'Thêm người phụ',
    cancel: 'Hủy',
    confirm: 'Thêm',
    duplicate: 'Người này đã có trong danh sách.',
    otherPlant: 'Không thể thêm người của nhà máy khác.',
    failed: 'Không thay đổi được người làm. Hãy thử lại.',
    loadFailed: 'Không tải được danh sách người làm. Hãy chọn lại lệnh sản xuất.',
    unknown: 'Chưa đăng ký tên',
  },

  list: {
    title: 'Lệnh sản xuất',
    equipmentLabel: 'Thiết bị',
    defaultOption: (equipment: string): string => `Thiết bị mặc định: ${equipment}`,
    allOption: 'Tất cả thiết bị',
    resetToDefault: 'Về thiết bị mặc định',
    scopeEquipmentUnknown: 'Thiết bị của máy trạm',

    select: (workOrderNo: string): string => `Chọn ${workOrderNo}`,
    caption: 'Lệnh sản xuất có thể thực hiện',

    status: {
      released: 'Chưa bắt đầu',
      inProgress: 'Đang làm',
      suspended: 'Tạm dừng',
    },
    emergencyBadge: 'Khẩn',
    unassignedEquipmentBadge: 'Chưa gán thiết bị',

    goodLabel: 'Thực tế',
    orderLabel: 'Lệnh',
    progress: (good: string, order: string, uom: string | null): string =>
      `${good} / ${order}${uom === null ? '' : ` ${uom}`}`,
    equipment: 'Thiết bị',

    empty: (equipment: string): string =>
      `Không có lệnh sản xuất nào phát hành cho ${equipment}. Chọn 「Tất cả thiết bị」 ở mục Thiết bị để xem lệnh của thiết bị khác.`,
    emptyOther: (equipment: string): string =>
      `Không có lệnh sản xuất nào phát hành cho ${equipment}.`,
    emptyAll: 'Không có lệnh sản xuất nào có thể thực hiện.',
    loading: 'Đang tải lệnh sản xuất.',
    loadError: 'Không tải được lệnh sản xuất. Hãy thử lại.',
    retry: 'Thử lại',

    total: (total: number): string => `Tổng ${String(total)} mục`,
    range: (total: number, from: number, to: number): string =>
      `Mục ${String(from)}~${String(to)} trên tổng ${String(total)}`,

    pageNav: 'Chuyển trang danh sách lệnh sản xuất',

    equipmentUnknown:
      'Không xác nhận được thiết bị của máy trạm này. Chọn 「Tất cả thiết bị」 ở mục Thiết bị để tiếp tục.',
  },

  side: {
    title: 'Xác nhận công việc',
  },

  selection: {
    title: 'Lệnh sản xuất đã chọn',
    item: 'Mặt hàng',
    process: 'Công đoạn',
    plannedStart: 'Bắt đầu theo kế hoạch',
    equipment: 'Thiết bị',

    otherEquipment: (equipment: string): string =>
      `Thiết bị theo kế hoạch của lệnh này là ${equipment}. Vẫn có thể bắt đầu trên thiết bị này.`,

    otherWork: 'Công việc khác',
  },

  actions: {
    start: 'Bắt đầu sản xuất',
    resume: 'Tiếp tục lại',
    starting: 'Đang bắt đầu',
    continueToSession: 'Tiếp tục công việc',
  },

  remaining: {
    worker: 'Hãy nhập mã nhân viên',
    select: 'Hãy chọn lệnh sản xuất',
    ready: 'Có thể chuyển sang nạp vật tư',
    resume: 'Tiếp tục lại rồi chuyển sang nạp vật tư',
    continue: 'Có thể tiếp tục sang nạp vật tư',
  },

  blocked: {
    unidentified:
      'Không xác nhận được máy trạm nên không thể tiếp tục. Hãy hoàn tất đăng ký máy rồi mở lại',
    processNone:
      'Máy trạm chưa được gán công đoạn nên không thể tiếp tục. Hãy yêu cầu quản trị viên ánh xạ công đoạn cho máy trạm',
    processMultiple:
      'Máy trạm có nhiều công đoạn nên không xác nhận được quyền bắt đầu sản xuất. Hãy liên hệ quản trị viên',
    checking: 'Đang kiểm tra quyền của máy trạm',
    denied:
      'Máy trạm chưa có quyền bắt đầu công việc của công đoạn này nên không thể tiếp tục. Hãy yêu cầu quản trị viên ánh xạ công đoạn cho máy trạm',
    deniedProcess: (processName: string): string =>
      `Máy trạm chưa có quyền bắt đầu công việc ${processName} nên không thể tiếp tục. Hãy yêu cầu quản trị viên ánh xạ công đoạn cho máy trạm`,
    unavailable: 'Không xác nhận được quyền của máy trạm. Hãy bấm Kiểm tra lại',
    retry: 'Kiểm tra lại',

    offline: 'Mất kết nối nên không bắt đầu được. Khi kết nối lại, danh sách sẽ được tải lại',

    holdWork: 'Tạm dừng công việc',
    runningChange: 'Thay linh kiện',
    pqcInspection: 'Kiểm tra PQC',
    pqcInspectionOf: (inspectionRequestNo: string): string => `Kiểm tra PQC ${inspectionRequestNo}`,
    packingWork: 'Đóng gói',
  },

  closing: {
    fulfilled:
      'Lệnh sản xuất này đã hoàn tất đăng ký sản lượng. Hãy kết thúc lệnh trên web quản trị.',
    fulfilledWithOpenSession:
      'Đã hoàn tất đăng ký sản lượng nhưng vẫn còn công việc đang làm. Hãy hoàn tất công việc đang làm rồi kết thúc lệnh sản xuất trên web quản trị.',
  },

  resume: {
    sessionNotFound:
      'Không tìm thấy bản ghi công việc đã tạm dừng nên không thể tiếp tục lại. Hãy liên hệ quản trị viên',
    sessionLookupFailed: 'Không xác nhận được công việc đang làm. Hãy chọn lại lệnh sản xuất',
    checking: 'Đang kiểm tra công việc đang làm',
  },

  result: {
    started: (workOrderNo: string): string => `Đã bắt đầu sản xuất ${workOrderNo}.`,
    resumed: (workOrderNo: string): string => `Đã tiếp tục lại ${workOrderNo}.`,
    conflict: 'Trạng thái lệnh sản xuất đã thay đổi. Đang tải lại danh sách.',
    notOpened:
      'Kết quả kiểm tra đã được ghi nhận nhưng công việc chưa bắt đầu. Hãy bấm lại Bắt đầu sản xuất.',
    startFailed: 'Không bắt đầu được công việc. Hãy kiểm tra kết nối rồi bấm lại.',
    resumeFailed: 'Không tiếp tục lại được công việc. Hãy kiểm tra kết nối rồi bấm lại.',
  },
};
