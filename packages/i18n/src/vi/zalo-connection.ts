import type { ko } from '../ko';
import type { Translated } from './translated';

/** W-CO-12 알림 연결 설정. 사이드바 라벨(`nav-tree.ts`)과 제목 글자가 같아야 한다. */
export const zaloConnection: Translated<typeof ko.zaloConnection> = {
  panes: {
    status: 'Trạng thái kết nối',
    connection: 'Cài đặt gửi Zalo',
    templates: 'Tra cứu mẫu tin',
  },
  chips: {
    connectionError: 'Lỗi kết nối',
    deliveryOff: 'Gửi OFF',
  },
  fields: {
    appId: 'ID ứng dụng',
    secretKey: 'Khóa bí mật ứng dụng',
    refreshToken: 'Mã làm mới',
    paramMaxLength: 'Giới hạn độ dài giá trị biến',
    templateId: 'ID mẫu',
    templateIdFor: (name: string): string => `ID mẫu ${name}`,
    expiresAt: 'Thời điểm hết hạn mã truy cập',
    refreshedAt: 'Thời điểm làm mới lần cuối',
    params: 'Biến mẫu',
    errorCode: 'Mã lỗi',
    errorMessage: 'Nội dung lỗi gốc',
  },
  values: {
    registered: 'Đã đăng ký',
    notRegistered: 'Chưa đăng ký',
    none: '—',
    charUnit: 'ký tự',
  },
  actions: {
    register: 'Đăng ký',
    change: 'Sửa',
    copy: 'Sao chép tên biến',
    copyFor: (eventName: string): string => `Sao chép tên biến ${eventName}`,
    revert: 'Hủy',
    save: 'Lưu',
    errorDetail: 'Chi tiết lỗi',
    reload: 'Tải lại',
  },
  state: {
    saved: 'Đã lưu',
    copied: 'Đã sao chép biến mẫu.',
    reauth: 'Hãy nhận mã làm mới mới từ người phụ trách Zalo của khách hàng rồi đăng ký bằng [Sửa]',
    lastError: (code: string): string =>
      code === '-124' ? 'Mã truy cập Zalo không hợp lệ.' : 'Đã xảy ra lỗi khi kết nối Zalo.',
    conflict: 'Người khác đã lưu trước. Hãy tải lại rồi lưu',
  },
  handover: {
    title: 'Mẫu tin công việc bàn giao',
    copyFor: (typeName: string): string => `Sao chép tên biến công việc bàn giao ${typeName}`,
    templateIdHelp:
      'Hãy nhập ID mẫu đã đăng ký trên Zalo OA. Nếu để trống ID, chỉ gửi đến trung tâm thông báo.',
  },
  errors: {
    appId: 'ID ứng dụng gồm 1–40 chữ số.',
    secretRequired: 'Hãy nhập giá trị mới. Nếu không muốn thay đổi, hãy bấm [Hủy].',
    secretTooLong: (max: number): string => `Không được quá ${String(max)} ký tự.`,
    paramMaxLength: 'Hãy nhập số nguyên từ 20 đến 400.',
    templateId: 'ID mẫu tin gồm 1–40 chữ cái tiếng Anh hoặc chữ số, hoặc để trống.',
  },
  workspace: {
    search: 'Tìm tên mẫu',
    searchPlaceholder: 'Nhập tên mẫu, biến mẫu hoặc ID mẫu',
    apply: 'Tra cứu',
    clear: 'Đặt lại',
    list: 'Danh sách mẫu',
    kind: 'Loại',
    name: 'Tên mẫu',
    templateId: 'ID mẫu',
    kindWithCount: (label: string, count: number): string => `${label} ${String(count)}`,
    kinds: { event: 'Sự kiện', handover: 'Công việc bàn giao' },
    empty: 'Không có mẫu phù hợp với điều kiện.',
  },
};
