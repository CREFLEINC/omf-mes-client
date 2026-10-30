import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-CO-14 thiết lập thông báo công việc bàn giao (피처 002).
 *
 * ⚠ **화면 이름은 사이드바와 글자가 같아야 한다** — `apps/web/src/app/nav-tree.ts` 의 `labelVi`.
 * 긴 작업 이름은 표가 두 줄로 접는다(시안 WCO14-States 상태 C).
 */
export const handoverAlertSettings: Translated<typeof ko.handoverAlertSettings> = {
  title: 'Thiết lập thông báo công việc bàn giao',
  breadcrumbRoot: 'Quản trị hệ thống',
  description:
    'Chọn người được thông báo cho từng công việc bàn giao. Thông báo đến trung tâm thông báo, bật thêm Zalo nếu cần.',
  intro:
    'Ban đầu tất cả đều tắt. Bật Zalo sẽ làm tăng lượng tin Zalo của khách hàng (phí và hạn mức ngày).',
  panes: {
    types: 'Công việc bàn giao',
    setting: (typeName: string): string => `Thiết lập: ${typeName}`,
  },
  fields: {
    plant: 'Nhà máy',
    when: 'Khi nào',
    where: 'Xử lý',
    enabled: 'Nhận thông báo',
    zalo: 'Gửi cả qua Zalo',
    recipients: (count: number, max: number): string =>
      `Người nhận (${String(count)}/${String(max)})`,
  },
  columns: {
    type: 'Công việc',
    enabled: 'T.báo',
    zalo: 'Zalo',
    recipients: 'N.nhận',
  },
  values: {
    on: 'Bật',
    off: 'Tắt',
    noPhone: 'Không có số điện thoại — chỉ nhận ở trung tâm thông báo',
    inactive: 'Ngừng sử dụng',
    noPhoneCount: (count: number): string => `${String(count)} người nhận không có số điện thoại`,
  },
  actions: {
    add: 'Thêm',
    remove: 'Bỏ',
    revert: 'Hoàn tác',
    save: 'Lưu',
    reload: 'Tải lại',
    openConnection: 'Mở thiết lập kết nối thông báo',
    cancel: 'Hủy',
    discard: 'Bỏ thay đổi và chuyển',
  },
  state: {
    noPlants: 'Không có nhà máy để chọn.',
    noTypes: 'Không có công việc bàn giao để thiết lập.',
    noRecipients: 'Chưa chọn người nhận.',
    noRecipientsWarning: 'Không có người phụ trách nên thông báo sẽ không được gửi.',
    limitReached: (max: number): string =>
      `Chỉ được chọn tối đa ${String(max)} người. Hãy bỏ một người trước khi đổi.`,
    noPhoneNotice: (count: number): string =>
      `${String(count)} người nhận không có số điện thoại chỉ nhận ở trung tâm thông báo`,
    zaloHelp:
      'Gửi tin Zalo tiếng Anh cho người nhận có số điện thoại. Nếu gửi lỗi, trung tâm thông báo vẫn nhận.',
    zaloNeedsEnabled: 'Chỉ bật được Zalo sau khi bật thông báo.',
    zaloNotActive: 'Chưa thiết lập kết nối Zalo nên hiện chỉ gửi đến trung tâm thông báo',
    saved: 'Đã lưu',
    conflict: 'Người khác đã lưu trước. Hãy tải lại rồi sửa.',
    unsavedTitle: 'Có thay đổi chưa lưu',
    unsavedBody: 'Nếu chuyển đi, nội dung đã sửa sẽ mất. Bỏ thay đổi và chuyển?',
  },
  errors: {
    inactiveRecipients: (count: number): string =>
      `Có ${String(count)} tài khoản ngừng sử dụng. Hãy bỏ trước khi lưu.`,
  },
  picker: {
    slotsLeft: (left: number, max: number): string =>
      `Còn ${String(left)} chỗ — mỗi công việc tối đa ${String(max)} người`,
    full: (max: number): string => `Đã đủ ${String(max)} người — không chọn thêm được`,
  },
  types: {
    IQC_INSPECTION_REQUESTED: {
      when: 'Khi đăng ký LOT nhập hàng tạo yêu cầu IQC — 1 lần cho mỗi phiếu nhập (kèm số LOT)',
      where: 'Web quản trị › Quản lý chất lượng › Tra cứu · đánh giá kiểm tra (tab IQC)',
    },
    PUTAWAY_REQUESTED: {
      when: 'Khi nhập kho tạo lệnh xếp kệ — 1 lần cho mỗi phiếu nhập kho (kèm số lệnh)',
      where: 'PDA › Kho › Xếp hàng lên kệ',
    },
    MATERIAL_PICKING_REQUESTED: {
      when: 'Khi yêu cầu xuất (phát hành W/O, yêu cầu xuất thêm) tạo lệnh lấy hàng — mỗi lệnh 1 lần',
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
};
