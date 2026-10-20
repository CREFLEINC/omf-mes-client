import type { ko } from '../ko';
import type { Translated } from './translated';

/** 작업 목록의 묶음 이름. 현장은 무슨 일을 하러 왔나로 찾는다. */
export const shellHome: Translated<typeof ko.shellHome> = {
  label: 'Danh sách màn hình',
  areas: {
    label: 'Nghiệp vụ',
    inbound: { label: 'Nhập', summary: 'Nhập hàng · LOT vật tư · Sai lệch nhập hàng' },
    warehouse: { label: 'Kho', summary: 'Cất hàng · Chuyển kho · Xuất vật tư · Kiểm kê' },
    shopfloor: {
      label: 'Hiện trường sản xuất',
      summary: 'Nhập kho sản xuất · Chuyển công đoạn · Thiết bị',
    },
    shipping: { label: 'Xuất thành phẩm', summary: 'Nhập thành phẩm · Lấy hàng · Đóng gói' },
    count: (count: number) => `${String(count)} công việc`,
    open: (label: string) => `Xem công việc ${label}`,
  },
  frequent: 'Công việc hay dùng',
  resume: {
    label: 'Làm tiếp',
    open: (title: string) => `Làm tiếp ${title}`,
  },
  status: {
    label: 'Tình trạng gửi',
    pending: 'Chờ gửi',
    rejected: 'Gửi thất bại',
    count: (count: number) => `${String(count)} bản ghi`,
  },
};
