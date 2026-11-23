import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-03-09 특채·한도승인 승인 처리. 결재 차례가 온 요청을 승인하거나 반려한다.
 *
 * ⚠ 「승인」과 「결재」는 한국어에서 갈라 쓰지만 베트남어는 둘 다 `phê duyệt` 이다(용어집).
 * 대신 자리를 붙여 가른다 — 결재 단계는 `bước phê duyệt`, 결재 차례는 `lượt phê duyệt`.
 */
export const qualityApproval: Translated<typeof ko.qualityApproval> = {
  title: 'Xử lý phê duyệt chất lượng',
  breadcrumbRoot: 'Quản lý chất lượng',
  scopeWarning:
    'Giá trị gốc của loại phê duyệt chưa sẵn sàng nên hiển thị mọi loại yêu cầu được giao cho tôi. Hãy kiểm tra nguyên văn loại phê duyệt.',
  fields: {
    approvalTypeCode: 'Loại phê duyệt',
    statusCode: 'Trạng thái',
    periodFrom: 'Tìm theo ngày trình bắt đầu',
    periodTo: 'Tìm theo ngày trình kết thúc',
    q: 'Tìm theo số yêu cầu',
    /** 조회 조건 체크 칸(#193) — 지금 내가 결재할 차례인 요청만. */
    myTurnOnly: 'Lượt của tôi',
    approvalRequestNo: 'Số yêu cầu',
    requestedByName: 'Người trình',
    requestedAt: 'Thời điểm trình',
    reason: 'Lý do',
    request: 'Số yêu cầu',
    target: 'Đối tượng',
    targetLot: 'LOT đối tượng',
    targetShipmentRequest: 'Lệnh xuất hàng đối tượng',
    targetWorkOrder: 'Lệnh sản xuất đối tượng',
    myTurn: 'Lượt phê duyệt',
  },
  /** 탭 줄 오른쪽 상태 칩(#186) — 「결재 대기 3」. 누르면 그 상태만 남고, 다시 누르면 풀린다. */
  statusChips: {
    label: 'Trạng thái phê duyệt',
    count: (label: string, count: number): string => `${label} ${String(count)}`,
    filterOn: (label: string): string => `Chỉ xem ${label}`,
    filterOff: (label: string): string => `Bỏ lọc ${label}`,
  },
  all: 'Tất cả',
  datePlaceholder: 'Hãy chọn ngày',
  qPlaceholder: 'Hãy nhập số yêu cầu',
  typeLabels: {
    IQC_SKIP: 'Bỏ qua IQC (kiểm tra đầu vào)',
    PQC_SKIP: 'Bỏ qua PQC (kiểm tra công đoạn)',
    OQC_SKIP: 'Bỏ qua OQC (kiểm tra xuất hàng)',
  },
  statusLabels: { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Trả lại' },
  splitter: 'Kéo để điều chỉnh độ rộng danh sách·chi tiết',
  /** 목록 · 상세 배치 고르기(#186) — 「좌우 배치 | 상하 배치」 두 단추. */
  layout: {
    group: 'Bố cục danh sách·chi tiết',
    side: 'Bố cục trái phải',
    stack: 'Bố cục trên dưới',
  },
  panes: {
    filter: 'Điều kiện tra cứu',
    list: 'Danh sách yêu cầu phê duyệt',
    detail: 'Chi tiết yêu cầu',
    progress: 'Tiến trình phê duyệt',
    reason: 'Toàn văn lý do',
    target: 'Đối tượng phê duyệt',
  },
  actions: {
    selectRow: (requestNo: string): string => `Chọn ${requestNo}`,
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
  },
  detail: {
    noSelectionTitle: 'Hãy chọn một yêu cầu',
    noSelectionDescription: 'Chọn một yêu cầu để xem nội dung chi tiết.',
    loading: 'Đang tải chi tiết yêu cầu phê duyệt',
    notFound: 'Không tìm thấy yêu cầu',
    notFoundDescription: 'Hãy tra cứu lại danh sách rồi chọn yêu cầu khác.',
    iqcSkipNoPermission:
      'Cần quyền màn hình 「Phê duyệt bỏ qua IQC khẩn cấp」 để thực hiện bỏ qua IQC.',
  },
  pqcSkipExecute: {
    heading: 'Thực hiện bỏ qua PQC',
    note: 'Yêu cầu đã được duyệt. Khi thực hiện, các yêu cầu kiểm tra PQC đang mở của lệnh sản xuất này sẽ được bỏ qua và LOT sản phẩm đang chờ kiểm tra trở thành bình thường.',
    action: 'Thực hiện bỏ qua PQC',
    dialogTitle: 'Thực hiện bỏ qua PQC?',
    dialogBody:
      'Các yêu cầu kiểm tra PQC đang mở sẽ được bỏ qua, và LOT của các kết quả đăng ký sau đó cũng trở thành bình thường mà không cần kiểm tra.',
    irreversible: 'Sau khi thực hiện thì không thể hoàn tác.',
    done: 'Đã thực hiện bỏ qua PQC',
    executed: 'Đã thực hiện bỏ qua — kiểm tra PQC đã được bỏ qua.',
    compact: {
      title: 'Bỏ qua PQC',
      summary: 'Bỏ qua yêu cầu kiểm tra đang mở · LOT chờ kiểm tra thành bình thường',
      action: 'Thực hiện',
      done: 'Đã thực hiện',
    },
    checking: 'Đang kiểm tra trạng thái.',
    notPending: (status: string) =>
      `Trạng thái này không thể thực hiện bỏ qua (trạng thái ${status}).`,
  },
  oqcSkipExecute: {
    heading: 'Thực hiện bỏ qua OQC',
    note: 'Yêu cầu đã được duyệt. Khi thực hiện, các yêu cầu kiểm tra OQC đang mở của lệnh xuất hàng này sẽ được bỏ qua và lịch sử bỏ qua được ghi cho các LOT đã soạn.',
    action: 'Thực hiện bỏ qua OQC',
    dialogTitle: 'Thực hiện bỏ qua OQC?',
    dialogBody:
      'Các yêu cầu kiểm tra OQC đang mở sẽ được bỏ qua để có thể xuất hàng. Nếu chưa soạn hàng xong thì không thực hiện được — hãy hoàn tất soạn hàng trước.',
    irreversible: 'Sau khi thực hiện thì không thể hoàn tác.',
    done: 'Đã thực hiện bỏ qua OQC',
    executed: 'Đã thực hiện bỏ qua — kiểm tra OQC đã được bỏ qua.',
    compact: {
      title: 'Bỏ qua OQC',
      summary: 'Bỏ qua yêu cầu kiểm tra đang mở · ghi lịch sử LOT',
      action: 'Thực hiện',
      done: 'Đã thực hiện',
    },
    checking: 'Đang kiểm tra trạng thái.',
    notPending: (status: string) =>
      `Trạng thái này không thể thực hiện bỏ qua (trạng thái ${status}).`,
  },
  oqcShipment: {
    shipmentRequest: 'Lệnh xuất hàng',
    shipDate: 'Ngày xuất dự kiến',
    pickedLots: 'LOT đã lấy',
    lotNo: 'Số LOT',
    pickedQty: 'Số lượng đã lấy',
    noPicks: 'Chưa lấy LOT nào.',
    loading: 'Đang tải lệnh xuất hàng.',
    failed: 'Không tải được lệnh xuất hàng.',
    inspectionStatus: {
      NOT_REQUIRED: 'Không cần kiểm tra xuất hàng',
      REJECTED: 'Kiểm tra xuất hàng không đạt',
      HELD: 'Kiểm tra xuất hàng tạm giữ',
    } as Record<string, string>,
  },
  next: {
    heading: 'Việc tiếp theo',
    iqcRejectedTitle: 'Yêu cầu bỏ qua đã bị từ chối.',
    iqcRejected: 'Vui lòng tiến hành kiểm tra đầu vào.',
    iqcRejectedNote: 'Có thể yêu cầu bỏ qua lại trên PDA.',
    openIqcInspection: 'Mở kiểm tra đầu vào IQC',
    oqcRejectedTitle: 'Yêu cầu bỏ qua kiểm tra xuất hàng đã bị từ chối.',
    oqcRejected: 'Vui lòng tiến hành kiểm tra xuất hàng hoặc yêu cầu bỏ qua lại.',
    openOqcInspection: 'Mở kiểm tra xuất hàng OQC',
    iqcDoneTitle: 'Đã hoàn tất bỏ qua kiểm tra đầu vào.',
    iqcDone: 'Cất hàng trên PDA là nhập kho.',
    openInboundSchedule: 'Mở quản lý nhập kho',
    oqcDone: 'Đã bỏ qua OQC — hãy tiếp tục xử lý xuất hàng',
    openShipmentProcessing: 'Mở xử lý xuất hàng',
  },
  condition: {
    openLot: 'Mở LOT',
    open: 'Mở',
  },
  progress: {
    steps: 'Bước phê duyệt',
    position: (current: number, total: number): string =>
      `Bước ${String(current)} / ${String(total)}`,
    myTurn: 'Đến lượt phê duyệt',
    notMyTurn: 'Bây giờ chưa đến lượt phê duyệt yêu cầu này',
    waitingPending: 'Chờ',
    resultTitle: 'Kết quả phê duyệt',
    decisionComment: 'Lý do phê duyệt',
    noSteps: 'Không có bước phê duyệt nào để hiển thị',
    loading: 'Đang tải tiến trình phê duyệt',
    unavailable: 'Không hiển thị được tiến trình phê duyệt',
  },
  approval: {
    title: 'Xử lý phê duyệt',
    commentLabel: 'Lý do phê duyệt',
    commentHelp: 'Hãy nhập lý do từ chối hoặc phê duyệt',
    commentRequired: 'Hãy nhập lý do duyệt',
    commentHeading: 'Lý do duyệt',
    rejectCommentRequired: 'Hãy nhập lý do từ chối',
    rejectCommentHeading: 'Lý do từ chối',
    approve: 'Duyệt',
    reject: 'Từ chối',
    dialogTitle: 'Xác nhận duyệt',
    rejectDialogTitle: 'Xác nhận từ chối',
    notMyTurnReason: 'Bây giờ chưa đến lượt phê duyệt của tôi',
    savingReason: 'Đang xử lý yêu cầu phê duyệt',
    uncertainOtherTarget: 'Phải kiểm tra trạng thái của yêu cầu phê duyệt đã gửi trước đó',
    conditionRequired: 'Cần đúng 1 điều kiện liên kết đã được xác nhận an toàn',
    deliveryUnknown: 'Không xác nhận được máy chủ đã áp dụng hay chưa',
    reloadTarget: 'Kiểm tra lại chi tiết đối tượng phê duyệt',
    stateOnly: 'Duyệt chỉ gỡ trạng thái',
    irreversible: 'Duyệt không thể hoàn tác',
    success: 'Đã duyệt xong',
    rejectStateOnly: 'Từ chối chỉ đổi trạng thái',
    rejectIrreversible: 'Từ chối không thể hoàn tác',
    rejectSuccess: 'Đã từ chối xong',
  },
  loading: 'Đang tải danh sách yêu cầu phê duyệt',
  empty: {
    title: 'Không có yêu cầu phê duyệt nào khớp điều kiện',
    description: 'Hãy bớt điều kiện hoặc bỏ chọn chip trạng thái đang bật.',
    beyondTitle: 'Không có yêu cầu nào để hiển thị ở trang này',
    beyondDescription: 'Hãy quay về trang đầu để xem yêu cầu.',
  },
  page: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / tổng ${String(total)} mục`,
    total: (total: number): string => `Tổng ${String(total)} mục`,
  },
  values: {
    unknownTarget: 'Không có tên đối tượng',
    unknownRequester: 'Không có tên người trình',
    emptyReason: 'Chưa có lý do nào được đăng ký',
    unknownApprover: 'Không có tên người phê duyệt',
    myTurn: 'Lượt của tôi',
  },
};
