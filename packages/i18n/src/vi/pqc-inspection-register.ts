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
  },
};
