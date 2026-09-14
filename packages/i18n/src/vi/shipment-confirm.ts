import type { ko } from '../ko';
import type { Translated } from './translated';

/** W-04-12 출하 확정·취소. 확정은 되돌릴 수 없고 취소는 확정 전에만 된다. */
export const shipmentConfirm: Translated<typeof ko.shipmentConfirm> = {
  title: 'Xác nhận và hủy xuất hàng',
  breadcrumbRoot: 'Xuất hàng',
  panes: {
    summary: 'Tình hình chưa xác nhận',
    list: 'Lô xuất hàng chưa xác nhận',
    outcome: 'Điều xảy ra khi xác nhận',
  },
  summary: {
    unconfirmed: 'Chưa xác nhận',
    overdue: 'Đã qua 24 giờ',
    critical: 'Đã qua 3 ngày',
    unit: (count: number): string => `${String(count)} mục`,
    pageScoped: 'Số mục đã quá hạn chỉ đếm những gì nhận được ở trang đang xem.',
    monthEndWarning: (count: number): string =>
      `Tháng này còn ${String(count)} mục chưa xác nhận. Không xác nhận trước cuối tháng thì việc liên kết có thể bị từ chối.`,
  },
  filter: {
    shipDate: 'Ngày xuất hàng',
    customer: 'Khách hàng',
    unconfirmedOnly: 'Chỉ chưa xác nhận',
    sort: 'Sắp xếp',
    sortNote: 'Mục cũ thì nguy hiểm nên mặc định là theo số ngày đã qua giảm dần.',
    sortOptions: {
      elapsed: 'Số ngày đã qua nhiều nhất trước',
    },
    search: 'Tra cứu',
    reset: 'Đặt lại',
    periodRequired: 'Phải chọn khoảng ngày xuất hàng mới tra cứu được',
    periodReversed: 'Ngày bắt đầu sau ngày kết thúc. Hãy đổi hai ngày cho nhau',
  },
  list: {
    loading: 'Đang tải các lô xuất hàng chưa xác nhận',
    loadFailed: 'Không tải được các lô xuất hàng chưa xác nhận',
    empty: 'Không có lô xuất hàng chưa xác nhận nào khớp điều kiện',
    emptyDescription: 'Hãy mở rộng khoảng thời gian hoặc tra cứu với điều kiện khác.',
    selectAll: 'Chọn tất cả các mục có thể xác nhận cùng lúc ở trang này',
    selectRow: (shipmentNo: string): string => `Chọn ${shipmentNo}`,
    fields: {
      shipmentNo: 'Số xuất hàng',
      customer: 'Khách hàng',
      shippedAt: 'Xuất hàng thực tế',
      elapsed: 'Đã qua',
      status: 'Trạng thái',
      erpDeliveryNo: 'Số giao hàng ERP',
    },
    erpPending: 'Chờ gửi',
    shippedAtUnknown: 'Không có thời điểm xuất hàng thực tế',
    elapsedUnknown: '—',
    selected: (count: number, quantity: string): string =>
      `Đã chọn ${String(count)} mục · Tổng ${quantity}`,
  },
  elapsed: {
    days: (days: number, hours: number): string => `${String(days)} ngày ${String(hours)} giờ`,
    hours: (hours: number): string => `${String(hours)} giờ`,
    overdue: 'Đã qua 24 giờ',
    critical: 'Đã qua 3 ngày',
  },
  hold: {
    excludedFromBatch: 'Không xác nhận cùng lúc. Hãy kiểm tra và xác nhận từng mục một.',
  },
  outcome: {
    idle: 'Hãy chọn lô xuất hàng cần xác nhận.',
    confirmed: (count: number): string => `${String(count)} lô xuất hàng sẽ được xác nhận.`,
    erpQueued: 'Việc gửi phiếu ERP được xếp vào hàng chờ — không gửi ngay.',
    irreversible: 'Sau khi xác nhận thì không hủy được. Không có đường ngoại lệ.',
    cancelBeforeOnly: 'Nếu cần hủy thì hãy hủy trước khi xác nhận.',
  },
  actions: {
    confirm: 'Xác nhận',
    requestCancel: 'Yêu cầu hủy',
    retry: 'Thử lại',
  },
  lock: {
    selectNone: 'Hãy chọn lô xuất hàng cần xác nhận',
    selectOneForCancel: 'Yêu cầu hủy làm từng mục một. Hãy chỉ chọn một mục',
    running: 'Đang xử lý việc xác nhận',
  },
  confirmDialog: {
    title: 'Xác nhận xuất hàng',
    target: (count: number): string => `Sẽ xác nhận ${String(count)} lô xuất hàng.`,
    list: 'Lô xuất hàng sẽ xác nhận',
    irreversible: 'Xác nhận không hoàn tác được — không có đường hủy xác nhận.',
    erpQueued: 'Việc gửi phiếu ERP được xếp vào hàng chờ. Không gửi ngay.',
    cancel: 'Hủy',
    confirm: 'Xác nhận',
  },
  cancelDialog: {
    title: 'Yêu cầu hủy xuất hàng',
    target: (shipmentNo: string): string => `Sẽ yêu cầu hủy ${shipmentNo}.`,
    approvalNote: 'Yêu cầu sẽ được đưa lên phê duyệt. Được duyệt rồi thì việc hủy mới chạy.',
    reasonLabel: 'Lý do hủy',
    reasonHelp: 'Hãy ghi lại vì sao hủy. Người duyệt sẽ đọc phần này để quyết định.',
    reasonRequired: 'Hãy nhập lý do hủy',
    reasonTooLong: 'Lý do hủy quá dài. Hãy nhập tối đa 500 ký tự',
    traceWithdrawn: 'Người hủy và thời điểm hủy được lưu trong bản ghi phê duyệt.',
    cancel: 'Đóng',
    submit: 'Yêu cầu hủy',
  },
  result: {
    allConfirmed: (count: number): string => `Đã xác nhận ${String(count)} lô xuất hàng.`,
    partial: (confirmed: number, failed: number): string =>
      `Xác nhận ${String(confirmed)} mục · Thất bại ${String(failed)} mục`,
    allFailed: (count: number): string => `Không xác nhận được cả ${String(count)} mục.`,
    reasons: {
      alreadyConfirmed: 'Lô xuất hàng này đã được xác nhận rồi',
      cancelInProgress: 'Yêu cầu hủy đang chờ phê duyệt',
      versionConflict: 'Một xử lý khác đã được ghi nhận trước. Hãy tra cứu lại rồi xác nhận',
      lockUnavailable: 'Chưa nhận được thông tin cần cho việc xác nhận. Hãy thử lại',
      unknown: 'Không xác nhận được',
    },
    requestCancelDone: (shipmentNo: string): string =>
      `Đã gửi yêu cầu hủy ${shipmentNo}. Được duyệt rồi thì việc hủy mới chạy.`,
  },
  withdrawn: {
    confirmedBy:
      'Không hiển thị người đã xác nhận. Cũng không phân biệt được xác nhận tự động với xác nhận bằng tay.',
    cancelPendingUnknown:
      'Danh sách vẫn chưa phân biệt được mục nào có yêu cầu hủy đang chờ phê duyệt. Nếu thử xác nhận thì máy chủ sẽ chặn mục đang chờ phê duyệt và cho xem lý do.',
    executeCancel:
      'Việc thực thi phần hủy đã được duyệt không đặt ở màn hình này. Hãy làm ở hộp phê duyệt.',
    autoConfirm:
      'Màn hình này vẫn chưa cho xem được cài đặt xác nhận tự động và thời điểm dự kiến. Bản thân việc xác nhận tự động vẫn chạy ở máy chủ theo cài đặt.',
  },
};
