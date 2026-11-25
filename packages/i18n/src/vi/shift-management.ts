import type { ko } from '../ko';
import type { Translated } from './translated';

export const shiftManagement: Translated<typeof ko.shiftManagement> = {
  title: 'Quản lý ca làm việc',
  breadcrumbRoot: 'Quản lý dữ liệu gốc',
  intro:
    'Đăng ký giờ ca ngày · ca đêm cho từng nhà máy. Nếu giờ kết thúc sớm hơn giờ bắt đầu, ca sẽ được lưu là ca đêm kết thúc vào ngày hôm sau.',
  filters: {
    label: 'Điều kiện',
    plant: 'Nhà máy',
  },
  noPlant: 'Không có nhà máy nào có thể xem.',
  count: (count: number) => `${count} ca`,
  plantNote: (plantName: string) => `Nhà máy: ${plantName}`,
  add: 'Thêm',
  tableLabel: 'Danh sách ca',
  empty: 'Chưa có ca nào. Hãy bấm [Thêm] để đăng ký ca ngày · ca đêm.',
  columns: {
    code: 'Mã ca',
    name: 'Tên ca',
    start: 'Giờ bắt đầu',
    end: 'Giờ kết thúc',
    crossesMidnight: 'Ngày kết thúc',
    actions: 'Quản lý',
  },
  values: {
    sameDay: 'Cùng ngày',
    nextDay: 'Ngày hôm sau',
  },
  edit: 'Sửa',
  editRow: (name: string) => `Sửa ca ${name}`,
  dialog: {
    addTitle: 'Thêm ca',
    editTitle: 'Sửa ca',
    plant: 'Nhà máy',
    code: 'Mã ca',
    codePlaceholder: 'VD: D, N',
    codeLocked: (count: number) =>
      `Ca đã được dùng ở ${count} công việc · kết quả nên không thể đổi mã.`,
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
    required: 'Hãy nhập.',
    cancel: 'Hủy',
    save: 'Lưu',
    deactivate: 'Ngừng sử dụng',
    loading: 'Đang tải thông tin ca.',
  },
  deactivateDialog: {
    title: 'Ngừng sử dụng ca',
    body: (name: string) =>
      `Ngừng sử dụng ca ${name}. Công việc · kết quả đã ghi vẫn giữ nguyên, từ nay ca này không còn trong danh sách chọn ca và việc xác định ca theo giờ làm.`,
    cancel: 'Hủy',
    confirm: 'Ngừng sử dụng',
  },
  toast: {
    saved: 'Đã lưu.',
    deactivated: 'Đã ngừng sử dụng.',
  },
};
