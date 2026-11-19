import type { ko } from '../ko';

import type { Translated } from './translated';

/** P-04-05 Cấu thành đơn vị giao hàng. Thuật ngữ theo GLOSSARY.md. */
export const shippingUnit: Translated<typeof ko.shippingUnit> = {
  title: 'Cấu thành đơn vị giao hàng',

  header: {
    online: 'Trực tuyến',
    offline: 'Ngoại tuyến',
  },

  tabs: {
    label: 'Danh sách xuất hàng',
    wait: 'Chờ cấu thành',
    done: 'Đã cấu thành',
  },

  entry: {
    label: 'Lô xuất hàng',
    loading: 'Đang tải lô xuất hàng…',
    failed: 'Không tải được danh sách lô xuất hàng.',
    empty: 'Không có lô xuất hàng cần cấu thành',
    boxes: (count: number): string => `${String(count)} kiện chưa cấu thành`,
    pick: 'Hãy chọn lô xuất hàng',
    pickHint: 'Chạm vào lô xuất hàng ở danh sách 「Chờ cấu thành」 bên trái.',
  },

  closed: {
    loading: 'Đang tải đơn vị đã chốt…',
    failed: 'Không tải được đơn vị đã chốt.',
    empty: 'Không có đơn vị giao hàng đã chốt',
    chip: 'Đã chốt',
    shipment: 'Xuất hàng',
    boxes: (count: number): string => `${String(count)} kiện`,
    closedAt: 'Chốt',
    pick: 'Hãy chọn đơn vị giao hàng',
    pickHint: 'Chạm vào đơn vị ở danh sách 「Đã cấu thành」 bên trái để xem kết quả chốt.',
  },

  steps: {
    label: 'Các bước đơn vị giao hàng',
    compose: 'Loại · đăng ký kiện',
    boxes: 'Đăng ký kiện',
    close: 'Chốt · phát hành nhãn giao hàng',
  },

  band: {
    shipment: 'Xuất hàng',
    type: 'Loại',
    unit: 'Đơn vị giao hàng',
    unassigned: 'Kiện chưa cấu thành',
    closedAt: 'Giờ chốt',
    count: (count: number): string => `${String(count)} kiện`,
  },

  unit: {
    typeLabel: 'Loại',
    failed: 'Không tạo được đơn vị giao hàng.',
  },

  scan: {
    label: 'Quét nhãn kiện',
    placeholder: 'Hãy quét hoặc nhập số kiện',
  },

  rejection: {
    unitClosed: 'Đơn vị đã chốt. Hãy tạo đơn vị giao hàng mới.',
    notPacked: 'Kiện này chưa đóng gói xong.',
    noAllocation: 'Kiện này không có thực tích đóng gói.',
    otherShipment: 'Kiện của lô xuất hàng khác.',
    alreadyAssigned: 'Kiện đã nằm trong đơn vị giao hàng khác.',
    shipmentCancelled: 'Lô xuất hàng đã hủy.',
    notFound: 'Không có kiện này.',
    unknown: 'Không đăng ký được.',
    spoken: (message: string): string => `Không đăng ký được: ${message}`,
  },

  boxes: {
    empty: 'Không có kiện đã đăng ký',
    emptyHint: 'Hãy quét nhãn kiện.',
    remove: (no: string): string => `Bỏ ${no} ra`,
    removeFailed: 'Không bỏ kiện ra được.',
    content: (itemCode: string, lotNo: string, qty: string): string =>
      `${itemCode} ${qty} · ${lotNo}`,
    sum: (count: number): string => `${String(count)} kiện · Tổng`,
  },

  preview: {
    sectionLabel: 'Xem trước nhãn giao hàng',
    empty: 'Hãy đăng ký kiện trước',
  },

  close: {
    action: 'In nhãn giao hàng sau khi chốt',
    closing: 'Đang chốt…',
    failed: 'Không chốt được.',
    done: 'Đã phát hành 1 nhãn giao hàng. Hãy dán lên đơn vị giao hàng.',
    issued: (seq: number): string => `Đã phát hành 1 nhãn giao hàng · lần ${String(seq)}`,
    printed: 'In thành công',
    printFailed: (reason: string): string => `In thất bại — ${reason}`,
    noPrinter: 'Không có máy in nên chưa in được. Bản ghi phát hành vẫn còn.',
    noBridge: 'Ở đây không gửi ra máy in được. Bản ghi phát hành vẫn còn.',
    reissueHint: 'Nếu nhãn chưa ra, hãy vào màn hình in lại, chọn lý do rồi in lại.',
  },

  actions: {
    prev: 'Trước',
    next: 'Tiếp',
  },

  next: 'Đơn vị mới',
};
