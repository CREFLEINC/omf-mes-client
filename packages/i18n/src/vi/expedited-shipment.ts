import type { ko } from '../ko';
import type { Translated } from './translated';

/** W-04-05 긴급 직행 출하 처리. 문구의 중심은 「일어나지 않는 것」이다. */
export const expeditedShipment: Translated<typeof ko.expeditedShipment> = {
  title: 'Xử lý xuất hàng thẳng khẩn cấp',
  breadcrumbRoot: 'Xuất hàng',
  headerNotice:
    'Bỏ qua luồng thông thường. Xuất hàng thẳng, không qua kho, không lấy hàng, không đóng gói.',
  panes: {
    lot: 'LOT thành phẩm đích',
    target: 'Đích xuất hàng',
    loading: 'Thông tin lên xe',
    reason: 'Lý do',
    outcome: 'Điều xảy ra khi xác nhận',
  },
  lot: {
    label: 'Phần đã sản xuất xong',
    placeholder: 'Hãy chọn phần đã sản xuất xong',
    empty: 'Không có phần đã sản xuất xong nào xuất hàng được',
    truncated: 'Phần đã sản xuất xong quá nhiều nên chỉ hiện phần đầu. Hãy thu hẹp theo mặt hàng.',
    loading: 'Đang tải phần đã sản xuất xong',
    loadFailed: 'Không tải được danh sách phần đã sản xuất xong',
    fields: {
      lotNo: 'LOT',
      item: 'Mặt hàng',
      qty: 'Số lượng',
      status: 'Lot Status',
    },
    unreceivedNotice: 'LOT này đang ở trạng thái chưa nhập vào kho thành phẩm.',
  },
  release: {
    heldTitle: 'Đây là LOT đang tạm giữ',
    held: 'Phải gỡ tạm giữ mới xuất hàng được. Việc gỡ tạm giữ hãy hỏi người phụ trách.',
    inspectionPendingTitle: 'Vẫn đang ở trạng thái chờ kiểm tra',
    inspectionPending: 'Có đánh giá OQC rồi thì mới tiếp tục được.',
    serverDecides:
      'Có ở trạng thái xuất hàng được hay không thì máy chủ đánh giá lại khi xác nhận.',
    unknown: 'Không rõ trạng thái',
  },
  target: {
    label: 'Lệnh xuất hàng',
    placeholder: 'Hãy chọn lệnh xuất hàng',
    empty: 'Không có lệnh xuất hàng nào khớp mặt hàng của LOT đã chọn',
    filteredByItem:
      'Chỉ hiện những lệnh khớp mặt hàng của LOT đã chọn. Việc lọc này chỉ áp dụng trong phần kết quả nhận được ở trang này.',
    period: 'Ngày xuất hàng',
    periodNote: 'Chỉ tra cứu các lệnh xuất hàng trong khoảng thời gian này.',
    periodInvalid: 'Ngày bắt đầu sau ngày kết thúc. Hãy đổi hai ngày cho nhau',
    selectLotFirst: 'Hãy chọn LOT thành phẩm đích trước',
    loading: 'Đang tải lệnh xuất hàng',
    loadFailed: 'Không tải được lệnh xuất hàng',
    noLine: 'Lệnh này không có dòng nào của mặt hàng đã chọn',
    fields: {
      shipmentRequestNo: 'Số lệnh xuất hàng',
      requestedShipDate: 'Ngày xuất hàng',
      allocatedQty: 'Phân bổ',
      remainingQty: 'Phân bổ còn lại',
      qty: 'Số lượng',
    },
  },
  qty: {
    required: 'Hãy nhập số lượng',
    notNumber: 'Hãy nhập số lượng bằng số',
    tooSmall: 'Số lượng phải lớn hơn 0',
    tooLong: 'Số lượng quá dài. Hãy nhập tối đa 12 chữ số nguyên và 6 chữ số thập phân',
    overLimit: (lotQty: string, remainingQty: string): string =>
      `Không được vượt quá số lượng LOT ${lotQty} / phân bổ còn lại ${remainingQty}`,
    limitNote: (lotQty: string, remainingQty: string): string =>
      `Hãy nhập không quá số lượng LOT ${lotQty} · phân bổ còn lại ${remainingQty}`,
  },
  loading: {
    vehicleNo: 'Biển số xe',
    driverName: 'Tên tài xế',
    sealNo: 'Số niêm phong',
    optional: 'Đây là mục nhập tùy chọn',
    warehouse: 'Kho xuất hàng',
    warehouseNote: 'Đây là kho nhập trên sổ sách. Hàng không đi qua kho này.',
    warehouseAmbiguous:
      'Có nhiều kho đang hoạt động nên màn hình để bạn tự chọn. Hãy chọn nơi cần ghi nhận.',
    warehouseNone:
      'Không có kho nào đang hoạt động nên không tiếp tục được. Hãy đăng ký dữ liệu gốc của kho trước.',
    warehouseFailed: 'Không tải được danh sách kho',
    warehouseLoading: 'Đang tải kho',
  },
  reason: {
    label: 'Lý do khẩn cấp',
    help: 'Hãy ghi lại vì sao bỏ qua luồng thông thường. Sau này sẽ có người đọc và phán đoán.',
    withdrawn: 'Lý do là nhập tự do nên không tổng hợp được theo lý do.',
    required: 'Hãy nhập lý do khẩn cấp',
    tooLong: 'Lý do khẩn cấp quá dài. Hãy nhập tối đa 500 ký tự',
  },
  outcome: {
    irreversible: 'Không hoàn tác được.',
    receipt:
      'Sẽ tạo phiếu nhập kho thành phẩm — việc nhập kho thành phẩm chỉ là ghi nhận trên sổ sách, hàng không đi qua kho.',
    shipment:
      'Sẽ tạo phiếu xuất hàng và trừ tồn kho đúng bằng phần LOT đã phân bổ. Genealogy của LOT đó kết thúc.',
    unconfirmed:
      'Lô xuất hàng vẫn ở trạng thái chưa xác nhận — màn hình này không xác nhận, việc xác nhận và hủy làm ở màn hình riêng.',
    rollback:
      'Chỉ cần một phần thất bại là mọi thứ quay lại như cũ. Không để lại trạng thái xử lý dở dang.',
    skipped: 'Bỏ qua việc qua kho, lấy hàng và đóng gói.',
    qualityGate:
      'Không bỏ qua việc đánh giá chất lượng — nếu Lot Status không ở trạng thái xuất hàng được thì không tiếp tục được.',
  },
  submit: 'Chốt xuất hàng thẳng',
  lock: {
    selectLot: 'Hãy chọn LOT thành phẩm đích',
    selectTarget: 'Hãy chọn lệnh xuất hàng',
    notReleasable: 'Lot Status không ở trạng thái xuất hàng được',
    qty: 'Hãy nhập số lượng cho đúng',
    reason: 'Hãy nhập lý do khẩn cấp',
    warehouse: 'Phải xác định kho xuất hàng',
    saving: 'Đang xử lý xuất hàng thẳng',
  },
  confirm: {
    title: 'Chốt xuất hàng thẳng',
    target: (lotNo: string, shipmentRequestNo: string): string =>
      `Sẽ xuất hàng thẳng ${lotNo} theo ${shipmentRequestNo}.`,
    qty: (qty: string): string => `Số lượng ${qty}`,
    irreversible:
      'Không hoàn tác được — phiếu nhập kho thành phẩm và phiếu xuất hàng được tạo cùng lúc và tồn kho bị trừ.',
    unconfirmedNote:
      'Sau khi xử lý, lô xuất hàng vẫn ở trạng thái chưa xác nhận. Việc xác nhận làm ở màn hình riêng.',
    cancel: 'Hủy',
    confirm: 'Chốt xuất hàng thẳng',
  },
  success: 'Đã tạo lô xuất hàng thẳng ở trạng thái chưa xác nhận.',
};
