import type { ko } from '../ko';
import type { Translated } from './translated';

/** W-01-01 IQC 수입검사·판정. 검사자가 쓰는 말로 쓰고, 확정이 되돌릴 수 없다는 것을 먼저 말한다. */
export const iqcInspection: Translated<typeof ko.iqcInspection> = {
  title: 'IQC kiểm tra đầu vào · đánh giá',
  breadcrumbRoot: 'Kho vật tư',

  queue: {
    heading: 'Chờ kiểm tra',
    columns: {
      inspectionRequestNo: 'Số yêu cầu',
      lotId: 'LOT vật tư',
      statusCode: 'Trạng thái',
      requestedAt: 'Thời điểm yêu cầu',
    },
    emptyValue: '—',
    openRow: (inspectionRequestNo: string): string => `Mở yêu cầu kiểm tra ${inspectionRequestNo}`,
    caption: 'Danh sách chờ kiểm tra',
    empty: 'Không có yêu cầu kiểm tra nào khớp điều kiện. Hãy thử nới rộng điều kiện.',
    unavailable: 'Không hiển thị được danh sách.',
    loading: 'Đang tải các yêu cầu kiểm tra.',
  },

  filters: {
    item: 'Mặt hàng',
    itemPlaceholder: 'Tìm theo số mặt hàng',
    supplier: 'Nhà cung cấp',
    supplierPlaceholder: 'Tìm theo số nhà cung cấp',
    keyword: 'Số yêu cầu',
    keywordPlaceholder: 'Tìm theo số yêu cầu',
    apply: 'Tra cứu',
    reset: 'Đặt lại',
    identifierInvalid: 'Hãy nhập số là số nguyên từ 1 trở lên.',
  },

  status: {
    requested: 'Chờ',
    inProgress: 'Đang làm',
  },

  detail: {
    heading: 'Đối tượng',
    sectionTitle: 'Thông tin kiểm tra cơ bản',
    nothingSelected: 'Hãy chọn yêu cầu cần kiểm tra ở danh sách bên trái.',
    loading: 'Đang tải yêu cầu.',
    fields: {
      inspectionRequestNo: 'Số yêu cầu',
      inspectionTypeCode: 'Loại kiểm tra',
      inspectionPlanVersionId: 'Phiên bản tiêu chuẩn kiểm tra',
      lotId: 'LOT liên quan',
      itemId: 'Mặt hàng',
      targetQty: 'Số lượng kiểm tra',
      requestedAt: 'Thời điểm yêu cầu',
    },
    planVersionNote: 'Cố định theo phiên bản tiêu chuẩn tại thời điểm yêu cầu.',
    noPlanVersion: 'Không có tiêu chuẩn',
  },

  result: {
    heading: 'Đánh giá số lượng',
    sectionTitle: 'Số lượng kết quả kiểm tra',
    judgmentSectionTitle: 'Đánh giá',
    round: (round: number): string => `Lượt ${round}`,
    loading: 'Đang tải kết quả kiểm tra.',
    confirmed:
      'Lượt này đã xác nhận nên không sửa được. Muốn kiểm tra lại thì thêm một lượt kiểm tra lại.',
    fields: {
      inspectedQty: 'Số lượng kiểm tra',
      accepted: 'Số lượng đạt',
      rejected: 'Số lượng không đạt',
      held: 'Số lượng tạm giữ',
    },
    sum: 'Tổng',
    remaining: 'Còn lại',
    progressTitle: 'Tình trạng nhập',
    progressLabel: 'Tổng đã nhập so với số lượng kiểm tra',
    matched: 'Khớp với số lượng kiểm tra.',
    over: (over: string): string => `Nhiều hơn số lượng kiểm tra ${over}. Hãy giảm số lượng.`,
    quantityInvalid: 'Hãy nhập số từ 0 trở lên. Tối đa sáu chữ số thập phân.',
    save: 'Lưu tạm',
    saving: 'Đang lưu',
    saved: 'Đã lưu.',
    saveBlockedByInvalid: 'Hãy sửa các ô số lượng rồi mới lưu được.',

    judgment: 'Đánh giá tổng hợp',
    judgmentPlaceholder: 'Hãy chọn đánh giá',
    judgmentUnavailable: 'Danh sách giá trị đánh giá chưa được chuẩn bị. Hãy hỏi người phụ trách.',
    judgmentUnknown: (code: string): string =>
      `Đánh giá đã lưu (${code}) không có trong danh sách.`,

    confirm: 'Xác nhận đánh giá',
    confirming: 'Đang xác nhận',
    confirmNote: 'Khi xác nhận đánh giá, trạng thái LOT sẽ thay đổi, sau đó không thể hoàn tác.',
    submitTitle: 'Lưu và xác nhận',
    confirmBlockedByTotals: 'Tổng đã nhập phải bằng số lượng kiểm tra mới xác nhận được.',
    confirmBlockedByJudgment: 'Phải chọn đánh giá tổng hợp mới xác nhận được.',
    confirmBlockedByConfirmed: 'Lượt này đã được xác nhận.',
    confirmBlockedByUnsaved: 'Sau khi lưu tạm mới có thể xác nhận đánh giá.',
    confirmSucceeded: 'Đã xác nhận đánh giá.',

    partialReceipt: 'Cho phép nhập kho một phần',
    partialTitle: 'Nhập kho một phần',
    partialReceiptPending: 'Chức năng cho phép nhập kho một phần sẽ được cập nhật.',

    reinspect: 'Thêm lượt kiểm tra lại',
    reinspectCancel: 'Thôi kiểm tra lại',
    reinspectRound: 'Lượt mới (kiểm tra lại)',
    reinspectNote:
      'Nhập số lượng rồi lưu tạm thì một lượt mới được tạo. Lượt trước vẫn giữ nguyên.',
    reinspectReasonPending:
      'Lý do kiểm tra lại chưa chọn được. Khi danh sách lý do được chốt thì sẽ thêm vào chỗ này.',
  },

  history: {
    heading: 'Các lượt trước',
    caption: 'Các lượt kiểm tra trước',
    columns: {
      round: 'Lượt',
      judgment: 'Đánh giá tổng hợp',
      accepted: 'Đạt',
      rejected: 'Không đạt',
      held: 'Tạm giữ',
      confirmedAt: 'Thời điểm xác nhận',
    },
    notConfirmed: 'Chưa xác nhận',
  },

  measurements: {
    heading: 'Hạng mục kiểm tra',
    caption: 'Giá trị đo theo từng hạng mục',
    loading: 'Đang tải các hạng mục kiểm tra.',
    noItems:
      'Phiên bản tiêu chuẩn kiểm tra này không có hạng mục nào. Hãy hỏi người phụ trách dữ liệu gốc.',
    columns: {
      item: 'Hạng mục',
      spec: 'Quy cách',
      sample: 'Mẫu',
      value: 'Giá trị đo',
      judgment: 'Đánh giá',
    },
    requiredMark: 'Bắt buộc',
    sampleOf: (sampleNo: number, count: number): string => `${sampleNo} trên ${count}`,
    range: (lower: number, upper: number): string => `${lower} ~ ${upper}`,
    atLeast: (lower: number): string => `${lower} trở lên`,
    atMost: (upper: number): string => `${upper} trở xuống`,
    target: (value: number): string => `Mục tiêu ${value}`,
    notMeasured: '—',
    calibrationWarningTitle: 'Có giá trị được đo bằng thiết bị đo đã hết hạn hiệu chuẩn',
    calibrationWarning:
      'Hãy kiểm tra lại giá trị đo đó. Việc này không chặn kiểm tra — về hiệu chuẩn thiết bị đo, hãy hỏi người phụ trách thiết bị.',
    calibrationExpired: 'Hết hạn hiệu chuẩn',
  },

  pageNav: {
    label: 'Chuyển trang danh sách chờ kiểm tra',
    range: (start: number, end: number, total: number): string =>
      `${start}–${end} / Tổng ${total} phiếu`,
    totalOnly: (total: number): string => `Tổng ${total} phiếu`,
    previous: 'Trước',
    next: 'Sau',
    beyondLast: 'Trang này không có kết quả. Hãy quay về trang trước.',
    toFirstPage: 'Về trang đầu',
  },
};
