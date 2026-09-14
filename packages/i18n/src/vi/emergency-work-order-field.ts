import type { ko } from '../ko';
import { common } from './common';
import type { Translated } from './translated';

/** P-02-12 긴급 W/O 현장 투입·실적. */
export const emergencyWorkOrderField: Translated<typeof ko.emergencyWorkOrderField> = {
  title: 'W/O khẩn',

  header: {
    terminalUnknown: 'Máy trạm —',
    terminalLabel: (terminalNo: string): string => `Máy trạm ${terminalNo}`,
    connected: common.connection.online,
    disconnected: common.connection.offline,
  },

  list: {
    title: 'Danh sách W/O khẩn',
    caption: 'Lệnh sản xuất khẩn có thể tiến hành',
    columns: {
      workOrder: 'Lệnh sản xuất',
      item: 'Mặt hàng',
      quantity: 'Số lượng',
      releasedAt: 'Phát hành',
    },
    emergencyBadge: 'Khẩn',
    select: 'Chọn',
    deselect: 'Bỏ chọn',

    empty:
      'Không có W/O khẩn. W/O khẩn được phát hành tại 「Phát hành W/O khẩn」 trên Web quản trị.',
    loadError: 'Không nhận được danh sách W/O khẩn. Hãy tải lại trang.',

    truncated: (shown: number, total: number): string =>
      `Đang hiện ${String(shown)} trên ${String(total)} mục.`,

    pageNav: 'Chuyển trang danh sách W/O khẩn',
    issuedElsewhere: 'W/O khẩn được phát hành tại 「Phát hành W/O khẩn」 trên Web quản trị.',
  },

  detail: {
    title: 'Chi tiết W/O',
    notSelected: 'Hãy chọn W/O khẩn ở danh sách bên trái.',
    item: 'Mặt hàng',
    orderQty: 'Số lượng',
    releasedAt: 'Phát hành',

    unknown: 'Đang kiểm tra',

    bypassTitle: 'Chưa phân bổ · Bỏ qua kiểm soát kiểm tra định kỳ',
    bypassTitleAssigned: 'Bỏ qua kiểm soát kiểm tra định kỳ',
    bypassBody: 'W/O khẩn tiến hành không cần phân bổ và kiểm tra định kỳ trước khi làm.',
  },

  handoff: {
    materialInput: 'Đưa vật tư vào',
    productionResult: 'Nhập kết quả',
  },
};
