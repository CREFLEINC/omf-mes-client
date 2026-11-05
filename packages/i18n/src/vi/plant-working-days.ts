import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-CO-15 thiết lập ngày làm việc của nhà máy (003).
 *
 * ⚠ **화면 이름은 사이드바와 글자가 같아야 한다** — `apps/web/src/app/nav-tree.ts` 의 `labelVi`.
 */
export const plantWorkingDays: Translated<typeof ko.plantWorkingDays> = {
  title: 'Thiết lập ngày làm việc nhà máy',
  breadcrumbRoot: 'Quản trị hệ thống',
  description:
    'Số ngày làm việc trong tuần của từng nhà máy, dùng để tính ngày xuất kho (1 ngày làm việc trước ngày sản xuất). Chỉ bỏ qua cuối tuần — không dùng ngày lễ và lịch làm việc.',
  intro:
    'Thiết lập đã đổi áp dụng cho các yêu cầu xuất tạo từ nay. Ngày xuất kho của yêu cầu đã tạo giữ nguyên. Nhà máy chưa thiết lập được tính theo 5 ngày/tuần.',
  tableLabel: 'Ngày làm việc theo nhà máy',
  columns: {
    plant: 'Nhà máy',
    days: 'Ngày làm việc trong tuần',
    off: 'Ngày nghỉ',
    example: (date: string, weekday: string): string =>
      `Ví dụ: ngày xuất kho của ngày sản xuất ${date} (${weekday})`,
    lastChanged: 'Thay đổi gần nhất',
  },
  options: {
    five: '5 ngày/tuần (T2–T6)',
    six: '6 ngày/tuần (T2–T7)',
  },
  groupLabel: (plant: string): string => `Ngày làm việc trong tuần của ${plant}`,
  weekdays: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
  values: {
    example: (date: string, weekday: string, skipped: string): string =>
      skipped === '' ? `${date} (${weekday})` : `${date} (${weekday}) — bỏ qua ${skipped}`,
    lastChanged: (date: string): string => `Áp dụng từ ${date}`,
    none: '—',
  },
  tags: {
    default: 'Mặc định',
    changed: 'Đã đổi',
  },
  actions: {
    revert: 'Hoàn tác',
    save: 'Lưu',
    reload: 'Tải lại',
  },
  state: {
    saved: 'Đã lưu. Áp dụng cho các yêu cầu xuất tạo từ nay',
    conflict: 'Người khác đã lưu trước. Hãy tải lại rồi sửa.',
    noPlants: 'Không có nhà máy để thiết lập.',
  },
  discard: {
    title: 'Có thay đổi chưa lưu',
    body: 'Nếu chuyển đi bây giờ, ngày làm việc đã đổi sẽ không được lưu và bị mất. Để giữ lại, nhấn «Tiếp tục chỉnh sửa» rồi lưu.',
  },
};
