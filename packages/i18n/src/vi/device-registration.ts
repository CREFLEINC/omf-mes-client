import type { ko } from '../ko';
import type { Translated } from './translated';

/** M-CO-01 기기 등록·사번 확인. */
export const deviceRegistration: Translated<typeof ko.deviceRegistration> = {
  title: 'Đăng ký máy',
  checking: 'Đang kiểm tra trạng thái đăng ký',
  unregistered: {
    title: 'Máy này chưa được đăng ký',
    description: 'Hãy quét mã QR đăng ký trên màn hình quản trị.',
    where: 'Quản trị viên tạo mã đăng ký tại Web quản trị > Hệ thống > Cài đặt.',
  },
  camera: {
    preparing: 'Đang chuẩn bị camera',
    unsupported: 'Máy này không dùng được nhận dạng camera',
    denied: 'Không có quyền camera nên không đọc được mã QR đăng ký',
    grant: 'Hãy cấp quyền rồi thử lại.',
  },
  offline: {
    title: 'Phải đăng ký khi đang kết nối',
    description: 'Đăng ký chỉ xong khi gửi đi và được xác nhận. Hãy kiểm tra kết nối rồi thử lại.',
  },
  receiving: {
    title: 'Đang nhận thông tin nhân viên',
    description: 'Đang nhận danh sách nhân viên. Hãy đợi cho đến khi xong.',
  },
  rejected: {
    title: 'Thông tin đăng ký đã hết hạn',
    description: 'Hãy yêu cầu quản trị viên cấp mã QR mới.',
  },
  retry: 'Thử lại',
  terminal: {
    label: 'Máy',
  },
  registered: {
    title: 'Đã đăng ký',
    confirm: 'Hãy đối chiếu với mã máy mà quản trị viên đã báo',
  },
  signIn: {
    title: 'Xác nhận mã nhân viên',
    label: 'Mã nhân viên',
    confirm: 'Xác nhận',
    change: 'Đổi mã nhân viên',
    toWork: 'Đến danh sách công việc',
    unknown: 'Mã nhân viên chưa đăng ký hoặc đã nghỉ việc',
    noDirectory: 'Chưa nhận được thông tin nhân viên',
    keypad: {
      label: 'Nhập mã nhân viên',
      backspace: 'Xóa một ký tự',
      clear: 'Xóa hết',
    },
    current: {
      label: 'Nhân viên hiện tại',
      notice: 'Mọi ghi nhận trên máy này sẽ mang mã nhân viên đó.',
    },
  },
  device: {
    label: 'Thông tin máy',
    unknown: 'Không đọc được thông tin máy',
  },
};
