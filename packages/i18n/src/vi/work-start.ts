import type { ko } from '../ko';
import { named } from '../named';
import type { Translated } from './translated';
import { common } from './common';

/** P-02-01 작업 시작(작업지시 선택). */
export const workStart: Translated<typeof ko.workStart> = {
  title: 'Bắt đầu sản xuất',

  header: {
    terminalUnknown: 'Chưa xác nhận máy trạm',
    terminalLabel: (code: string): string => `Máy trạm ${code}`,
    equipmentLabel: (code: string, name: string): string => `Thiết bị ${named(name, code)}`,

    workerUnset: 'Chưa nhập mã nhân viên',
    workerLabel: (workerNo: string, workerName?: string | null): string =>
      `Người làm ${named(workerName, workerNo)}`,

    connected: common.connection.online,
    disconnected: common.connection.offline,
  },

  worker: {
    title: 'Người làm',
    fieldLabel: 'Mã nhân viên',
    keypadLabel: 'Bàn phím số nhập mã nhân viên',
    backspace: 'Xóa một ký tự',
    clear: 'Xóa hết',
    confirm: 'Xác nhận',
    change: 'Nhập lại',
    checking: 'Đang kiểm tra',

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
    scopeLabel: 'Phạm vi lệnh sản xuất',
    scopeEquipmentUnknown: 'Thiết bị của máy trạm',
    scopeAll: 'Tất cả thiết bị',

    select: (workOrderNo: string): string => `Chọn ${workOrderNo}`,
    caption: 'Lệnh sản xuất có thể thực hiện',

    status: {
      released: 'Chưa bắt đầu',
      inProgress: 'Đang làm',
      suspended: 'Tạm dừng',
    },
    emergencyBadge: 'Khẩn',
    unassignedEquipmentBadge: 'Chưa gán thiết bị',

    qty: (good: string, order: string): string => `Thực tế ${good} / Lệnh ${order}`,
    equipment: 'Thiết bị',
    plannedStart: (at: string): string => `Bắt đầu theo kế hoạch ${at}`,

    empty: (equipment: string): string =>
      `Không có lệnh sản xuất nào phát hành cho ${equipment}. Đổi phạm vi sang tất cả thiết bị để xem lệnh của thiết bị khác.`,
    emptyAll: 'Không có lệnh sản xuất nào có thể thực hiện.',
    loading: 'Đang tải lệnh sản xuất.',
    loadError: 'Không tải được lệnh sản xuất. Hãy thử lại.',
    retry: 'Thử lại',

    total: (total: number): string => `Tổng ${String(total)} mục`,

    pageNav: 'Chuyển trang danh sách lệnh sản xuất',

    equipmentUnknown:
      'Không xác nhận được thiết bị của máy trạm này. Đổi phạm vi sang tất cả thiết bị để tiếp tục.',
  },

  side: {
    title: 'Xác nhận công việc',
  },

  selection: {
    title: 'Lệnh sản xuất đã chọn',
    notSelected: 'Hãy chọn lệnh sản xuất ở danh sách bên trái.',
    workOrderNo: 'Số W/O',
    status: 'Trạng thái',
    item: 'Mặt hàng',
    process: 'Công đoạn',
    qty: 'Số lượng',
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

    alreadyOpen: 'Đang có công việc dở dang',
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
