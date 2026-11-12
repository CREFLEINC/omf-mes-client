import type { ko } from '../ko';
import type { Translated } from './translated';

export const inboundWorkRecord: Translated<typeof ko.inboundWorkRecord> = {
  title: 'Nhật ký công việc nhập hàng / nhập kho',
  noPlant: 'Không có nhà máy đang dùng.',
  filters: {
    label: 'Điều kiện tra cứu',
    plant: 'Nhà máy',
    period: 'Ngày nhập hàng',
    supplier: 'Nhà cung cấp',
    supplierAll: 'Tất cả',
    query: 'Mặt hàng · LOT nhập hàng',
    queryPlaceholder: 'Mã · tên mặt hàng, số IL',
  },
  views: {
    label: 'Chế độ xem',
    ready: 'Chờ duyệt chốt',
    prog: 'Đang xử lý',
    final: 'Chốt cuối cùng',
    readyHint:
      'Đã nhập hàng xong và mọi LOT quản lý vật tư đã kết thúc (đã nhập kho hoặc đã xử lý trả hàng · hủy). Kiểm tra ghép P/O rồi chốt cuối cùng.',
    progHint:
      'LOT nhập hàng đang nhập hàng, hoặc còn IQC · nhập kho · xử lý. Không thể chốt cuối cùng.',
    finalHint:
      'LOT nhập hàng đã chốt cuối cùng. Không thể hủy nhập kho · hủy chốt nhập hàng · sửa ghép P/O.',
  },
  list: {
    label: 'Danh sách LOT nhập hàng',
    columns: {
      inboundLot: 'LOT nhập hàng',
      supplier: 'Nhà cung cấp',
      item: 'Mặt hàng',
      receivingDate: 'Ngày nhập hàng',
      lotCount: 'LOT quản lý vật tư',
      receivedQty: 'SL nhập hàng',
      goodsReceivedQty: 'SL nhập kho',
      match: 'Ghép P/O',
      status: 'Trạng thái',
      reason: 'Lý do chưa thể chốt cuối cùng',
      finalized: 'Chốt cuối cùng',
    },
    empty: (view: string) => `Không có LOT nhập hàng 「${view}」.`,
    open: (inboundLotNo: string) => `Mở ${inboundLotNo}`,
    autoMatchLater: 'Tự ghép khi chốt nhập hàng',
    matchLine: (line: string, qty: string) => `${line}: ${qty}`,
    excess: (qty: string) => `(vượt ${qty})`,
    unallocated: (qty: string) => `Không có P/O: ${qty}`,
    separator: ' · ',
    readyChip: 'Chờ duyệt chốt',
    autoClosed: 'Tự động chốt',
    receiving: 'Đang nhập hàng — chưa chốt',
    blockedUnknown: 'Xem lý do trong chi tiết',
  },
  blockers: {
    IQC_IN_PROGRESS: (count: number) => `Đang IQC — ${String(count)} LOT quản lý vật tư`,
    DISPOSITION_IN_PROGRESS: (count: number) => `Đang xử lý — ${String(count)} LOT quản lý vật tư`,
    NOT_RECEIVED: (count: number) => `Chưa nhập kho — ${String(count)} LOT quản lý vật tư`,
    RECEIPT_CANCEL_PENDING: (count: number) =>
      `Đang yêu cầu hủy nhập kho — ${String(count)} LOT quản lý vật tư`,
  },
  detail: {
    label: 'Chi tiết LOT nhập hàng',
    close: 'Đóng',
    status: {
      ready: 'Chờ duyệt chốt',
      prog: 'Đang xử lý',
      final: 'Chốt cuối cùng',
    },
    supplier: 'Nhà cung cấp',
    item: 'Mặt hàng',
    receivingDate: 'Ngày nhập hàng',
    receiptClosed: 'Chốt nhập hàng',
    notClosed: 'Chưa chốt',
    autoClosedSuffix: ' (tự động khi sang ngày)',
    receivedQty: 'SL nhập hàng',
    goodsReceivedQty: 'SL nhập kho',
    receivedValue: (qty: string, uom: string, count: number) =>
      `${qty} ${uom} · ${String(count)} LOT quản lý vật tư`,
    blocked: (reason: string) => `Không thể chốt cuối cùng — ${reason}.`,
    blockedHelp: 'Mọi LOT quản lý vật tư phải đã nhập kho hoặc đã xử lý trả hàng · hủy xong.',
    finalized: (at: string, by: string) =>
      `Chốt cuối cùng ${at} · ${by}. Không thể hủy nhập kho · hủy chốt nhập hàng · sửa ghép P/O.`,
    finalizedNoName: (at: string) =>
      `Chốt cuối cùng ${at}. Không thể hủy nhập kho · hủy chốt nhập hàng · sửa ghép P/O.`,
    matchTitle: 'Ghép P/O',
    matchRule:
      'Tự động khi chốt: P/O có ngày đặt cũ trước, phần còn lại → dung sai, còn dư thì Không có P/O',
    noMatchYet:
      'Đang nhập hàng nên chưa có ghép P/O. Sẽ tự ghép khi chốt nhập hàng (thủ công · tự động).',
    editMatch: 'Sửa ghép P/O',
    matchLabel: 'Bảng ghép P/O',
    matchColumns: {
      line: 'Dòng P/O',
      orderDate: 'Ngày đặt',
      ordered: 'SL đặt',
      previous: 'Đã nhận trước',
      thisMatch: 'Ghép lần này',
      tolerance: 'Dung sai',
      remaining: 'Hạn mức còn',
    },
    lineName: (purchaseOrderNo: string, lineNo: number) => `${purchaseOrderNo} · ${String(lineNo)}`,
    unallocatedRow: 'Không có P/O',
    totalLabel: 'Tổng',
    total: (sum: string, need: string, uom: string) => `${sum} / ${need} ${uom}`,
    excessChip: (qty: string) => `vượt ${qty}`,
    openedAfterClose: 'P/O phần vượt · tạo sau khi chốt',
    lotsTitle: (count: number) => `LOT quản lý vật tư ${String(count)}`,
    lotsLabel: 'Bảng LOT quản lý vật tư',
    lotColumns: {
      lotNo: 'Số LOT quản lý vật tư',
      qty: 'Số lượng',
      status: 'Trạng thái',
    },
    lotStatus: {
      received: 'Đã nhập kho',
      returned: 'Đã xử lý trả hàng',
      disposed: 'Đã xử lý hủy',
      dispositionInProgress: 'Đang xử lý',
      iqcInProgress: 'Đang IQC',
      inspectionHold: 'Chờ kiểm tra · tạm giữ',
      waitingReceipt: 'Chờ nhập kho',
    },
    footReady:
      'Nếu đã kiểm tra ghép P/O thì chốt cuối cùng. Sau khi chốt cuối cùng sẽ thành đối tượng nhập kho mua hàng ERP (gửi ở #265).',
    finalize: 'Chốt cuối cùng',
    finalizeLockedByEdit: 'Hãy lưu hoặc hủy phần sửa ghép P/O trước',
  },
  editor: {
    help: 'Chỉ chuyển giữa các dòng P/O đang mở của cùng nhà cung cấp · mặt hàng. Mỗi dòng không được vượt 「SL đặt + dung sai − đã nhận trước」.',
    reopenNote: 'Nếu hủy chốt nhập hàng, phần ghép đã sửa sẽ mất và được tính lại khi chốt lại.',
    qtyLabel: (line: string) => `${line} ghép lần này`,
    errorsTitle: 'Không thể lưu',
    notNumber: (line: string) => `${line}: hãy nhập số từ 0 trở lên`,
    overLimit: (
      line: string,
      qty: string,
      limit: string,
      uom: string,
      ordered: string,
      tolerance: string,
      previous: string,
    ) =>
      `${line}: ${qty} — vượt hạn mức ${limit} ${uom} (đặt ${ordered} + dung sai ${tolerance} − đã nhận ${previous})`,
    overTotal: (sum: string, need: string, uom: string, diff: string) =>
      `Tổng ghép ${sum} ${uom} vượt SL nhập hàng ${need} ${uom} (+${diff})`,
    cancel: 'Hủy',
    save: 'Lưu ghép P/O',
    saveLocked: 'Phải sửa lỗi mới lưu được',
    saved: (inboundLotNo: string) => `Đã sửa ghép P/O của ${inboundLotNo}`,
    saveFailed: 'Không lưu được ghép P/O.',
    finalizedLocked: 'LOT nhập hàng đã chốt cuối cùng — không thể sửa ghép P/O',
  },
  finalizeDialog: {
    title: 'Chốt cuối cùng?',
    summary: (received: string, goods: string, uom: string) =>
      `Nhập hàng ${received} · nhập kho ${goods} ${uom}`,
    matchLabel: 'Ghép P/O: ',
    unallocatedWarning: (qty: string, uom: string) =>
      `Còn ${qty} ${uom} Không có P/O. Số lượng đó sẽ không được gửi sang ERP.`,
    acknowledge: 'Đã xác nhận',
    acknowledgeNeeded: 'Phải xác nhận số lượng Không có P/O mới chốt cuối cùng được.',
    warning:
      'Sau khi chốt cuối cùng không thể hủy nhập kho · hủy chốt nhập hàng · sửa ghép P/O. Sau khi chốt cuối cùng sẽ thành đối tượng nhập kho mua hàng ERP (gửi ở #265).',
    cancel: 'Hủy',
    confirm: 'Chốt cuối cùng',
    done: (inboundLotNo: string) =>
      `${inboundLotNo} đã chốt cuối cùng — thành đối tượng nhập kho mua hàng ERP (gửi ở #265)`,
    blocked: (reason: string) => `Không thể chốt cuối cùng — ${reason}`,
    failed: 'Không chốt cuối cùng được.',
  },
  errors: {
    conflict: 'Người khác đã thay đổi trước',
    reload: 'Tải lại',
    stateLocked:
      'LOT nhập hàng đã quay về đang nhập hàng — khi chốt lại, ghép P/O sẽ được tính lại',
  },
};
