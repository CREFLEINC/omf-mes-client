import type { ko } from '../ko';
import type { Translated } from './translated';

/** 작업 목록의 묶음 이름. 현장은 무슨 일을 하러 왔나로 찾는다. */
export const shellHome: Translated<typeof ko.shellHome> = {
  label: 'Danh sách màn hình',
  tiles: {
    inbound: 'Nhập hàng',
    putaway: 'Cất hàng',
    picking: 'Lấy hàng / Xuất kho',
    recycle: 'Vật tư tái chế',
    urgent: 'Yêu cầu khẩn',
    transfer: 'Chuyển kho',
    stocktaking: 'Kiểm kê',
    productionMove: 'Chuyển công đoạn / Sửa chữa',
    shipment: 'Quét xuất hàng',
    equipment: 'Thiết bị',
  },
  shell: 'Trạng thái gửi',
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
