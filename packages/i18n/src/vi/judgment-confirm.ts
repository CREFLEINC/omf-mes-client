import type { ko } from '../ko';
import type { Translated } from './translated';

export const judgmentConfirm: Translated<typeof ko.judgmentConfirm> = {
  title: 'Xác nhận đánh giá?',
  target: (inspectionRequestNo: string): string => `Số yêu cầu kiểm tra: ${inspectionRequestNo}`,
  judgmentHeading: 'Đánh giá cuối cùng',
  resultRow: 'Kết quả kiểm tra',
  accepted: 'Đạt',
  rejected: 'Không đạt',
  held: 'Tạm giữ',
  lotRow: 'Trạng thái LOT',
  lotState: {
    release: 'Bình thường',
    hold: 'Lỗi',
    pending: 'Chờ kiểm tra',
    unknown: 'Thay đổi',
  },
  pickedLotState: {
    release: 'Có thể xuất hàng',
    hold: 'Lỗi',
    pending: 'Không đổi',
    unknown: 'Thay đổi',
  },
  applyHeading: 'Áp dụng khi xác nhận',
  irreversible:
    'Sau khi xác nhận không thể sửa hoặc hủy đánh giá. Nếu cần thay đổi, hãy kiểm tra lại.',
  back: 'Hủy',
  confirm: 'Xác nhận đánh giá',
};
