import type { ko } from '../ko';
import type { Translated } from './translated';

export const emergencyWorkOrderField: Translated<typeof ko.emergencyWorkOrderField> = {
  title: 'Lệnh sản xuất khẩn',

  list: {
    title: 'Danh sách lệnh sản xuất khẩn',
    select: 'Chọn',
    deselect: 'Bỏ chọn',
    item: 'Mặt hàng',
    releasedAt: 'Phát hành',

    empty: 'Không có lệnh sản xuất khẩn.',
    emptyHint: 'Lệnh sản xuất khẩn được phát hành tại 「Phát hành lệnh khẩn」 trên Web quản trị.',
    loadError: 'Không nhận được danh sách lệnh sản xuất khẩn. Hãy tải lại trang.',

    pageNav: 'Chuyển trang danh sách lệnh sản xuất khẩn',
  },

  detail: {
    title: 'Chi tiết lệnh sản xuất',
    notSelected: 'Hãy chọn lệnh sản xuất khẩn ở danh sách bên trái.',
    workOrder: 'Lệnh sản xuất',
    item: 'Mặt hàng',
    orderQty: 'Số lượng',
    releasedAt: 'Phát hành',

    unknown: 'Đang kiểm tra',

    bypassTitle: 'Chưa phân bổ · Bỏ qua kiểm soát kiểm tra định kỳ',
    bypassTitleAssigned: 'Bỏ qua kiểm soát kiểm tra định kỳ',
    bypassBody: 'Lệnh sản xuất khẩn tiến hành không cần phân bổ và kiểm tra định kỳ trước khi làm.',
  },

  handoff: {
    materialInput: 'Đưa vật tư vào',
    productionResult: 'Nhập kết quả',
  },
};
