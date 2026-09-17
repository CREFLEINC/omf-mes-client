import type { ko } from '../ko';

import type { Translated } from './translated';

/** P-04-05 Cấu thành đơn vị giao hàng. Thuật ngữ theo GLOSSARY.md. */
export const shippingUnit: Translated<typeof ko.shippingUnit> = {
  title: 'Cấu thành đơn vị giao hàng',

  header: {
    online: 'Trực tuyến',
    offline: 'Ngoại tuyến',
  },

  entry: {
    label: 'Lô xuất hàng',
    placeholder: 'Hãy chọn lô xuất hàng',
    loading: 'Đang tải lô xuất hàng…',
    failed: 'Không tải được danh sách lô xuất hàng.',
    boxes: (count: number): string => `${String(count)} kiện chưa cấu thành`,
  },

  unit: {
    label: 'Đơn vị giao hàng',
    typeLabel: 'Loại',
    typePlaceholder: 'Hãy chọn loại',
    create: 'Đơn vị mới',
    creating: 'Đang tạo…',
    failed: 'Không tạo được đơn vị giao hàng.',
  },

  scan: {
    label: 'Nhãn kiện',
    placeholder: 'Hãy quét hoặc nhập số kiện',
    locked: 'Hãy tạo đơn vị giao hàng trước',
    scanning: 'Đang đăng ký…',
    added: (no: string): string => `Đã đăng ký ${no}.`,
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
    sectionLabel: 'Kiện đã đăng ký',
    empty: 'Không có kiện đã đăng ký',
    columnSeq: '#',
    columnNo: 'Số kiện',
    columnContents: 'Nội dung',
    columnAction: '',
    remove: 'Bỏ ra',
    removing: 'Đang bỏ ra…',
    removeFailed: 'Không bỏ kiện ra được.',
    content: (itemCode: string, lotNo: string, qty: string): string =>
      `${itemCode} · ${lotNo} · ${qty}`,
  },

  preview: {
    sectionLabel: 'Xem trước nhãn giao hàng',
    empty: 'Hãy đăng ký kiện trước',
  },

  close: {
    action: 'In nhãn giao hàng sau khi chốt',
    closing: 'Đang chốt…',
    failed: 'Không chốt được.',
    issued: (seq: number): string => `Đã phát hành 1 nhãn giao hàng · lần ${String(seq)}`,
    printed: 'In thành công',
    printFailed: (reason: string): string => `In thất bại — ${reason}`,
    noPrinter: 'Không có máy in nên chưa in được. Bản ghi phát hành vẫn còn.',
    noBridge: 'Ở đây không gửi ra máy in được. Bản ghi phát hành vẫn còn.',
    reissueHint: 'Nếu nhãn chưa ra, hãy vào màn hình in lại, chọn lý do rồi in lại.',
  },

  next: 'Đơn vị mới',
};
