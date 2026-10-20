/** Ghi nhận lỗi vật tư (omf-all-around#108). */
export const materialDefect = {
  title: 'Đăng ký lỗi vật tư',

  lot: {
    label: 'LOT vật tư',
    placeholder: 'Quét hoặc nhập số LOT',
    find: 'Tra cứu',
    notFound: 'Không có LOT với số này.',
    loadFailed: 'Không tải được LOT. Hãy kiểm tra kết nối rồi thử lại.',
    item: 'Mặt hàng',
    status: 'Trạng thái',
  },

  code: {
    major: 'Nhóm lỗi',
    minor: 'Chi tiết lỗi',
    none: 'Chưa có mã lỗi. Hãy đăng ký danh mục mã lỗi trước.',
    loadFailed: 'Không tải được mã lỗi.',
  },

  qty: {
    label: 'Số lượng lỗi',
    invalid: 'Hãy nhập số lớn hơn 0.',
    keypad: 'Bàn phím số lượng lỗi',
    backspace: 'Xóa một ký tự',
    clear: 'Xóa',
    decimal: 'Dấu thập phân',
  },

  description: 'Nội dung lỗi',

  hold: {
    label: 'Tạm giữ LOT này',
    reason: 'Lý do tạm giữ',
    reasonPlaceholder: 'Chọn lý do tạm giữ',
    releaseCondition: 'Điều kiện gỡ',
    releaseConditionDefault: 'Gỡ sau khi có kết quả đánh giá chất lượng',
    noVersion: 'Không đọc được thông tin khóa của LOT nên không thể tạm giữ. Hãy tra cứu lại LOT.',
    webNote: 'Nếu cần tạm giữ, hãy thực hiện ở phần nhập tạm giữ trên màn hình này.',
  },

  submit: 'Ghi nhận lỗi vật tư',
  saving: 'Đang ghi nhận…',
  recorded: 'Đã ghi nhận lỗi vật tư.',
  held: 'Đã tạm giữ LOT.',
  holdFailed: 'Đã ghi nhận lỗi nhưng tạm giữ LOT thất bại.',
  retryHold: 'Thử tạm giữ lại',
  holdFailure: {
    versionConflict:
      'Trạng thái LOT đã thay đổi ở nơi khác. Nhấn [Thử tạm giữ lại] để tra cứu lại LOT rồi tạm giữ.',
    alreadyHeld: 'LOT này đã bị tạm giữ toàn bộ. Không cần tạm giữ lại.',
    stateLocked:
      'Không thể tạm giữ ở trạng thái LOT hiện tại. Hãy kiểm tra trạng thái LOT tại màn hình đăng ký vật tư nghi ngờ.',
    network: 'Mất kết nối nên chưa tạm giữ được. Hãy kiểm tra kết nối rồi nhấn [Thử tạm giữ lại].',
    other:
      'Hãy nhấn [Thử tạm giữ lại] sau ít phút hoặc tạm giữ tại màn hình đăng ký vật tư nghi ngờ.',
  },

  blocked: {
    lot: 'Hãy tra cứu LOT trước.',
    code: 'Hãy chọn mã lỗi.',
    qty: 'Hãy nhập số lượng lỗi.',
    uom: 'Không biết đơn vị của LOT nên không thể ghi nhận.',
    holdReason: 'Hãy chọn lý do tạm giữ.',
    releaseCondition: 'Hãy nhập điều kiện gỡ.',
  },

  pane: {
    heading: 'Ghi nhận lỗi vật tư',
    singleOnly: 'Chọn một LOT để ghi nhận lỗi vật tư và xem LOT sản xuất bị ảnh hưởng.',
  },

  affected: {
    heading: 'LOT sản xuất bị ảnh hưởng',
    caption: 'Danh sách LOT sản xuất bị ảnh hưởng',
    estimate:
      'Ước tính theo lệnh sản xuất — toàn bộ LOT sản xuất của lệnh đã dùng vật tư này. Có thể rộng hơn các LOT thực sự sử dụng.',
    none: 'Không có lệnh sản xuất nào đã dùng vật tư này.',
    loading: 'Đang tải phạm vi ảnh hưởng.',
    loadFailed: 'Không tải được phạm vi ảnh hưởng.',
    columns: { lotNo: 'LOT sản xuất', workOrderNo: 'Lệnh sản xuất', statusCode: 'Trạng thái' },
  },
};
