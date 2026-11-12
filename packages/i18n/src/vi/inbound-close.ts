import type { ko } from '../ko';
import type { Translated } from './translated';

export const inboundClose: Translated<typeof ko.inboundClose> = {
  title: 'Chốt nhập hàng',
  open: {
    heading: (count: number) => `Đang nhập hàng (cần chốt) ${count}`,
    empty: 'Không có LOT nhập hàng nào cần chốt',
    note: 'Dù không chốt, khi ngày của nhà máy thay đổi hệ thống sẽ tự động chốt.',
    receiving: 'Đang nhập hàng',
    reopened: 'Đã hủy chốt',
    firstAt: (when: string) => `Đăng ký đầu tiên ${when}`,
  },
  done: {
    heading: (count: number) => `Đã nhập hàng xong · có thể hủy chốt ${count}`,
    note: 'Chỉ hiện các mục chưa có công việc nào bắt đầu.',
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
    hiddenTitle: 'Không hiện ở đây — không hủy chốt được',
    hidden: [
      'Mục đã có dù chỉ 1 kết quả IQC (chỉ hiện sau khi xóa kết quả ở W-01-01)',
      'Mục có dù chỉ một LOT quản lý vật tư đã nhập kho',
      'Mục đang chờ phê duyệt bỏ qua khẩn cấp',
      'Mục quản trị viên đã Chốt cuối cùng (W-01-16 Nhật ký công việc nhập hàng / nhập kho)',
    ],
  },
  card: {
    itemSupplier: (item: string, supplier: string) => `${item} · ${supplier}`,
    total: (count: number, qty: string) => `${count} LOT quản lý vật tư · ${qty}`,
    open: (no: string) => `Mở ${no}`,
    withSub: (total: string, sub: string) => `${total} · ${sub}`,
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
    total: 'Tổng',
    lots: (count: number) => `LOT quản lý vật tư ${count}`,
    pending: 'Chờ kiểm tra · tạm giữ',
    normal: 'Bình thường',
    unregister: 'Gỡ',
    package: (unit: string, count: number) => ` · ${unit} ${String(count)}`, // ui-check-ignore: C-13 설계 확정 표기 「1,000 EA · 봉지 10」(screens/M-01-01.md)
    note: 'Các thùng còn lại, nếu quét ở M-01-01 Đăng ký nhập hàng, sẽ tiếp tục vào LOT nhập hàng này cho đến khi chốt. Khi ngày của nhà máy thay đổi sẽ tự động chốt.',
    close: 'Chốt',
    loading: 'Đang tải LOT nhập hàng',
    gone: 'LOT nhập hàng này đã được chốt hoặc không còn. Hãy quay về danh sách.',
  },
  unregisterDialog: {
    title: 'Gỡ đăng ký LOT quản lý vật tư?',
    body: (qty: string) => `LOT quay về trạng thái chờ và số lượng nhập hàng giảm ${qty}.`,
    last: 'Đây là LOT quản lý vật tư cuối cùng. Nếu gỡ, LOT nhập hàng sẽ bị xóa (hủy nhập hàng) và biến mất khỏi danh sách này.',
    cancel: 'Hủy',
    proceed: 'Gỡ đăng ký',
    done: (tail: string) => `Đã gỡ đăng ký — …|${tail} về trạng thái chờ`,
    lastDone: (no: string) => `${no}: Đã gỡ LOT quản lý vật tư cuối cùng — LOT nhập hàng đã bị xóa`,
  },
  closeDialog: {
    title: (no: string) => `Chốt ${no}?`,
    total: (count: number, qty: string) => `${count} LOT quản lý vật tư · ${qty}.`,
    withIqc: 'yêu cầu IQC sẽ được tạo',
    withoutIqc: 'mặt hàng không cần kiểm tra nên IQC được ghi 「Bỏ qua kiểm tra」',
    withoutIqcRecord: 'mặt hàng không cần kiểm tra nên không tạo bản ghi IQC',
    rest: ', và LOT nhập hàng này không nhận thêm hay gỡ được nữa. Quét lại cùng nhà cung cấp · mặt hàng sẽ tạo LOT nhập hàng mới.',
    cancel: 'Hủy',
    proceed: 'Chốt',
  },
  result: {
    withIqc: (no: string) => `Đã nhập hàng xong — đã tạo yêu cầu IQC (${no})`,
    withIqcNoNumber: 'Đã nhập hàng xong — đã tạo yêu cầu IQC',
    noInspection: 'Đã nhập hàng xong — không cần kiểm tra, LOT quản lý vật tư bình thường',
    notice:
      'Đã gửi thông báo bàn giao IQC cho người phụ trách chất lượng. Cho đến khi có kết quả, mục này hiện trong 「Đã nhập hàng xong · có thể hủy chốt」.',
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
        `Yêu cầu IQC (${iqcNo}) bị hủy và LOT nhập hàng quay về 「Đang nhập hàng」. Việc bỏ qua IQC khẩn cấp mất hiệu lực và LOT quản lý vật tư quay về chờ kiểm tra. Khi chốt lại phải kiểm tra hoặc yêu cầu bỏ qua lại`,
    },
    common:
      'Khi về Đang nhập hàng, các lần quét cùng nhà cung cấp · mặt hàng sẽ vào LOT nhập hàng này. Nhận thêm hoặc gỡ xong thì chốt lại. Khi ngày của nhà máy thay đổi sẽ lại tự động chốt.',
    cancel: 'Đóng',
    proceed: 'Hủy chốt',
    done: (no: string) => `${no}: Đã hủy chốt — về Đang nhập hàng`,
  },
  blockedDialog: {
    title: 'Không thể hủy chốt',
    openReceipt: (supplier: string, item: string, no: string) =>
      `Cùng nhà cung cấp · mặt hàng (${supplier} · ${item}): ${no} đang nhập hàng. Mỗi nhà cung cấp · mặt hàng chỉ có một LOT nhập hàng đang nhập, nên hãy chốt LOT đó trước.`,
    codes: {
      IQC_RECORDED:
        'Trong lúc đó đã có kết quả IQC. Chỉ hủy chốt được sau khi xóa kết quả ở W-01-01.',
      GOODS_RECEIVED: 'Trong lúc đó LOT quản lý vật tư đã nhập kho.',
      SKIP_PENDING: 'Đang chờ phê duyệt bỏ qua khẩn cấp.',
      INBOUND_LOT_FINALIZED:
        'Quản trị viên đã Chốt cuối cùng (W-01-16 Nhật ký công việc nhập hàng / nhập kho).',
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
