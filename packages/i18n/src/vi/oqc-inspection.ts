import type { ko } from '../ko';
import type { Translated } from './translated';

/** W-04-03 OQC 출하검사 판정. 저장은 한 번이고 되돌릴 수 없다 — 번복은 재검사 회차다. */
export const oqcInspection: Translated<typeof ko.oqcInspection> = {
  title: 'OQC (kiểm tra xuất hàng) tra cứu · đánh giá',
  breadcrumbRoot: 'Quản lý chất lượng',

  queue: {
    heading: 'Đối tượng kiểm tra',
    columns: {
      inspectionRequestNo: 'Số yêu cầu',
      itemId: 'Mặt hàng',
      targetQty: 'Số lượng kiểm tra',
      statusCode: 'Trạng thái',
    },
    requestedAtColumn: 'Thời điểm yêu cầu',
    serialColumn: 'Số serial',
    targetQtyColumn: 'SL kiểm tra',
    serialUnregistered: 'Chưa đăng ký',
    targetTypes: {
      SHIPMENT_REQUEST: 'Yêu cầu xuất hàng',
    } as Readonly<Record<string, string>>,
    target: (typeLabel: string, targetId: number): string => `${typeLabel} #${String(targetId)}`,
    targetId: (targetId: number): string => `Đối tượng ${String(targetId)}`,
    emptyValue: '—',
    openRow: (inspectionRequestNo: string): string => `Mở yêu cầu kiểm tra ${inspectionRequestNo}`,
    caption: 'Danh sách đối tượng kiểm tra xuất hàng',
    empty: 'Không tìm thấy yêu cầu kiểm tra nào.',
    emptyHint: 'Hãy thay đổi điều kiện tìm kiếm hoặc đặt lại bộ lọc.',
    unavailable: 'Không hiển thị được danh sách.',
    loading: 'Đang tải các yêu cầu kiểm tra.',
  },

  filters: {
    item: 'Mặt hàng',
    itemPlaceholder: 'Chọn mặt hàng',
    itemPick: 'Chọn',
    itemClear: 'Xóa điều kiện mặt hàng',
    keyword: 'Tìm số yêu cầu',
    keywordPlaceholder: 'Nhập số yêu cầu',
    pendingOnly: 'Chỉ xem mục chờ và đang làm',
    apply: 'Tra cứu',
    reset: 'Đặt lại',
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
    backToList: '← Danh sách',
    leaveUnsaved: 'Chưa lưu thay đổi',
    leaveUnsavedNote: 'Nếu rời đi mà không lưu, nội dung đã nhập sẽ bị mất.',
    keepEditing: 'Tiếp tục soạn',
    leaveAnyway: 'Rời đi không lưu',
    sectionTitle: 'Thông tin kiểm tra cơ bản',
    historyCount: (count: number): string => `${String(count)} mục`,
    historyTitle: 'Lịch sử xử lý kiểm tra',
    inspectionTypeNames: { OQC: 'Kiểm tra xuất hàng' } as Readonly<Record<string, string>>,
    heading: 'Thông tin đối tượng',
    loading: 'Đang tải yêu cầu.',
    fields: {
      inspectionRequestNo: 'Số yêu cầu',
      inspectionTypeCode: 'Loại kiểm tra',
      target: 'Đối tượng',
      lotId: 'LOT đối tượng',
      itemId: 'Mặt hàng',
      targetQty: 'Số lượng kiểm tra',
      inspectionPlanVersionId: 'Tiêu chuẩn áp dụng',
      requestedAt: 'Ngày giờ yêu cầu',
    },
    noPlanVersion: 'Không có tiêu chuẩn',
    serialNo: 'Số serial',
    unregistered: 'Chưa đăng ký',
    more: (first: string, rest: number): string => `${first} và ${String(rest)} mục khác`,
  },

  result: {
    heading: 'Nhập đánh giá',
    round: (round: number): string => `Lượt ${round}`,
    reinspectRound: 'Lượt mới (kiểm tra lại)',
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
    sum: 'Đã nhập',
    remaining: 'Chưa nhập',
    overBy: (over: string): string => `Vượt ${over}`,
    progressLabel: 'Tổng đã nhập so với số lượng kiểm tra',
    sectionTitle: 'Nhập số lượng kiểm tra',
    judgmentSectionTitle: 'Đánh giá',
    saveNote: 'Sau khi lưu đánh giá sẽ không thể sửa.',
    over: (over: string): string => `Nhiều hơn số lượng kiểm tra ${over}.`,
    quantityInvalid: 'Số lượng phải từ 0 trở lên và tối đa sáu chữ số thập phân.',

    judgment: 'Đánh giá cuối cùng',
    judgmentPlaceholder: 'Hãy chọn đánh giá',
    rejectionReason: 'Lý do không đạt (tùy chọn)',
    rejectionReasonPlaceholder: 'Nhập lý do không đạt',
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
    blockedByTotals: 'Tổng số lượng phải khớp với số lượng kiểm tra.',
    blockedByJudgmentOptions:
      'Lưu đánh giá — danh sách giá trị đánh giá chưa sẵn sàng nên không lưu được. Hãy hỏi người phụ trách.',
    blockedByJudgment: 'Vui lòng chọn đánh giá cuối cùng.',
    judgmentChange: {
      basis: (acceptanceNumber: number): string =>
        `Tự động đánh giá theo số chấp nhận ${String(acceptanceNumber)}`,
      expected: (judgment: string): string => `Đánh giá tự động: ${judgment}`,
      reason: 'Lý do thay đổi đánh giá',
      reasonPlaceholder: 'Hãy nhập lý do thay đổi đánh giá',
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
    guide: {
      title: 'Hướng dẫn chốt đánh giá',
      irreversible: 'Sau khi chốt thì không sửa được đánh giá.',
      irreversibleHint: 'Nếu cần thay đổi, hãy tiến hành kiểm tra lại.',
    },
  },

  confirm: {
    title: (inspectionRequestNo: string): string => `Lưu đánh giá ${inspectionRequestNo}`,
    judgment: (label: string): string => `Đánh giá cuối cùng: ${label}`,
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
    heading: 'Yêu cầu bỏ qua OQC (kiểm tra xuất hàng)',
    steps: ['1. Yêu cầu bỏ qua', '2. Phê duyệt', '3. Thực hiện bỏ qua'],
    result:
      'Sau khi yêu cầu và được phê duyệt bỏ qua, phần kiểm tra xuất hàng còn lại sẽ được bỏ qua và kết quả được xử lý là đạt.',
    reason: 'Lý do bỏ qua',
    reasonPlaceholder: 'Nhập lý do bỏ qua',
    openApproval: 'Đến phê duyệt yêu cầu này',
    currentStep: 'Bước hiện tại',
    reasonCount: (count: number): string => `${String(count)} ký tự`,
    reasonRequired: 'Hãy nhập lý do bỏ qua.',
    openRequest: 'Yêu cầu bỏ qua',
    cancel: 'Hủy',
    request: 'Yêu cầu phê duyệt bỏ qua',
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
    openByScan: 'Quét số serial',
    openByScanHelp: 'Nhập số serial để tra cứu yêu cầu kiểm tra OQC tương ứng.',
    openByScanPlaceholder: 'Quét hoặc nhập số serial',
    openByScanNotFound: 'Số serial chưa được đăng ký.',
    judge: {
      heading: 'Kết quả kiểm tra theo serial',
      inspected: (count: number): string => `Đã kiểm ${String(count)}`,
      accepted: (count: number): string => `Đạt ${String(count)}`,
      rejected: (count: number): string => `Không đạt ${String(count)}`,
      scanLabel: 'Quét số serial',
      scanHint: 'Quét xong sẽ được thêm vào bảng bên dưới.',
      scanPlaceholder: 'Quét hoặc nhập số serial',
      notFound: 'Số serial chưa được đăng ký.',
      columns: {
        serialNo: 'Số serial',
        lotNo: 'LOT',
        previous: 'Kết quả kiểm tra trước',
        judgment: 'Đánh giá',
      },
      emptyTitle: 'Chưa có serial kiểm tra nào.',
      emptyDescription: 'Hãy quét hoặc nhập số serial ở phía trên.',
      lotOnlyNote: 'Không dùng khi đánh giá theo LOT.',
    },
    scanLabel: 'Quét serial',
    scanPlaceholder: 'Quét hoặc nhập số serial rồi nhấn Enter',
    scanning: 'Đang kiểm tra serial…',
    heading: 'Serial đã kiểm tra',
    help: 'Quét serial đã kiểm tra và chọn OK/NG. Lưu cùng với đánh giá và ghi thành hồ sơ kiểm tra xuất hàng theo từng serial.',
    notFound: (serialNo: string): string => `Không có số serial: ${serialNo}`,
    noPickedRequest: (serialNo: string): string =>
      `Không có yêu cầu OQC đã lấy hàng LOT của serial ${serialNo}.`,
    completedRequest: (requestNo: string): string => `${requestNo} (đã hoàn thành, kiểm tra lại)`,
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
    count: (total: number, ng: number): string => `${total} serial, NG ${ng}`,
    recordHeading: 'Lịch sử kiểm tra xuất hàng theo serial',
    recordTab: 'Lịch sử kiểm tra theo serial',
    recordHelp: 'Xem kết quả kiểm tra lần đầu và kiểm tra lại của từng serial.',
    recordEmpty: 'Chưa có lịch sử kiểm tra xuất hàng.',
    recordEmptyDescription: 'Khi có kết quả kiểm tra, lịch sử sẽ hiển thị tại đây.',
    recordCount: (count: number): string => `${String(count)} mục`,
    recordLoading: 'Đang tải kiểm tra xuất hàng theo serial.',
    recordFailed: 'Không tải được kiểm tra xuất hàng theo serial.',
    recordColumns: {
      serialNo: 'Số serial',
      lotNo: 'LOT',
      first: 'Đánh giá lần đầu',
      final: 'Đánh giá cuối',
      round: 'Lượt kiểm tra',
      inspector: 'Người kiểm tra',
      inspectedAt: 'Thời điểm kiểm tra',
    },
    round: (round: number): string => `Lượt ${round}`,
  },
};
