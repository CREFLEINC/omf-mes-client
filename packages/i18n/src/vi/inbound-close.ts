import type { ko } from '../ko';
import type { Translated } from './translated';

export const inboundClose: Translated<typeof ko.inboundClose> = {
  title: 'Chốt nhập hàng',
  open: {
    heading: (count: number) => `Đang nhập hàng (cần chốt) ${count}`,
    empty: 'Không có LOT nhập hàng nào cần chốt',
    receiving: 'Đang nhập hàng',
    reopened: 'Đã hủy chốt',
  },
  done: {
    heading: (count: number) => `Đã nhập hàng xong · có thể hủy chốt ${count}`,
    empty: 'Không có mục nào hủy chốt được',
    autoChip: 'Tự động chốt',
    closedAuto: (when: string) => `Tự động chốt do sang ngày mới ${when}`,
    closed: (when: string) => `Chốt ${when}`,
    reopen: 'Hủy chốt',
    blocked: (no: string) =>
      `Cùng nhà cung cấp · mặt hàng: ${no} đang nhập hàng — phải chốt LOT đó trước mới hủy được`,
    reason: {
      NO_IQC_RESULT: { chip: 'IQC 0 kết quả', sub: 'Cần kiểm tra · chưa có kết quả' },
      INSPECTION_NOT_REQUIRED: {
        chip: 'Không cần kiểm tra · chưa nhập kho',
        sub: 'LOT quản lý vật tư bình thường',
      },
      IQC_SKIPPED: {
        chip: 'Đã bỏ qua IQC khẩn cấp · chưa nhập kho',
        sub: 'LOT quản lý vật tư bình thường (bỏ qua khẩn cấp)',
      },
    },
  },
  card: {
    facts: {
      supplier: 'Nhà cung cấp',
      item: 'Mặt hàng',
      lotCount: 'Số LOT',
      totalQty: 'Tổng số lượng',
      firstAt: 'Đăng ký đầu tiên',
      quality: 'Chất lượng',
    },
    lotCount: (count: number) => `${count}`,
    open: (no: string) => `Mở ${no}`,
    withIqc: (closed: string, iqcNo: string) => `${closed} · ${iqcNo}`,
    lotItem: (no: string, item: string) => `${no} · ${item}`,
  },
  detail: {
    inboundLot: 'LOT nhập hàng',
    status: 'Trạng thái',
    statusValue: 'Đang nhập hàng · chưa chốt',
    item: 'Mặt hàng',
    supplier: 'Nhà cung cấp',
    receiptNo: 'Số nhập hàng',
    firstAt: 'Đăng ký đầu tiên',
    lotCount: 'Số LOT',
    totalQty: 'Tổng số lượng',
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
    notice: 'Đã gửi thông báo bàn giao IQC cho người phụ trách chất lượng.',
    back: 'Về danh sách',
  },
  reopenDialog: {
    title: 'Hủy chốt?',
    effect: {
      NO_IQC_RESULT: (iqcNo: string) =>
        `Yêu cầu IQC (${iqcNo}) bị hủy và LOT nhập hàng quay về 「Đang nhập hàng」. LOT quản lý vật tư vẫn giữ chờ kiểm tra · tạm giữ.`,
      INSPECTION_NOT_REQUIRED: () =>
        'Bản ghi IQC 「Bỏ qua kiểm tra」 bị hủy và LOT nhập hàng quay về 「Đang nhập hàng」. LOT quản lý vật tư vẫn Bình thường (mặt hàng không cần kiểm tra).',
      IQC_SKIPPED: (iqcNo: string) =>
        `Yêu cầu IQC (${iqcNo}) bị hủy và LOT nhập hàng quay về 「Đang nhập hàng」. Việc bỏ qua IQC khẩn cấp mất hiệu lực và LOT quản lý vật tư quay về chờ kiểm tra.`,
    },
    cancel: 'Đóng',
    proceed: 'Hủy chốt',
    done: (no: string) => `${no}: Đã hủy chốt — về Đang nhập hàng`,
  },
  blockedDialog: {
    title: 'Không thể hủy chốt',
    openReceipt: (supplier: string, item: string, no: string) =>
      `Cùng nhà cung cấp · mặt hàng (${supplier} · ${item}): ${no} đang nhập hàng. Hãy chốt LOT đó trước.`,
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
