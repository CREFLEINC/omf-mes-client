/** P-04-08 Tách LOT sản xuất (POP · tính năng 013). Thuật ngữ theo GLOSSARY.md. */
export const productLotSplit = {
  title: 'Tách LOT sản xuất',

  work: {
    title: 'Tách LOT',
    scanLabel: 'Nhãn LOT sản xuất',
    manualLabel: 'Số LOT',
    looking: 'Đang tìm LOT.',
    notFound: (lotNo: string) => `Không có LOT 「${lotNo}」 tại nhà máy này. Hãy kiểm tra nhãn.`,
    lookupFailed: 'Không đọc được LOT. Hãy kiểm tra kết nối rồi quét lại.',
    idleHint: 'Quét nhãn LOT sản xuất rồi nhập vị trí và số lượng.',
  },

  lot: {
    label: 'LOT đã quét',
    item: 'Mã hàng',
    lotNo: 'LOT',
    status: 'Trạng thái',
    workOrder: 'W/O',
    labelQty: 'Số lượng LOT',
    statuses: {
      INSPECTION_PENDING: 'Chờ kiểm tra',
      HOLD: 'Tạm giữ',
      DEFECTIVE: 'Lỗi',
      SCRAPPED: 'Hủy',
      VOIDED: 'Vô hiệu',
    } as Record<string, string | undefined>,
    queued: 'Chờ xác nhận',
  },

  location: {
    label: 'Vị trí tách',
    tile: (warehouseCode: string, qty: string) => `Kho ${warehouseCode} ${qty}`,
    many: (count: number, total: string) =>
      `LOT này nằm ở ${String(count)} vị trí do chuyển kho. Chọn vị trí sẽ tách hàng thực tế. Nhãn LOT gốc in số lượng của cả LOT (${total} trừ số lượng tách).`,
    blocked: {
      PUTAWAY_PENDING: 'Chờ xếp kệ',
      NOT_PRODUCT_WAREHOUSE: 'Không phải kho thành phẩm',
      MIXED_STOCK_STATUS: 'Lẫn trạng thái',
    } as Record<string, string | undefined>,
    none: 'Không có vị trí tách được. Hãy kiểm tra LOT có nằm trong kho thành phẩm không.',
  },

  qty: {
    label: 'Số lượng tách (LOT mới)',
    badTitle: 'Kiểm tra lại số lượng',
    bad: (max: string) => `Nhập từ 1 và nhỏ hơn số lượng tại vị trí này (${max}).`,
    badInteger: 'Đơn vị này chỉ nhận số nguyên.',
  },

  preview: {
    label: 'Sau khi tách',
    parent: 'Còn lại ở LOT gốc',
    child: 'LOT mới',
    childNo: 'Số LOT được gán khi tách',
  },

  blocked: {
    NOT_PRODUCTION_LOT: {
      title: 'Chỉ tách được LOT sản xuất',
      body: 'Không tách LOT vật tư tại màn hình này. Hãy quét nhãn LOT sản xuất trong kho thành phẩm.',
    },
    SPLIT_SERIAL_LOT: {
      title: 'Không tách được mặt hàng quản lý theo serial',
      body: 'Serial gắn với LOT nên tách sẽ làm sai tra cứu serial. Hãy xuất nguyên LOT.',
    },
    INVALID_STATE: {
      title: (state: string) => `Trạng thái không tách được (${state})`,
      titleNoState: 'Trạng thái không tách được',
      body: 'Không tách được LOT tạm giữ, lỗi, hủy, vô hiệu. Hãy quét lại sau khi xử lý chất lượng xong.',
    },
    LOT_SPLIT_UNCONFIRMED: {
      title: 'Hãy xác nhận tách trước',
      body: (at: string) =>
        `LOT này đã tách lúc ${at} nhưng chưa xác nhận trên PDA 「Xác nhận tách LOT」. Có thể in lại nhãn trong danh sách chờ xác nhận.`,
      bodyNoTime:
        'LOT này đã tách nhưng chưa xác nhận trên PDA 「Xác nhận tách LOT」. Có thể in lại nhãn trong danh sách chờ xác nhận.',
    },
    LOT_ALREADY_RESERVED: {
      title: 'Không thể tách. LOT đang được giữ cho công việc khác',
      body: (requestNo: string) =>
        `Có phần đã lấy cho lệnh xuất hàng ${requestNo}. Hãy bỏ lấy hàng hoặc chờ xuất xong rồi quét lại.`,
      bodyNoRequest:
        'Có phần đang được giữ hoặc đã lấy hàng. Hãy gỡ hoặc hoàn tất công việc đó rồi quét lại.',
    },
    PUTAWAY_PENDING: {
      title: 'Hãy hoàn tất xếp kệ trước',
      body: 'Hàng đang ở chỗ chờ xếp kệ hoặc có lệnh xếp kệ đang mở từ chỗ này. Hãy xếp kệ xong rồi tách.',
    },
    NOT_PRODUCT_WAREHOUSE: {
      title: 'Không phải vị trí kho thành phẩm',
      body: 'Chỉ tách được phần nằm trong kho thành phẩm (trừ kho hàng lỗi).',
    },
    MIXED_STOCK_STATUS: {
      title: 'Vị trí có trạng thái tồn kho lẫn nhau',
      body: 'Vị trí này có tồn kho khác trạng thái nên không tách được. Hãy báo quản lý.',
    },
    unknown: {
      title: 'Không tách được',
      body: 'Hãy quét lại để kiểm tra trạng thái.',
    },
    states: {
      HOLD: 'Tạm giữ',
      DEFECTIVE: 'Lỗi',
      SCRAPPED: 'Hủy',
      VOIDED: 'Vô hiệu',
    } as Record<string, string | undefined>,
  },

  queue: {
    title: 'Chờ xác nhận',
    hint: 'Quét hai nhãn trên PDA 「Xác nhận tách LOT」 thì mục sẽ biến mất.',
    label: 'Lần tách chờ xác nhận',
    cols: {
      lots: 'LOT gốc, LOT mới',
      qty: 'SL (còn/mới)',
      location: 'Vị trí',
      splitAt: 'Thời điểm tách',
      label: 'Nhãn',
    },
    choose: (lotNo: string) => `Chọn lần tách ${lotNo}`,
    newTag: 'Mới',
    parentChip: (outcome: string) => `Gốc ${outcome}`,
    childChip: (outcome: string) => `Mới ${outcome}`,
    printed: 'Đã in',
    failed: 'In lỗi',
    notPrinted: 'Chưa in',
    emptyTitle: 'Không có lần tách chờ xác nhận',
    emptyBody: 'LOT đã tách nằm ở đây đến khi xác nhận trên PDA.',
    loadFailedTitle: 'Không đọc được danh sách chờ xác nhận',
    loadFailedBody: 'Hãy kiểm tra kết nối rồi đọc lại.',
    retry: 'Đọc lại',
  },

  bar: {
    label: 'Thao tác tách',
    split: 'Tách và in 2 nhãn',
    reprint: 'In lại 2 nhãn của lần tách đã chọn',
    splitting: 'Đang tách',
  },

  dialog: {
    splitTitle: '2 nhãn — dán lại nhãn LOT gốc với số lượng mới',
    reprintTitle: 'Lý do in lại',
    parentCaption: (seq: number) => `LOT gốc in lại #${String(seq)} (lý do 「Tách LOT」 tự động)`,
    parentFirstCaption: (seq: number) => `LOT gốc in lần đầu #${String(seq)}`,
    childCaption: (seq: number) => `LOT mới in lần đầu #${String(seq)}`,
    parentReprint: 'In lại LOT gốc',
    childReprint: 'In lại LOT mới',
    oldLabel: (qty: string) => `Bỏ nhãn cũ (SL ${qty}) trên thùng gốc.`,
    close: 'Đóng',
    print: 'In 2 nhãn',
    reasonLabel: 'Lý do',
    reasonNeed: 'Hãy chọn lý do',
    labelName: (lotNo: string) => `Nhãn ${lotNo}`,
    workOrderLoading: 'Đang đọc W/O.',
  },

  result: {
    split: (childLotNo: string) => `Đã tách. LOT mới ${childLotNo}`,
    printedTitle: 'Đã in 2 nhãn',
    printedBody:
      'Tách hàng thực tế, dán nhãn rồi quét hai nhãn trên PDA 「Xác nhận tách LOT」. Trước khi xác nhận, cả hai LOT đều không lấy hàng xuất được.',
    reprinted: 'Đã in lại 2 nhãn',
    failedTitle: (count: number, which: string) => `Không in được ${String(count)} nhãn (${which})`,
    failedBody: 'Đã tách xong. Chọn lần tách trong danh sách chờ xác nhận để in lại.',
    whichParent: 'nhãn LOT gốc',
    whichChild: 'nhãn LOT mới',
    whichBoth: 'hai nhãn',
    shellUnavailable: 'Thiết bị này không in được. Hãy in lại trong danh sách chờ xác nhận.',
    reportFailed: 'Nhãn đã in nhưng chưa gửi được kết quả in. Hãy kiểm tra kết nối.',
    notPrinted:
      'Đã tách xong nhưng chưa in nhãn. Chọn lần tách trong danh sách chờ xác nhận để in.',
    splitFailed: 'Không tách được. Hãy kiểm tra kết nối rồi nhấn lại.',
    reprintFailed: 'Không phát hành lại được nhãn. Hãy kiểm tra kết nối rồi nhấn lại.',
    forbidden: 'Thiết bị này không có quyền in nhãn. Hãy báo quản lý.',
  },
};
