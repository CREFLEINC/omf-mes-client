import type { ko } from '../ko';
import type { Translated } from './translated';

/** 요청이 막힌 자리의 공용 안내. 상태 코드를 그리지 않고 할 수 있는 일만 말한다. */
export const httpError: Translated<typeof ko.httpError> = {
  title: 'Không xử lý được yêu cầu',
  loadTitle: 'Không tải được danh sách',
  description: 'Hãy thử lại sau. Nếu lặp lại thì báo cho người phụ trách.',
  offline: 'Mất kết nối mạng. Hãy kiểm tra kết nối rồi thử lại.',
  forbidden: 'Bạn không có quyền thực hiện việc này. Cần quyền thì hãy hỏi người phụ trách.',
  deviceExpired: 'Thông tin đăng ký đã hết hạn. Hãy yêu cầu quản trị viên cấp mã QR mới.',
  deviceNotAllowed:
    'Máy này không xem được thông tin này. Hãy nhờ quản trị viên kiểm tra cài đặt máy.',
  deviceRejected:
    'Yêu cầu của máy này không được chấp nhận. Hãy nhờ quản trị viên kiểm tra đăng ký máy.',
  loadServer: 'Không tải được thông tin. Hãy thử lại sau.',
};
