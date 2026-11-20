/** P-04-07 출하 완료(POP · 피처 010). 용어는 GLOSSARY.md 의 출하 묶음을 따른다. */
export const popShipmentComplete = {
  title: 'Hoàn tất xuất hàng',

  scan: {
    label: 'Tra cứu lệnh xuất hàng',
    manualLabel: 'Số lệnh xuất hàng',
    search: 'Tìm lệnh xuất hàng',
    looking: 'Đang mở lệnh xuất hàng.',
    notCode: (value: string): string =>
      `Đây không phải mã lệnh xuất hàng. Giá trị đã đọc: ${value}. Hãy quét QR của lệnh, không phải nhãn LOT.`,
    notFound: (value: string): string => `Không tìm thấy lệnh xuất hàng. Giá trị đã đọc: ${value}`,
    failed: 'Không mở được lệnh xuất hàng. Hãy kiểm tra kết nối rồi quét lại.',
    directNotFound: (value: string): string =>
      `Không tìm thấy lệnh xuất hàng. Giá trị đã nhập: ${value}. Hãy kiểm tra số lệnh (SR-…).`,
    previousStill: (requestNo: string): string =>
      `Màn hình bên dưới là lệnh ${requestNo} đã mở trước đó.`,
  },

  head: {
    request: 'Lệnh xuất hàng',
    customer: 'Khách hàng',
    shipTo: 'Nơi giao hàng',
    salesOrder: 'Đơn bán hàng',
    noSalesOrder: 'Không có (lập không theo đơn bán hàng)',
    status: 'Tình trạng xuất hàng',
    ready: 'Có thể xuất hàng',
    blocked: 'Không thể xuất hàng',
    named: (name: string, code: string): string => `${name} (${code})`,
    band: 'Thông tin lệnh xuất hàng',
    none: '-',
  },

  blockers: {
    heading: 'Không thể xuất hàng',
    PICKING_SHORT: {
      title: 'Số lượng đã lấy chưa đủ',
      hint: 'Hãy kiểm tra LOT xuất hàng tại màn hình lấy hàng thành phẩm trên PDA.',
    },
    noPickedLot: {
      title: 'Chưa có LOT xuất hàng nào được lấy',
      hint: 'Hãy kiểm tra LOT xuất hàng tại màn hình lấy hàng thành phẩm trên PDA.',
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
      `Dòng ${String(lineNo)} ${itemCode}, SL đã lấy ${picked} / SL chỉ thị ${target}`,
    lineOnly: (lineNo: number): string => `Dòng ${String(lineNo)}`,
  },

  lines: {
    heading: 'Mặt hàng xuất',
    caption: 'SL chỉ thị và SL đã lấy theo mặt hàng xuất',
    columns: {
      lineNo: 'Dòng',
      item: 'Mặt hàng',
      target: 'SL chỉ thị',
      picked: 'SL đã lấy',
      over: 'SL vượt',
      lotCount: 'Số LOT',
    },
    matched: 'Bằng SL chỉ thị',
  },

  warehouses: {
    heading: 'Kho sẽ bị trừ tồn',
    splitLot: (lotNo: string): string => `${lotNo} nằm ở hai kho nên được tính ở cả hai kho.`,
  },

  lots: {
    title: 'LOT đã lấy',
    empty: 'Chưa có LOT nào được lấy.',
    none: '-',
    replaced: (count: number, lots: string): string =>
      `${String(count)} LOT bị loại do thay thế: ${lots}. Không tính vào lô xuất hàng.`,
    replacedLot: (lotNo: string, judgment: string | null): string =>
      judgment === null ? lotNo : `${lotNo} (${judgment})`,
    caption: 'LOT đã lấy và phán định OQC',
    columns: {
      lotNo: 'Số LOT',
      qty: 'SL',
      oqc: 'Phán định OQC',
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
    completedBy: 'Thiết bị và công nhân',
    who: (terminalCode: string, workerName: string, workerNo: string): string =>
      `${terminalCode}, ${workerName} (${workerNo})`,
    qty: 'SL xuất hàng',
    qtyValue: (qty: string, lineCount: number, lotCount: number, over: string | null): string =>
      `${qty}, ${String(lineCount)} dòng, ${String(lotCount)} LOT${over === null ? '' : ` (gồm vượt ${over})`}`,
    warehouses: 'Trừ tồn kho',
    warehouseValue: (name: string, qty: string): string => `${name} ${qty}`,
  },

  already: {
    title: 'Lệnh xuất hàng này đã được hoàn tất',
    heading: 'Xuất hàng đã hoàn tất',
    shipmentNo: 'Số xuất hàng',
    request: 'Lệnh xuất hàng',
    completedAt: 'Hoàn tất',
  },

  search: {
    title: 'Tìm lệnh xuất hàng',
    close: 'Đóng',
    queryLabel: 'Từ khóa',

    queryHeading: 'Số lệnh, tên khách hàng, tên hoặc mã hàng',
    readyOnly: 'Chỉ hiện lệnh có thể xuất hàng',
    caption: 'Danh sách lệnh xuất hàng',
    select: (requestNo: string): string => `Tra cứu lệnh ${requestNo}`,
    ready: 'Có thể xuất hàng',
    blocked: 'Không thể xuất hàng',
    shipDate: 'Ngày xuất',
    customer: 'Khách hàng',
    summary: 'Nội dung',
    items: 'Mặt hàng',
    itemsValue: (code: string, name: string, more: number): string =>
      more > 0 ? `${code} ${name} và ${String(more)} mặt hàng khác` : `${code} ${name}`,
    summaryValue: (lineCount: number, lotCount: number, picked: string, target: string): string =>
      `${String(lineCount)} dòng, ${String(lotCount)} LOT, SL đã lấy ${picked} / SL chỉ thị ${target}`,
    blockedWhy: 'Lý do không thể xuất hàng',
    noPickedLot: 'Chưa có LOT xuất hàng được lấy',
    blockerCount: {
      PICKING_SHORT: (count: number): string => `Thiếu SL đã lấy ${String(count)} dòng`,
      NOT_INSPECTED: (count: number): string => `LOT chưa kiểm tra ${String(count)}`,
      REJECTED: (count: number): string => `LOT không đạt ${String(count)}`,
      HELD: (count: number): string => `LOT tạm giữ ${String(count)}`,
      SALES_ORDER_LINE_CANCELLED: (count: number): string =>
        `Dòng đơn bán hàng bị hủy ${String(count)}`,
    },
    loading: 'Đang tải danh sách lệnh xuất hàng.',
    empty: 'Không có lệnh xuất hàng phù hợp với điều kiện.',
    emptyHintFiltered: 'Hãy đổi từ khóa hoặc bỏ bộ lọc.',
    emptyHint: 'Hãy đổi từ khóa.',
    failed: 'Không tải được danh sách lệnh xuất hàng. Hãy kiểm tra kết nối rồi thử lại.',
    retry: 'Thử lại',
    pageNav: 'Chuyển trang danh sách lệnh xuất hàng',
  },

  bar: {
    label: 'Thao tác hoàn tất xuất hàng',
    complete: 'Hoàn tất xuất hàng',
    completing: 'Đang hoàn tất…',
  },

  failure: {
    /* 409 ALREADY_COMPLETED 인데 다시 읽어도 완료되지 않은 지시서(검증 1회차 F-3) — 아무 말 없이 두지 않는다. */
    alreadyNotDone:
      'Máy chủ từ chối vì «đã hoàn tất xuất hàng» nhưng lệnh này vẫn chưa hoàn tất. Hãy nhấn [Làm mới] ở trên cùng, nếu vẫn không được hãy báo người phụ trách.',
    /* 서버 문구를 함께 보인다 — 작업자가 담당자에게 그대로 전할 수 있게. */
    withMessage: (base: string, message: string): string => `${base} (Máy chủ: ${message})`,
    blocked: 'Vừa phát sinh lý do không thể xuất hàng. Hãy xem lại các lý do.',
    changed: 'Lệnh xuất hàng vừa thay đổi. Hãy nhấn [Làm mới] ở trên cùng rồi hoàn tất.',
    network: 'Mất kết nối nên chưa hoàn tất được. Hãy kiểm tra kết nối rồi nhấn lại.',
    other: 'Không hoàn tất được xuất hàng. Hãy nhấn [Làm mới] ở trên cùng rồi thử lại.',
  },
};
