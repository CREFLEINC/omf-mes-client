/** P-04-06 OQC 출하검사 판정(POP). */
export const popOqcInspection = {
  title: 'Phán định kiểm tra xuất hàng OQC',

  queue: {
    heading: 'Chờ phán định',
    caption: 'Danh sách yêu cầu chờ phán định',
    count: (total: number): string => `${String(total)} mục`,
    columns: {
      request: 'Số yêu cầu',
      item: 'Mặt hàng',
      qty: 'SL kiểm tra',
      status: 'Trạng thái',
    },
    selectRow: (requestNo: string): string => `Chọn yêu cầu ${requestNo}`,
    loading: 'Đang tải danh sách chờ phán định.',
    empty: 'Không có yêu cầu kiểm tra xuất hàng cần phán định.',
    unavailable: 'Không tải được danh sách chờ phán định. Hãy kiểm tra kết nối rồi thử lại.',
    pageNav: 'Chuyển trang danh sách chờ phán định',
  },

  detail: {
    paneLabel: 'Phán định',
    nothingSelectedTitle: 'Hãy chọn yêu cầu',
    nothingSelected: 'Chạm vào một yêu cầu trong danh sách bên trái để phán định tại đây.',
    loading: 'Đang tải thông tin yêu cầu.',
    fields: {
      inspectionType: 'Loại kiểm tra',
      target: 'Đối tượng kiểm tra',
      lot: 'LOT đối tượng',
      item: 'Mặt hàng',
      targetQty: 'SL kiểm tra',
      plan: 'Tiêu chuẩn kiểm tra',
      requestedAt: 'Thời điểm yêu cầu',
    },
    targetTypes: {
      SHIPMENT_REQUEST: 'Yêu cầu xuất hàng',
    } as Readonly<Record<string, string>>,
    target: (typeLabel: string, targetId: number): string => `${typeLabel} #${String(targetId)}`,
    idValue: (id: number): string => `#${String(id)}`,
    noPlanVersion: 'Chưa có tiêu chuẩn',
    planValue: (id: number): string => `#${String(id)} · cố định khi kiểm tra`,
  },

  result: {
    heading: 'Nhập phán định',
    firstRound: 'Lần kiểm tra đầu',
    round: (round: number): string => `Lần ${String(round)}`,
    reinspectRound: 'Kiểm tra lại · lần mới',
    reinspectNote: 'Khi lưu sẽ thêm một lần mới. Các lần trước vẫn được giữ nguyên.',
    reinspectReasonPending: 'Chưa thể chọn lý do kiểm tra lại.',
    confirmed:
      'Lần này đã xác nhận nên không thể sửa. Để phán định lại, hãy nhấn [Thêm lần kiểm tra lại].',
    draftElsewhere:
      'Lần này đang được soạn ở nơi khác nên không thể sửa tại đây. Để phán định lại, hãy nhấn [Thêm lần kiểm tra lại].',
    loading: 'Đang tải kết quả kiểm tra.',

    quantityStep: 'Nhập số lượng',
    quantityHint: 'Đạt + Không đạt + Tạm giữ = SL kiểm tra',
    fields: {
      accepted: 'SL đạt',
      rejected: 'SL không đạt',
      held: 'SL tạm giữ',
    },
    inspectedQty: 'SL kiểm tra',
    sum: 'Tổng đã nhập',
    remaining: 'SL còn lại',
    matched: 'Đã nhập đủ số lượng',
    short: (remaining: string): string => `Số lượng còn lại (${remaining}) phải bằng 0.`,
    over: (over: string): string => `Thừa ${over}. Hãy giảm bớt.`,
    uncountable: 'Chỉ nhập số.',
    quantityInvalid: 'Chỉ nhập số từ 0 trở lên (tối đa 6 chữ số thập phân).',

    judgmentStep: 'Phán định tổng',
    judgmentHint: 'Chọn kết quả của cả yêu cầu, tách biệt với số lượng.',
    judgmentUnavailable: 'Danh sách giá trị phán định chưa sẵn sàng. Hãy liên hệ người phụ trách.',
    judgmentUnknown: (code: string): string =>
      `Phán định đã lưu (${code}) không có trong danh sách.`,
  },

  warning: {
    title: 'Thay đổi trạng thái LOT',
    directionRelease:
      "Khi lưu, trạng thái LOT chuyển thành 'Bình thường' (khi không còn tạm giữ khác).",
    directionHold: "Khi lưu, trạng thái LOT chuyển thành 'Lỗi'.",
    directionPending: "Khi lưu, trạng thái LOT chuyển thành 'Chờ kiểm tra'.",
    directionUnknown: 'Khi lưu, trạng thái LOT sẽ thay đổi.',
    noLot: 'Không có LOT đối tượng nên trạng thái LOT không thay đổi.',
    picking:
      'Các lần lấy hàng đang thực hiện dùng LOT này sẽ bị chặn, số lượng đã lấy sẽ không được hoàn lại.',
    noAmendment: 'Sau khi lưu không thể sửa. Muốn thay đổi thì kiểm tra lại.',
    dispositionPath: 'Xử lý số lượng không đạt (làm lại·hủy) không quyết định tại màn hình này.',
  },

  bar: {
    save: 'Lưu phán định',
    saving: 'Đang lưu…',
    saved: 'Đã lưu phán định.',
    ready: 'Có thể lưu.',
    blocked: {
      noSelection: 'Hãy chọn yêu cầu trong danh sách bên trái.',
      loading: 'Đang tải thông tin yêu cầu.',
      worker: 'Chưa chỉ định mã nhân viên. Hãy nhập mã ở [Chuyển người dùng].',
      confirmed: 'Lần này đã xác nhận. Để phán định lại, hãy thêm lần kiểm tra lại.',
      draftElsewhere:
        'Lần này đang được soạn ở nơi khác. Để phán định lại, hãy thêm lần kiểm tra lại.',
      totals: 'Hãy cho tổng số lượng bằng số lượng kiểm tra.',
      judgmentOptions:
        'Không có danh sách giá trị phán định nên không thể lưu. Hãy liên hệ người phụ trách.',
      judgment: 'Hãy chọn phán định tổng.',
      invalid: 'Hãy sửa lỗi ở ô số lượng rồi lưu.',
    },
    reinspect: 'Thêm lần kiểm tra lại',
    reinspectCancel: 'Hủy kiểm tra lại',
    coaIssue: 'Phát hành phiếu kết quả kiểm tra',
    coaPending: 'Đang chuẩn bị',
  },

  confirm: {
    title: 'Lưu phán định?',
    request: 'Số yêu cầu',
    judgment: 'Phán định tổng',
    inspectedQty: 'SL kiểm tra',
    accepted: 'Đạt',
    rejected: 'Không đạt',
    held: 'Tạm giữ',
    effects: 'Khi lưu',
    caution: 'Lưu ý',
    cancel: 'Hủy',
    confirm: 'Lưu phán định',
  },
};
