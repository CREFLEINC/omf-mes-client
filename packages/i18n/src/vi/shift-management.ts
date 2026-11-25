import type { ko } from '../ko';
import type { Translated } from './translated';

export const shiftManagement: Translated<typeof ko.shiftManagement> = {
  intro:
    'Thiết lập giờ bắt đầu và giờ kết thúc của ca ngày và ca đêm cho từng nhà máy. Nếu giờ kết thúc sớm hơn giờ bắt đầu, ca sẽ được lưu là kết thúc vào ngày hôm sau.\nVD: 20:00~08:00 → bắt đầu 20:00 trong ngày, kết thúc 08:00 ngày hôm sau',
  filters: {
    label: 'Điều kiện',
    plant: 'Nhà máy',
  },
  chips: {
    label: 'Trạng thái sử dụng',
    active: 'Đang dùng',
    inactive: 'Ngừng dùng',
    filterOn: (label: string): string => `Chỉ xem ${label}`,
    filterOff: (label: string): string => `Bỏ lọc ${label}`,
  },
  noPlant: 'Không có nhà máy nào có thể xem.',
  add: 'Thêm ca',
  tableLabel: 'Danh sách ca',
  empty: 'Chưa có ca nào. Hãy bấm [Thêm ca] để đăng ký ca ngày và ca đêm.',
  columns: {
    code: 'Mã ca',
    name: 'Tên ca',
    start: 'Giờ bắt đầu',
    end: 'Giờ kết thúc',
    status: 'Trạng thái sử dụng',
    actions: 'Quản lý',
  },
  values: {
    nextDayEnd: (time: string) => `${time} ngày hôm sau`,
  },
  edit: 'Sửa',
  editRow: (name: string) => `Sửa ca ${name}`,
  deactivate: 'Ngừng sử dụng',
  deactivateRow: (name: string) => `Ngừng sử dụng ca ${name}`,
  dialog: {
    addTitle: 'Thêm ca',
    editTitle: 'Sửa ca',
    plant: 'Nhà máy',
    code: 'Mã ca',
    codePlaceholder: 'VD: S01',
    codeAuto: 'Số tiếp theo được điền tự động. Có thể thay đổi nếu cần.',
    codeLocked: (count: number) =>
      `Ca đã được dùng ở ${count} công việc hoặc kết quả nên không thể đổi mã.`,
    name: 'Tên ca',
    namePlaceholder: 'VD: Ca ngày, Ca đêm',
    start: 'Giờ bắt đầu',
    end: 'Giờ kết thúc',
    startHour: 'Giờ bắt đầu (giờ)',
    startMinute: 'Giờ bắt đầu (phút)',
    endHour: 'Giờ kết thúc (giờ)',
    endMinute: 'Giờ kết thúc (phút)',
    hourHead: 'Giờ',
    minuteHead: 'Phút',
    timePlaceholder: 'Chọn giờ',
    nextDayNote:
      'Giờ kết thúc sớm hơn hoặc bằng giờ bắt đầu nên ca sẽ được lưu là kết thúc vào ngày hôm sau.',
    cancel: 'Hủy',
    save: 'Lưu',
    loading: 'Đang tải thông tin ca.',
  },
  deactivateDialog: {
    title: 'Ngừng sử dụng ca',
    body: (name: string) =>
      `Ngừng sử dụng ca ${name}. Công việc và kết quả đã ghi vẫn giữ nguyên, từ nay ca này không còn trong danh sách chọn ca và việc xác định ca theo giờ làm.`,
    cancel: 'Hủy',
    confirm: 'Ngừng sử dụng',
  },
  toast: {
    saved: 'Đã lưu.',
    deactivated: 'Đã ngừng sử dụng.',
  },
};
