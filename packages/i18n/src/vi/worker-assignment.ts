import type { ko } from '../ko';
import { common } from './common';
import type { Translated } from './translated';

/** P-CO-01 작업자 지정(사번 경량 인증). */
export const workerAssignment: Translated<typeof ko.workerAssignment> = {
  registration: {
    title: 'Đăng ký máy trạm',
    guide: 'Hãy nhập token máy trạm được cấp từ Web quản trị.',
    tokenLabel: 'Token máy trạm',
    tokenPlaceholder: 'Nhập token máy trạm',
    paste: 'Dán',
    clear: 'Nhập lại',
    verify: 'Đăng ký máy trạm',
    verifying: 'Đang kiểm tra…',
    confirmHeading: 'Xác nhận đăng ký máy trạm',
    confirmTitle: 'Hãy kiểm tra thông tin máy trạm bên dưới.',
    apply: 'Áp dụng đăng ký',
    restart: 'Nhập lại',
    reRegister: 'Đăng ký lại máy trạm',
    terminalCode: 'Mã máy trạm',
    equipment: 'Thiết bị',
    process: 'Công đoạn',
    processUnknown: 'Không kiểm tra được',
    unassigned: 'Chưa chỉ định',
    preparing: 'Đang kiểm tra đăng ký máy trạm và chuẩn bị công việc…',
    prepareFailedTitle: 'Kiểm tra đăng ký máy trạm hoặc chuẩn bị công việc thất bại',
    prepareFailedBody:
      'Mã đã lưu vẫn được giữ. Hãy kiểm tra kết nối và quyền máy trạm rồi thử lại.',
    retryPrepare: 'Chuẩn bị lại',
    storedFailure: {
      malformed:
        'Token lưu trên máy trạm này không hợp lệ nên đã bị xóa. Hãy dán token nhận từ Web quản trị.',
      rejected:
        'Token lưu trên máy trạm này không còn dùng được nên đã bị xóa. Hãy xin cấp lại token của máy trạm này trên Web quản trị rồi dán vào.',
      foreign:
        'Token lưu trên máy trạm này là của máy trạm khác nên đã bị xóa. Hãy dán token đúng của máy trạm này.',
      wrongType:
        'Token lưu trên máy trạm này không dành cho máy trạm POP nên đã bị xóa. Hãy xin quản trị viên thông tin đăng ký phù hợp.',
    },
    failure: {
      malformed:
        'Giá trị token không hợp lệ. Hãy sao chép lại từ cửa sổ cấp token trên Web quản trị rồi dán vào.',
      rejected:
        'Token này không còn dùng được. Hãy xin cấp lại token của máy trạm này trên Web quản trị.',
      unreachable:
        'Không kết nối được máy chủ nên chưa kiểm tra được. Hãy kiểm tra kết nối rồi thử lại.',
      foreign: 'Đây là token của máy trạm khác. Hãy xin quản trị viên token đúng của máy trạm này.',
      wrongType:
        'Không phải token dành cho máy trạm POP. Hãy xin lại thông tin token từ quản trị viên.',
      offline: 'Chỉ đăng ký máy trạm được khi đang kết nối. Hãy kiểm tra kết nối rồi thử lại.',
      noStore: 'Máy trạm này không lưu được token. Hãy báo người phụ trách lắp đặt.',
      queueBlocked:
        'Còn {count} bản ghi chưa gửi lên máy chủ nên không đổi sang máy trạm khác được. Hãy khôi phục kết nối, chờ gửi xong rồi thử lại.',
    },
  },
  header: {
    brand: 'OMF-MES POP',
    label: 'Máy trạm',
    emptyValue: '—',
    online: common.connection.online,
    offline: common.connection.offline,
  },
  input: {
    heading: 'Nhập mã nhân viên',
    workerNo: 'Mã nhân viên',
    keypad: 'Bàn phím số mã nhân viên',
    backspace: 'Xóa một ký tự',
    clear: 'Xóa hết',
    placeholder: 'Nhập mã nhân viên',
    submit: 'Xác nhận mã',
    checking: 'Đang kiểm tra',
    unusual: 'Mã nhân viên không phải 6 chữ số. Hãy nhập lại.',
  },
  offline: {
    /** ⭐ 오프라인에서도 **미리 받아 둔 목록으로 확인한다**(§5-6) — 막지 않는다. */
    note: 'Đang ngoại tuyến. Kiểm tra bằng danh sách công nhân đã nhận trước.',
  },
  current: {
    heading: 'Công nhân hiện tại',
    none: 'Chưa có công nhân hiện tại.',
    noneHelp: 'Hãy nhập mã nhân viên.',
    confirmed: 'Đã xác nhận',
    workerNo: 'Mã nhân viên',
    assignedAt: 'Thời điểm chỉ định',
    shift: 'Đổi công nhân',
    pendingQueue: (count: number): string =>
      `Còn ${count} bản ghi chưa gửi vẫn mang mã nhân viên trước`,
    toWork: 'Đến màn hình công việc →',
    otherPlant: 'Thuộc nhà máy khác.',
  },
  error: {
    unknown: (workerNo: string): string => `Mã nhân viên chưa đăng ký (${workerNo})`,
    inactive: 'Mã nhân viên này hiện không còn làm việc. Hãy liên hệ quản trị viên',
    lookupFailed: 'Không kiểm tra được mã nhân viên. Hãy thử lại sau.',
    noDirectory: 'Chưa nhận được danh sách công nhân. Phải chạy một lần khi đang kết nối',
  },
};
