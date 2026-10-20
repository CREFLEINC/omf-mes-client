import type { ko } from '../ko';
import type { Translated } from './translated';

/** Khác với gửi thất bại: bản ghi chờ gửi sẽ tự đi khi có kết nối. */
export const outboxPending: Translated<typeof ko.outboxPending> = {
  title: 'Bản ghi chờ gửi',
  lead: 'Bản ghi chưa gửi được. Khi có kết nối sẽ tự gửi.',
  empty: 'Không có bản ghi chờ gửi.',
  occurredAt: (at: string) => `Ghi lúc ${at}`,
  worker: (workerNo: string) => `Mã nhân viên ${workerNo}`,
  sendNow: 'Gửi ngay',
  sendLocked: 'Có kết nối mới gửi được',
  result: {
    sent: (count: number) => `Đã gửi ${String(count)} bản ghi`,
    unreachable: 'Không gửi được. Kiểm tra kết nối rồi bấm lại.',
    rejected: (count: number) =>
      `${String(count)} bản ghi không được đăng ký, đã chuyển sang bản ghi gửi thất bại`,
  },
};
