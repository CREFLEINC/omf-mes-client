import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-CO-05 통합 대시보드. 숫자를 모아 보이기만 하는 화면이라, 문구도 「여기서 고친다」가 아니라
 * 「어디로 가면 되는가」를 말한다 - 그 성질을 옮긴 말에서도 지킨다.
 */
export const dashboard: Translated<typeof ko.dashboard> = {
  title: 'Bảng điều khiển tổng hợp',
  breadcrumbRoot: 'Chung',

  panes: {
    filters: 'Điều kiện cơ sở',
    cards: 'Chỉ số',
    trend: 'Diễn biến sản lượng theo ngày',
    alerts: 'Cảnh báo chưa xử lý',
  },

  filters: {
    baseDate: 'Ngày cơ sở',
    plant: 'Nhà máy',
    allPlants: 'Tất cả',
    refresh: 'Làm mới',
    manualOnly: 'Màn hình không tự làm mới. Hãy bấm «Làm mới» để xem số liệu mới nhất.',
    plantLookupFailed: 'Không tải được danh sách nhà máy nên hiện chưa chọn được. Hãy thử lại.',
    plantLookupTruncated:
      'Chỉ hiển thị một phần danh sách nhà máy. Không thấy nhà máy cần tìm thì hãy hỏi người phụ trách.',
  },

  asOf: {
    label: (at: string): string => `Cơ sở ${at}`,
    unknown: 'Không rõ thời điểm tổng hợp.',
    stale: (at: string): string =>
      `Cơ sở ${at} · Làm mới thất bại nên đang hiển thị số liệu trước.`,
  },

  cards: {
    notYet: 'Chưa có',
    excluded: (count: number): string => `Đã loại ${String(count)} mục`,
    statusPartial: 'Chỉ đếm một phần',
    statusNotYet: 'Không có số liệu',
    deltaUp: (text: string): string => `Tăng ${text} so với ngày cơ sở trước`,
    deltaDown: (text: string): string => `Giảm ${text} so với ngày cơ sở trước`,
    deltaFlat: 'Bằng ngày cơ sở trước',
    openHint: (label: string): string => `Đến màn hình chi tiết ${label}`,
    drilldownClosed:
      'Chưa thể đi thẳng từ thẻ sang màn hình chi tiết. Hãy mở màn hình đó từ menu bên trái.',
    empty: 'Không có chỉ số để hiển thị. Hãy đổi ngày cơ sở hoặc nhà máy.',
    emptyTitle: 'Không có chỉ số',
  },

  trend: {
    target: 'Mục tiêu',
    unitSuffix: (unit: string): string => `Đơn vị ${unit}`,
    emptyTitle: 'Không có diễn biến',
    empty: 'Kỳ này không có sản lượng để vẽ.',
    absent: 'Phản hồi này không kèm diễn biến sản lượng.',
    detail: 'Chi tiết',
  },

  alerts: {
    emptyTitle: 'Không có cảnh báo chưa xử lý',
    empty: 'Hiện không có cảnh báo nào cần xem.',
    unread: 'Chưa xem',
    read: 'Đã xem',
    locationUnknown: 'Không có thông tin vị trí',
    emptyMessage: 'Nội dung đang trống.',
    openCenter: 'Trung tâm thông báo',
  },
};
