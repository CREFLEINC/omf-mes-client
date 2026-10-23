import type { ko } from '../ko';
import type { Translated } from './translated';

export const taskFlow: Translated<typeof ko.taskFlow> = {
  header: {
    label: 'Công việc đang xử lý',
    more: 'Chi tiết',
    less: 'Thu gọn',
    progress: (done: number, total: number) => `Xong ${String(done)}/${String(total)}`,
  },
  scanZone: 'SCAN',
  step: (index: number, total: number) => `Bước ${String(index)}/${String(total)}`,
};
