/** W-03-11 PQC 검사 등록·조회(관리웹). */
export const pqcInspectionRegister = {
  title: 'Đăng ký · tra cứu kiểm tra PQC',
  breadcrumbRoot: 'Quản lý chất lượng',

  queue: {
    heading: 'Yêu cầu kiểm tra',
    caption: 'Danh sách yêu cầu kiểm tra PQC',
    pendingOnly: 'Chỉ xem đang chờ · đang thực hiện',
    empty: 'Không có yêu cầu kiểm tra PQC phù hợp với điều kiện.',
    unavailable: 'Không thể hiển thị danh sách.',
    loading: 'Đang tải yêu cầu kiểm tra PQC.',
  },

  detail: {
    paneLabel: 'Nhập kiểm tra',
    nothingSelected: 'Hãy chọn yêu cầu cần kiểm tra ở danh sách bên trái.',
  },
};
