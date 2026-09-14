import type { ko } from '../ko';
import type { Translated } from './translated';

/** W-04-03 OQC 출하검사 판정. 저장은 한 번이고 되돌릴 수 없다 — 번복은 재검사 회차다. */
export const oqcInspection: Translated<typeof ko.oqcInspection> = {
  title: 'Đánh giá kiểm tra xuất hàng OQC',
  breadcrumbRoot: 'Xuất hàng',

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
    directionRelease: 'Chốt xong thì LOT này được gỡ sang trạng thái xuất hàng được.',
    directionHold: 'Chốt xong thì LOT này bị giữ ở trạng thái tạm giữ.',
    directionPending: 'Chốt xong thì LOT này chuyển sang trạng thái chờ kiểm tra.',
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
};
