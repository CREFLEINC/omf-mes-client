import type { ko } from '../ko';
import type { Translated } from './translated';

/** W-02-11 tình trạng yêu cầu xuất kho (003). Tên màn hình trùng với tên tab. */
export const materialIssueStatus: Translated<typeof ko.materialIssueStatus> = {
  title: 'Tình trạng yêu cầu xuất kho',
  breadcrumb: { root: 'Mua hàng / Quản lý vật tư', parent: 'Quản lý xuất kho' },
  today: (date: string): string => `Hôm nay ${date}`,
  views: {
    label: 'Chế độ xem',
    list: 'Danh sách yêu cầu',
    shortage: 'Thiếu',
    shortageCount: (count: number): string => `Thiếu ${String(count)}`,
  },
  filters: {
    label: 'Điều kiện tra cứu',
    plant: 'Nhà máy',
    issueWorkDate: 'Ngày xuất kho',
    productionDate: 'Ngày sản xuất',
    workOrder: 'W/O',
    workOrderPlaceholder: 'Số W/O',
    sourceWarehouse: 'Kho sản xuất xuất đi',
    all: 'Tất cả',
    status: 'Trạng thái',
    hasShortage: 'Chỉ yêu cầu có thiếu',
    releaseFailed: 'Chỉ phát hành lỗi',
    groupByPlan: 'Nhóm theo kế hoạch',
    search: 'Tra cứu',
    reset: 'Đặt lại',
  },
  columns: {
    requestNo: 'Số yêu cầu',
    workOrder: 'W/O',
    productionDate: 'Ngày sản xuất',
    issueWorkDate: 'Ngày xuất kho',
    sourceWarehouse: 'Kho sản xuất xuất đi',
    destination: 'Nơi nhận (hiện trường sản xuất)',
    lineCount: 'Số mặt hàng',
    status: 'Trạng thái',
    shortage: 'Thiếu',
  },
  status: {
    WAITING: 'Chờ',
    RELEASED: 'Đã phát hành',
    IN_PROGRESS: 'Đang thực hiện',
    DONE: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
  },
  closeReasons: {
    WO_CANCELLED: 'Hủy W/O',
    WO_CLOSED: 'Đóng W/O',
  },
  statusWithReason: (status: string, reason: string): string => `${status}, ${reason}`,
  releaseFailed: 'Phát hành lỗi',
  shortageChip: (qty: string): string => `Thiếu ${qty}`,
  planGroup: {
    title: (planNo: string): string => `Kế hoạch sản xuất ${planNo}`,
    none: 'Không có kế hoạch sản xuất',
    meta: (count: number, shortCount: number): string =>
      shortCount > 0
        ? `${String(count)} phiếu yêu cầu, ${String(shortCount)} phiếu thiếu`
        : `${String(count)} phiếu yêu cầu`,
  },
  pager: {
    total: (count: number): string => `Tổng ${String(count)}`,
    previous: 'Trước',
    next: 'Sau',
  },
  empty: {
    title: 'Không có yêu cầu xuất kho phù hợp điều kiện',
    description: 'Hãy nới điều kiện hoặc đặt lại rồi tra cứu lại.',
    noPlant: 'Không có nhà máy để tra cứu.',
  },
  detail: {
    label: 'Chi tiết yêu cầu xuất kho',
    close: 'Đóng',
    plan: (planNo: string): string => `Kế hoạch sản xuất ${planNo}`,
    productionDate: (date: string): string => `Ngày sản xuất ${date}`,
    releaseFailed: (text: string): string =>
      `Không phát hành được. Nguyên nhân: ${text} Sửa nguyên nhân thì lần xử lý sau sẽ phát hành lại.`,
    locked:
      'Đã bắt đầu lấy hàng nên không thể đổi ngày xuất kho, nơi xuất, nơi nhận hoặc hủy. Chỉ sửa được số lượng yêu cầu không nhỏ hơn số đã xuất.',
    legacy: 'Yêu cầu tạo trước quy tắc kho sản xuất nên không sửa được.',
    cancelled: 'Yêu cầu đã hủy. Không sửa được.',
    done: 'Yêu cầu đã xuất xong. Không sửa được.',
    closed: (reason: string, picked: string): string =>
      picked === ''
        ? `Đã đóng phần chưa xuất do ${reason}.`
        : `Đã đóng phần chưa xuất do ${reason}. ${picked} đã lấy nhưng chưa xuất vẫn giữ nguyên.`,
    issueWorkDate: 'Ngày xuất kho',
    changeDate: 'Đổi',
    sourceWarehouse: 'Kho sản xuất xuất đi',
    destination: 'Nơi nhận',
    hints: {
      WAITING: 'Sẽ phát hành lúc 00:00 ngày đó',
      RELEASED: 'Lùi sang tương lai thì trở về trạng thái chờ',
    },
    lines: {
      label: 'Mặt hàng yêu cầu',
      item: 'Mặt hàng',
      requested: 'Yêu cầu',
      picked: 'Đã lấy',
      issued: 'Đã xuất',
      outstanding: 'Chưa xuất',
      shortage: 'Thiếu',
      qtyLabel: (item: string): string => `Số lượng yêu cầu ${item}`,
      belowIssued: (item: string, issued: string): string =>
        `Số lượng yêu cầu ${item} không được nhỏ hơn số đã xuất (${issued}).`,
    },
    history: 'Lịch sử',
    noHistory: 'Không có lịch sử.',
    systemActor: 'Phát hành tự động',
    events: {
      CREATED: (): string => 'Tạo, chờ',
      RELEASED: (): string => 'Phát hành',
      RELEASE_FAILED: (error: string): string =>
        error === '' ? 'Phát hành lỗi' : `Phát hành lỗi: ${error}`,
      REVERTED_TO_WAITING: (): string => 'Trở về chờ (đóng chỉ thị lấy hàng)',
      ISSUE_DATE_CHANGED: (before: string, after: string): string =>
        `Đổi ngày xuất kho ${before} → ${after}`,
      SOURCE_CHANGED: (before: string, after: string): string =>
        `Đổi kho sản xuất xuất đi ${before} → ${after}`,
      DESTINATION_CHANGED: (before: string, after: string): string =>
        `Đổi nơi nhận ${before} → ${after}`,
      QTY_CHANGED: (item: string, before: string, after: string): string =>
        `Đổi số lượng yêu cầu ${item} ${before} → ${after}`,
      CANCELLED: (reason: string): string => (reason === '' ? 'Hủy' : `Hủy: ${reason}`),
      CLOSED: (reason: string): string =>
        reason === '' ? 'Đóng phần chưa xuất' : `Đóng phần chưa xuất: ${reason}`,
      PLANNED_OVERRIDE: (reason: string): string =>
        reason === ''
          ? 'Lấy phần dự kiến xuất của W/O khác'
          : `Lấy phần dự kiến xuất của W/O khác, lý do ${reason}`,
    },
    cancel: 'Hủy yêu cầu',
    cancelLocked: 'Đã thực hiện một phần nên không thể hủy',
    revert: 'Hoàn tác',
    save: 'Lưu',
  },
  dateDialog: {
    title: 'Đổi ngày xuất kho',
    current: (requestNo: string, date: string): string => `${requestNo}, hiện tại ${date}`,
    field: 'Ngày xuất kho mới',
    pickFirst: 'Hãy chọn ngày.',
    releaseNow:
      'Là hôm nay hoặc ngày đã qua nên lưu sẽ phát hành ngay (tạo chỉ thị lấy hàng và thông báo người phụ trách).',
    backToWaiting: (date: string): string =>
      `Lùi sang ${date} thì trở về «Chờ», chỉ thị lấy hàng bị đóng và biến khỏi danh sách hiện trường.`,
    scheduled: (date: string): string => `Sẽ phát hành lúc 00:00 ngày ${date}.`,
    cancel: 'Hủy',
    submit: 'Đổi',
  },
  holidayDialog: {
    title: 'Là ngày nghỉ',
    body: (date: string): string =>
      `${date} là ngày nghỉ của nhà máy này. Vẫn lấy ngày này làm ngày xuất kho?`,
    note: 'Sẽ phát hành lúc 00:00 ngày đó và gửi thông báo công việc bàn giao cho người phụ trách kho sản xuất.',
    back: 'Chọn lại ngày',
    submit: 'Vẫn đổi',
  },
  cancelDialog: {
    title: (requestNo: string): string => `Hủy ${requestNo}?`,
    released:
      'Yêu cầu đã phát hành. Hủy sẽ đóng cả chỉ thị lấy hàng và giải phóng dự kiến xuất. Không thể hoàn tác.',
    waiting: 'Hủy sẽ giải phóng dự kiến xuất. Không thể hoàn tác.',
    reason: 'Lý do hủy (không bắt buộc)',
    reasonPlaceholder: 'Ví dụ: đổi kế hoạch',
    close: 'Đóng',
    submit: 'Hủy yêu cầu',
  },
  toast: {
    saved: 'Đã lưu yêu cầu. Đã điều chỉnh dự kiến xuất',
    releasedNow: (date: string): string => `Đã đổi ngày xuất kho sang ${date} và phát hành ngay`,
    dateChanged: (date: string): string => `Đã đổi ngày xuất kho sang ${date}`,
    cancelled: (requestNo: string): string => `Đã hủy ${requestNo}. Đã giải phóng dự kiến xuất`,
  },
  errors: {
    versionConflict: 'Người khác đã đổi yêu cầu này trước. Hãy tải lại rồi sửa.',
    stateLocked: 'Trong lúc đó đã bắt đầu lấy hàng nên không lưu được thay đổi này. Đã tải lại.',
    reload: 'Tải lại',
  },
  shortage: {
    intro:
      'Nhóm trên là vật tư không đưa vào yêu cầu vì không có kho sản xuất còn tồn (theo W/O), bên dưới là mặt hàng có dự kiến xuất lớn hơn tồn khả dụng của kho sản xuất. Bổ sung kho sản xuất bằng chuyển kho; nếu gấp, mở yêu cầu xuất kho bổ sung bằng «Yêu cầu bổ sung».',
    warehouse: 'Kho sản xuất',
    item: 'Mặt hàng',
    itemPlaceholder: 'Mã hoặc tên mặt hàng',
    tableLabel: 'Thiếu ở kho sản xuất',
    columns: {
      warehouse: 'Kho sản xuất',
      item: 'Mặt hàng',
      available: 'Khả dụng',
      planned: 'Dự kiến xuất',
      shortage: 'Thiếu',
      allocation: 'Phân bổ yêu cầu (thiếu từ yêu cầu có ngày xuất muộn nhất)',
    },
    unsourcedTitle: 'Không có kho sản xuất còn tồn',
    unsourcedNote: (count: number): string =>
      `${String(count)} W/O. Vật tư không đưa vào yêu cầu xuất vì khi phát hành không kho sản xuất nào của phòng ban còn tồn. Hãy bổ sung kho sản xuất rồi yêu cầu bổ sung. Có tồn rồi cũng không tự yêu cầu.`,
    none: 'Không có',
    warehouseGroup: 'Thiếu theo kho sản xuất',
    warehouseGroupCount: (count: number): string => `${String(count)} mặt hàng`,
    workOrderLine: (workOrderNo: string, date: string): string =>
      date === '' ? workOrderNo : `${workOrderNo}, ngày sản xuất ${date}`,
    allocation: (workOrderNo: string, date: string, planned: string): string =>
      `${workOrderNo}, xuất ${date}, dự kiến ${planned}`,
    replenish: 'Yêu cầu bổ sung →',
    replenishLabel: (target: string): string => `Yêu cầu bổ sung ${target}`,
    replenished: (requestNo: string): string => `Đã yêu cầu bổ sung (${requestNo})`,
    empty: 'Không có mặt hàng thiếu.',
  },
};
