/** P-04-07 출하 완료(POP · 피처 010). 용어는 GLOSSARY.md 의 출하 묶음을 따른다. */
export const popShipmentComplete = {
  title: 'Hoàn tất xuất hàng',

  scan: {
    label: 'Mã lệnh xuất hàng',
    placeholder: 'Quét QR trên màn hình PDA hoặc QR trên lệnh đã in',
    replacePlaceholder: 'Quét QR của lệnh xuất hàng khác để mở thay thế',
    nextPlaceholder: 'Quét QR của lệnh xuất hàng tiếp theo',
    submit: 'Nhập trực tiếp',
    search: 'Tìm',
    looking: 'Đang mở lệnh xuất hàng.',
    notCode: (value: string): string =>
      `Đây không phải mã lệnh xuất hàng. Giá trị đã đọc: ${value}. Hãy quét QR của lệnh, không phải nhãn LOT.`,
    notFound: (value: string): string => `Không tìm thấy lệnh xuất hàng. Giá trị đã đọc: ${value}`,
    failed: 'Không mở được lệnh xuất hàng. Hãy kiểm tra kết nối rồi quét lại.',
  },

  entry: {
    heading: 'Ba cách mở lệnh xuất hàng',
    pda: {
      title: 'QR trên màn hình PDA',
      body: 'Mở lệnh tại màn hình lấy hàng thành phẩm trên PDA, chọn 「Xem mã lệnh」 rồi đưa vào máy quét.',
    },
    print: {
      title: 'QR trên lệnh đã in',
      body: 'Quét QR ở phía trên lệnh xuất hàng đã in từ web quản lý.',
    },
    search: {
      title: 'Chọn bằng [Tìm]',
      body: 'Nếu không có mã, hãy tìm theo số lệnh, khách hàng hoặc mặt hàng rồi chọn.',
    },
    same: 'Cả ba cách đều mở cùng một màn hình xác nhận. Thời điểm nhấn [Hoàn tất xuất hàng] trên màn hình đó là thời điểm hoàn tất xuất hàng.',
  },

  head: {
    request: 'Lệnh xuất hàng',
    customer: 'Khách hàng',
    shipTo: 'Nơi giao hàng',
    salesOrder: 'Đơn bán hàng',
    noSalesOrder: 'Không có (lập không theo đơn bán hàng)',
    ready: 'Có thể hoàn tất',
    blocked: 'Không thể hoàn tất',
    openedByScan: 'Mở bằng quét mã',
    openedBySearch: 'Mở bằng tìm kiếm',
    named: (name: string, code: string): string => `${name} (${code})`,
  },

  blockers: {
    heading: (count: number): string => `Lý do chặn hoàn tất: ${String(count)}`,
    PICKING_SHORT: {
      title: 'Số lượng đã lấy chưa đạt số lượng mục tiêu',
      hint: 'Hãy quét thêm LOT tại màn hình lấy hàng thành phẩm trên PDA.',
    },
    NOT_INSPECTED: {
      title: 'Có LOT chưa được kiểm tra',
      hint: 'Hãy ghi kết quả tại màn hình kiểm tra xuất hàng OQC (P-04-06, W-04-03).',
    },
    REJECTED: {
      title: 'Có LOT không đạt',
      hint: 'Hãy nhấn [Thay thế] trên PDA hoặc nhập kết quả kiểm tra lại.',
    },
    HELD: {
      title: 'Có LOT đang tạm giữ',
      hint: 'Hãy hoàn tất phán định tại màn hình kiểm tra xuất hàng OQC.',
    },
    SALES_ORDER_LINE_CANCELLED: {
      title: 'Có dòng đơn bán hàng đã bị hủy trên ERP',
      hint: 'Hãy liên hệ người phụ trách.',
    },
    line: (lineNo: number, itemCode: string, picked: string, target: string): string =>
      `Dòng ${String(lineNo)} ${itemCode}, đã lấy ${picked} / mục tiêu ${target}`,
    lineOnly: (lineNo: number): string => `Dòng ${String(lineNo)}`,
  },

  lines: {
    heading: 'Dòng',
    caption: 'Mục tiêu và số lượng đã lấy theo dòng',
    note: 'Mục tiêu là số lượng của dòng lệnh, đã lấy là tổng các LOT lấy nguyên.',
    columns: {
      lineNo: 'Dòng',
      itemCode: 'Mã hàng',
      itemName: 'Tên hàng',
      target: 'Mục tiêu',
      picked: 'Đã lấy',
      over: 'Vượt',
      lotCount: 'LOT',
    },
  },

  warehouses: {
    heading: 'Kho sẽ bị trừ tồn',
    note: 'Chỉ để tham khảo. Xuất hàng được ghi thành một lần.',
    entry: (lotCount: number, qty: string): string => `${String(lotCount)} LOT, SL ${qty}`,
  },

  lots: {
    heading: (count: number): string => `${String(count)} LOT`,
    caption: 'LOT đã lấy và phán định OQC',
    note: 'Phán định OQC là kết quả cuối cùng của lệnh này.',
    columns: {
      lotNo: 'LOT',
      itemCode: 'Mã hàng',
      qty: 'SL',
      oqc: 'OQC',
      managementCode: 'Mã quản lý xuất hàng',
    },
    oqc: {
      NOT_REQUIRED: 'Không cần kiểm tra',
      SKIPPED: 'Bỏ qua kiểm tra',
      NOT_INSPECTED: 'Chưa kiểm tra',
      ACCEPTED: 'Đạt',
      REJECTED: 'Không đạt',
      HELD: 'Tạm giữ',
    },
  },

  result: {
    title: 'Đã hoàn tất xuất hàng',
    shipmentNo: 'Số xuất hàng',
    request: 'Lệnh xuất hàng',
    completedAt: 'Thời điểm hoàn tất',
    worker: 'Công nhân',
    qty: 'SL xuất hàng',
    qtyValue: (qty: string, lineCount: number, lotCount: number, over: string | null): string =>
      `${qty}, ${String(lineCount)} dòng, ${String(lotCount)} LOT${over === null ? '' : ` (gồm vượt ${over})`}`,
    warehouses: 'Trừ tồn kho',
    warehouseValue: (name: string, qty: string): string => `${name} ${qty}`,
    cancelHint:
      'Nếu xuất nhầm, hãy trình duyệt hủy tại màn hình lịch sử xuất hàng (W-04-12) trên web quản lý.',
  },

  already: {
    title: 'Lệnh xuất hàng này đã được hoàn tất',
    body: 'Không có gì thay đổi. Hãy quét lệnh tiếp theo.',
    heading: 'Xuất hàng đã hoàn tất',
    shipmentNo: 'Số xuất hàng',
    request: 'Lệnh xuất hàng',
    completedAt: 'Hoàn tất',
    historyHint: 'Xem lịch sử và hủy tại màn hình lịch sử xuất hàng (W-04-12) trên web quản lý.',
  },

  search: {
    title: 'Tìm lệnh xuất hàng',
    close: 'Đóng',
    queryLabel: 'Từ khóa',
    queryPlaceholder: 'Một phần số lệnh, khách hàng hoặc mặt hàng (mã hoặc tên)',
    find: 'Tìm',
    readyOnly: 'Chỉ lệnh chờ hoàn tất',
    count: (total: number): string => `${String(total)} lệnh`,
    note: 'Lệnh đã hoàn tất xuất hàng không hiện ra.',
    caption: 'Danh sách lệnh xuất hàng',
    select: (requestNo: string): string => `Mở lệnh ${requestNo}`,
    ready: 'Chờ hoàn tất',
    blocked: (count: number): string => `Bị chặn ${String(count)}`,
    shipDate: 'Ngày xuất',
    customer: 'Khách hàng',
    summary: 'Nội dung',
    summaryValue: (lineCount: number, lotCount: number, picked: string, target: string): string =>
      `${String(lineCount)} dòng, ${String(lotCount)} LOT, đã lấy ${picked} / mục tiêu ${target}`,
    blockedWhy: 'Lý do chặn',
    blockerCount: {
      PICKING_SHORT: (count: number): string => `Thiếu hàng đã lấy ${String(count)} dòng`,
      NOT_INSPECTED: (count: number): string => `LOT chưa kiểm tra ${String(count)}`,
      REJECTED: (count: number): string => `LOT không đạt ${String(count)}`,
      HELD: (count: number): string => `LOT tạm giữ ${String(count)}`,
      SALES_ORDER_LINE_CANCELLED: (count: number): string =>
        `Dòng đơn bán hàng bị hủy ${String(count)}`,
    },
    loading: 'Đang tải danh sách lệnh xuất hàng.',
    emptyReady: 'Không có lệnh nào chờ hoàn tất',
    emptyReadyHint:
      'Tắt 「Chỉ lệnh chờ hoàn tất」 để xem cả các lệnh còn phải lấy hàng hoặc kiểm tra.',
    turnOffReadyOnly: 'Tắt lọc chờ hoàn tất',
    empty: 'Không có lệnh xuất hàng phù hợp',
    emptyHint: 'Hãy kiểm tra lại số lệnh, khách hàng hoặc mặt hàng.',
    failed: 'Không tải được danh sách lệnh xuất hàng. Hãy kiểm tra kết nối rồi thử lại.',
    retry: 'Thử lại',
    pageNav: 'Chuyển trang danh sách lệnh xuất hàng',
  },

  bar: {
    idle: 'Quét hoặc tìm lệnh xuất hàng để mở màn hình xác nhận.',
    ready: (qty: string, lotCount: number): string =>
      `Tổng ${qty}, ${String(lotCount)} LOT. Khi nhấn, việc trừ tồn kho và phiếu xuất kho được tạo cùng lúc.`,
    blocked: (count: number): string =>
      `Cần xử lý ${String(count)} lý do trên mới có thể hoàn tất xuất hàng.`,
    done: 'Đã hoàn tất. Hãy quét hoặc tìm lệnh tiếp theo.',
    already: 'Lệnh đã hoàn tất thì không thể hoàn tất lại.',
    workerMissing: 'Cần xác nhận mã nhân viên mới có thể hoàn tất.',
    recheck: 'Kiểm tra lại',
    close: 'Đóng',
    complete: 'Hoàn tất xuất hàng',
    completing: 'Đang hoàn tất…',
  },

  failure: {
    blocked: 'Vừa phát sinh lý do chặn hoàn tất. Hãy xem lại các lý do.',
    changed: 'Lệnh xuất hàng vừa thay đổi. Hãy kiểm tra lại rồi hoàn tất.',
    network: 'Mất kết nối nên chưa hoàn tất được. Hãy kiểm tra kết nối rồi nhấn lại.',
    other: 'Không hoàn tất được xuất hàng. Hãy nhấn [Kiểm tra lại] rồi thử lại.',
  },
};
