import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-CO-15 thiết lập ngày làm việc của nhà máy (003).
 *
 * ⚠ **화면 이름은 사이드바와 글자가 같아야 한다** — `apps/web/src/app/nav-tree.ts` 의 `labelVi`.
 */
export const plantWorkingDays: Translated<typeof ko.plantWorkingDays> = {
  description:
    'Ngày xuất kho được xác định là ngày làm việc ngay trước ngày sản xuất, theo các ngày làm việc trong tuần của từng nhà máy. Không loại trừ riêng ngày lễ. Nhà máy chưa thiết lập áp dụng chuẩn làm việc 5 ngày/tuần.',
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
    changed: 'Đã sửa',
  },
  actions: {
    revert: 'Hủy thay đổi',
    save: 'Lưu',
    reload: 'Tải lại',
  },
  state: {
    saved: 'Đã lưu. Áp dụng cho các yêu cầu xuất tạo từ nay',
    conflict: 'Người khác đã lưu trước. Hãy tải lại rồi sửa.',
    noPlants: 'Không có nhà máy để thiết lập.',
  },
  discard: {
    title: 'Thay đổi chưa lưu',
    body: 'Nếu rời đi mà không lưu, các thay đổi sẽ bị mất.',
    keep: 'Tiếp tục chỉnh sửa',
    confirm: 'Rời đi không lưu',
  },
  daysFilter: {
    group: 'Ngày làm việc trong tuần',
    five: '5 ngày/tuần',
    six: '6 ngày/tuần',
  },
  workspace: {
    filter: 'Điều kiện tra cứu',
    list: 'Danh sách nhà máy',
    search: 'Tìm tên nhà máy',
    searchPlaceholder: 'Nhập tên nhà máy',
    apply: 'Tra cứu',
    clear: 'Đặt lại',
    empty: 'Không có nhà máy phù hợp với điều kiện.',
  },
};
