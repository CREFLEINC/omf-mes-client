import type { ko } from '../ko';
import type { Translated } from './translated';

export const inboundReceipt: Translated<typeof ko.inboundReceipt> = {
  title: 'Đăng ký nhập hàng',
  scan: {
    label: 'Nhãn LOT quản lý vật tư',
    prompt: 'Hãy quét nhãn LOT quản lý vật tư — quét là đăng ký ngay',
    results: 'Kết quả quét',
    manual: 'Nhập tay',
    manualSubmit: 'Đăng ký bằng số đã nhập',
  },
  result: {
    registered: (lotTail: string) => `Đã đăng ký · ${lotTail}`,
    created: (inboundLotNo: string) => `Tạo LOT nhập hàng mới ${inboundLotNo}`,
    added: (inboundLotNo: string, count: number) => `Thêm vào ${inboundLotNo} (thứ ${count})`,
    supplierLabel: 'Nhãn nhà cung cấp — đã tạo LOT quản lý vật tư tại chỗ',
  },
  reject: {
    title: (reason: string, lotTail: string) => `${reason} — chưa đăng ký · ${lotTail}`,
    refused: 'Bị từ chối',
    voided: 'Đã hủy',
    voidedBody: 'Nhãn đã bị hủy sau khi in. Hãy quét nhãn in lại',
    alreadyReceived: 'Đã nhập hàng',
    alreadyReceivedIn: (inboundLotNo: string, receiving: boolean) =>
      `LOT quản lý vật tư đã được đăng ký vào ${inboundLotNo} (${receiving ? 'đang nhập hàng' : 'đã nhập hàng xong'})`,
    alreadyReceivedBody: 'LOT quản lý vật tư đã được đăng ký nhập hàng',
    notMaterialLot: 'Không phải LOT quản lý vật tư',
    notMaterialLotBody:
      'Không phải nhãn LOT quản lý vật tư (LOT sản xuất, v.v.). Hãy quét nhãn LOT quản lý vật tư',
    alreadyQueued: 'Đã chờ gửi',
    alreadyQueuedBody: 'Nhãn này đã có trong danh sách chờ gửi',
    failed: 'Không đăng ký được. Lát nữa hãy quét lại.',
    closedTitle: (lotTail: string) => `LOT nhập hàng đã chốt — chưa lưu · ${lotTail}`,
    closedBody: (inboundLotNo: string) =>
      `${inboundLotNo} đã được chốt (M-01-03 hoặc tự động chốt theo ngày). Sau khi chốt không sửa được số LOT nhà cung cấp`,
    dismiss: 'Đóng',
  },
  autoClosed: (inboundLotNo: string) =>
    `${inboundLotNo} đang nhập hàng hôm qua đã tự động chốt vì đổi ngày (đã tạo yêu cầu IQC). Lần quét này đã vào LOT nhập hàng mới.`,
  offline: {
    scanned: 'Ngoại tuyến — chưa đăng ký. Đã để chờ gửi, khi có kết nối sẽ tự gửi',
    title: (count: number) => `Chờ gửi ${count}`,
    sub: 'Khi có kết nối sẽ tự gửi',
    note: 'Chưa được đăng ký. Vào LOT nhập hàng nào hay bị từ chối sẽ do máy chủ quyết định sau khi gửi.',
    chip: 'Chờ gửi',
    flushed: (count: number, registered: number, rejected: number) =>
      `Đã kết nối — đã gửi ${count} mục chờ gửi · đăng ký ${registered} · từ chối ${rejected}`,
    queueFailed: 'Không đưa được vào danh sách chờ gửi. Hãy quét lại.',
  },
  cards: {
    title: (count: number) => `LOT nhập hàng đã nhận lần này ${count}`,
    sub: 'Mỗi nhà cung cấp · mặt hàng một thẻ',
    empty:
      'Chưa có LOT quản lý vật tư nào được đăng ký. Dù lẫn nhà cung cấp · mặt hàng vẫn cứ quét tiếp — sẽ tự chia vào thẻ LOT nhập hàng theo nhà cung cấp · mặt hàng.',
    splitHint:
      'Muốn chia 100 thùng thành 2 LOT nhập hàng: quét 50 thùng → [Chốt nhập hàng] → quét phần còn lại sẽ có thẻ LOT nhập hàng mới.',
    stayHint:
      'LOT nhập hàng chưa chốt vẫn ở trạng thái 「Đang nhập hàng」 dù rời màn hình này — quét tiếp sẽ vào đó, và cũng có thể chốt ở M-01-03. Khi ngày của nhà máy đổi, hệ thống sẽ tự động chốt, sau đó lần quét sẽ vào LOT nhập hàng mới.',
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
    thisVisit: 'Đăng ký lần này',
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
    closedNote: (iqcNo: string | null) =>
      iqcNo === null
        ? 'Thành phần đã cố định — quét lại cùng nhà cung cấp · mặt hàng sẽ có thẻ LOT nhập hàng mới.'
        : `Yêu cầu IQC ${iqcNo}. Thành phần đã cố định — quét lại cùng nhà cung cấp · mặt hàng sẽ có thẻ LOT nhập hàng mới.`,
    closedElsewhere: 'Đã được chốt ở máy khác (M-01-03) hoặc tự động chốt theo ngày. ',
    noInspection: 'Không cần kiểm tra — LOT quản lý vật tư bình thường',
    readOnlySupplierLot: 'Sau khi chốt không sửa được số LOT nhà cung cấp (chỉ xem).',
    blockedOffline:
      'Ngoại tuyến — chốt · gỡ · nhập LOT nhà cung cấp chỉ làm được sau khi có kết nối',
    blockedPending: (count: number) =>
      `Có thể chốt sau khi ${count} mục chờ gửi của nhà cung cấp · mặt hàng này được gửi đi`,
  },
  unregistered: {
    toast: (lotTail: string, inboundLotNo: string, total: string) =>
      `Đã gỡ đăng ký — ${lotTail} về chờ · ${inboundLotNo} tổng ${total}`,
    lastToast: (inboundLotNo: string) =>
      `Đã gỡ LOT quản lý vật tư cuối cùng — LOT nhập hàng ${inboundLotNo} không còn (hủy nhập hàng)`,
    failed: 'Không gỡ được đăng ký.',
  },
  closeDialog: {
    title: (inboundLotNo: string) => `Chốt ${inboundLotNo}?`,
    summary: (supplier: string, item: string, count: number, total: string) =>
      `${supplier} · ${item} · ${count} LOT quản lý vật tư · ${total}`,
    body: 'Khi chốt sẽ tạo yêu cầu IQC và LOT nhập hàng này không nhận thêm hay gỡ được nữa. Quét lại cùng nhà cung cấp · mặt hàng sẽ tạo LOT nhập hàng mới.',
    bodyNoInspection:
      'Mặt hàng không cần kiểm tra nên khi chốt IQC sẽ ghi là 「bỏ qua kiểm tra」, và LOT nhập hàng này không nhận thêm hay gỡ được nữa. Quét lại cùng nhà cung cấp · mặt hàng sẽ tạo LOT nhập hàng mới.',
    cancel: 'Hủy',
    confirm: 'Chốt',
    toast: (inboundLotNo: string, iqcNo: string | null) =>
      iqcNo === null
        ? `Đã chốt nhập hàng ${inboundLotNo} — không cần kiểm tra, LOT quản lý vật tư bình thường`
        : `Đã chốt nhập hàng ${inboundLotNo} — yêu cầu IQC ${iqcNo}. Quét lại cùng nhà cung cấp · mặt hàng sẽ tạo LOT nhập hàng mới`,
    failed: 'Không chốt được. Đã tải lại LOT nhập hàng.',
  },
  sheet: {
    title: 'Số LOT nhà cung cấp',
    status: (inboundLotNo: string) =>
      `${inboundLotNo} · Đang nhập hàng — có thể nhập hoặc sửa trước khi chốt nhập hàng`,
    label: 'Số LOT nhà cung cấp (tùy chọn)',
    prefilled: 'Đã điền số in trên nhãn nhà cung cấp. Nếu khác hãy sửa.',
    applyRest: (count: number) =>
      `Áp dụng cùng số cho ${count} LOT quản lý vật tư còn lại của thẻ này`,
    applyRestNote: (count: number) => `${count} LOT đang có số khác cũng sẽ bị đổi`,
    note: 'Nhiều LOT quản lý vật tư có thể có cùng một LOT nhà cung cấp (N : 1). Bấm [Lưu] sẽ cập nhật ngay lên máy chủ.',
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
