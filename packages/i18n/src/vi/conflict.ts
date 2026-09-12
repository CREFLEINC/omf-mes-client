import type { ko } from '../ko';
import type { Translated } from './translated';

/** 저장 충돌(409) 원인별 안내. 세 원인은 대응이 서로 달라 문장도 갈라 둔다. */
export const conflict: Translated<typeof ko.conflict> = {
  reloadAction: 'Tải nội dung mới nhất',
  reloadNote: 'Tải nội dung mới nhất thì nội dung đã nhập sẽ mất.',
  user: 'Người dùng khác đã lưu trước. Hãy tải nội dung mới nhất rồi lưu lại.',
  erpSync: 'Hệ thống ngoài đã đồng bộ lại mục này. Hãy tải nội dung mới nhất rồi lưu lại.',
  workerLease: 'Công việc khác đang xử lý mục này. Lát nữa hãy tải nội dung mới nhất rồi lưu lại.',
};
