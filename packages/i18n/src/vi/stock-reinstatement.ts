import type { ko } from '../ko';
import type { Translated } from './translated';

/** W-04-11 재고 재등록. 새 LOT 을 만들지 않고 보류를 풀어 완제품창고로 되돌린다. */
export const stockReinstatement: Translated<typeof ko.stockReinstatement> = {
  title: 'Đăng ký lại tồn kho',
  breadcrumbRoot: 'Xuất hàng',
  scopeNotice: 'Đăng ký lại không tạo LOT mới. LOT gốc và lịch sử trả hàng vẫn được giữ nguyên.',
  panes: {
    candidates: 'Chờ đăng ký lại',
    detail: 'LOT đã chọn',
    history: 'Lịch sử đánh giá',
    form: 'Nhập đăng ký lại',
  },
  fields: {
    sourceWarehouse: 'Kho hiện tại',
    targetWarehouse: 'Kho đích',
    targetLocation: 'Vị trí đích',
    completedOnly: 'Chỉ đã đánh giá xong',
    lot: 'LOT thành phẩm',
    item: 'Mặt hàng',
    qty: 'Số lượng',
    disposition: 'Quyết định xử lý',
    decidedAt: 'Thời điểm đánh giá',
    expiry: 'Hạn sử dụng',
    hold: 'Tạm giữ cần gỡ',
    releaseReason: 'Lý do gỡ',
    reason: 'Lý do đăng ký lại',
    remarks: 'Ghi chú',
  },
  actions: {
    selectRow: (lotNo: string): string => `Chọn ${lotNo}`,
    prevPage: 'Trước',
    nextPage: 'Sau',
    confirm: 'Xác nhận đăng ký lại',
    submit: 'Chốt đăng ký lại',
    keepEditing: 'Tiếp tục nhập',
  },
  accessibility: {
    candidateLoading: 'Đang tải danh sách chờ đăng ký lại',
    pagination: 'Chuyển trang danh sách chờ đăng ký lại',
  },
  filters: {
    allWarehouses: 'Tất cả kho hàng lỗi',
    noWarehouse: 'Không tải được các lựa chọn kho hàng lỗi. Sẽ tra cứu mà không đặt điều kiện kho.',
  },
  values: {
    normal: 'Bình thường',
    rework: 'Đã làm lại xong',
    empty: '—',
    noExpiry: '⚠ Không có',
    remainingDays: (days: number): string => `Còn lại ${String(days)} ngày`,
    expiredDays: (days: number): string => `Đã qua ${String(days)} ngày`,
    holdingQty: (qty: number): string => `Đang giữ ${String(qty)}`,
    partial: (qty: number): string => `${String(qty)} sẽ ở lại kho hàng lỗi.`,
    full: 'Đăng ký lại toàn bộ số lượng đang giữ.',
    page: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)} mục`,
  },
  history: {
    opened: 'Đăng ký điểm không phù hợp',
    held: 'Tạm giữ LOT trả hàng',
    decided: 'Đánh giá xử lý',
    noSource: 'Không tải được lịch sử đánh giá.',
  },
  form: {
    warehouseRequired: 'Hãy chọn kho đích.',
    locationRequired: 'Kho này có quản lý vị trí. Hãy chọn vị trí đích.',
    holdRequired: 'Hãy chọn mục tạm giữ chưa được gỡ.',
    qtyRequired: 'Hãy nhập số lượng từ 1 trở lên.',
    qtyExceeded: (qty: number): string => `Không được vượt quá ${String(qty)} đang giữ.`,
    releaseReasonRequired: 'Hãy chọn lý do gỡ.',
    releaseReasonUnavailable: 'Phải tải xong giá trị gốc của lý do gỡ mới chốt được.',
    optionalReasonEmpty:
      'Chưa có lý do đăng ký lại nào được đăng ký. Đây là mục tùy chọn nên không chặn việc chốt.',
    selectPlaceholder: 'Hãy chọn',
    noLocations: 'Không có vị trí nào dùng được.',
    warehouseOnly: 'Kho đã chọn không quản lý vị trí riêng.',
  },
  warning: {
    title: 'Đăng ký lại xong thì LOT này sẽ xuất hàng được',
    transition: 'Lot Status: Hold → Release',
    stock: (qty: number): string => `Tồn kho: kho hàng lỗi → kho thành phẩm ${String(qty)}`,
    noUndo: 'Không có nút hoàn tác. Muốn chặn lại thì phải làm lại thủ tục đánh giá và tạm giữ.',
    shelfLife: (days: number): string =>
      days < 0
        ? `Hạn sử dụng đã qua ${String(Math.abs(days))} ngày. Hãy kiểm tra chính sách hạn sử dụng trước khi xuất hàng.`
        : `Còn lại ${String(days)} ngày. Nếu ngắn hơn hạn sử dụng còn lại tối thiểu của khách hàng thì không xuất hàng được.`,
  },
  confirm: {
    title: 'Xác nhận đăng ký lại tồn kho',
    lead: 'Các thay đổi dưới đây được áp dụng cùng lúc chỉ với một lần chốt.',
  },
  success: (qty: number): string => `Đã đăng ký lại ${String(qty)} tồn kho.`,
  empty: {
    title: 'Không có mục nào chờ đăng ký lại',
    description:
      'Chỉ hiện những mục đã đánh giá bình thường hoặc đã làm lại xong mà còn phần xử lý tiếp theo.',
    selectionTitle: 'Chưa chọn LOT nào',
    selectionDescription: 'Hãy chọn LOT cần đăng ký lại ở danh sách bên trái.',
    selectionLoading: 'Đang tải thông tin LOT đã chọn',
    selectionLoadError:
      'Không tải được thông tin mới nhất của LOT đã chọn. Hãy thử lại sau giây lát.',
    relatedLoadError:
      'Không tải được đầy đủ thông tin mới nhất cần cho việc đăng ký lại. Chưa chốt được cho tới khi thông tin được xác nhận.',
  },
  conflict: {
    already: 'Đánh giá này đã được đăng ký lại rồi. Danh sách chờ đã được tải lại.',
    released: 'Mục tạm giữ đã được gỡ trước ở đường khác. Hãy kiểm tra lại danh sách chờ.',
    notEligible: 'Đánh giá hiện tại không đăng ký lại được. Hãy kiểm tra lại danh sách chờ.',
  },
};
