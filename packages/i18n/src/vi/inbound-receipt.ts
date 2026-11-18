import type { ko } from '../ko';
import type { Translated } from './translated';

export const inboundReceipt: Translated<typeof ko.inboundReceipt> = {
  title: 'Đăng ký nhập hàng',
  scan: {
    label: 'Nhãn LOT quản lý vật tư',
    prompt: 'Hãy quét nhãn LOT quản lý vật tư',
    results: 'Kết quả quét',
    manual: 'Nhập tay',
    manualSubmit: 'Đăng ký bằng số đã nhập',
  },
  result: {
    registered: (lotTail: string) => `Đã đăng ký · ${lotTail}`,
    created: (inboundLotNo: string) => `Tạo LOT nhập hàng mới ${inboundLotNo}`,
    added: (inboundLotNo: string, count: number) => `Thêm vào ${inboundLotNo} (thứ ${count})`,
    autoClosed: (inboundLotNo: string) => `${inboundLotNo} tự động chốt vì đổi ngày`,
  },
  reject: {
    title: (reason: string, lotTail: string) => `${reason} — chưa đăng ký · ${lotTail}`,
    refused: 'Bị từ chối',
    voided: 'Đã hủy',
    alreadyReceived: 'Đã nhập hàng',
    alreadyReceivedIn: (inboundLotNo: string, receiving: boolean) =>
      `${inboundLotNo} (${receiving ? 'đang nhập hàng' : 'đã nhập hàng xong'})`,
    notMaterialLot: 'Không phải LOT quản lý vật tư',
    alreadyQueued: 'Đã chờ gửi',
    failed: 'Không đăng ký được. Lát nữa hãy quét lại.',
    closedTitle: (lotTail: string) => `LOT nhập hàng đã chốt — chưa lưu · ${lotTail}`,
    closedBody: (inboundLotNo: string) => `${inboundLotNo} đã được chốt`,
  },
  offline: {
    scanned: 'Ngoại tuyến — đã đưa vào chờ gửi',
    title: (count: number) => `Chờ gửi ${count}`,
    flushed: (count: number, registered: number, rejected: number) =>
      `Đã gửi ${count} mục chờ gửi · đăng ký ${registered} · từ chối ${rejected}`,
    queueFailed: 'Không đưa được vào danh sách chờ gửi. Hãy quét lại.',
  },
  cards: {
    title: (count: number) => `LOT nhập hàng đã nhận lần này ${count}`,
    empty: 'Chưa có LOT quản lý vật tư nào được đăng ký',
  },
  card: {
    statusNew: 'LOT nhập hàng mới · Đang nhập hàng',
    statusReceiving: 'Đang nhập hàng',
    statusClosed: 'Đã chốt · Đã yêu cầu IQC',
    statusClosedNoIqc: 'Đã chốt',
    statusVoided: 'Hủy nhập hàng',
    pair: (supplier: string, itemCode: string, itemName: string) =>
      `${supplier} · ${itemCode} ${itemName}`,
    summary: (count: number, total: string) => `${count} LOT quản lý vật tư · ${total}`,
    loading: 'Đang tải LOT nhập hàng',
    loadFailed: 'Không tải được LOT nhập hàng',
    retry: 'Tải lại',
    justNow: 'Vừa đăng ký',
    earlier: (time: string) => `Đăng ký trước ${time}`,
    package: (uomCode: string, count: number) => ` · ${uomCode} ${String(count)}`,
    supplierLabel: 'Nhãn nhà cung cấp',
    qualityPending: 'Chờ kiểm tra · Giữ lại',
    qualityNormal: 'Bình thường',
    supplierLot: (no: string) => `LOT nhà cung cấp ${no}`,
    noSupplierLot: 'Không có LOT nhà cung cấp',
    editSupplierLot: (lotNo: string) => `Sửa số LOT nhà cung cấp của ${lotNo}`,
    unregister: 'Gỡ',
    close: 'Chốt nhập hàng',
    iqcRequest: (iqcNo: string) => `Yêu cầu IQC ${iqcNo}`,
    blockedOffline: 'Ngoại tuyến — làm được sau khi có kết nối',
    blockedPending: (count: number) => `Có thể chốt sau khi gửi ${count} mục chờ gửi`,
  },
  unregistered: {
    toast: (lotTail: string, inboundLotNo: string, total: string) =>
      `Đã gỡ đăng ký — ${lotTail} · ${inboundLotNo} tổng ${total}`,
    lastToast: (inboundLotNo: string) =>
      `Hủy nhập hàng ${inboundLotNo} — đã gỡ LOT quản lý vật tư cuối cùng`,
    failed: 'Không gỡ được đăng ký.',
  },
  closeDialog: {
    title: (inboundLotNo: string) => `Chốt ${inboundLotNo}?`,
    summary: (supplier: string, item: string, count: number, total: string) =>
      `${supplier} · ${item} · ${count} LOT quản lý vật tư · ${total}`,
    body: 'Khi chốt sẽ tạo yêu cầu IQC và không nhận thêm hay gỡ được nữa.',
    bodyNoInspection:
      'Khi chốt IQC sẽ ghi là 「bỏ qua kiểm tra」 và không nhận thêm hay gỡ được nữa.',
    bodyNoIqcRecord: 'Khi chốt sẽ không tạo bản ghi IQC và không nhận thêm hay gỡ được nữa.',
    cancel: 'Hủy',
    confirm: 'Chốt',
    toast: (inboundLotNo: string, iqcNo: string | null) =>
      iqcNo === null
        ? `Đã chốt nhập hàng ${inboundLotNo}`
        : `Đã chốt nhập hàng ${inboundLotNo} — yêu cầu IQC ${iqcNo}`,
    failed: 'Không chốt được. Đã tải lại LOT nhập hàng.',
  },
  sheet: {
    title: 'Số LOT nhà cung cấp',
    status: (inboundLotNo: string) => `${inboundLotNo} · Đang nhập hàng`,
    label: 'Số LOT nhà cung cấp (tùy chọn)',
    applyRest: (count: number) =>
      `Áp dụng cùng số cho ${count} LOT quản lý vật tư còn lại của thẻ này`,
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
