import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-CO-14 thiết lập thông báo công việc bàn giao (피처 002).
 *
 * ⚠ **화면 이름은 사이드바와 글자가 같아야 한다** — `apps/web/src/app/nav-tree.ts` 의 `labelVi`.
 * 긴 작업 이름은 표가 두 줄로 접는다(시안 WCO14-States 상태 C).
 */
export const handoverAlertSettings: Translated<typeof ko.handoverAlertSettings> = {
  panes: {
    types: 'Công việc bàn giao',
    setting: (typeName: string): string => `Thiết lập thông báo: ${typeName}`,
  },
  fields: {
    plant: 'Chọn nhà máy',
    plantPlaceholder: 'Chọn nhà máy',
    when: 'Khi nào',
    where: 'Xử lý',
    enabled: 'Dùng thông báo',
    zalo: 'Gửi Zalo',
    recipients: (count: number): string => `Người nhận ${String(count)} người`,
    recipientMax: (max: number): string => `Tối đa ${String(max)} người`,
  },
  columns: {
    type: 'Công việc',
    enabled: 'T.báo',
    zalo: 'Zalo',
    recipients: 'N.nhận',
  },
  values: {
    on: 'ON',
    off: 'OFF',
    /** Zalo 연결이 ACTIVE 가 아닐 때 Zalo 발송 옆 노란 칩. */
    notConnected: 'Chưa kết nối',
    noPhone: 'Không có số điện thoại — chỉ nhận ở trung tâm thông báo',
    inactive: 'Ngừng sử dụng',
    noPhoneCount: (count: number): string => `${String(count)} người nhận không có số điện thoại`,
    recipientCount: (count: number): string => `${String(count)} người`,
  },
  actions: {
    add: 'Thêm người nhận',
    remove: 'Xóa',
    revert: 'Hủy',
    save: 'Lưu',
    reload: 'Tải lại',
    openConnection: 'Thiết lập kết nối Zalo',
    cancel: 'Hủy',
    discard: 'Bỏ thay đổi và chuyển',
  },
  state: {
    noPlants: 'Không có nhà máy để chọn.',
    noTypes: 'Không có công việc bàn giao để thiết lập.',
    noRecipients: 'Chưa chọn người nhận.',
    limitReached: (max: number): string =>
      `Chỉ được chọn tối đa ${String(max)} người. Hãy xóa một người trước khi đổi.`,
    noPhoneNotice: (count: number): string =>
      `${String(count)} người nhận không có số điện thoại chỉ nhận ở trung tâm thông báo`,
    zaloNeedsEnabled: 'Chỉ bật được Zalo sau khi bật dùng thông báo.',
    zaloNotActive:
      'Zalo chưa được kết nối nên sẽ không gửi Zalo. Trung tâm thông báo vẫn nhận ngay.',
    zaloQuota:
      'Phí gửi được trừ vào số dư ZBS. Thông báo vượt hạn mức gửi hằng ngày sẽ được gửi lúc 7 giờ sáng hôm sau (giờ nhà máy).',
    unsaved: 'Có thay đổi chưa lưu',
    saved: 'Đã lưu',
    conflict: 'Người khác đã lưu trước. Hãy tải lại rồi sửa.',
    unsavedTitle: 'Có thay đổi chưa lưu',
    unsavedBody: 'Nếu chuyển đi, nội dung đã sửa sẽ mất. Bỏ thay đổi và chuyển?',
  },
  errors: {
    inactiveRecipients: (count: number): string =>
      `Có ${String(count)} tài khoản ngừng sử dụng. Hãy xóa trước khi lưu.`,
  },
  types: {
    IQC_INSPECTION_REQUESTED: {
      when: 'Khi tạo yêu cầu kiểm tra IQC — gửi 1 lần cho mỗi phiếu nhập, thông báo ghi số LOT',
      where: 'Quản lý chất lượng › Tra cứu · đánh giá kiểm tra › IQC',
    },
    IQC_INSPECTION_REJECTED: {
      when: 'Khi kết quả IQC được xác nhận là không đạt — 1 lần cho mỗi LOT không đạt',
      where: 'PDA › Kho › Cất hàng và hoàn tất nhập kho (cất vào kho hàng lỗi trên PDA)',
    },
    PUTAWAY_PENDING: {
      when: 'Khi có LOT cần cất do xác nhận kết quả IQC hoặc đóng nhập hàng không cần kiểm — 1 lần cho mỗi LOT nhập (kèm số LOT)',
      where: 'PDA › Kho › Cất hàng và hoàn tất nhập kho',
    },
    PUTAWAY_REQUESTED: {
      when: 'Khi nhập kho tạo lệnh xếp kệ — 1 lần cho mỗi phiếu nhập kho (kèm số lệnh)',
      where: 'PDA › Kho › Xếp hàng lên kệ',
    },
    MATERIAL_PICKING_REQUESTED: {
      when: 'Khi yêu cầu xuất kho được phát hành và tạo lệnh lấy hàng (00:00 ngày xuất kho hoặc ngay) — mỗi lệnh 1 lần',
      where: 'PDA › Kho › Xuất vật tư, lấy hàng',
    },
    STOCK_TRANSFER_ARRIVAL_PENDING: {
      when: 'Khi chuyển kho được xuất đi — gửi người phụ trách của nhà máy kho đến',
      where: 'PDA › Kho › Chuyển kho (đến)',
    },
    WORK_ORDER_RELEASED: {
      when: 'Khi W/O thường được phát hành',
      where: 'POP › Bắt đầu công việc',
    },
    EMERGENCY_WORK_ORDER_RELEASED: {
      when: 'Khi W/O khẩn cấp được phát hành',
      where: 'POP › W/O khẩn cấp',
    },
    REWORK_WORK_ORDER_CREATED: {
      when: 'Khi xử lý không phù hợp tạo W/O làm lại',
      where: 'POP › Đăng ký kết quả làm lại',
    },
    OQC_INSPECTION_REQUESTED: {
      when: 'Khi đăng ký lệnh xuất hàng tạo yêu cầu OQC — 1 lần cho mỗi lệnh xuất (kèm số yêu cầu)',
      where: 'POP › Đánh giá kiểm tra xuất hàng OQC',
    },
    SHIPMENT_PICKING_REQUESTED: {
      when: 'Khi lệnh xuất hàng được đăng ký có nhà máy hoặc lần đầu được gán nhà máy',
      where: 'PDA › Xuất thành phẩm › Lấy hàng xuất thành phẩm',
    },
    SHIPMENT_PACKING_REQUESTED: {
      when: 'Khi xử lý xuất hàng trên web quản trị tạo phiếu xuất',
      where: 'POP › Đóng gói xuất hàng',
    },
  },
  workspace: {
    list: 'Danh sách công việc bàn giao',
    search: 'Tìm tên công việc',
    searchPlaceholder: 'Nhập tên công việc',
    apply: 'Tra cứu',
    clear: 'Đặt lại',
    selectTypeTitle: 'Hãy chọn công việc bàn giao.',
    selectType: 'Có thể thiết lập dùng thông báo, gửi Zalo và người nhận cho công việc đã chọn.',
  },
};
