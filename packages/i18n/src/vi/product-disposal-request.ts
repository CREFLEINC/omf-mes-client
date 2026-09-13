import type { ko } from '../ko';
import type { Translated } from './translated';

/** W-04-10 제품 폐기 요청. 요청 → 승인 → 기타출고 3단이고 결재는 결재함 몫이다. */
export const productDisposalRequest: Translated<typeof ko.productDisposalRequest> = {
  title: 'Yêu cầu hủy thành phẩm',
  breadcrumbRoot: 'Xuất hàng',
  headerNotice: 'Việc phê duyệt làm ở hộp phê duyệt. Màn hình này lo phần yêu cầu và xuất kho.',
  tabs: {
    request: 'Yêu cầu hủy',
    history: 'Lịch sử xử lý',
  },
  panes: {
    targets: 'Đối tượng hủy',
    request: 'Yêu cầu hủy',
    issue: 'Sau khi duyệt — xuất kho khác',
    history: 'Lịch sử xử lý',
  },
  targets: {
    loading: 'Đang tải các đối tượng hủy',
    loadFailed: 'Không tải được các đối tượng hủy',
    empty: 'Không có quyết định xử lý nào còn phần xử lý tiếp theo',
    emptyDescription: 'Phải đánh giá xử lý xong thì mới hiện ở đây.',
    selectAll: 'Chọn tất cả đối tượng ở trang này',
    selectRow: (lotNo: string): string => `Chọn ${lotNo}`,
    fields: {
      lotNo: 'LOT',
      item: 'Mặt hàng',
      qty: 'Số lượng',
      nonconformanceNo: 'Điểm không phù hợp',
      disposition: 'Quyết định xử lý',
      decidedAt: 'Ngày đánh giá',
      decidedBy: 'Người đánh giá',
    },
    judgmentRequired:
      'Không đánh giá thì không hủy được. Hãy yêu cầu trước ở màn hình yêu cầu đánh giá làm lại hoặc hủy.',
    disposition: {
      SCRAP: 'Hủy',
      REWORK: 'Làm lại',
      NORMAL: 'Bình thường',
    },
    selected: (count: number, qty: string): string => `Đã chọn ${String(count)} mục · Tổng ${qty}`,
  },
  request: {
    reasonLabel: 'Lý do',
    reasonHelp: 'Đã chép sẵn lý do của quyết định xử lý. Nếu lý do hủy khác thì hãy sửa lại.',
    reasonRequired: 'Hãy nhập lý do',
    reasonTooLong: 'Lý do quá dài. Hãy nhập tối đa 500 ký tự',
    qtyLabel: 'Số lượng',
    routeLabel: 'Luồng phê duyệt',
    routeChecking: 'Đang kiểm tra luồng phê duyệt',
    routeFound: 'Đã xác nhận',
    routeMissing:
      'Không có luồng phê duyệt cho yêu cầu hủy. Hãy định nghĩa trước ở phần quản lý luồng phê duyệt.',
    routeFailed: 'Không kiểm tra được luồng phê duyệt',
    submit: 'Yêu cầu phê duyệt',
    submitted: 'Đã tiếp nhận yêu cầu hủy. Việc phê duyệt sẽ chạy theo luồng phê duyệt.',
  },
  issue: {
    typeLabel: 'Loại xuất kho',
    typeFixed: 'Cố định là xuất kho khác',
    selfDisposal: 'Tự hủy (không có đơn vị bên ngoài)',
    selfDisposalHelp:
      'Đánh dấu thì sẽ để trống đối tác hủy. Hàng đi ra rồi mất đi thì không có nơi đến.',
    partnerLabel: 'Đối tác hủy',
    partnerPlaceholder: 'Hãy chọn đối tác hủy',
    partnerEmpty: 'Không có đối tác nào được gắn vai trò hủy',
    partnerPending: 'Các lựa chọn chưa sẵn sàng. Vẫn xuất kho được bằng hình thức tự hủy.',
    partnerFailed: 'Không tải được đối tác hủy',
    reasonLabel: 'Lý do xuất kho',
    submit: 'Xử lý xuất kho khác',
    destinationLabel: 'Nơi đến',
    destinationSelf: 'Tự hủy (không có đơn vị bên ngoài)',
    destinationUnset: 'Vẫn chưa xác định',
    pickRow: 'Chọn phiếu thì mới xuất kho được.',
    notSubmitted: 'Đây là phiếu vẫn chưa trình duyệt. Hãy gửi yêu cầu phê duyệt trước.',
    notOurs: 'Đây không phải phiếu do màn hình này tạo. Hãy xử lý ở màn hình yêu cầu hủy vật tư.',
    tokenLoading: 'Đang kiểm tra phiếu',
    tokenFailed: 'Không tải được phiếu nên không xuất kho được. Hãy tải lại.',
    posted: 'Đã xử lý xuất kho khác. Tồn kho đã bị trừ.',
    unlockNote: 'Phê duyệt chỉ mở khóa. Việc xuất kho thì sau khi duyệt vẫn phải bấm lại ở đây.',
  },
  lock: {
    selectNone: 'Hãy chọn đối tượng cần hủy',
    reason: 'Hãy nhập lý do',
    route: 'Phải có luồng phê duyệt mới yêu cầu được',
    issueReason: 'Hãy chọn lý do hủy',
    destination: 'Hãy chọn đối tác hủy hoặc đánh dấu tự hủy',
    saving: 'Đang xử lý',
  },
  placement: {
    noTarget: 'Hãy chọn đối tượng cần hủy',
    pending: 'Đang kiểm tra vị trí tồn kho',
    lotMissing: 'Có mục đánh giá không kèm LOT nên không tạo được dòng xuất kho',
    notFound: 'Không tìm thấy vị trí tồn kho của LOT đã chọn. Hãy kiểm tra ở phần tồn kho hiện tại',
    failed: 'Không tải được vị trí tồn kho',
    overOnHand: (lotNo: string): string =>
      `Số lượng đánh giá của ${lotNo} nhiều hơn lượng đang giữ ở chỗ đó`,
    split: 'LOT đã chọn nằm rải ở nhiều vị trí. Hãy gom tồn kho về một vị trí rồi yêu cầu',
    mixedWarehouse:
      'Các đối tượng đã chọn nằm ở những kho khác nhau. Hãy tách theo từng kho rồi yêu cầu',
  },
  history: {
    loading: 'Đang tải lịch sử xử lý',
    loadFailed: 'Không tải được lịch sử xử lý',
    emptyTitle: 'Không có phiếu xuất kho khác nào',
    mixedNotice:
      'Hiển thị toàn bộ phiếu xuất kho khác. Có lẫn phiếu hủy vật tư nên hãy xem cột nguồn gốc.',
    sourceProduct: 'Hủy thành phẩm',
    sourceOther: 'Khác',
    fields: {
      no: 'Số xuất kho',
      source: 'Nguồn gốc',
      issuedAt: 'Ngày giờ xuất kho',
      status: 'Trạng thái',
      reason: 'Lý do',
      approval: 'Phê duyệt',
    },
  },
  approval: {
    title: 'Tiến độ phê duyệt',
    pickRow: 'Chọn phiếu thì sẽ hiện tiến độ phê duyệt.',
    notSubmitted: 'Đây là phiếu chưa trình duyệt',
    submitted: 'Đã trình duyệt',
    loading: 'Đang tải tiến độ phê duyệt',
    loadFailed: 'Không tải được tiến độ phê duyệt',
    approved: 'Duyệt',
    rejected: 'Từ chối',
    waiting: 'Chờ',
    unknownApprover: 'Chưa nhận được người duyệt',
    inProgress: (current: number, total: number): string =>
      `Bước ${String(current)} trong ${String(total)} bước`,
    finished: (total: number): string => `Đã xong ${String(total)} bước phê duyệt`,
  },
  errors: {
    submitTokenMissing:
      'Phiếu hủy đã được tạo nhưng không trình duyệt được. Đừng tạo lại, hãy kiểm tra phiếu này ở hộp phê duyệt.',
  },
  confirm: {
    title: 'Yêu cầu hủy',
    target: (count: number, qty: string): string =>
      `Sẽ yêu cầu hủy ${String(count)} đối tượng · tổng ${qty}.`,
    approvalNote: 'Yêu cầu sẽ đi lên theo luồng phê duyệt. Được duyệt rồi mới xuất kho được.',
    irreversible:
      'Sau khi gửi yêu cầu thì không rút lại được ở màn hình. Muốn lật lại thì dùng phần từ chối ở hộp phê duyệt.',
    cancel: 'Hủy',
    submit: 'Yêu cầu phê duyệt',
  },
  withdrawn: {
    account:
      'Hệ thống này không xử lý tài khoản kế toán cho việc hủy. Phần kế toán làm ở bên ngoài.',
    noWithdraw:
      'Không có đường rút lại yêu cầu đã gửi ngay trên màn hình. Hãy xử lý bằng phần từ chối ở hộp phê duyệt.',
  },
};
