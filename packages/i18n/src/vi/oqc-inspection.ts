import type { ko } from '../ko';
import type { Translated } from './translated';

/** W-04-03 OQC 출하검사 판정. 저장은 한 번이고 되돌릴 수 없다 — 번복은 재검사 회차다. */
export const oqcInspection: Translated<typeof ko.oqcInspection> = {
  title: 'Đánh giá kiểm tra xuất hàng OQC',
  breadcrumbRoot: 'Quản lý chất lượng',

  queue: {
    heading: 'Đối tượng kiểm tra',
    columns: {
      inspectionRequestNo: 'Số yêu cầu',
      itemId: 'Mặt hàng',
      targetQty: 'Số lượng kiểm tra',
      statusCode: 'Trạng thái',
    },
    targetId: (targetId: number): string => `Đối tượng ${String(targetId)}`,
    emptyValue: '—',
    openRow: (inspectionRequestNo: string): string => `Mở yêu cầu kiểm tra ${inspectionRequestNo}`,
    caption: 'Danh sách đối tượng kiểm tra xuất hàng',
    empty: 'Không có yêu cầu kiểm tra nào khớp điều kiện. Hãy nới rộng điều kiện.',
    unavailable: 'Không hiển thị được danh sách.',
    loading: 'Đang tải các yêu cầu kiểm tra.',
  },

  filters: {
    item: 'Mặt hàng',
    itemPlaceholder: 'Số mặt hàng',
    keyword: 'Số yêu cầu',
    keywordPlaceholder: 'Tìm theo số yêu cầu',
    pendingOnly: 'Chỉ xem mục chờ và đang làm',
    apply: 'Tra cứu',
    reset: 'Đặt lại',
    identifierInvalid: 'Hãy nhập số là số nguyên từ 1 trở lên.',
  },

  status: {
    requested: 'Chờ',
    inProgress: 'Đang làm',
    completed: 'Xong',
    skipped: 'Bỏ qua',
    cancelled: 'Đã hủy',
  },

  detail: {
    paneLabel: 'Đối tượng đánh giá',
    heading: 'Thông tin đối tượng',
    nothingSelected: 'Hãy chọn yêu cầu cần đánh giá ở danh sách bên trái.',
    loading: 'Đang tải yêu cầu.',
    fields: {
      inspectionRequestNo: 'Số yêu cầu',
      inspectionTypeCode: 'Loại kiểm tra',
      targetTypeCode: 'Loại đối tượng',
      targetId: 'Số đối tượng',
      lotId: 'LOT đối tượng',
      itemId: 'Mặt hàng',
      targetQty: 'Số lượng kiểm tra',
      inspectionPlanVersionId: 'Tiêu chuẩn áp dụng',
      requestedAt: 'Ngày giờ yêu cầu',
    },
    planVersionNote: 'Được cố định theo phiên bản tiêu chuẩn tại thời điểm kiểm tra.',
    noPlanVersion: 'Không có tiêu chuẩn',
    uomNote: 'Đơn vị của số lượng vẫn chưa được hiển thị bằng tên.',
  },

  result: {
    heading: 'Nhập đánh giá',
    round: (round: number): string => `Lượt ${round}`,
    reinspectRound: 'Lượt mới (kiểm tra lại)',
    notStarted: 'Chưa có kết quả kiểm tra nào được nhập.',
    loading: 'Đang tải kết quả kiểm tra.',
    confirmed:
      'Lượt này đã được chốt nên không sửa được. Muốn đánh giá lại thì thêm lượt kiểm tra lại.',
    draftElsewhere:
      'Lượt này đang được soạn ở nơi khác nên màn hình này không sửa được. Muốn đánh giá lại thì thêm lượt kiểm tra lại.',
    fields: {
      inspectedQty: 'Số lượng kiểm tra',
      accepted: 'Số lượng đạt',
      rejected: 'Số lượng không đạt',
      held: 'Số lượng tạm giữ',
    },
    sum: 'Tổng',
    remaining: 'Còn lại',
    matched: 'Khớp với số lượng kiểm tra.',
    short: (remaining: string): string => `Thiếu ${remaining} so với số lượng kiểm tra.`,
    over: (over: string): string => `Nhiều hơn số lượng kiểm tra ${over}.`,
    quantityInvalid: 'Số lượng phải từ 0 trở lên và tối đa sáu chữ số thập phân.',

    judgment: 'Đánh giá tổng hợp',
    judgmentPlaceholder: 'Hãy chọn đánh giá',
    judgmentUnavailable:
      'Danh sách giá trị đánh giá vẫn chưa được chuẩn bị. Hãy hỏi người phụ trách.',
    judgmentUnknown: (code: string): string =>
      `Đánh giá đã lưu (${code}) không có trong danh sách.`,

    save: 'Lưu đánh giá',
    saving: 'Đang lưu',
    saved: 'Đã lưu đánh giá.',
    saveBlockedByInvalid: 'Sửa xong các ô số lượng thì mới lưu được.',
    blockedByConfirmed: 'Lưu đánh giá — đây là lượt đã chốt. Hãy thêm lượt mới bằng kiểm tra lại.',
    blockedByDraftElsewhere:
      'Lưu đánh giá — đây là lượt đang được soạn ở nơi khác. Hãy thêm lượt mới bằng kiểm tra lại.',
    blockedByTotals:
      'Lưu đánh giá — tổng các số lượng phải khớp với số lượng kiểm tra thì mới lưu được.',
    blockedByJudgmentOptions:
      'Lưu đánh giá — danh sách giá trị đánh giá chưa sẵn sàng nên không lưu được. Hãy hỏi người phụ trách.',
    blockedByJudgment: 'Lưu đánh giá — phải chọn đánh giá tổng hợp thì mới lưu được.',
    judgmentChange: {
      basis: (acceptanceNumber: number): string =>
        `Tự động đánh giá theo số chấp nhận ${String(acceptanceNumber)}`,
      expected: (judgment: string): string => `Đánh giá tự động: ${judgment}`,
      reason: 'Lý do thay đổi đánh giá',
      reasonPlaceholder: 'Hãy nhập lý do lưu khác với đánh giá tự động.',
      required:
        'Lưu đánh giá — đánh giá khác với đánh giá tự động phải nhập lý do thay đổi thì mới lưu được.',
      reasonMissing: 'Hãy nhập lý do thay đổi đánh giá.',
    },

    reinspect: 'Thêm lượt kiểm tra lại',
    reinspectCancel: 'Thôi không kiểm tra lại',
    reinspectNote:
      'Nhập số lượng và đánh giá rồi lưu thì một lượt mới được tạo. Lượt trước vẫn được giữ nguyên.',
    reinspectReasonPending:
      'Lý do kiểm tra lại vẫn chưa chọn được. Khi danh sách lý do được quyết định thì sẽ thêm vào chỗ này.',

    coaIssue: 'Phát hành giấy chứng nhận kiểm tra',
    coaPending:
      'Việc phát hành giấy chứng nhận kiểm tra vẫn chưa mở — sẽ mở khi hợp đồng phát hành bản in sẵn sàng.',
  },

  transition: {
    title: 'Chốt xong thì trạng thái LOT sẽ đổi',
    quantities: (accepted: string, rejected: string, held: string): string =>
      `Đạt ${accepted} · Không đạt ${rejected} · Tạm giữ ${held}`,
    directionRelease:
      "Chốt xong thì LOT này chuyển sang trạng thái 'Bình thường' (khi không còn tạm giữ khác).",
    directionHold: "Chốt xong thì LOT này chuyển sang trạng thái 'Lỗi'.",
    directionPending: "Chốt xong thì LOT này chuyển sang trạng thái 'Chờ kiểm tra'.",
    pickedDirectionRelease: 'Chốt xong thì LOT này được gỡ sang trạng thái xuất hàng được.',
    pickedDirectionHold:
      'Chốt xong thì các LOT mà lệnh xuất hàng này đã lấy (picking) sẽ chuyển sang trạng thái lỗi.',
    pickedDirectionPending:
      'Tạm giữ không thay đổi trạng thái LOT. Lệnh xuất hàng này không xuất được cho đến khi đánh giá xong.',
    directionUnknown: 'Chốt xong thì trạng thái LOT sẽ đổi.',
    pickingImpact: 'Các lượt lấy hàng đang làm dở dùng LOT này cũng bị chặn theo.',
    pickedNotReturned: 'Phần đã lấy hàng rồi thì không được thu hồi lại bằng lần chuyển này.',
    noAmendment: 'Đánh giá không sửa được — muốn lật lại thì phải kiểm tra lại.',
    dispositionPath:
      'Quyết định xử lý phần không đạt (làm lại, hủy) không được định ở màn hình này — khi màn hình yêu cầu quyết định xử lý mở thì sẽ làm ở đó.',
  },

  confirm: {
    title: (inspectionRequestNo: string): string => `Lưu đánh giá ${inspectionRequestNo}`,
    judgment: (label: string): string => `Đánh giá tổng hợp: ${label}`,
    irreversible: 'Lưu rồi thì không hoàn tác được.',
    cancel: 'Hủy',
    confirm: 'Lưu đánh giá',
  },

  history: {
    heading: 'Lịch sử các lượt',
    quantities: (accepted: string, rejected: string, held: string): string =>
      `Đạt ${accepted} · Không đạt ${rejected} · Tạm giữ ${held}`,
    confirmedAt: (at: string): string => `Chốt ${at}`,
    notConfirmed: 'Chưa chốt',
    noJudgment: 'Không có đánh giá',
  },

  pageNav: {
    label: 'Chuyển trang danh sách đối tượng kiểm tra',
    range: (start: number, end: number, total: number): string =>
      `${start}–${end} / Tổng ${total} mục`,
    totalOnly: (total: number): string => `Tổng ${total} mục`,
    previous: 'Trước',
    next: 'Sau',
    beyondLast: 'Trang này không có kết quả. Hãy quay về các trang trước.',
    toFirstPage: 'Về trang đầu',
  },

  save: {
    duplicateRound: 'Cùng lượt đó đã được lưu rồi. Hãy tải nội dung mới nhất rồi kiểm tra.',
    invalidState: 'Đánh giá không sửa được — hãy tiến hành bằng kiểm tra lại.',
  },

  skip: {
    heading: 'Bỏ qua OQC',
    help: 'Để xuất hàng mà không kiểm tra, hãy yêu cầu bỏ qua. Sau khi phê duyệt ở «Xử lý phê duyệt đặc cách · hạn mức», thực hiện tại đây. Khi thực hiện, mọi yêu cầu OQC đang mở của lệnh xuất hàng này sẽ được bỏ qua và kiểm tra xuất hàng chuyển sang đạt.',
    reason: 'Lý do bỏ qua',
    reasonRequired: 'Hãy nhập lý do bỏ qua.',
    request: 'Yêu cầu bỏ qua OQC',
    requesting: 'Đang yêu cầu…',
    execute: 'Thực hiện bỏ qua OQC',
    executing: 'Đang thực hiện…',
    requested: 'Đã yêu cầu bỏ qua OQC. Khi phê duyệt xong, hãy thực hiện tại đây.',
    pending: 'Phê duyệt vẫn đang tiến hành.',
    approved:
      'Việc bỏ qua đã được phê duyệt. Khi thực hiện, OQC của lệnh xuất hàng này sẽ được bỏ qua.',
    rejected: 'Yêu cầu bỏ qua trước đó đã bị từ chối. Có thể yêu cầu lại.',
    executed: 'Đã bỏ qua OQC. Kiểm tra xuất hàng đã chuyển sang đạt.',
    skipped: 'Yêu cầu này đã đóng do bỏ qua OQC.',
    loading: 'Đang tải trạng thái phê duyệt bỏ qua.',
    loadFailed: 'Không tải được trạng thái phê duyệt bỏ qua.',
  },
  serials: {
    openByScan: 'Mở yêu cầu bằng số serial',
    openByScanHelp: 'Quét số serial để mở yêu cầu OQC đang mở đã lấy hàng LOT đó.',
    scanLabel: 'Quét serial',
    scanPlaceholder: 'Quét hoặc nhập số serial rồi nhấn Enter',
    scanning: 'Đang kiểm tra serial…',
    heading: 'Serial đã kiểm tra',
    help: 'Quét serial đã kiểm tra và chọn OK/NG. Lưu cùng với đánh giá và ghi thành hồ sơ kiểm tra xuất hàng theo từng serial.',
    notFound: (serialNo: string): string => `Không có số serial: ${serialNo}`,
    noOpenRequest: (serialNo: string): string =>
      `Không có yêu cầu OQC đang mở đã lấy hàng LOT của serial ${serialNo}.`,
    pickRequest: 'Có nhiều yêu cầu OQC đã lấy hàng LOT của serial này. Hãy chọn yêu cầu cần mở.',
    duplicate: (serialNo: string): string => `Serial đã có trong danh sách: ${serialNo}`,
    otherItem: (serialNo: string): string =>
      `Serial ${serialNo} không thuộc mã hàng của yêu cầu này.`,
    notPicked: (serialNo: string): string =>
      `LOT của serial ${serialNo} không phải LOT mà lệnh xuất hàng này đã lấy hàng.`,
    lookupFailed: 'Không kiểm tra được serial. Hãy quét lại.',
    columns: { serialNo: 'Serial', lotNo: 'LOT', previous: 'Ghi trước', judgment: 'Đánh giá' },
    previous: (first: string, final: string): string => `Lần 1 ${first} → Cuối ${final}`,
    firstOkLocked: 'Lần 1 OK — không đổi sang NG được',
    remove: 'Bỏ',
    ok: 'OK',
    ng: 'NG',
    empty: 'Chưa quét serial nào. Cũng có thể chỉ lưu đánh giá LOT mà không có serial.',
    tooMany: 'Số serial đã kiểm tra nhiều hơn số lượng kiểm tra.',
    tooManyNg: 'Số serial NG nhiều hơn số lượng không đạt. Hãy kiểm tra số lượng không đạt.',
    count: (total: number, ng: number): string => `${total} serial · NG ${ng}`,
    recordHeading: 'Kiểm tra xuất hàng theo serial',
    recordHelp:
      'Với mỗi serial, đánh giá lần 1 giữ nguyên như lần ghi đầu; lượt kiểm tra lại chỉ đổi đánh giá cuối.',
    recordEmpty: 'Chưa có serial nào được ghi.',
    recordLoading: 'Đang tải kiểm tra xuất hàng theo serial.',
    recordFailed: 'Không tải được kiểm tra xuất hàng theo serial.',
    recordColumns: {
      serialNo: 'Serial',
      lotNo: 'LOT',
      first: 'Lần 1',
      final: 'Cuối',
      round: 'Lượt cuối',
      inspector: 'Người kiểm tra',
      inspectedAt: 'Thời điểm kiểm tra',
    },
    round: (round: number): string => `Lượt ${round}`,
  },
};
