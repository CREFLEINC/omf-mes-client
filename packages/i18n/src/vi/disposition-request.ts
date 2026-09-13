import type { ko } from '../ko';
import type { Translated } from './translated';

/** W-04-07 재작업/폐기 판정 의뢰. 이 화면은 의뢰만 한다 — 판정은 품질 화면 몫이다. */
export const dispositionRequest: Translated<typeof ko.dispositionRequest> = {
  title: 'Yêu cầu đánh giá làm lại hoặc hủy',
  breadcrumbRoot: 'Xuất hàng',
  scopeNotice:
    'Việc đánh giá làm ở màn hình chất lượng. Ở đây chỉ đăng ký điểm không phù hợp và yêu cầu đánh giá.',
  periodContractBlocked:
    'Vẫn chưa tải được danh sách theo trạng thái điểm không phù hợp. Máy chủ bắt buộc phải có khoảng thời gian tra cứu mà màn hình này lại không có điều kiện thời gian, nên sẽ mở sau khi đội máy chủ xác nhận. Trong lúc đó hãy để trống điều kiện trạng thái và dùng danh sách đối tượng chờ đánh giá.',
  panes: {
    list: 'Đối tượng chờ đánh giá',
    target: 'Đối tượng đã chọn',
    register: '① Đăng ký điểm không phù hợp',
    request: '② Yêu cầu đánh giá',
    result: '③ Sau khi nhận kết quả',
    progress: 'Các bước tiến hành',
    decisions: 'Danh sách quyết định xử lý',
  },
  fields: {
    warehouse: 'Kho',
    sourceCode: 'Nguồn gốc',
    stage: 'Trạng thái',
    keyword: 'Từ khóa',
    lotNo: 'LOT',
    item: 'Mặt hàng',
    qty: 'Số lượng',
    uom: 'Đơn vị',
    receiptNo: 'Số nhập kho',
    receivedAt: 'Ngày nhập kho',
    partner: 'Đối tác',
    inspectionResult: 'Kết quả kiểm tra',
    nonconformanceNo: 'Số điểm không phù hợp',
    severity: 'Mức nghiêm trọng',
    description: 'Nội dung',
    department: 'Bộ phận phụ trách',
    requestedQty: 'Số lượng yêu cầu',
    remarks: 'Ghi chú',
    dispositionType: 'Quyết định xử lý',
    decisionQty: 'Số lượng',
    reason: 'Lý do',
    decidedAt: 'Ngày giờ đánh giá',
  },
  all: 'Tất cả',
  none: 'Không có',
  keywordPlaceholder: 'Số LOT, số nhập kho, mặt hàng',
  codePending: 'Giá trị gốc để chọn vẫn chưa được chuẩn bị',
  codePlaceholder: 'Đang chuẩn bị giá trị gốc',
  warehousePending: 'Vẫn chưa có danh sách kho hàng lỗi. Sẽ tra cứu mà không lọc theo kho.',
  values: {
    sourceCode: {
      RETURN: 'Trả hàng',
      PRODUCT: 'Thành phẩm (OQC không đạt)',
    },
    stage: {
      NONE: 'Không có điểm không phù hợp',
      NOT_REQUESTED: 'Chưa yêu cầu',
      PENDING_DECISION: 'Chờ đánh giá',
      DECIDED: 'Đã đánh giá xong',
    },
    dispositionType: {
      REWORK: 'Làm lại',
      SCRAP: 'Hủy',
      NORMAL: 'Bình thường',
    },
    unknownQty: '—',
    notAvailable: '—',
  },
  stageSourceNote:
    'Chưa yêu cầu, chờ đánh giá và đã đánh giá xong được tra cứu theo các điểm không phù hợp đã đăng ký.',
  loading: 'Đang tải các đối tượng chờ đánh giá',
  empty: {
    title: 'Không có đối tượng nào đang chờ đánh giá',
    description: 'Hãy đổi điều kiện hoặc mở rộng phạm vi kho.',
    beyondTitle: 'Trang này không có đối tượng nào',
    beyondDescription:
      'Có đối tượng khớp điều kiện nhưng không nằm ở trang này. Hãy quay về trang đầu.',
  },
  page: {
    label: 'Chuyển trang danh sách đối tượng chờ đánh giá',
    total: (total: number): string => `Tổng ${String(total)} mục`,
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / ${String(total)} mục`,
  },
  actions: {
    selectRow: (lotNo: string): string => `Chọn ${lotNo}`,
    register: 'Đăng ký điểm không phù hợp',
    request: 'Yêu cầu đánh giá',
    cancel: 'Hủy',
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
    checkOutcome: 'Kiểm tra kết quả xử lý',
    openDecision: 'Xem kết quả đánh giá',
    reworkResult: 'Đăng ký kết quả làm lại',
    disposalRequest: 'Đề nghị hủy',
    reinstate: 'Đăng ký lại tồn kho',
  },
  target: {
    select: 'Hãy chọn đối tượng ở danh sách bên trái',
    loading: 'Đang tải chi tiết điểm không phù hợp',
    notFound: 'Không tìm thấy điểm không phù hợp',
    notFoundDescription: 'Hãy tra cứu lại danh sách rồi chọn đối tượng khác',
    returnSource: 'Nhập kho hàng trả',
    productSource: 'OQC không đạt',
    lotCount: (count: number): string => `${String(count)} LOT`,
  },
  progress: {
    register: 'Đăng ký điểm không phù hợp',
    request: 'Yêu cầu đánh giá',
    decide: 'Đánh giá (màn hình chất lượng)',
    followUp: 'Xử lý tiếp theo',
  },
  register: {
    severityLabel: 'Mức nghiêm trọng',
    severityPlaceholder: 'Hãy chọn mức nghiêm trọng',
    descriptionLabel: 'Nội dung',
    descriptionHelp:
      'Hãy ghi cái gì · chỗ nào · sai đến mức nào. Ví dụ: xước bề mặt · góc trên · mắt thường thấy 40 trong 200 cái',
    descriptionRequired: 'Hãy ghi cái gì đã sai',
    descriptionShort:
      'Người đánh giá chỉ đọc câu này rồi quyết định. Ghi cụ thể hơn một chút thì tốt hơn',
    severityRequired: 'Hãy chọn mức nghiêm trọng',
    departmentLabel: 'Bộ phận phụ trách',
    departmentNone: 'Không chỉ định',
    sourceDerived: 'Nguồn gốc do máy chủ xác định theo loại nhập kho. Không chọn ở đây.',
    qtyNote: (qty: string, uom: string): string =>
      `Đăng ký toàn bộ số lượng đối tượng ${qty} ${uom} là điểm không phù hợp.`,
    success: 'Đã đăng ký điểm không phù hợp',
    irreversible: 'Điểm không phù hợp đã đăng ký thì không xóa được.',
    lock: {
      noTarget: 'Đăng ký điểm không phù hợp chỉ làm được sau khi chọn đối tượng.',
      alreadyRegistered: (nonconformanceNo: string): string =>
        `Việc đăng ký điểm không phù hợp đã xong rồi (${nonconformanceNo}). Hãy yêu cầu đánh giá ở bên dưới.`,
      severityPending:
        'Đăng ký điểm không phù hợp chỉ làm được khi giá trị gốc của mức nghiêm trọng đã sẵn sàng.',
      noLot: 'Đăng ký điểm không phù hợp chỉ làm được với đối tượng chỉ có một LOT.',
      saving: 'Đang đăng ký.',
      uncertain:
        'Vẫn chưa xác nhận được kết quả của lần đăng ký trước. Hãy kiểm tra kết quả rồi tiếp tục.',
    },
  },
  request: {
    qtyLabel: 'Số lượng yêu cầu',
    qtyHelp: (max: string, uom: string): string => `Hãy nhập từ 1 đến ${max} ${uom}.`,
    qtyRequired: 'Hãy nhập số lượng yêu cầu',
    qtyNotNumber: 'Hãy nhập số lượng yêu cầu bằng số',
    qtyTooSmall: 'Số lượng yêu cầu phải từ 1 trở lên',
    qtyExceeds: (max: string): string => `Không được vượt quá số lượng đối tượng ${max}`,
    remarksLabel: 'Ghi chú',
    remarksHelp: 'Nếu có điều muốn gửi kèm cho người đánh giá thì hãy ghi vào đây.',
    afterNote:
      'Yêu cầu xong thì việc chuyển sang màn hình chất lượng, và kết quả đánh giá sẽ quay lại màn hình này.',
    success: 'Đã yêu cầu đánh giá',
    irreversible: 'Yêu cầu không hoàn tác được.',
    lock: {
      noTarget: 'Yêu cầu đánh giá chỉ làm được sau khi chọn đối tượng.',
      noNonconformance: 'Yêu cầu đánh giá cần đăng ký điểm không phù hợp trước mới làm được.',
      loading: 'Đang tải chi tiết điểm không phù hợp.',
      loadFailed: 'Không tải được chi tiết điểm không phù hợp nên không yêu cầu đánh giá được.',
      alreadyRequested: 'Đã yêu cầu rồi. Đang chờ đánh giá.',
      decided: 'Đây là điểm không phù hợp đã đánh giá xong. Không yêu cầu lại.',
      unknownStage: (statusCode: string): string =>
        `Không phán đoán được trạng thái điểm không phù hợp (${statusCode}) nên đã chặn việc yêu cầu.`,
      saving: 'Đang yêu cầu.',
      uncertain:
        'Vẫn chưa xác nhận được kết quả của lần yêu cầu trước. Hãy kiểm tra kết quả rồi tiếp tục.',
    },
    conflict: {
      invalidState:
        'Trạng thái điểm không phù hợp đã đổi nên không yêu cầu được. Hãy tải lại rồi kiểm tra.',
      qtyExceeded: 'Đã vượt quá số lượng có thể yêu cầu. Hãy tải lại rồi kiểm tra số lượng.',
    },
  },
  result: {
    loading: 'Đang tải danh sách quyết định xử lý',
    empty: 'Chưa có kết quả đánh giá',
    pending: 'Đang chờ đánh giá. Có kết quả thì sẽ hiện ở đây.',
    notRequested: 'Vẫn chưa yêu cầu.',
    unavailable: 'Không hiển thị được danh sách quyết định xử lý',
    partialNote:
      'Một điểm không phù hợp có thể có nhiều quyết định xử lý. Mỗi quyết định có phần tiếp theo khác nhau.',
    approvalPending: 'Đang phê duyệt',
    followUp: {
      reworkUnavailable:
        'Đăng ký kết quả làm lại được làm ở màn hình máy quét tại hiện trường. Không mở được ở màn hình này.',
      reworkNotDecided:
        'Đăng ký kết quả làm lại chỉ làm được khi đã có quyết định xử lý là làm lại.',
      disposalUnavailable:
        'Màn hình đề nghị hủy vẫn chưa được chuẩn bị. Khi chuẩn bị xong thì nút này sẽ dùng được.',
      disposalNotDecided: 'Đề nghị hủy chỉ làm được khi đã có quyết định xử lý là hủy.',
      reinstateUnavailable:
        'Màn hình đăng ký lại tồn kho vẫn chưa được chuẩn bị. Khi chuẩn bị xong thì nút này sẽ dùng được.',
      reinstateNotDecided:
        'Đăng ký lại tồn kho chỉ làm được khi đã có quyết định xử lý là bình thường.',
      openDecisionUnavailable:
        'Xem kết quả đánh giá chỉ làm được sau khi đăng ký điểm không phù hợp.',
    },
  },
};
