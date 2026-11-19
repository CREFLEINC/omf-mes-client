import type { ko } from '../ko';
import type { Translated } from './translated';

/** P-01-02 분할 LOT 라벨(008 · #295). */
export const goodsIssueQr: Translated<typeof ko.goodsIssueQr> = {
  title: 'Nhãn LOT tách',

  tabs: {
    label: 'Chế độ xem',
    unprinted: 'Chờ phát hành',
    printed: 'Phát hành lại',
  },
  search: {
    label: 'Số LOT · số phiếu xuất · mã hàng',
    placeholder: 'Hãy quét nhãn',
    manualTitle: 'Tìm LOT tách',
    filtered: (query: string) => `Kết quả tìm theo 「${query}」.`,
    clearFilter: 'Xóa hết',
    notFound: (code: string) => `Không có LOT tách nào ứng với 「${code}」 — hãy kiểm tra lại số.`,
  },
  periods: {
    label: 'Ngày xuất kho',
    today: 'Hôm nay',
    week: '7 ngày gần đây',
    month: '30 ngày gần đây',
  },
  order: {
    label: 'Sắp xếp',
    newest: 'Mới nhất',
    oldest: 'Cũ nhất',
  },
  help: {
    button: 'Trợ giúp',
    title: 'Hướng dẫn nhãn LOT tách',
    intro:
      'Khi xuất kho tách vật tư, một LOT mới được tạo theo số lượng tách. Khi xuất kho toàn bộ thì dùng LOT hiện có.',
    items: [
      { term: 'In nhãn:', text: 'In nhãn LOT tách và dán lên vật tư.' },
      {
        term: 'Nhập kho:',
        text: 'Nhãn LOT tách dùng khi nhập kho sản xuất và khi đưa vật tư vào sản xuất.',
      },
      { term: 'Lưu ý:', text: 'Mã QR xuất kho cũ vẫn dùng được khi nhập kho sản xuất.' },
    ],
  },

  table: {
    label: 'LOT tách',
    select: 'Chọn',
    lotNo: 'Số LOT tách',
    parentLot: 'Số LOT gốc',
    item: 'Mặt hàng',
    qty: 'Số lượng',
    issue: 'Số phiếu xuất',
    destination: 'Nơi đến',
    splitAt: 'Thời điểm tách',
    labelColumn: 'Nhãn',
    issueLine: (issueNo: string, lineNo: number) => `${issueNo} · dòng ${String(lineNo)}`,
    choose: (lotNo: string) => `Chọn ${lotNo}`,
  },
  status: {
    unissued: 'Chờ in',
    failed: (count: number) => `In lỗi lần ${String(count)}`,
    pending: (seq: number) => `In lần ${String(seq)} · chưa rõ kết quả`,
    printed: (seq: number) => `Đã in lần ${String(seq)}`,
  },
  empty: {
    unprintedTitle: 'Không có LOT tách nào cần phát hành nhãn.',
    unprintedBody: 'Khi xuất kho một phần, LOT sẽ hiện ở đây.',
    printedTitle: (period: string) => `Không có LOT tách nào đã in nhãn trong ${period}.`,
    printedBody: 'Hãy mở rộng khoảng ngày xuất kho.',
    searchTitle: (tab: string) => `Không có LOT cần tìm trong 「${tab}」.`,
    searchNone: 'Hãy kiểm tra lại số.',
    searchInPrinted: (lotNo: string) => `LOT này đã in nhãn (${lotNo}).`,
    searchInUnprinted: (lotNo: string) => `LOT này chưa in nhãn (${lotNo}).`,
    showInPrinted: 'Xem ở 「Phát hành lại」',
    showInUnprinted: 'Xem ở 「Chờ phát hành」',
    loadFailedTitle: 'Không tải được danh sách LOT tách.',
    loadFailedBody: 'Hãy kiểm tra kết nối rồi tải lại. Ở trạng thái này không phát hành nhãn được.',
    retry: 'Tải lại',
  },
  reasons: {
    label: 'Lý do in lại',
    needFailed: (count: number) => `Hãy chọn lý do in lại cho ${String(count)} LOT in lỗi`,
    need: 'Hãy chọn lý do',
  },
  bar: {
    label: 'Thao tác',
    selectAll: (count: number) => `Chọn tất cả (${String(count)})`,
    clearAll: (count: number) => `Bỏ chọn tất cả (${String(count)})`,
    clearSelection: 'Bỏ chọn',
    print: (count: number) => `Phát hành ${String(count)} nhãn`,
    printNone: 'Phát hành nhãn',
    reprint: (count: number) => `In lại ${String(count)} nhãn`,
    reprintNone: 'In lại',
    running: (done: number, total: number) => `Đang in nhãn ${String(done)} / ${String(total)}`,
  },
  preview: {
    title: 'Xem trước nhãn',
    reprintTitle: 'Xem trước in lại',
    kind: 'LOT tách',
    qty: 'Số lượng',
    reissue: (seq: number) => `In lại lượt ${String(seq)}`,
    close: 'Đóng',
    bag: 'Túi cần dán',
    bagValue: (qty: string, issueNo: string, lineNo: number, destination: string) =>
      `${qty} · phiếu xuất ${issueNo} dòng ${String(lineNo)}${destination === '' ? '' : ` · nơi đến ${destination}`}`,
    parent: 'LOT gốc',
    prev: '◀ Trước',
    next: 'Sau ▶',
    page: (index: number, total: number) => `${String(index)} / ${String(total)} nhãn`,
    print: (count: number) => `In ${String(count)} nhãn`,
    reprint: (count: number) => `In lại ${String(count)} nhãn`,
  },
  result: {
    printed: (count: number) => `Đã phát hành ${String(count)} nhãn. Hãy dán lên túi.`,
    reprinted: (count: number) =>
      `Đã in lại ${String(count)} nhãn. Hãy bóc nhãn cũ và dán nhãn mới.`,
    partial: (total: number, printed: number, failed: number) =>
      `Đã in ${String(printed)}/${String(total)} nhãn · ${String(failed)} nhãn in lỗi — hãy kiểm tra kết nối máy in và giấy. LOT in lỗi vẫn ở 「Chờ phát hành」, hãy chọn lý do rồi in lại.`,
    notSent: (count: number) => ` ${String(count)} nhãn chưa gửi vẫn còn nguyên.`,
    forbidden: 'Máy trạm này không có quyền phát hành nhãn. Hãy báo cho quản trị viên.',
    issueFailed: (count: number, reason: string) =>
      `Không phát hành được ${String(count)} nhãn${reason === '' ? '' : ` — ${reason}`}.`,
    showPrinted: 'Xem phát hành lại',
  },
};
