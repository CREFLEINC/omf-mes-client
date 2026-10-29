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
  screens: {
    inboundReceipt: 'Ghi nhận hàng NCC đến · Bắt đầu bằng quét nhãn',
    materialLotScan: 'Đăng ký sau LOT chưa quét khi hàng đến',
    inboundVariance: 'Ghi nhận nhập hàng khác dự kiến · Không sửa sau khi đăng ký',
    recycleEntry: 'Đăng ký vật liệu tái chế thành lô vật tư',
    iqcSkipRequest: 'Chỉ gửi yêu cầu · Phê duyệt trên web quản trị',
    putaway: 'Đưa vật tư đã nhập vào vị trí cất và hoàn tất nhập kho',
    temporaryPutaway: 'Để tạm ở vị trí tạm khi chưa cất được vào vị trí',
    stockTransfer: 'Chuyển tồn kho giữa các vị trí · Quét khi đến sau khi xuất',
    materialPicking: 'Lấy vật tư theo chỉ thị xuất',
    physicalCount: 'Đếm và ghi nhận hàng thực tế tại vị trí',
    materialLocation: 'Tra cứu LOT · mặt hàng đang ở vị trí nào',
    shopfloorReceipt: 'Nhận vật tư vào kho sản xuất',
    wipHandover: 'Bàn giao bán thành phẩm giữa các công đoạn',
    repairRoundtrip: 'Quét hàng gửi sửa và hàng sửa xong trở về',
    equipmentInspection: 'Ghi nhận hạng mục kiểm tra thiết bị',
    equipmentFailure: 'Báo cáo hiện tượng hỏng và ảnh',
    productReceipt: 'Nhập kho · cất thành phẩm',
    productPicking: 'Lấy thành phẩm theo chỉ thị xuất hàng',
    packingRepack: 'Tách hoặc gộp kiện đóng gói',
  },
  frequent: 'Công việc hay dùng',
  switchWorker: 'Đổi người dùng',
  settings: {
    label: 'Cài đặt',
    device: 'Thiết bị',
  },
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
  workCount: {
    left: 'Việc còn lại',
    label: (name: string, count: number) => `${name}, còn ${String(count)} việc`,
    basisWarehouse: (warehouseName: string) => `Máy này: theo ${warehouseName}`,
    basisPlant: 'Máy này: theo toàn nhà máy',
  },
};
