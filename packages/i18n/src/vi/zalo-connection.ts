import type { ko } from '../ko';
import type { Translated } from './translated';

/** W-CO-12 알림 연결 설정. 사이드바 라벨(`nav-tree.ts`)과 제목 글자가 같아야 한다. */
export const zaloConnection: Translated<typeof ko.zaloConnection> = {
  title: 'Thiết lập kết nối thông báo',
  subtitle: 'Thông tin kết nối Zalo',
  breadcrumbRoot: 'Quản trị hệ thống',
  panes: {
    status: 'Trạng thái kết nối',
    connection: 'Thông tin kết nối',
    templates: 'Mẫu tin theo sự kiện',
  },
  status: {
    ACTIVE: 'Bình thường',
    NOT_CONFIGURED: 'Chưa thiết lập',
    REAUTH_REQUIRED: 'Cần đăng ký lại',
  },
  fields: {
    appId: 'ID ứng dụng',
    secretKey: 'Khóa bí mật ứng dụng',
    refreshToken: 'Mã làm mới',
    paramMaxLength: 'Độ dài tối đa của giá trị',
    templateId: (eventName: string): string => `ID mẫu tin ${eventName}`,
    expiresAt: 'Hết hạn mã truy cập',
    refreshedAt: 'Làm mới lần cuối',
    params: 'Tham số',
  },
  values: {
    registered: '●●●●●● Đã đăng ký',
    notRegistered: 'Chưa đăng ký',
    none: '—',
    charUnit: 'ký tự',
  },
  actions: {
    change: 'Thay đổi',
    cancelChange: 'Không thay đổi',
    copy: 'Sao chép',
    copyFor: (eventName: string): string => `Sao chép tham số ${eventName}`,
    revert: 'Hoàn tác',
    save: 'Lưu',
    reload: 'Tải lại',
  },
  state: {
    saved: 'Đã lưu',
    copied: 'Đã sao chép tên tham số',
    reauth: 'Hãy nhận mã làm mới mới từ người phụ trách Zalo của khách hàng rồi đăng ký bằng [Thay đổi]',
    deliveryDisabled: 'Máy chủ này đang tắt gửi Zalo',
    lastError: (code: string, message: string): string => `${code} ${message}`.trim(),
    conflict: 'Người khác đã lưu trước. Hãy tải lại rồi lưu',
  },
  errors: {
    appId: 'ID ứng dụng gồm 1–40 chữ số.',
    secretRequired: 'Hãy nhập giá trị mới. Nếu không muốn thay đổi, hãy bấm [Không thay đổi].',
    secretTooLong: 'Không được quá 500 ký tự.',
    paramMaxLength: 'Hãy nhập số nguyên từ 20 đến 400.',
    templateId: 'ID mẫu tin gồm 1–40 chữ cái tiếng Anh hoặc chữ số, hoặc để trống.',
  },
};
