/** M-04-05 Xác nhận tách LOT (PDA · tính năng 013). Thuật ngữ theo GLOSSARY.md. */
export const productLotSplitConfirm = {
  /* 앱바 360 폭에서 잘리지 않게 짧게 — 「LOT」은 안내 · 칸 이름이 말한다(검증 둘러보기 9). */
  title: 'Xác nhận tách',
  guide:
    'Sau khi dán nhãn cho hai LOT đã tách trên POP, hãy quét lần lượt hai nhãn. Thứ tự không quan trọng',

  scan: {
    label: 'Quét nhãn tách',
    hint: 'Nhãn LOT gốc hoặc LOT mới',
    manualLabel: 'Nhập tay',
    manualSubmit: 'Xác nhận',
    looking: (lotNo: string) => `Đang tìm lần tách của ${lotNo}`,
    confirming: 'Đang xác nhận tách',
  },

  pair: {
    label: 'Lần tách cần xác nhận',
    head: (at: string, location: string) => `Tách trên POP ${at}, ${location}`,
    parent: 'LOT gốc',
    child: 'LOT mới',
    scanned: 'Đã quét',
    waiting: 'Chờ quét',
  },

  notice: {
    needParentTitle: 'Hãy quét nhãn LOT gốc',
    needParent: (qty: string) =>
      `Đã đọc nhãn LOT mới. Quét nhãn đã dán lại trên thùng gốc (SL ${qty})`,
    needChildTitle: 'Hãy quét nhãn LOT mới',
    needChild: (qty: string) => `Đã đọc nhãn LOT gốc. Quét nhãn trên thùng mới (SL ${qty})`,
    doneTitle: 'Đã xác nhận tách',
    done: 'Từ giờ cả hai LOT đều có thể lấy hàng xuất',
    wrongTitle: 'Không phải nhãn của lần tách này',
    wrong: (lotNo: string) => `${lotNo} không thuộc lần tách đang xác nhận. Hãy quét nhãn còn lại`,
    alreadyTitle: 'Lần tách này đã được xác nhận',
    already: (at: string, worker: string | null) =>
      worker === null
        ? `Đã xác nhận lúc ${at}. Không có gì thay đổi`
        : `${worker} đã xác nhận lúc ${at}. Không có gì thay đổi`,
    alreadyNoDetail: 'Một PDA khác đã xác nhận trước. Không có gì thay đổi',
    noneTitle: 'Không có lần tách cần xác nhận',
    none: (lotNo: string) => `${lotNo} không có lịch sử tách trên POP. Hãy kiểm tra số LOT`,
    offlineTitle: 'Mất kết nối, không thể xác nhận',
    offline: 'Kiểm tra kết nối rồi thử lại. Chỉ xác nhận được khi có kết nối',
    failedTitle: 'Không xác nhận được',
    failed: 'Hãy quét lại từ đầu',
  },

  actions: {
    exit: 'Thoát',
    next: 'Xác nhận lần tách khác',
    retry: 'Thử lại',
    reset: 'Làm lại',
  },
};
