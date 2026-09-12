import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-05-05 보전지시 발행. 트리거 여럿을 지시 하나로 묶는 화면이라, 옮긴 말도
 * 「지금 무엇을 하나로 묶고 있는가」를 계속 말한다.
 */
export const maintenanceOrder: Translated<typeof ko.maintenanceOrder> = {
  title: 'Phát hành lệnh bảo trì',
  breadcrumbRoot: 'Thiết bị / Công cụ',

  panes: {
    triggers: 'Đối tượng phát hành',
    form: 'Phát hành lệnh',
    list: 'Lệnh đã phát hành',
  },

  triggers: {
    heading: 'Những mục chưa có lệnh phát hành',
    /** 트리거는 kích hoạt 로 굳힌다 — 이 화면에서만 쓰는 말이라 한 낱말로 둔다. */
    sameEquipmentOnly:
      'Một lệnh chỉ gộp được các kích hoạt của cùng một thiết bị. Chọn một thiết bị thì dòng của thiết bị khác bị khóa.',
    lockedOtherEquipment:
      'Đây là kích hoạt của thiết bị khác. Bỏ chọn thiết bị đang chọn thì mới chọn được.',
    breakdownTab: 'Sự cố',
    inspectionTab: 'Kiểm tra định kỳ không đạt',
    pmDueTab: 'Đến chu kỳ',
    pmDueLead:
      'Đến chu kỳ là điều kiện suy ra, không phải bản ghi đã lưu, nên không có danh sách để chọn. Hãy chọn thiết bị rồi dùng nút bên dưới để thêm vào kích hoạt.',
    addPmDue: 'Thêm kích hoạt đến chu kỳ',
    pmDueAdded: 'Đến chu kỳ',
    selected: (count: number): string => `Đã chọn ${String(count)} mục`,
    none: 'Chưa chọn kích hoạt nào.',
    remove: 'Bỏ',

    breakdownNo: 'Số sự cố',
    inspectionNo: 'Số kiểm tra định kỳ',
    equipment: 'Thiết bị',
    symptom: 'Hiện tượng',
    reportedAt: 'Thời điểm báo',
    inspectedAt: 'Thời điểm kiểm tra',
    inspector: 'Người kiểm tra',
    result: 'Kết quả',
    emptyTitle: 'Không có đối tượng',
    emptyBreakdown: 'Không có sự cố nào chưa phát hành lệnh.',
    emptyInspection: 'Không có kết quả kiểm tra định kỳ không đạt nào chưa phát hành lệnh.',
  },

  form: {
    target: 'Thiết bị đối tượng',
    plannedDate: 'Ngày dự kiến',
    assignee: 'Người phụ trách',
    assigneeNone: 'Không chỉ định',
    assigneeExternalNote:
      'Không đưa được nhân lực thuê ngoài vào ô này. Hãy để trống người phụ trách và ghi nhà thầu cùng người phụ trách vào nội dung lệnh.',
    baseDate: 'Ngày cơ sở chu kỳ',
    baseDateNote: 'Chu kỳ tiếp theo bắt đầu từ ngày này. Chỉ ghi cho bảo trì phòng ngừa.',
    baseDateCorrective: 'Bảo trì khắc phục không ghi ngày cơ sở chu kỳ.',
    orderNote: 'Nội dung lệnh',
    orderNoteHint:
      'Hãy ghi nội dung để người phụ trách đọc và phán đoán. Nếu thuê ngoài thì ghi cả nhà thầu và số liên hệ.',
    items: 'Hạng mục lệnh',
    itemsLead:
      'Bảo trì thiết bị chọn từ dữ liệu gốc hạng mục kiểm tra định kỳ · bảo trì. Cái không có trong dữ liệu gốc thì ghi vào nội dung lệnh.',
    addItem: 'Thêm hạng mục',
    removeItem: 'Bỏ hạng mục',
    itemPlaceholder: 'Hãy chọn hạng mục',
    maintenanceType: 'Loại bảo trì',
    maintenanceTypeDerived:
      'Loại bảo trì do tổ hợp kích hoạt quyết định — chỉ cần lẫn một sự cố là thành khắc phục.',
    corrective: 'Khắc phục',
    preventive: 'Phòng ngừa',
    predictive: 'Dự đoán',
    predictiveLocked: 'Bảo trì dự đoán chưa có kích hoạt nên không chọn được.',

    submit: 'Phát hành lệnh',
    reset: 'Xóa nội dung nhập',
    requiredTarget: 'Hãy chọn thiết bị đối tượng.',
    requiredPlannedDate: 'Hãy chọn ngày dự kiến.',
    invalidPlannedDate: 'Ngày không có trên lịch. Hãy chọn lại ngày dự kiến.',
    requiredAssignee: 'Hãy chọn người phụ trách.',
    requiredTrigger: 'Hãy chọn ít nhất một kích hoạt.',
    requiredItem: 'Hãy chọn ít nhất một hạng mục lệnh.',
    mixedEquipment: 'Một lệnh chỉ gộp được các kích hoạt của cùng một thiết bị.',
    userLookupFailed: 'Không tải được danh sách người dùng nên hiện chưa chọn được. Hãy thử lại.',
    itemLookupFailed: 'Không tải được dữ liệu gốc hạng mục nên hiện chưa chọn được. Hãy thử lại.',
    equipmentLookupFailed:
      'Không tải được danh sách thiết bị nên hiện chưa chọn được. Hãy thử lại.',
    lookupTruncated:
      'Chỉ hiển thị một phần danh sách. Không thấy giá trị cần tìm thì hãy hỏi người phụ trách.',
  },

  confirm: {
    title: 'Phát hành lệnh này?',
    lead: 'Một lệnh sẽ được tạo với nội dung bên dưới.',
    triggerCount: (count: number): string => `${String(count)} kích hoạt`,
    itemCount: (count: number): string => `${String(count)} hạng mục`,
    submit: 'Phát hành',
    cancel: 'Hủy',
  },

  list: {
    orderNo: 'Số lệnh',
    target: 'Đối tượng',
    type: 'Loại',
    plannedDate: 'Ngày dự kiến',
    status: 'Trạng thái',
    assignee: 'Người phụ trách',
    notAvailable: '—',
    emptyTitle: 'Không có lệnh đã phát hành',
    empty: 'Không có lệnh nào khớp điều kiện.',
    cancel: 'Hủy',
    cancelConfirmTitle: 'Hủy lệnh này?',
    cancelConfirm:
      'Chỉ hủy được khi chưa có kết quả nào. Nếu đã có kết quả thì máy chủ sẽ từ chối.',
    cancelLockedStatus: 'Chỉ hủy được lệnh ở trạng thái đã phát hành.',
  },

  status: {
    issued: 'Đã phát hành',
    done: 'Hoàn thành',
    cancelled: 'Đã hủy',
  },

  filters: {
    status: 'Trạng thái',
    period: 'Khoảng ngày dự kiến',
    all: 'Tất cả',
    search: 'Tra cứu',
    reset: 'Đặt lại',
    periodInvalid: 'Ngày không có trên lịch. Hãy chọn lại ngày bắt đầu và ngày kết thúc.',
    periodReversed: 'Ngày kết thúc trước ngày bắt đầu. Hãy đổi chỗ hai ngày.',
  },

  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)} mục`,
    totalOnly: (total: number): string => `Tổng ${String(total)} mục`,
    prev: 'Trước',
    next: 'Sau',
  },
};
