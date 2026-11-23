import type { ko } from '../ko';
import type { Translated } from './translated';

export const inboundClose: Translated<typeof ko.inboundClose> = {
  title: 'Chốt nhập hàng',
  tabsLabel: 'Danh sách chốt nhập hàng',
  open: {
    heading: 'Đang nhập hàng',
    empty: 'Không có LOT nhập hàng nào cần chốt',
    closeAll: 'Chốt tất cả',
    closeAllLabel: (items: number, lots: number) =>
      `Chốt tất cả ${items} mặt hàng ${lots} LOT đang nhập hàng`,
  },
  done: {
    heading: 'Đã nhập hàng xong',
    empty: 'Không có mục nào hủy chốt được',
    reopen: 'Hủy',
    reopenLabel: (itemCode: string, itemName: string) => `Hủy chốt ${itemCode} ${itemName}`,
  },
  closeAllDialog: {
    title: 'Chốt tất cả mặt hàng đang nhập hàng?',
    summary: (items: number, lots: number) => `Chốt ${items} mặt hàng ${lots} LOT.`,
    body: 'Sau khi chốt không thể nhận thêm hoặc gỡ, mặt hàng cần kiểm tra sẽ tạo yêu cầu IQC.',
    cancel: 'Hủy',
    proceed: 'Chốt tất cả',
    done: (items: number) => `Đã chốt ${items} mặt hàng`,
  },
  list: {
    open: (itemCode: string, itemName: string) => `Mở ${itemCode} ${itemName}`,
  },
  sheet: {
    title: 'Hàng nhập',
    fields: {
      itemCode: 'Mã hàng',
      itemName: 'Tên hàng',
      supplier: 'Nhà cung cấp',
      qty: 'Số lượng',
      closedAt: 'Giờ chốt',
    },
    summary: (count: number, total: string) => `${String(count)} cái ${total}`,
  },
  detail: {
    lotCount: 'Số LOT',
    lots: (count: number) => `LOT quản lý vật tư ${count}`,
    columns: { no: 'Số', qty: 'Số lượng', registered: 'Đăng ký' },
    unregister: 'Gỡ',
    package: (unit: string, count: number) => ` · ${unit} ${String(count)}`, // ui-check-ignore: C-13 설계 확정 표기 「1,000 EA · 봉지 10」(screens/M-01-01.md)
    close: 'Chốt',
    loading: 'Đang tải LOT nhập hàng',
    gone: 'LOT nhập hàng này đã được chốt hoặc không còn. Hãy quay về danh sách.',
  },
  unregisterDialog: {
    title: 'Gỡ đăng ký LOT quản lý vật tư?',
    body: (qty: string) => `Số lượng nhập hàng giảm ${qty}.`,
    last: 'Đây là LOT quản lý vật tư cuối cùng. Nếu gỡ sẽ hủy nhập hàng.',
    cancel: 'Hủy',
    proceed: 'Gỡ',
    done: (tail: string) => `Đã gỡ đăng ký — …|${tail}`,
    lastDone: (no: string) => `Hủy nhập hàng ${no} — đã gỡ LOT quản lý vật tư cuối cùng`,
  },
  closeDialog: {
    title: (no: string) => `Chốt ${no}?`,
    total: (count: number, qty: string) => `${count} LOT quản lý vật tư · ${qty}.`,
    withIqc: 'yêu cầu IQC sẽ được tạo',
    withoutIqc: 'mặt hàng không cần kiểm tra nên IQC được ghi 「Bỏ qua kiểm tra」',
    withoutIqcRecord: 'mặt hàng không cần kiểm tra nên không tạo bản ghi IQC',
    rest: ', và không nhận thêm hay gỡ được nữa.',
    cancel: 'Hủy',
    proceed: 'Chốt',
  },
  result: {
    withIqc: (no: string) => `Đã nhập hàng xong — đã tạo yêu cầu IQC (${no})`,
    withIqcNoNumber: 'Đã nhập hàng xong — đã tạo yêu cầu IQC',
    noInspection: 'Đã nhập hàng xong — không cần kiểm tra, LOT quản lý vật tư bình thường',
  },
  reopenDialog: {
    title: 'Hủy chốt?',
    effect: {
      NO_IQC_RESULT: (iqcNo: string) =>
        `Yêu cầu IQC (${iqcNo}) bị hủy và LOT nhập hàng quay về 「Đang nhập hàng」. LOT quản lý vật tư vẫn giữ trạng thái chờ kiểm tra hoặc tạm giữ.`,
      INSPECTION_NOT_REQUIRED: () =>
        'Bản ghi IQC 「Bỏ qua kiểm tra」 bị hủy và LOT nhập hàng quay về 「Đang nhập hàng」. LOT quản lý vật tư vẫn Bình thường (mặt hàng không cần kiểm tra).',
      IQC_SKIPPED: (iqcNo: string) =>
        `Yêu cầu IQC (${iqcNo}) bị hủy và LOT nhập hàng quay về 「Đang nhập hàng」. Việc bỏ qua IQC khẩn cấp mất hiệu lực và LOT quản lý vật tư quay về chờ kiểm tra.`,
    },
    cancel: 'Đóng',
    proceed: 'Hủy chốt',
    done: (itemCode: string, itemName: string) => `Đã hủy chốt ${itemCode} ${itemName}`,
  },
  blockedDialog: {
    title: 'Không thể hủy chốt',
    openReceipt: 'Cùng mặt hàng đang nhập hàng nên không thể hủy chốt.',
    openReceiving: 'Mở mục đang nhập hàng',
    codes: {
      IQC_RECORDED: 'Trong lúc đó đã có kết quả IQC.',
      GOODS_RECEIVED: 'Trong lúc đó LOT quản lý vật tư đã nhập kho.',
      SKIP_PENDING: 'Đang chờ phê duyệt bỏ qua khẩn cấp.',
      INBOUND_LOT_FINALIZED: 'Quản trị viên đã Chốt cuối cùng.',
      LEGACY_INBOUND_LOT: 'Đây là dữ liệu nhập hàng cũ nên không hủy chốt được.',
    } as Record<string, string | undefined>,
    other: 'Hiện không hủy chốt được. Đã tải lại danh sách.',
    close: 'Đóng',
  },
  errors: {
    conflict: 'Thiết bị khác đã thay đổi trước. Đã tải lại danh sách.',
    stateLocked: 'Trạng thái LOT nhập hàng này đã thay đổi. Đã tải lại danh sách.',
    failed: 'Không lưu được. Hãy kiểm tra kết nối rồi thử lại.',
    loadFailed: 'Không tải được danh sách LOT nhập hàng.',
    retry: 'Tải lại',
  },
  offline: 'Ngoại tuyến — chốt nhập hàng · gỡ · hủy chốt chỉ làm được khi đã kết nối',
  noWorker: 'Làm được sau khi xác nhận mã NV',
  noPlant:
    'Không biết nhà máy của thiết bị này nên không tải danh sách. Hãy kiểm tra đăng ký thiết bị.',
};
