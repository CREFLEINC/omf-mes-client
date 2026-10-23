import type { ko } from '../ko';
import { named } from '../named';
import type { Translated } from './translated';
import { common } from './common';

/** POP 화면 위에 늘 서 있는 공통 조작 문구 — 모든 POP 화면이 함께 쓴다. */
export const popChrome: Translated<typeof ko.popChrome> = {
  screenNav: 'Chuyển màn hình',
  userSwitch: 'Đổi người dùng',
  header: {
    terminalUnknown: 'Chưa xác nhận máy trạm',
    terminalLabel: (code: string): string => `Máy trạm ${code}`,
    /** 머리줄은 1024 폭에 고정 항목이 다 들어가게 설비 이름만 보인다. 코드는 툴팁(`equipmentTitle`). */
    equipmentLabel: (code: string, name: string): string =>
      `Thiết bị ${name.trim() === '' ? code : name}`,
    equipmentTitle: (code: string, name: string): string => `Thiết bị ${named(name, code)}`,
    workerUnset: 'Chưa nhập mã nhân viên',
    workerLabel: (workerNo: string, workerName?: string | null): string =>
      `Người làm ${named(workerName, workerNo)}`,
    workOrderLabel: (workOrderNo: string): string => `W/O ${workOrderNo}`,
    emergency: 'Khẩn',
    connected: common.connection.online,
    disconnected: common.connection.offline,
    unsent: (count: number): string => `Chờ gửi ${String(count)} mục`,
  },
  workerMissing: 'Chưa xác nhận mã nhân viên. Hãy xác thực mã nhân viên trước.',
  processGate: {
    denied: (process: string, feature: string, menuPath: string): string =>
      `Máy này đang tắt «${feature}» của công đoạn ${process}. Hãy nhờ quản trị viên bật «${feature}» của công đoạn ${process} ở ${menuPath} trên web quản lý.`,
    checkMapping: (menuPath: string): string =>
      `Nếu vẫn vậy, hãy nhờ quản trị viên kiểm tra ở ${menuPath} trên web quản lý xem công đoạn của lệnh sản xuất này đã được ánh xạ cho máy này chưa.`,
    serverReason: (reason: string): string => `(Máy chủ trả lời: ${reason})`,
    deniedUnknownProcess: (feature: string, menuPath: string): string =>
      `Máy này đang tắt «${feature}» của công đoạn thuộc lệnh sản xuất này. Hãy nhờ quản trị viên bật «${feature}» của công đoạn đó ở ${menuPath} trên web quản lý.`,
  },
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
};
