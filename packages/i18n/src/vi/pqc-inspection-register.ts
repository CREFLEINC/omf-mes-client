/** W-03-11 PQC 검사 등록·조회(관리웹). */
export const pqcInspectionRegister = {
  title: 'PQC (kiểm tra công đoạn) tra cứu · đánh giá',
  breadcrumbRoot: 'Quản lý chất lượng',

  queue: {
    heading: 'Yêu cầu kiểm tra',
    caption: 'Danh sách yêu cầu kiểm tra PQC',
    pendingOnly: 'Chỉ xem đang chờ · đang thực hiện',
    empty: 'Không tìm thấy yêu cầu kiểm tra nào.',
    emptyHint: 'Hãy thay đổi điều kiện tìm kiếm hoặc đặt lại bộ lọc.',
    unavailable: 'Không thể hiển thị danh sách.',
    loading: 'Đang tải yêu cầu kiểm tra PQC.',
  },

  detail: {
    paneLabel: 'Nhập kiểm tra',
    nothingSelected: 'Hãy chọn yêu cầu cần kiểm tra ở danh sách bên trái.',
    sectionTitle: 'Thông tin kiểm tra',
    backToList: '← Danh sách',
    leaveUnsaved: 'Chưa lưu thay đổi',
    leaveUnsavedNote: 'Nếu rời đi mà không lưu, nội dung đã nhập sẽ bị mất.',
    keepEditing: 'Tiếp tục nhập',
    leaveAnyway: 'Rời đi không lưu',
  },

  filters: {
    item: 'Tìm mặt hàng',
    itemPlaceholder: 'Nhập mặt hàng',
    itemPick: 'Chọn',
    itemClear: 'Xóa điều kiện mặt hàng',
    keyword: 'Tìm số yêu cầu',
    keywordPlaceholder: 'Nhập số yêu cầu',
    apply: 'Tra cứu',
    reset: 'Đặt lại',
  },

  columns: {
    workOrder: 'Lệnh sản xuất',
    item: 'Mặt hàng',
    targetQty: 'Số lượng kiểm tra',
    status: 'Trạng thái',
  },

  web: {
    summary: {
      heading: 'Thông tin kiểm tra',
      inspectionRequestNo: 'Số yêu cầu',
      workOrder: 'Lệnh sản xuất',
      item: 'Mặt hàng',
      targetQty: 'Tổng số lượng kiểm tra',
      inspectionType: 'Loại kiểm tra',
      inspectionTypeName: 'PQC (Kiểm tra công đoạn)',
      plan: 'Tiêu chuẩn áp dụng',
      noPlan: 'Không có tiêu chuẩn',
      planLabel: (code: string, version: number): string => `${code} v${String(version)}`,
      lot: 'LOT đối tượng',
      requestedAt: 'Thời gian yêu cầu',
    },
    items: {
      heading: 'Kết quả theo hạng mục',
      progress: (judged: number, total: number): string =>
        `Đã đánh giá ${String(judged)} / ${String(total)}`,
      columns: {
        item: 'Hạng mục kiểm tra',
        spec: 'Quy cách',
        sample: 'Lần đo',
        value: 'Kết quả đo',
        judgment: 'Đánh giá',
      },
      sampleOf: (sampleNo: number): string => `Lần ${String(sampleNo)}`,
      valueLabel: (item: string, sampleNo: number): string =>
        `${item} lần ${String(sampleNo)} kết quả đo`,
      judgmentLabel: (item: string, sampleNo: number): string =>
        `${item} lần ${String(sampleNo)} đánh giá`,
      tolerance: (value: number, delta: number): string => `${value} ± ${delta}`,
      target: (value: number): string => `Giá trị chuẩn ${value}`,
      withTarget: (limits: string, value: number): string => `${limits} (chuẩn ${value})`,
    },
    quantity: {
      heading: 'Nhập số lượng kiểm tra',
      targetQty: 'Tổng số lượng kiểm tra',
      inspectedQty: 'Số lượng kiểm tra',
      accepted: 'Số lượng đạt',
      rejected: 'Số lượng không đạt',
      held: 'Số lượng tạm giữ',
      entered: 'Đã nhập',
      remaining: 'Chưa nhập',
      overBy: (over: string): string => `Vượt ${over}`,
      overNote: (over: string): string => `Nhiều hơn số lượng kiểm tra ${over}.`,
      progressLabel: 'Tổng đã nhập so với số lượng kiểm tra',
    },
    judgment: {
      heading: 'Đánh giá',
      label: 'Đánh giá cuối cùng',
      placeholder: 'Hãy chọn đánh giá cuối cùng',
    },
    actions: {
      confirm: 'Xác nhận đánh giá',
      confirmNote: 'Sau khi xác nhận không thể sửa.',
      confirmed: 'Đánh giá đã được xác nhận, không thể sửa.',
    },
  },
};
