import type { ko } from '../ko';
import type { Translated } from './translated';

/** W-04-12 Lịch sử xuất hàng (tính năng 010). Chỉ hủy được trước khi gửi sang ERP. */
export const shipmentConfirm: Translated<typeof ko.shipmentConfirm> = {
  title: 'Lịch sử xuất hàng',
  breadcrumbRoot: 'Quản lý bán hàng / xuất hàng',
  lead: 'Việc xuất hàng kết thúc ở màn hình POP 「Hoàn tất xuất hàng」. Màn hình này dùng để xem các lô xuất hàng và yêu cầu hủy nếu chưa gửi sang ERP. Chỉ những lô xuất hàng chưa xác nhận được tạo theo luồng cũ hoặc xuất thẳng khẩn mới được xác nhận tại đây.',
  panes: {
    list: 'Danh sách xuất hàng',
    detail: 'Chi tiết xuất hàng',
  },
  filter: {
    period: 'Ngày hoàn tất · xuất hàng',
    q: 'Số xuất hàng, lệnh xuất, khách hàng',
    qPlaceholder: 'Nhập từ khóa',
    erp: 'Gửi ERP',
    all: 'Tất cả',
    search: 'Tra cứu',
    reset: 'Đặt lại',
    chip: (label: string, count: number): string => `${label} ${String(count)}`,
    periodRequired: 'Hãy chọn khoảng thời gian để tra cứu',
    periodReversed: 'Ngày bắt đầu sau ngày kết thúc. Hãy đổi lại hai ngày',
  },
  erp: {
    NOT_QUEUED: 'Chưa xác nhận',
    PENDING: 'Chờ gửi',
    SENT: 'Đã gửi',
    SEND_ERROR: 'Lỗi gửi',
    NOT_SENT_NO_SALES_ORDER: 'Không gửi ERP',
    CANCELLED: 'Đã hủy',
  },
  flow: {
    completed: 'Đã hoàn tất xuất hàng',
    legacyUnconfirmed: 'Luồng cũ, chưa xác nhận',
    expeditedUnconfirmed: 'Xuất thẳng khẩn, chưa xác nhận',
    confirmed: 'Đã xác nhận',
    cancelled: 'Đã hủy',
    cancelPending: 'Đang chờ duyệt hủy',
  },
  hold: 'Tạm giữ việc gửi',
  list: {
    loading: 'Đang tải lịch sử xuất hàng',
    loadFailed: 'Không tải được lịch sử xuất hàng',
    empty: 'Không có lô xuất hàng nào khớp điều kiện',
    emptyDescription: 'Hãy mở rộng khoảng thời gian hoặc bỏ lọc gửi ERP.',
    fields: {
      shipmentNo: 'Số xuất hàng',
      shippedAt: 'Thời điểm hoàn tất · xuất',
      customerRequest: 'Khách hàng và lệnh xuất',
      warehouse: 'Kho',
      completedBy: 'Thiết bị hoàn tất · người làm',
      erp: 'Gửi ERP',
    },
    warehouseCount: (count: number): string => `${String(count)} kho`,
    webCreated: 'Web quản lý',
    open: (shipmentNo: string): string => `Xem chi tiết ${shipmentNo}`,
    page: (page: number, total: number): string =>
      `Trang ${String(page)}, tổng ${String(total)} mục`,
    prev: 'Trước',
    next: 'Sau',
    shippedAtUnknown: 'Không có thời điểm xuất hàng thực tế',
    elapsedUnknown: '—',
  },
  elapsed: {
    days: (days: number, hours: number): string => `${String(days)} ngày ${String(hours)} giờ`,
    hours: (hours: number): string => `${String(hours)} giờ`,
  },
  detail: {
    empty: 'Hãy chọn một lô xuất hàng trong danh sách',
    loading: 'Đang tải chi tiết xuất hàng',
    loadFailed: 'Không tải được chi tiết xuất hàng',
    fields: {
      shipmentRequest: 'Lệnh xuất hàng',
      salesOrder: 'Đơn bán hàng',
      customer: 'Khách hàng',
      shipTo: 'Nơi giao hàng',
      completedAt: 'Thời điểm hoàn tất · xuất',
      terminal: 'Thiết bị POP',
      worker: 'Người làm',
      erpDeliveryNo: 'Số giao hàng ERP',
    },
    erpDeliveryNone: '— (chưa gửi)',
    noSalesOrder: 'Không có đơn bán hàng',
    warehouses: 'Kho đã trừ tồn kho',
    warehousesNote: 'Mỗi kho có một phiếu xuất kho.',
    goodsIssue: (goodsIssueNos: string): string => `Phiếu xuất kho ${goodsIssueNos}`,
    noGoodsIssue: 'Chưa có phiếu xuất kho (chưa xác nhận)',
    staging: 'Chờ xếp kệ',
    lines: 'Dòng · LOT',
    linesNote: 'Số lượng xuất là toàn bộ LOT. Mã quản lý xuất hàng chỉ để xem.',
    columns: {
      lot: 'Dòng / LOT',
      shipped: 'Đã xuất',
      managementCode: 'Mã quản lý xuất hàng',
      places: 'Nơi đã trừ tồn kho',
      oqc: 'OQC',
    },
    line: (lineNo: number, itemCode: string): string => `Dòng ${String(lineNo)}: ${itemCode}`,
    lineNotSent: 'Không gửi ERP',
    erpPending: (lineCount: number, salesOrderNos: string): string =>
      `Chưa gửi sang ERP. Ở lần gửi tiếp theo, ${String(lineCount)} dòng có đơn bán hàng (đơn ${salesOrderNos}) sẽ được gửi.`,
    lineQty: (target: string, shipped: number): string =>
      `Mục tiêu ${target}, đã xuất ${String(shipped)}`,
    over: (qty: number): string => `Vượt +${String(qty)}`,
    replaced: 'Đã thay thế — không tính vào lô xuất hàng',
    replacedNote: (replacedAt: string, nonconformanceNo: string | null): string =>
      nonconformanceNo === null
        ? `Thay thế do không đạt ${replacedAt}`
        : `Thay thế do không đạt ${replacedAt}, không phù hợp ${nonconformanceNo}`,
    noValue: '—',
    erp: 'Gửi ERP',
    erpMessage: {
      NOT_QUEUED:
        'Chưa xác nhận. Khi xác nhận, phiếu sẽ được đưa vào hàng đợi gửi ERP — không gửi ngay lập tức.',
      PENDING: 'Chưa gửi sang ERP. Ở lần gửi tiếp theo, các dòng có đơn bán hàng sẽ được gửi.',
      SENT: 'Đã gửi sang ERP.',
      SEND_ERROR:
        'Gửi sang ERP không thành công nên chưa được phản ánh vào ERP. Có thể yêu cầu hủy — khi việc hủy được thực thi, lần gửi này sẽ không thử lại.',
      NOT_SENT_NO_SALES_ORDER: 'Lô xuất hàng không có đơn bán hàng nên không gửi sang ERP.',
      CANCELLED: 'Lô xuất hàng đã bị hủy. Phần chờ gửi ERP cũng đã bị xóa.',
    },
    cancelPendingBanner:
      'Yêu cầu hủy đang chờ phê duyệt nên lô xuất hàng này chưa được gửi sang ERP mà phải chờ. Nếu được duyệt và việc hủy được thực thi thì phần chờ gửi cũng bị xóa. Nếu bị từ chối thì sẽ gửi ở lần tiếp theo.',
    legacyBanner:
      'Lô xuất hàng này được tạo bằng chức năng xử lý xuất hàng trên web quản lý trước khi triển khai. Cần xác nhận như trước đây thì việc gửi xuất kho sang ERP mới được đưa vào hàng đợi. Trước khi xác nhận có thể yêu cầu hủy.',
    expeditedBanner:
      'Lô xuất hàng này được tạo bằng xuất thẳng khẩn. Cần xác nhận thì việc gửi xuất kho sang ERP mới được đưa vào hàng đợi. Trước khi xác nhận có thể yêu cầu hủy.',
  },
  oqc: {
    NOT_REQUIRED: 'Không cần kiểm tra',
    SKIPPED: 'Bỏ qua kiểm tra',
    NOT_INSPECTED: 'Chưa kiểm tra',
    ACCEPTED: 'Đạt',
    REJECTED: 'Không đạt',
    HELD: 'Tạm giữ',
  },
  cancelNote:
    'Chỉ có thể hủy trước khi gửi sang ERP (kể cả khi gửi lỗi). Khi việc hủy được duyệt, hãy thực thi bằng [Thực thi hủy] trên màn hình này.',
  actions: {
    confirm: 'Xác nhận',
    requestCancel: 'Yêu cầu hủy',
    executeCancel: 'Thực thi hủy',
  },
  lock: {
    sent: 'Đã gửi sang ERP rồi. Hãy xử lý ở phía ERP',
    cancelPending: 'Yêu cầu hủy đang chờ phê duyệt',
    confirmedLegacy: 'Sau khi xác nhận thì không thể hủy',
    cancelled: 'Lô xuất hàng đã bị hủy',
    running: 'Đang xử lý xác nhận',
    cancelApproved: 'Việc hủy đã được duyệt. Hãy thực thi bằng [Thực thi hủy]',
  },
  confirmDialog: {
    title: 'Xác nhận xuất hàng',
    target: (count: number): string => `Xác nhận ${String(count)} lô xuất hàng.`,
    list: 'Lô xuất hàng sẽ xác nhận',
    irreversible: 'Không thể hoàn tác việc xác nhận — không có cách hủy xác nhận.',
    erpQueued: 'Phiếu sẽ được đưa vào hàng đợi gửi ERP. Không gửi ngay lập tức.',
    cancel: 'Hủy',
    confirm: 'Xác nhận',
  },
  cancelDialog: {
    title: 'Yêu cầu hủy xuất hàng',
    target: (shipmentNo: string): string => `Sẽ yêu cầu hủy ${shipmentNo}.`,
    approvalNote: 'Yêu cầu sẽ được đưa lên phê duyệt. Được duyệt rồi thì việc hủy mới chạy.',
    hold: 'Sau khi yêu cầu, lô xuất hàng này sẽ không được gửi sang ERP cho đến khi được duyệt và thực thi.',
    whatTitle: 'Khi việc hủy được thực thi',
    what: {
      stock: (qty: number, warehouses: string): string =>
        `${String(qty)} tồn kho trở về đúng vị trí đã trừ (${warehouses}).`,
      documents: 'Các phiếu xuất kho bị hủy và phần chờ gửi ERP bị xóa.',
      salesOrder: 'Số lượng đã xuất của đơn bán hàng giảm tương ứng.',
      request: (shipmentRequestNo: string): string =>
        `Lệnh xuất hàng ${shipmentRequestNo} trở về 「Trước khi hoàn tất xuất hàng」. Bản ghi lấy hàng · OQC được giữ lại và các LOT đã lấy được đặt giữ lại (LOT nào không giữ lại được sẽ hiện là đã nhả).`,
    },
    reasonLabel: 'Lý do hủy',
    reasonHelp: 'Hãy ghi lại vì sao hủy. Người duyệt sẽ đọc phần này để quyết định.',
    reasonRequired: 'Hãy nhập lý do hủy',
    reasonTooLong: 'Lý do hủy quá dài. Hãy nhập tối đa 500 ký tự',
    traceWithdrawn: 'Người hủy và thời điểm hủy được lưu trong bản ghi phê duyệt.',
    erpAlreadySent:
      'Không gửi được yêu cầu hủy. Trong lúc yêu cầu, việc gửi ERP đã xong trước — đã gửi sang ERP rồi. Hãy xử lý ở phía ERP.',
    cancel: 'Đóng',
    submit: 'Yêu cầu hủy',
  },
  executeDialog: {
    title: 'Thực thi hủy xuất hàng',
    target: (shipmentNo: string): string => `Sẽ thực thi việc hủy đã được duyệt của ${shipmentNo}.`,
    irreversible:
      'Sau khi thực thi thì không thể hoàn tác. Muốn xuất lại, hãy hoàn tất xuất hàng lại trên POP.',
    erpAlreadySent: 'Không thực thi được. Trong lúc đó đã gửi sang ERP rồi. Hãy xử lý ở phía ERP.',
    failed: (message: string): string => `Không thực thi được. ${message}`,
    cancel: 'Đóng',
    submit: 'Thực thi hủy',
  },
  result: {
    allConfirmed: (count: number): string => `Đã xác nhận ${String(count)} lô xuất hàng.`,
    partial: (confirmed: number, failed: number): string =>
      `Đã xác nhận ${String(confirmed)} · thất bại ${String(failed)}`,
    allFailed: (count: number): string => `Không xác nhận được cả ${String(count)} lô.`,
    reasons: {
      alreadyConfirmed: 'Lô xuất hàng đã được xác nhận',
      cancelInProgress: 'Yêu cầu hủy đang chờ phê duyệt',
      versionConflict: 'Một xử lý khác đã được áp dụng trước. Hãy tra cứu lại rồi xác nhận',
      lockUnavailable: 'Chưa nhận được thông tin cần để xác nhận. Hãy thử lại',
      unknown: 'Không xác nhận được',
    },
    executeCancelDone: (shipmentNo: string): string =>
      `Đã thực thi hủy ${shipmentNo}. Tồn kho và phiếu xuất kho đã được hoàn lại.`,
    requestCancelDone: (shipmentNo: string): string =>
      `Đã gửi yêu cầu hủy ${shipmentNo}. Việc hủy sẽ chạy sau khi được duyệt.`,
  },
};
