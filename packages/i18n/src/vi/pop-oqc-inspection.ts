/** P-04-06 OQC 출하검사 판정(POP). */
export const popOqcInspection = {
  queue: {
    heading: 'Chờ phán định',
    doneHeading: 'Đã phán định',
    viewLabel: 'Chọn danh sách phán định',
    listName: 'Danh sách phán định',
    caption: 'Danh sách yêu cầu chờ phán định',
    columns: {
      item: 'Mặt hàng',
      qty: 'SL kiểm tra',
    },
    selectRow: (requestNo: string): string => `Chọn yêu cầu ${requestNo}`,
    loading: 'Đang tải danh sách chờ phán định.',
    doneEmpty: 'Không có yêu cầu kiểm tra xuất hàng đã phán định.',
    empty: 'Không có yêu cầu kiểm tra xuất hàng cần phán định.',
    pageNav: 'Chuyển trang danh sách chờ phán định',
  },

  detail: {
    nothingSelectedTitle: 'Hãy chọn yêu cầu',
    nothingSelected: 'Chạm vào yêu cầu bên trái để nhập số lượng và phán định.',
    nothingSelectedDone: 'Chạm vào yêu cầu bên trái để xem kết quả phán định.',
    loading: 'Đang tải thông tin yêu cầu.',
    bandLabel: 'Thông tin yêu cầu',
    fields: {
      requestNo: 'Số yêu cầu',
      requestedAt: 'Thời điểm yêu cầu',
      item: 'Mặt hàng',
      inspectionType: 'Loại kiểm tra',
      targetQty: 'Tổng SL kiểm tra',
      target: 'Đối tượng',
      lot: 'LOT đối tượng',
      plan: 'Tiêu chuẩn áp dụng',
      history: 'Lịch sử các lần',
    },
    targetTypes: {
      SHIPMENT_REQUEST: 'Yêu cầu xuất hàng',
    } as Readonly<Record<string, string>>,
    target: (typeLabel: string, targetId: number): string => `${typeLabel} #${String(targetId)}`,
    idValue: (id: number): string => `#${String(id)}`,
    noPlanVersion: 'Chưa có tiêu chuẩn',
    viewPlan: 'Xem tiêu chuẩn',
    planTitle: 'Tiêu chuẩn áp dụng',
    planNo: 'Số tiêu chuẩn',
    planVersion: (no: number): string => `Phiên bản ${String(no)}`,
    planValue: (label: string): string => `${label} · cố định khi kiểm tra`,
    guide: 'Nội dung kiểm tra',
    noGuide: 'Chưa có hướng dẫn kiểm tra.',
  },

  result: {
    quantityTitle: 'Nhập số lượng',
    judgmentTitle: 'Phán định cuối',
    resultTitle: 'Kết quả phán định',
    flowLabel: 'Các bước OQC',
    round: (round: number): string => `Lần ${String(round)}`,
    reinspectRound: (round: number): string => `Lần ${String(round)} · kiểm tra lại`,
    reinspectNote: (round: number): string =>
      `Khi lưu sẽ thêm lần ${String(round)}. Các lần trước vẫn được giữ nguyên.`,
    draftElsewhere:
      'Lần này đang được soạn ở nơi khác nên không thể sửa tại đây. Để phán định lại, hãy nhấn [Thêm lần kiểm tra lại].',
    loading: 'Đang tải kết quả kiểm tra.',
    fields: {
      accepted: 'SL đạt',
      rejected: 'SL không đạt',
      held: 'SL tạm giữ',
    },
    quantityInvalid: 'Chỉ nhập số từ 0 trở lên (tối đa 6 chữ số thập phân).',
    keypadTitle: 'Nhập',
    judgmentStep: 'Phán định tổng',
    judgmentUnavailable: 'Danh sách giá trị phán định chưa sẵn sàng. Hãy liên hệ người phụ trách.',
    judgmentUnknown: (code: string): string =>
      `Phán định đã lưu (${code}) không có trong danh sách.`,
    summary: {
      inspectedQty: 'SL kiểm tra',
      accepted: 'Đạt',
      rejected: 'Không đạt',
      held: 'Tạm giữ',
    },
    columns: { round: 'Lượt', judgment: 'Kết luận', confirmedAt: 'Thời điểm xác nhận' },
    confirmedAt: (at: string): string => `Xác nhận ${at}`,
  },

  serial: {
    open: 'Ghi kiểm tra serial',
    summary: (count: number, ng: number): string =>
      `Đã kiểm ${String(count)} máy · NG ${String(ng)} máy`,
    summaryHint: 'Được lưu cùng phán định',
    label: 'Số serial',
    count: (count: number, ng: number): string => `${String(count)} máy · NG ${String(ng)} máy`,
    manualLabel: 'Số serial',
    emptyTitle: 'Chưa quét serial nào',
    emptyHint: 'Có thể chỉ lưu phán định LOT mà không cần serial.',
    remove: (serialNo: string): string => `Bỏ ${serialNo}`,
    pageNav: 'Chuyển trang danh sách serial',
  },

  warning: {
    directionRelease:
      "Khi lưu, trạng thái LOT chuyển thành 'Bình thường' (khi không còn tạm giữ khác).",
    directionHold: "Khi lưu, trạng thái LOT chuyển thành 'Lỗi'.",
    directionPending: "Khi lưu, trạng thái LOT chuyển thành 'Chờ kiểm tra'.",
    directionUnknown: 'Khi lưu, trạng thái LOT sẽ thay đổi.',
    pickedDirectionRelease: 'Khi lưu, LOT này được gỡ sang trạng thái xuất hàng được.',
    pickedDirectionHold:
      'Khi lưu, các LOT mà lệnh xuất hàng này đã lấy (picking) sẽ chuyển sang trạng thái lỗi.',
    pickedDirectionPending:
      'Tạm giữ không thay đổi trạng thái LOT. Lệnh xuất hàng này không xuất được cho đến khi đánh giá xong.',
    picking:
      'Các lần lấy hàng đang thực hiện dùng LOT này sẽ bị chặn, số lượng đã lấy sẽ không được hoàn lại.',
    noAmendment: 'Sau khi lưu không thể sửa. Muốn thay đổi thì kiểm tra lại.',
    dispositionPath: 'Xử lý số lượng không đạt (làm lại·hủy) không quyết định tại màn hình này.',
  },

  bar: {
    next: 'Lưu',
    prev: 'Trước',
    save: 'Lưu phán định',
    saving: 'Đang lưu…',
    saved: (requestNo: string, judgment: string): string =>
      `Đã lưu phán định ${requestNo} (${judgment}).`,
    blocked: {
      noSelection: 'Hãy chọn yêu cầu trong danh sách bên trái.',
      loading: 'Đang tải thông tin yêu cầu.',
      worker: 'Chưa chỉ định mã nhân viên. Hãy nhập mã ở [Chuyển người dùng].',
      confirmed: 'Lần này đã xác nhận. Để phán định lại, hãy thêm lần kiểm tra lại.',
      draftElsewhere:
        'Lần này đang được soạn ở nơi khác. Để phán định lại, hãy thêm lần kiểm tra lại.',
      totals: 'Đạt + Không đạt + Tạm giữ phải bằng SL kiểm tra.',
      judgmentOptions:
        'Không có danh sách giá trị phán định nên không thể lưu. Hãy liên hệ người phụ trách.',
      judgment: 'Hãy chọn phán định tổng.',
    },
    reinspect: 'Thêm lần kiểm tra lại',
    reinspectCancel: 'Hủy kiểm tra lại',
  },

  confirm: {
    title: 'Lưu phán định?',
    request: 'Số yêu cầu',
    judgment: 'Phán định tổng',
    inspectedQty: 'SL kiểm tra',
    accepted: 'Đạt',
    rejected: 'Không đạt',
    held: 'Tạm giữ',
    serials: 'Serial',
    effects: 'Khi lưu',
    caution: 'Lưu ý',
    cancel: 'Hủy',
    confirm: 'Lưu phán định',
  },
  shipment: {
    card: (item: string, count: number, qty: string): string =>
      `${item} · ${String(count)} LOT đã lấy · ${qty}`,
    itemValue: (code: string, name: string): string => (name === '' ? code : `${code} ${name}`),
    staging: 'Chờ cất hàng',
    replacedLine: (
      round: number | null,
      judgment: string,
      at: string,
      worker: string,
      nonconformanceNo: string | null,
    ): string =>
      [
        round === null ? judgment : `Lần ${String(round)} ${judgment}`,
        `Thay trên PDA ${at}${worker === '' ? '' : ` ${worker}`}`,
        ...(nonconformanceNo === null ? [] : [`Không phù hợp ${nonconformanceNo}`]),
      ].join(' · '),
    cardEmpty: (item: string): string => `${item} · Chưa có LOT đã lấy`,
    target: 'Mục tiêu',
    picked: 'Đã lấy',
    refs: {
      request: 'Số yêu cầu',
      customer: 'Khách hàng',
      shipTo: 'Nơi giao',
      plan: 'Tiêu chuẩn kiểm tra',
      requestedAt: 'Thời điểm yêu cầu',
    },
    lotsReplacedHeading: 'LOT đã bị thay thế — không còn là đối tượng phán định',
    appliedNone: 'Chưa có lần áp dụng',
    form: {
      heading: (seqNo: number): string => `Thêm kết quả kiểm tra lần ${String(seqNo)}`,
      matchHint: 'Phán định của kết quả này áp dụng cho các LOT đã chọn.',
      judgmentHint: 'Chỉ chọn một. Không nhập số lượng.',
      serialHeading: 'Số sê-ri đã kiểm tra',
      serialOptional: '(tùy chọn)',
      noLots: 'Chưa có LOT nào được lấy nên không thể ghi kết quả.',
    },
    bar: {
      save: 'Lưu kết quả',
      saving: 'Đang lưu…',
      saved: (seqNo: number): string => `Đã lưu kết quả lần ${String(seqNo)}.`,
      ready: 'Có thể lưu. Phán định sẽ được xác nhận khi hoàn tất xuất hàng.',
      blocked: {
        match: 'Hãy chọn ít nhất 1 LOT đã lấy.',
        judgment: 'Hãy chọn phán định.',
        reason:
          'Kết quả này thay đổi phán định Không đạt hoặc Giữ lại. Hãy chọn lý do kiểm tra lại.',
        noLots: 'Chưa có LOT nào được lấy nên không thể ghi kết quả.',
        skipped: 'Yêu cầu này đã đóng do bỏ qua OQC. Không thêm kết quả.',
        completed: 'Phán định đã được xác nhận khi hoàn tất xuất hàng. Không thêm kết quả.',
        measurement: 'Hãy sửa lỗi giá trị đo của hạng mục kiểm tra rồi mới lưu được.',
      },
    },
  },
};
