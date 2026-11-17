import type { ko } from '../ko';
import type { Translated } from './translated';

/** P-01-02 분할 LOT 라벨(008). */
export const goodsIssueQr: Translated<typeof ko.goodsIssueQr> = {
  title: 'Nhãn LOT tách',
  terminalLabel: 'Máy trạm#',
  terminalUnknown: 'Chưa xác nhận',

  band: {
    unknownTitle: 'Chưa nhận được số LOT tách chưa in nhãn',
    unknownBody: 'Hãy tải lại danh sách. Khi chưa tải được thì không có nghĩa là 「không có」.',
    noneTitle: 'Không có LOT tách nào chưa in nhãn',
    noneBody: 'Tất cả LOT tách sinh ra do xuất kho một phần đều đã được in nhãn.',
    title: (count: number) => `${String(count)} LOT tách chưa in nhãn`,
    body: 'Nếu túi chưa dán nhãn thì không quét được khi nhập kho sản xuất (PDA) · đưa vật tư vào (POP). Hiển thị tất cả, không giới hạn thời gian.',
    failed: (count: number) => `In lỗi ${String(count)} mục`,
    oldest: (at: string, age: string) => `Cũ nhất ${at} · ${age}`,
    showUnprinted: 'Xem LOT chưa in nhãn',
  },

  tabs: {
    label: 'Chế độ xem',
    unprinted: 'Chưa in nhãn',
    printed: 'Đã in nhãn',
  },
  search: {
    label: 'Tìm LOT tách',
    placeholder: 'Quét số LOT tách · LOT gốc, nhập số phiếu xuất kho hoặc mã mặt hàng',
    clear: 'Xóa',
  },
  periods: {
    label: 'Ngày xuất kho',
    today: 'Hôm nay',
    week: '7 ngày gần đây',
    month: '30 ngày gần đây',
  },
  refresh: 'Làm mới',
  refreshedAt: (at: string) => `Nhận lúc ${at}`,
  info: 'Số lượng tách ra khi xuất kho một phần sẽ thành LOT tách (LOT quản lý vật tư mới). Nhãn cùng mẫu với nhãn LOT quản lý vật tư, mã QR chứa số LOT tách. Không phát hành QR xuất kho nữa — QR xuất kho đã dán vẫn quét được khi nhập kho sản xuất trên PDA.',

  table: {
    label: 'LOT tách',
    select: 'Chọn',
    lotNo: 'Số LOT tách · LOT gốc',
    item: 'Mặt hàng',
    qty: 'Số lượng',
    issue: 'Số phiếu xuất kho · dòng',
    destination: 'Kho · vị trí đến',
    splitAt: 'Thời điểm tách',
    splitAtOldestFirst: 'Thời điểm tách ↑',
    labelColumn: 'Nhãn',
    parent: (lotNo: string) => `Gốc ${lotNo}`,
    line: (lineNo: number) => `Dòng ${String(lineNo)}`,
    today: 'Hôm nay',
    daysAgo: (days: number) => `${String(days)} ngày trước`,
    choose: (lotNo: string) => `Chọn ${lotNo}`,
  },
  status: {
    unissued: 'Chưa phát hành',
    failed: (count: number) => `In lỗi · lần ${String(count)}`,
    failedHint: 'Chọn lý do rồi in lại',
    pending: (seq: number) => `Đã in lần ${String(seq)} · chưa rõ kết quả`,
    printed: (seq: number) => `Đã in lần ${String(seq)}`,
  },
  empty: {
    unprintedTitle: 'Không có LOT tách nào cần in nhãn',
    unprintedBody:
      'Khi xuất kho một phần, số lượng tách ra thành LOT tách và hiện ở đây. Xuất kho toàn bộ thì dùng luôn nhãn LOT quản lý vật tư đã dán.',
    printedTitle: (period: string) => `Không có nhãn LOT tách nào trong ${period}.`,
    printedBody: 'Hãy mở rộng khoảng thời gian.',
    searchTitle: 'Không có LOT tách cần tìm trong danh sách này.',
    searchNone:
      'Hãy kiểm tra lại số. LOT xuất kho toàn bộ không sinh LOT tách nên không hiện ở đây.',
    searchInPrinted: (lotNo: string) => `LOT tách này đã in nhãn (${lotNo}).`,
    searchInUnprinted: (lotNo: string) => `LOT tách này chưa in nhãn (${lotNo}).`,
    showInPrinted: 'Xem ở 「Đã in nhãn」',
    showInUnprinted: 'Xem ở 「Chưa in nhãn」',
    loadFailedTitle: 'Không tải được danh sách LOT tách.',
    loadFailedBody: 'Hãy kiểm tra kết nối rồi tải lại. Ở trạng thái này không in nhãn được.',
    retry: 'Tải lại',
  },
  reasons: {
    needFailed: (count: number) =>
      `${String(count)} nhãn in lỗi đã tăng lượt nên phải chọn lý do mới in được`,
    need: 'Hãy chọn lý do',
  },
  bar: {
    pickHint: 'Hãy chọn LOT tách cần in nhãn — LOT cũ nhất ở trên cùng',
    selected: (count: number) => `Đã chọn ${String(count)} LOT`,
    withFailed: (count: number) => ` · gồm ${String(count)} in lỗi`,
    failedNeedsReason: 'LOT in lỗi phải chọn lý do phát hành lại mới in được',
    selectAll: (count: number) => `Chọn tất cả (${String(count)})`,
    clearAll: 'Bỏ chọn tất cả',
    clearSelection: 'Bỏ chọn',
    print: (count: number) => `In ${String(count)} nhãn`,
    printNone: 'In nhãn',
    reprintHint: 'Hãy chọn hoặc quét nhãn cần in lại',
    reprintSelected: (count: number) => `Đã chọn ${String(count)} nhãn`,
    withReason: (reason: string) => ` · Lý do ${reason}`,
    reprintNeedsReason: 'Phải chọn lý do thì mới in lại được',
    reprint: (count: number) => `In lại ${String(count)} nhãn`,
    reprintNone: 'In lại',
    listFirst: 'Có danh sách rồi mới in nhãn được',
    running: (done: number, total: number) => `Đang in nhãn ${String(done)} / ${String(total)}`,
  },
  preview: {
    title: 'Xem trước nhãn LOT tách',
    reprintTitle: 'Xem trước in lại',
    note: 'Cùng mẫu với nhãn LOT quản lý vật tư. Mã QR chỉ chứa số LOT tách; trên nhãn hiển thị mặt hàng · số lượng (số lượng tách) · nhà cung cấp. Không có dòng đóng gói.',
    reissueNote: (reason: string) => ` Lý do 「${reason}」, số lượt in tăng thêm 1.`,
    guide: '80 × 30 mm · QR = số LOT tách',
    bag: 'Túi cần dán',
    bagValue: (qty: string, issueNo: string, lineNo: number, destination: string) =>
      `${qty} · phiếu xuất ${issueNo} dòng ${String(lineNo)}${destination === '' ? '' : ` · nơi đến ${destination}`}`,
    parent: 'LOT gốc',
    prev: '◀ Trước',
    next: 'Sau ▶',
    page: (index: number, total: number) => `${String(index)} / ${String(total)} nhãn`,
    cancel: 'Hủy',
    print: (count: number) => `In ${String(count)} nhãn`,
    reprint: (count: number) => `In lại ${String(count)} nhãn`,
    printer: (name: string) => `Máy in ${name}`,
    printerDefault: 'Máy in mặc định của máy chủ',
  },
  result: {
    printed: (count: number) =>
      `Đã in ${String(count)} nhãn — hãy dán lên túi. LOT tách đã in được chuyển sang 「Đã in nhãn」.`,
    reprinted: (count: number) =>
      `Đã in lại ${String(count)} nhãn — số lượt in đã tăng. Hãy bóc nhãn cũ bỏ đi.`,
    partial: (total: number, printed: number, failed: number) =>
      `Đã in ${String(printed)}/${String(total)} nhãn · ${String(failed)} nhãn in lỗi — hãy kiểm tra kết nối máy in và giấy. LOT in lỗi vẫn ở 「Chưa in nhãn」, hãy chọn lý do rồi in lại.`,
    notSent: (count: number) => ` ${String(count)} nhãn chưa gửi vẫn còn nguyên.`,
    forbidden: 'Máy trạm này không có quyền phát hành nhãn. Hãy báo cho quản trị viên.',
    issueFailed: (count: number, reason: string) =>
      `Không phát hành được ${String(count)} nhãn${reason === '' ? '' : ` — ${reason}`}.`,
    showPrinted: 'Xem đã in',
    close: 'Đóng',
  },
};
