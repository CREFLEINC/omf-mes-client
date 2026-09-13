import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-03-10 처분 판정 처리. 부적합 하나를 골라 재작업·폐기·정상 중 무엇을 할지 정한다.
 *
 * ⚠ 「판정」(`đánh giá`)과 「처분」(`quyết định xử lý`)은 다른 일이다 — 판정은 가르는 일이고
 * 처분은 가른 뒤 무엇을 할지다. 용어집의 짝을 그대로 두고 한 화면 안에서 섞지 않는다.
 */
export const dispositionDecision: Translated<typeof ko.dispositionDecision> = {
  title: 'Ra quyết định xử lý',
  breadcrumbRoot: 'Chất lượng',
  tabs: {
    label: 'Xem đánh giá quyết định xử lý',
    pending: 'Chờ đánh giá',
    history: 'Lịch sử xử lý',
  },
  panes: {
    list: 'Danh sách chờ đánh giá',
    detail: 'Mục không phù hợp đã chọn',
    decision: 'Đánh giá',
    history: 'Lịch sử đánh giá quyết định xử lý',
    lots: 'LOT liên quan',
    decisions: 'Lịch sử đánh giá',
  },
  fields: {
    period: 'Ngày tiếp nhận',
    decidedPeriod: 'Ngày đánh giá',
    item: 'Mặt hàng',
    severityCode: 'Mức nghiêm trọng',
    statusCode: 'Trạng thái',
    sourceCode: 'Nguồn',
    nonconformanceNo: 'Số không phù hợp',
    openedAt: 'Ngày tiếp nhận',
    qty: 'Số lượng',
    description: 'Mô tả',
    lotNo: 'LOT',
    uom: 'Đơn vị',
    qualityStatus: 'Trạng thái chất lượng',
    dispositionTypeCode: 'Quyết định xử lý',
    decisionQty: 'Số lượng',
    reason: 'Lý do',
    decidedAt: 'Thời điểm đánh giá',
    decidedBy: 'Người đánh giá',
    remainingQty: 'Số lượng còn lại',
    dispositionProgressCode: 'Tiến độ đánh giá',
  },
  all: 'Tất cả',
  codePending: 'Giá trị gốc để chọn vẫn chưa sẵn sàng',
  codePlaceholder: 'Đang chuẩn bị giá trị gốc',
  codeLock: {
    loading: 'Đang tải giá trị gốc',
    failed: 'Không tải được giá trị gốc. Hãy tra cứu lại',
    empty: 'Chưa có giá trị gốc nào được đăng ký. Phải có giá trị trong mã chung thì mới chọn được',
  },
  codeTruncated:
    'Chỉ nhận được một phần giá trị gốc. Giá trị không có trong danh sách thì không chọn được',
  dispositionPending: 'Lựa chọn quyết định xử lý chưa sẵn sàng nên chưa lưu được đánh giá',
  sourceNote:
    'Chỉ có hai nhánh thành phẩm · trả hàng. Không phù hợp của sửa chữa · vật tư không vào danh sách này.',
  actions: {
    selectRow: (nonconformanceNo: string): string => `Chọn ${nonconformanceNo}`,
    save: 'Lưu đánh giá',
    cancel: 'Hủy bỏ',
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
  },
  detail: {
    select: 'Hãy chọn một mục không phù hợp',
    loading: 'Đang tải chi tiết không phù hợp',
    notFound: 'Không tìm thấy mục không phù hợp',
    notFoundDescription: 'Hãy tra cứu lại danh sách rồi chọn mục không phù hợp khác.',
    emptyDescription: 'Chưa có mô tả nào được đăng ký',
    noLots: 'Không có LOT liên quan',
    transitionHistoryUnavailable:
      'Trạng thái LOT thay đổi do đánh giá không lưu lại trong bảng này. Chỉ hiển thị trạng thái hiện tại.',
  },
  decisions: {
    loading: 'Đang tải lịch sử đánh giá',
    empty: 'Chưa có nội dung nào được đánh giá',
    unavailable: 'Không hiển thị được lịch sử đánh giá',
  },
  remaining: {
    label: 'Số lượng còn lại',
    note: 'Số lượng còn lại hiển thị ở đây là giá trị tham khảo. Số lượng lưu được do máy chủ đánh giá khi lưu.',
    unknown: 'Không tính được số lượng còn lại',
    settled: 'Không còn số lượng nào. Mục không phù hợp này đã đánh giá xong',
  },
  form: {
    dispositionLabel: 'Quyết định xử lý',
    qtyLabel: 'Số lượng',
    qtyHelp: 'Hãy nhập số lớn hơn 0. Số lượng lưu được do máy chủ xác định khi lưu.',
    reasonLabel: 'Lý do',
    reasonHelp: 'Hãy ghi lại căn cứ đã chọn quyết định xử lý này.',
    qtyRequired: 'Hãy nhập số lượng',
    qtyNotNumber: 'Hãy nhập số lượng bằng chữ số',
    qtyTooLong: 'Số lượng quá dài. Hãy nhập tối đa 12 chữ số phần nguyên · 6 chữ số phần thập phân',
    qtyTooSmall: 'Số lượng phải lớn hơn 0',
    qtyOverRemaining: (remaining: string): string =>
      `Nhiều hơn số lượng còn lại mà màn hình tính được (${remaining}). Số lượng còn lại do máy chủ xác định khi lưu`,
    qtySettledNotice:
      'Màn hình tính ra không còn số lượng nào. Việc lưu được hay không do máy chủ xác định',
    qtyExceededByServer: (remaining: string): string =>
      `Tổng số lượng quyết định xử lý vượt số lượng còn lại (${remaining}) nên chưa được lưu. Hãy nhập lại không quá số lượng còn lại`,
    alreadyClosed: 'Mục không phù hợp này đã kết thúc. Không lưu được đánh giá',
    reasonRequired: 'Hãy nhập lý do',
    dispositionRequired: 'Hãy chọn quyết định xử lý',
    savingReason: 'Đang lưu đánh giá',
    uncertainReason: 'Phải kiểm tra kết quả xử lý của đánh giá đã gửi trước đó',
    uncertainOtherTarget: (nonconformanceNo: string): string =>
      `Phải kiểm tra kết quả xử lý của đánh giá đã gửi cho mục không phù hợp ${nonconformanceNo}`,
    forbiddenReason: 'Không có quyền đánh giá. Cần quyền thì hãy hỏi người phụ trách',
    unitUnknownReason:
      'Không xác định được một đơn vị chung cho LOT liên quan nên không đánh giá được. Hãy hỏi người phụ trách',
    checkOutcome: 'Kiểm tra kết quả xử lý',
    selectFirstReason: 'Hãy chọn mục không phù hợp cần đánh giá trước',
    reloadDetail: 'Kiểm tra lại trạng thái không phù hợp',
    irreversible: 'Đánh giá không thể hoàn tác',
    success: 'Đã lưu đánh giá',
  },
  loading: 'Đang tải danh sách chờ đánh giá',
  historyLoading: 'Đang tải lịch sử xử lý',
  empty: {
    title: 'Không có mục không phù hợp nào khớp điều kiện',
    description: 'Hãy nới rộng khoảng thời gian hoặc tra cứu với điều kiện khác.',
    historyTitle: 'Không có nội dung đánh giá nào khớp điều kiện',
    historyDescription: 'Hãy nới rộng khoảng ngày đánh giá rồi tra cứu lại.',
    beyondTitle: 'Không có nội dung nào để hiển thị ở trang này',
    beyondDescription: 'Hãy quay về trang đầu để xem.',
  },
  page: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / tổng ${String(total)} mục`,
    total: (total: number): string => `Tổng ${String(total)} mục`,
  },
  values: {
    unknownQty: '—',
    periodRequired: 'Phải chọn khoảng thời gian thì mới tra cứu được',
    periodInvalid: 'Ngày này không có trên lịch. Hãy sửa thành ngày có thật',
    periodReversed: 'Ngày bắt đầu sau ngày kết thúc. Hãy đổi chỗ hai ngày',
    sourceCode: {
      PRODUCT: 'Thành phẩm',
      RETURN: 'Trả hàng',
    },
    dispositionType: {
      REWORK: 'Làm lại',
      SCRAP: 'Hủy',
      NORMAL: 'Bình thường',
    },
    dispositionProgress: {
      NOT_STARTED: 'Chưa đánh giá',
      PARTIAL: 'Đánh giá một phần',
      COMPLETED: 'Hoàn tất',
    },
  },
};
