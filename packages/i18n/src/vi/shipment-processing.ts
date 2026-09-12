import type { ko } from '../ko';
import type { Translated } from './translated';

/** W-04-04 출하 처리(상차·실물 출고). 관문을 다 지나야 처리하고, 확정은 다른 화면 몫이다. */
export const shipmentProcessing: Translated<typeof ko.shipmentProcessing> = {
  title: 'Xử lý xuất hàng (lên xe và xuất kho thực tế)',
  breadcrumbRoot: 'Xuất hàng',
  panes: {
    list: 'Danh sách lệnh xuất hàng chờ xác nhận',
    lines: 'Nội dung xuất hàng',
    loadingInfo: 'Thông tin lên xe',
    outcome: 'Điều xảy ra khi xác nhận',
    gate: 'Cổng kiểm xử lý',
  },
  filter: {
    shipDateFrom: 'Ngày xuất hàng từ',
    shipDateTo: 'Ngày xuất hàng đến',
    pickingCompleteOnly: 'Chỉ đã lấy hàng xong',
    pickingCompleteOnlyNote:
      'Áp dụng cho toàn bộ kết quả, dựa trên trạng thái tiến độ xuất hàng do máy chủ tính.',
    search: 'Tra cứu',
    reset: 'Đặt lại',
    shipDateFromRequired: 'Ngày xuất hàng từ là bắt buộc.',
    dateRange: 'Ngày xuất hàng đến không được sớm hơn ngày bắt đầu.',
  },
  list: {
    pane: 'Danh sách lệnh xuất hàng chờ xác nhận',
    fields: {
      shipmentRequestNo: 'Số lệnh xuất hàng',
      customer: 'Khách hàng',
      requestedShipDate: 'Ngày xuất hàng',
      status: 'Trạng thái tiến độ',
      gate: 'Có xử lý được không',
    },
    values: {
      missingCustomer: 'Không có thông tin khách hàng',
      ready: 'Xử lý được',
    },
    blockers: {
      LINES_UNAVAILABLE: 'Không có thông tin dòng',
      PICKING_INCOMPLETE: 'Chưa lấy hàng xong',
      INSPECTION_NOT_PASSED: 'Chưa kiểm tra xuất hàng xong',
    },
    progressCodes: {
      NOT_ALLOCATED: 'Chưa lập lệnh',
      PARTIALLY_ALLOCATED: 'Lập lệnh một phần',
      PICKING: 'Đang lấy hàng',
      PICKED: 'Lấy hàng xong',
      PARTIALLY_SHIPPED: 'Xuất hàng một phần',
      SHIPPED: 'Xuất hàng xong',
    },
    empty: {
      title: 'Không có kết quả tra cứu.',
      description: 'Hãy kiểm tra ngày xuất hàng rồi tra cứu lại.',
      beyondTitle: 'Trang này không có kết quả.',
      beyondDescription: 'Hãy kiểm tra số trang.',
    },
    loading: 'Đang tải danh sách.',
    actions: {
      select: (shipmentRequestNo: string) => `Chọn ${shipmentRequestNo}`,
    },
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number) =>
      `${String(start)}–${String(end)} / Tổng ${String(total)} mục`,
    totalOnly: (total: number) => `Tổng ${String(total)} mục`,
    actions: {
      prevPage: 'Trang trước',
      nextPage: 'Trang sau',
    },
  },
  detail: {
    selection: {
      title: 'Hãy chọn lệnh xuất hàng.',
      description:
        'Chọn lệnh xuất hàng ở danh sách bên trái thì sẽ nhập được nội dung xử lý xuất hàng.',
    },
    unavailable: 'Không tải được thông tin chi tiết.',
  },
  gate: {
    complete: 'Đã qua tất cả các cổng kiểm.',
    checking: 'Đang kiểm tra các cổng kiểm.',
    blockers: {
      LINES_UNAVAILABLE:
        'Không tải được thông tin dòng nên không đánh giá được là có xử lý được hay không.',
      PICKING_INCOMPLETE:
        'Chưa lấy hàng xong nên không xử lý xuất hàng được. Hãy hoàn tất việc lấy hàng cho mọi dòng.',
      INSPECTION_NOT_PASSED:
        'Chưa kiểm tra xuất hàng xong nên không xử lý xuất hàng được. Hãy kiểm tra kết quả kiểm tra.',
      ALLOCATION_UNBALANCED:
        'Phân bổ LOT trong nội dung xuất hàng không khớp nên không xử lý xuất hàng được. Hãy khớp số lượng xuất hàng của từng dòng với tổng phân bổ LOT.',
      WAREHOUSE_UNRESOLVED: 'Không xác định được kho xuất hàng nên không xử lý xuất hàng được.',
    },
  },
  lines: {
    fields: {
      line: 'Dòng',
      item: 'Mặt hàng',
      requestedQty: 'Yêu cầu',
      allocatedQty: 'Phân bổ',
      pickedQty: 'Lấy hàng',
      shippedQty: 'Số lượng xuất hàng',
      lot: 'LOT',
      qty: 'Số lượng',
      manage: 'Quản lý',
    },
    values: {
      itemLabel: (itemId: number) => `ID mặt hàng ${String(itemId)}`,
      noAllocations: 'Chưa chọn LOT nào.',
      heldSuffix: ' (tạm giữ — không chọn được)',
    },
    actions: {
      addLot: 'Thêm LOT',
      removeLot: 'Xóa phân bổ LOT này',
    },
    issues: {
      SHIPPED_QTY_INVALID: 'Hãy nhập số lượng xuất hàng.',
      NO_ALLOCATIONS: 'Hãy chọn ít nhất một LOT.',
      LOT_NOT_SELECTED: 'Có LOT chưa được chọn.',
      ALLOCATION_QTY_INVALID: 'Hãy nhập số lượng cho từng LOT.',
      DUPLICATE_LOT: 'Không được chọn cùng một LOT từ hai lần trở lên.',
      SUM_MISMATCH: 'Số lượng xuất hàng khác với tổng phân bổ LOT.',
    },
    lotSelectPlaceholder: 'Chọn LOT',
    lotUnavailable: 'Không tải được các LOT ứng viên của mặt hàng này.',
    lotTruncated: 'Mặt hàng này có nhiều LOT ứng viên nên chỉ hiện một phần.',
    lotLoading: 'Đang tải các LOT ứng viên.',
  },
  loadingInfo: {
    fields: {
      vehicleNo: 'Biển số xe',
      driverName: 'Tên tài xế',
      sealNo: 'Số niêm phong',
      transportDocumentNo: 'Số vận đơn',
      loadingWorker: 'Người phụ trách lên xe',
      carrier: 'Hãng vận chuyển',
      warehouse: 'Kho xuất hàng',
    },
    unselected: '(Chưa chỉ định)',
    warehouse: {
      resolved: (label: string) => `${label} — chỉ có một kho đang hoạt động nên đã tự chọn.`,
      none: 'Không có kho nào đang hoạt động nên không xử lý xuất hàng được. Hãy đăng ký kho ở dữ liệu gốc.',
      ambiguous:
        'Có nhiều kho đang hoạt động. Đặc tả không nói kho xuất hàng lấy từ đâu nên tạm để chọn tay — cần xác nhận thiết kế.',
      loadFailed: 'Không tải được danh sách kho.',
      loading: 'Đang tải danh sách kho.',
    },
    lookupFailed: {
      workers: 'Không tải được danh sách người phụ trách lên xe.',
      carriers: 'Không tải được danh sách hãng vận chuyển.',
    },
  },
  outcome: {
    inventory:
      'Tồn kho bị trừ ngay đúng bằng phần phân bổ LOT của nội dung xuất hàng này, và genealogy của LOT đó kết thúc.',
    unconfirmed:
      'Việc xử lý này đưa lô xuất hàng về trạng thái chưa xác nhận — màn hình này không xác nhận, việc xác nhận và hủy làm ở màn hình riêng.',
    irreversible: 'Không hoàn tác được.',
  },
  confirm: {
    title: (shipmentRequestNo: string) => `Xử lý xuất hàng ${shipmentRequestNo}`,
    target: (shipmentRequestNo: string) => `Sẽ xử lý xuất hàng cho ${shipmentRequestNo}.`,
    irreversible:
      'Việc xử lý này không hoàn tác được — tồn kho bị trừ ngay và genealogy của LOT kết thúc.',
    unconfirmedNote:
      'Sau khi xử lý, lô xuất hàng vẫn ở trạng thái chưa xác nhận. Việc xác nhận làm ở màn hình riêng.',
    cancel: 'Hủy',
    confirm: 'Xử lý xuất hàng',
  },
  submit: 'Xử lý xuất hàng',
  processedToast: 'Đã tạo lô xuất hàng ở trạng thái chưa xác nhận.',
};
