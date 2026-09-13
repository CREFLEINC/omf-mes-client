import type { ko } from '../ko';
import type { Translated } from './translated';

/** 못 보낸 것과 다른 말을 쓴다. 이것은 기다려도 가지 않는다. */
export const outboxRejections: Translated<typeof ko.outboxRejections> = {
  title: 'Bản ghi gửi thất bại',
  lead: 'Đã gửi nhưng không được đăng ký. Sẽ không gửi lại.',
  empty: 'Không có bản ghi gửi thất bại.',
  occurredAt: (at: string) => `Ghi lúc ${at}`,
  cascaded: 'Bản ghi trước thất bại nên bản ghi này cũng không gửi được',
  dismiss: 'Bỏ khỏi danh sách',
  details: {
    open: 'Xem chi tiết',
    close: 'Đóng chi tiết',
    request: 'Yêu cầu',
    status: 'Mã phản hồi',
    code: 'Mã lỗi',
    message: 'Thông báo nhận về',
    key: 'Mã yêu cầu',
    rejectedAt: 'Thời điểm bị trả về',
    none: 'Không có',
  },
  reason: {
    invalid: 'Nội dung đã ghi có vấn đề.',
    conflict: 'Nơi khác đã thay đổi trước.',
    stateLocked: 'Trạng thái hiện tại không cho phép làm việc này.',
    noLeader: 'Bản ghi trước chưa đi nên không có chỗ để gắn vào.',
    unknown: 'Đã gửi nhưng không được đăng ký.',
  },
};
