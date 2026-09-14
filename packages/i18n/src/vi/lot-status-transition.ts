import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-03-02 Lot Status 판정·전이 처리. 대상 LOT 을 골라 보류를 걸거나(Hold) 푼다(Release).
 *
 * ⚠ 「전이」는 사이드바가 `chuyển đổi` 로 세웠다(`nav-tree.ts`) — 여기서도 같은 말을 쓴다.
 * 「보류」(`tạm giữ`)와 「해제」(`gỡ`)는 용어집의 짝이고, 한 화면에 둘이 나란히 서므로
 * 서로 섞이지 않게 앞말을 붙여 가른다.
 */
export const lotStatusTransition: Translated<typeof ko.lotStatusTransition> = {
  title: 'Xử lý đánh giá · chuyển đổi Lot Status',
  breadcrumbRoot: 'Quản lý chất lượng',
  historyNotice: 'Lịch sử chuyển đổi không được lưu thành lịch sử riêng',
  historyLink: 'Xem lịch sử thay đổi Lot Status',
  reason: {
    holdLabel: 'Lý do tạm giữ',
    releaseLabel: 'Lý do gỡ',
    placeholder: 'Hãy chọn lý do',
    required: 'Hãy chọn lý do.',
    pending: 'Đang tải danh sách lý do.',
    failed: 'Không tải được danh sách lý do. Phải có danh sách thì mới đi tiếp được.',
    truncated: 'Chỉ nhận được một phần danh sách lý do nên không đi tiếp được.',
    empty:
      'Chưa có giá trị lý do nào được đăng ký. Phải có giá trị trong mã chung thì mới đi tiếp được.',
    unknown: 'Lý do này không có trong lựa chọn. Hãy chọn lại.',
  },
  candidate: {
    pane: 'LOT cần chuyển đổi',
    filters: {
      period: 'Khoảng thời gian chuyển đổi gần nhất',
      lotNo: 'Số LOT',
      item: 'Vật tư',
      status: 'Trạng thái chất lượng',
      all: 'Tất cả',
      note: 'Tra cứu LOT mục tiêu theo ngày chuyển đổi gần nhất.',
      periodMissing: 'Hãy chọn cả ngày bắt đầu và ngày kết thúc tra cứu.',
      periodInvalid: 'Hãy nhập ngày hợp lệ cho khoảng thời gian tra cứu.',
      periodReversed: 'Ngày bắt đầu tra cứu không được muộn hơn ngày kết thúc.',
      reset: 'Đặt lại',
      search: 'Tra cứu',
    },
    fields: {
      lotNo: 'Số LOT',
      item: 'Mặt hàng',
      status: 'Trạng thái chất lượng',
      onHand: 'Số lượng đang giữ',
      held: 'Số lượng tạm giữ',
    },
    select: (lotNo: string): string => `Chọn ${lotNo}`,
    statusUnknown: (code: string): string => `${code} (chưa xác định tên)`,
    loading: 'Đang tải LOT ứng viên',
    failed: 'Không tải được LOT ứng viên.',
    retry: 'Thử lại',
    empty: 'Không có LOT nào khớp điều kiện.',
    summary: (total: string, page: number, totalPages: number): string =>
      `Tổng ${total} mục · trang ${String(page)} / ${String(totalPages)}`,
    pagination: 'Chuyển trang LOT ứng viên',
    previous: 'Trang trước',
    next: 'Trang sau',
  },
  selected: {
    pane: 'LOT đã chọn',
    title: 'LOT đã chọn',
    identity: 'Định danh LOT đã chọn',
    lotNo: 'Số LOT',
    item: 'Mặt hàng',
    currentTitle: 'Trạng thái hiện tại',
    current: 'Trạng thái hiện tại của LOT đã chọn',
    status: 'Lot Status',
    onHand: 'Số lượng đang giữ',
    held: 'Số lượng tạm giữ',
    available: 'Số lượng khả dụng',
    latestTransition: 'Chuyển đổi gần nhất',
    latestReason: 'Lý do gần nhất',
  },
  preparation: {
    pane: 'Chuẩn bị chuyển đổi trạng thái',
    loading: 'Đang tải lựa chọn chuyển đổi',
    failed: 'Không tải được lựa chọn chuyển đổi.',
    retry: 'Thử lại',
    noTransition: 'LOT hiện tại không chuyển đổi được.',
    choiceTitle: 'Trạng thái cần chuyển sang',
    choiceLabel: 'Chuyển đổi',
    holds: {
      pane: 'Danh sách mục tạm giữ đang mở',
      title: 'Mục tạm giữ đang mở',
      reason: 'Lý do tạm giữ',
      heldAt: 'Thời điểm tạm giữ',
      quantity: 'Số lượng tạm giữ',
      full: 'Toàn bộ',
      target: 'Mục cần gỡ',
      select: 'Chọn',
      selected: 'Đã chọn',
    },
    notes: {
      createReady: 'Đã chuẩn bị xong việc đăng ký tạm giữ.',
      lockUnknown: 'Không xác nhận được thông tin khóa LOT nên không đi tiếp được.',
      holdsLoading: 'Đang tải mục tạm giữ đang mở.',
      holdsFailed: 'Không tải được mục tạm giữ đang mở.',
      holdsEmpty: 'Không có mục tạm giữ đang mở nào để gỡ.',
      detailLoading: 'Đang tải chi tiết mục tạm giữ.',
      detailFailed: 'Không tải được chi tiết mục tạm giữ.',
      releaseReady: 'Đã chuẩn bị xong việc gỡ tạm giữ.',
    },
  },
  create: {
    pane: 'Nhập đăng ký tạm giữ',
    scope: 'Phạm vi tạm giữ',
    full: 'Tạm giữ toàn bộ',
    partial: 'Tạm giữ một phần',
    quantity: 'Số lượng tạm giữ',
    remarks: 'Ghi chú tạm giữ',
    confirm: 'Xác nhận đăng ký',
    dialogTitle: (lotNo: string): string => `Đăng ký tạm giữ LOT — ${lotNo}`,
    cancel: 'Hủy bỏ',
    register: 'Đăng ký tạm giữ',
    reload: 'Tải nội dung mới nhất',
    success: 'Đã đăng ký tạm giữ LOT.',
    quantityPositive: 'Số lượng tạm giữ phải lớn hơn 0.',
    quantityUnknown: 'Không xác nhận được số lượng có thể tạm giữ.',
    quantityMax: (maximum: string): string =>
      `Số lượng tạm giữ phải không quá số lượng có thể tạm giữ ${maximum}.`,
    impact: {
      title: 'Việc chuyển đổi này sẽ làm gì',
      description: 'Hold chặn xuất kho · xuất hàng và lấy hàng của số lượng mục tiêu.',
      targetQuantity: (quantity: string): string => `Số lượng mục tiêu: ${quantity}`,
      fullQuantity: 'Toàn bộ',
      targetLocation: (location: string): string => `Vị trí mục tiêu: ${location}`,
      location: (warehouse: string, location: string): string =>
        `Kho ${warehouse} / Location ${location}`,
      unknown: 'Chưa xác định',
      openPicking: (count: string): string => `Sẽ chặn ${count} yêu cầu đang lấy hàng.`,
      shipped: (quantity: string): string =>
        `Số lượng ${quantity} đã xuất kho sẽ không được thu hồi bởi lần chuyển đổi này.`,
      recovery:
        'Muốn dùng lại thì cần một lần chuyển đổi Release, và số lượng đã xuất kho sẽ không thu hồi lại được.',
    },
  },
  release: {
    pane: 'Nhập gỡ tạm giữ',
    scope: 'Phạm vi gỡ',
    full: 'Gỡ toàn bộ',
    partial: 'Gỡ một phần',
    quantity: 'Số lượng gỡ',
    remarks: 'Ghi chú',
    confirm: 'Xác nhận gỡ',
    dialogTitle: (lotNo: string): string => `Gỡ tạm giữ LOT — ${lotNo}`,
    cancel: 'Hủy bỏ',
    release: 'Gỡ tạm giữ',
    reload: 'Tải nội dung mới nhất',
    success: 'Đã gỡ tạm giữ LOT.',
    quantityPositive: 'Số lượng gỡ phải lớn hơn 0.',
    quantityUnknown: 'Không xác nhận được số lượng tạm giữ có thể gỡ.',
    quantityMax: (maximum: string): string =>
      `Số lượng gỡ phải không quá số lượng tạm giữ ${maximum}.`,
    remarksRequired: 'Hãy nhập ghi chú.',
    impact: {
      title: 'Việc chuyển đổi này sẽ làm gì',
      description:
        'Gỡ tạm giữ mở lại hạn chế xuất kho · xuất hàng và lấy hàng của số lượng mục tiêu.',
      targetQuantity: (quantity: string): string => `Số lượng mục tiêu: ${quantity}`,
      fullQuantity: 'Toàn bộ',
      targetLocation: (location: string): string => `Vị trí mục tiêu: ${location}`,
      location: (warehouse: string, location: string): string =>
        `Kho ${warehouse} / Location ${location}`,
      unknown: 'Chưa xác định',
      recovery:
        'Nếu cần tạm giữ lại thì phải đăng ký một Hold mới, và số lượng đã xuất kho sẽ không thu hồi lại được.',
    },
  },
  stale: {
    fallback: 'Thông tin LOT đã thay đổi. Hãy tải nội dung mới nhất rồi kiểm tra lại.',
    withStatus: (statusLabel: string): string =>
      `Thông tin LOT đã thay đổi. Trạng thái hiện tại là ${statusLabel}. Hãy tải nội dung mới nhất rồi kiểm tra lại.`,
  },
};
