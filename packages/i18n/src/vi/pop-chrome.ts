import type { ko } from '../ko';
import type { Translated } from './translated';

/** POP 화면 위에 늘 서 있는 공통 조작 문구 — 모든 POP 화면이 함께 쓴다. */
export const popChrome: Translated<typeof ko.popChrome> = {
  screenNav: 'Chuyển màn hình',
  userSwitch: 'Đổi người dùng',
  workerMissing: 'Chưa xác nhận mã nhân viên. Hãy xác thực mã nhân viên trước.',
  select: 'Chọn',

  selectDialog: {
    fallbackName: 'mục',
    title: (name: string): string => `Chọn ${name}`,
    searchLabel: 'Tìm trong danh sách',
    searchPlaceholder: 'Tìm trong danh sách',
    scanLabel: 'Quét hoặc tìm trong danh sách',
    scanPlaceholder: 'Quét hoặc tìm trong danh sách',
    clearSearch: 'Xóa',
    empty: 'Không có mục nào để hiển thị.',
    position: (page: number, totalPages: number, count: number): string =>
      `${String(page)} / ${String(totalPages)} · Tổng ${String(count)} mục`,
  },

  console: {
    areas: {
      production: 'Sản xuất',
      material: 'Mua hàng · Vật tư',
      quality: 'Chất lượng',
      shipping: 'Xuất hàng',
      equipment: 'Thiết bị',
    },
    nav: {
      label: 'Điều hướng màn hình',
      home: 'Trang chủ',
      back: 'Quay lại',
      location: 'Vị trí hiện tại',
    },
    home: {
      title: 'Trang chủ',
      recent: 'Màn hình gần đây',
      recentWithWorkOrder: (name: string, workOrderId: number): string =>
        `${name} · W/O #${String(workOrderId)}`,
      screens: 'Màn hình công việc',
    },
    statusBar: {
      equipmentNone: 'Chưa gán thiết bị',
      workOrderNone: 'Chưa chọn lệnh SX',
      workOrder: (workOrderNo: string): string => `Lệnh SX ${workOrderNo}`,
      workerUnknown: 'Chưa xác nhận mã NV',
      worker: (workerNo: string): string => `Mã NV ${workerNo}`,
      online: 'Đã kết nối',
      offline: 'Mất kết nối',
      synced: 'Đã gửi hết',
      unsynced: (count: number): string => `Chờ gửi ${String(count)}`,
      menu: 'Menu công việc',
    },
    session: {
      running: 'Đang chạy',
      stopped: 'Tạm dừng',
      none: 'Không có phiên',
      unknown: 'Đang kiểm tra',
    },
    currentWork: {
      title: 'Công việc hiện tại',
      empty: 'Chọn lệnh SX để xem mục tiêu, hàng đạt và hàng lỗi tại đây.',
      loading: 'Đang tải lệnh SX…',
      failed: 'Không kiểm tra được lệnh SX.',
      item: 'Mã hàng',
      operation: 'Công đoạn',
      target: 'Mục tiêu',
      good: 'Đạt',
      defect: 'Lỗi',
      rate: (rate: string): string => `Tỷ lệ đạt ${rate}%`,
      progressUnknown: 'Không nhận được số lũy kế.',
      sessionStarted: (time: string): string => `Bắt đầu ${time}`,
    },
    steps: {
      label: 'Các bước công việc',
      needWorkOrder: 'Hãy chọn lệnh SX trước',
    },
    actions: {
      label: 'Báo bất thường',
      next: (step: string): string => `Tiếp: ${step}`,
    },
    menu: {
      title: 'Menu công việc',
      close: 'Đóng',
      loading: 'Đang kiểm tra các màn hình có thể chuyển…',
      unknown: 'Không kiểm tra được các màn hình có thể chuyển',
      empty: 'Không có màn hình nào để chuyển',
    },
    feedback: {
      acknowledge: 'Xác nhận',
      region: 'Thông báo',
      blockedTitle: 'Cần kiểm tra',
    },
  },
};
