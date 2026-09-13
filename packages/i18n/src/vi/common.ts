import type { ko } from '../ko';
import type { Translated } from './translated';

/** 화면 여럿이 함께 쓰는 말. 여기가 갈리면 화면마다 같은 뜻이 다른 모양으로 나간다. */
export const common: Translated<typeof ko.common> = {
  required: (label: string) => `${label} (bắt buộc)`,
  save: 'Lưu',
  cancel: 'Hủy',
  add: 'Thêm',
  search: 'Tìm',
  reset: 'Đặt lại',
  confirm: 'Xác nhận',
  close: 'Đóng',
  deactivate: 'Ngừng sử dụng',
  saved: 'Đã lưu',
  created: 'Đã đăng ký',
  retry: 'Thử lại',
  includeInactive: 'Gồm cả mục ngừng dùng',
  discardChangesConfirm: 'Nội dung đã nhập chưa được lưu. Bỏ thay đổi?',
  shell: {
    brand: 'OMF-MES Di động',
    main: 'Nội dung chính',
    skipToMain: 'Bỏ qua, đến nội dung chính',
    notifications: 'Thông báo',
  },
  connection: {
    online: 'Trực tuyến',
    offline: 'Ngoại tuyến',
    unsent: (count: number) => `Chờ gửi ${String(count)}`,
    returned: (count: number) => `Gửi thất bại ${String(count)}`,
    stalledTitle: 'Bản ghi đã gửi vẫn chưa được đăng ký',
    stalledBody: 'Bản ghi đang chờ gửi vẫn còn nguyên. Lát nữa hãy bấm gửi lại.',
    stalledRetry: 'Gửi lại',
  },
  reference: {
    empty: '—',
    unknown: 'Không rõ',
    loading: 'Đang tải tên',
    failed: 'Không tải được tên',
    inactiveSuffix: ' (ngừng dùng)',
  },
  selectDate: 'Chọn ngày',
  popWorker: {
    label: 'Mã nhân viên',
    unknown: 'Chưa xác nhận mã nhân viên',
  },

  rescan: {
    title: 'Đã quét lại',
    body: (before: string, after: string) =>
      `Đối tượng hiện tại là ${before}. Đổi sang ${after} vừa đọc chứ?`,
    keep: 'Giữ nguyên',
    replace: 'Dùng giá trị vừa đọc',
  },
};
