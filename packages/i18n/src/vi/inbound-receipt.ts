import type { ko } from '../ko';
import type { Translated } from './translated';

export const inboundReceipt: Translated<typeof ko.inboundReceipt> = {
  title: 'Đăng ký nhập hàng',
  scan: {
    label: 'Nhãn LOT quản lý vật tư',
    prompt: 'Hãy quét nhãn LOT quản lý vật tư',
    results: 'Kết quả quét',
    dismiss: 'Xóa thông báo',
  },
  last: {
    ok: 'Đã đăng ký',
    undo: 'Hủy quét',
    dismiss: 'Đóng',
    undoLabel: (lotNo: string) => `Hủy quét ${lotNo}`,
    loading: 'Đang tải mặt hàng',
    autoClosed: 'Lô nhập của ngày trước đã tự động chốt',
    rejected: 'Không đăng ký',
    duplicate: 'Nhãn này đã quét rồi',
    duplicateRow: (row: number) => `Có ở No ${row}`,
    offline: 'Chờ gửi',
    offlineBody: 'Ngoại tuyến — sẽ đăng ký khi có kết nối',
    closed: 'Không đăng ký',
    closedBody: 'Lô nhập này đã chốt',
  },
  reject: {
    refused: 'Bị từ chối',
    voided: 'Nhãn đã hủy',
    alreadyReceived: 'Nhãn đã được nhập hàng',
    alreadyReceivedIn: (receiving: boolean) =>
      receiving ? 'Đang được nhập trên thiết bị khác' : 'Nhãn đã nhập hàng xong',
    notMaterialLot: 'Không phải nhãn LOT quản lý vật tư',
    alreadyQueued: 'Đã có trong hàng chờ gửi',
    failed: 'Không đăng ký được. Hãy quét lại sau ít phút.',
  },
  offline: {
    title: (count: number) => `Chờ gửi ${count}`,
    flushed: (count: number, registered: number, rejected: number) =>
      `Đã gửi ${count} mục chờ · đăng ký ${registered} · từ chối ${rejected}`,
    queueFailed: 'Không đưa được vào hàng chờ gửi. Hãy quét lại.',
  },
  tally: {
    title: (date: string) => `Nhập hàng ${date}`,
    total: (count: number) => `Scan ${count} nhãn`,
    empty: 'Chưa đăng ký LOT quản lý vật tư nào',
    columns: { no: 'No', item: 'Mặt hàng', count: 'SL', qty: 'Số lượng' },
    closed: 'Đã chốt',
    open: (itemCode: string, itemName: string) => `Xem LOT ${itemCode} ${itemName}`,
    loadFailed: 'Có mặt hàng chưa tải được',
    retry: 'Tải lại',
  },
  lots: {
    label: 'Danh sách LOT quản lý vật tư',
    title: 'Vật tư nhập',
    fields: { itemCode: 'Mã vật tư', itemName: 'Tên vật tư', supplier: 'Nhà cung cấp', received: 'Số lượng' },
    summary: (count: number, total: string) => `${count} cái ${total}`,
    columns: { no: 'No', lotNo: 'Số', qty: 'Số lượng', supplierLot: 'LOT NCC' },
    package: (uomCode: string, count: number) => ` · ${uomCode} ${String(count)}`,
    noSupplierLot: 'Không có',
    editSupplierLot: (lotNo: string) => `Sửa số LOT nhà cung cấp của ${lotNo}`,
    unregister: 'Gỡ',
  },
  close: {
    allShort: 'Chốt',
    all: (items: number, lots: number) => `Chốt nhập tất cả (${items} mặt hàng ${lots} cái)`,
    one: (lots: number) => `Chỉ chốt mặt hàng này (${lots} cái)`,
    blockedOffline: 'Ngoại tuyến — có thể làm sau khi kết nối',
    blockedPending: (count: number) => `Có thể chốt sau khi gửi ${count} mục chờ`,
  },
  unregistered: {
    toast: (lotTail: string, total: string) => `Đã hủy đăng ký — ${lotTail} · tổng ${total}`,
    lastToast: (itemName: string) => `Đã hủy đăng ký — lô nhập ${itemName} đã trống`,
  },
  closeDialog: {
    titleAll: 'Chốt nhập tất cả mặt hàng?',
    titleOne: (itemName: string) => `Chốt nhập ${itemName}?`,
    summaryAll: (items: number, lots: number) => `Chốt ${items} mặt hàng ${lots} cái.`,
    summaryOne: (count: number, total: string) => `${count} cái ${total}`,
    body: 'Sau khi chốt không thể quét thêm hay gỡ, mặt hàng cần kiểm tra sẽ có yêu cầu IQC.',
    bodyNoInspection: 'Sau khi chốt, IQC ghi là 「bỏ qua kiểm tra」 và không thể quét thêm hay gỡ.',
    bodyNoIqcRecord: 'Sau khi chốt không tạo bản ghi IQC và không thể quét thêm hay gỡ.',
    cancel: 'Quét tiếp',
    confirm: 'Chốt',
    toastOne: (itemName: string) => `Đã chốt nhập ${itemName}`,
    toastAll: (items: number) => `Đã chốt nhập ${items} mặt hàng`,
    failed: 'Không chốt được. Đã tải lại.',
  },
  sheet: {
    title: 'Số LOT nhà cung cấp',
    label: 'Số LOT nhà cung cấp (tùy chọn)',
    applyRest: (count: number) =>
      `Áp dụng cùng số cho ${count} LOT quản lý vật tư còn lại của mặt hàng này`,
    applyRestNote: (count: number) => `${count} LOT đang có số khác cũng sẽ bị đổi`,
    cancel: 'Hủy',
    save: 'Lưu',
    tooLong: 'Số LOT nhà cung cấp tối đa 100 ký tự',
    saved: (no: string, count: number) =>
      `Đã lưu LOT nhà cung cấp ${no} — ${count} LOT quản lý vật tư`,
    cleared: (lotTail: string, rest: number) =>
      rest === 0
        ? `Đã xóa số LOT nhà cung cấp — ${lotTail}`
        : `Đã xóa số LOT nhà cung cấp — ${lotTail} và ${rest} LOT khác`,
    failed: 'Không lưu được.',
  },
  itemPicker: {
    title: 'Chọn mặt hàng',
    searchLabel: 'Tìm mặt hàng',
    searchPlaceholder: 'Nhập mã hoặc tên mặt hàng',
    more: (rest: string) => `Xem thêm (+${rest})`,
    loading: 'Đang tìm mặt hàng',
    empty: 'Không tìm thấy mặt hàng',
    failed: 'Không tìm được mặt hàng. Hãy kiểm tra kết nối.',
    cancel: 'Quay lại mà không chọn',
    toTop: 'Lên đầu trang',
  },
};
