import type { ko } from '../ko';
import type { Translated } from './translated';

/** W-04-06 반품·클레임 입고 등록. 이 화면은 입고만 한다 — 판정은 다른 화면 몫이다. */
export const returnReceipt: Translated<typeof ko.returnReceipt> = {
  title: 'Đăng ký nhập kho hàng trả và khiếu nại',
  breadcrumbRoot: 'Xuất hàng',
  scopeNotice:
    'Hàng trả và khiếu nại của lô xuất hàng đã xác nhận được nhập kho ở đây. Hàng trả vào ở trạng thái tạm giữ (Hold), còn đánh giá làm lại hoặc hủy thì làm ở màn hình yêu cầu đánh giá.',
  panes: {
    search: '① Tìm lô xuất hàng gốc',
    receipt: '② Nhập kho hàng trả',
    lines: 'Dòng hàng trả',
    outcome: 'Kết quả đăng ký',
  },
  fields: {
    customer: 'Khách hàng',
    shipDate: 'Ngày xuất hàng',
    keyword: 'Từ khóa',
    shipmentNo: 'Số xuất hàng',
    shippedAt: 'Ngày xuất hàng',
    status: 'Trạng thái',
    items: 'Mặt hàng',
    lots: 'LOT gốc',
    item: 'Mặt hàng',
    lotNo: 'LOT gốc',
    shippedQty: 'Xuất hàng',
    returnQty: 'Trả hàng',
    uom: 'Đơn vị',
    reason: 'Lý do trả hàng',
    remarks: 'Ghi chú',
    warehouse: 'Kho nhập',
    location: 'Vị trí nhập',
    qualityStatus: 'Trạng thái chất lượng',
    receiptNo: 'Số nhập kho',
    source: 'Nguồn gốc',
  },
  all: 'Tất cả',
  keywordPlaceholder: 'Số xuất hàng hoặc số LOT',
  codePlaceholder: 'Đang chuẩn bị giá trị gốc',
  codePending: 'Giá trị gốc để chọn vẫn chưa được chuẩn bị',
  lookupLoading: 'Đang tải danh sách',
  lookupFailed: 'Không tải được danh sách',
  lookupTruncated: 'Danh sách đã bị cắt bớt. Nếu không có giá trị cần tìm, hãy thu hẹp từ khóa',
  values: {
    notAvailable: '—',
    unknownLots: 'Chọn rồi thì LOT sẽ hiện',
  },
  search: {
    periodRequired: 'Khoảng ngày xuất hàng không được để trống',
    periodReversed: 'Ngày bắt đầu muộn hơn ngày kết thúc',
    empty: 'Không có lô xuất hàng nào khớp điều kiện',
    emptyDescription:
      'Hãy mở rộng khoảng thời gian hoặc đổi từ khóa. Nếu không tìm được lô xuất hàng gốc thì nhập tay ở bên dưới.',
    beyondLast: 'Trang này trống. Hãy quay về trang đầu.',
    loading: 'Đang tải các lô xuất hàng',
    notFoundHint: 'Nếu không tìm được lô xuất hàng gốc thì nhập tay ở bên dưới.',
    lotCount: (count: number): string => `${String(count)} LOT`,
  },
  actions: {
    search: 'Tra cứu',
    reset: 'Đặt lại',
    selectRow: (shipmentNo: string): string => `Chọn ${shipmentNo}`,
    prevPage: 'Trước',
    nextPage: 'Sau',
    firstPage: 'Về trang đầu',
    withoutShipment: 'Đăng ký không cần lô xuất hàng gốc',
    backToSearch: 'Về tìm lô xuất hàng gốc',
    findLot: 'Tìm LOT',
    removeLine: (lotNo: string): string => `Xóa dòng ${lotNo}`,
    submit: 'Đăng ký nhập kho hàng trả',
    cancel: 'Hủy',
    checkOutcome: 'Kiểm tra kết quả',
    openDisposition: 'Sang yêu cầu đánh giá',
    registerAnother: 'Đăng ký hàng trả khác',
  },
  target: {
    none: 'Hãy chọn lô xuất hàng gốc ở bên trái hoặc bấm «Đăng ký không cần lô xuất hàng gốc»',
    shipment: (shipmentNo: string): string => `Lô xuất hàng gốc ${shipmentNo}`,
    direct: 'Đăng ký không cần lô xuất hàng gốc — thêm dòng bằng số LOT',
    detailLoading: 'Đang tải LOT của lô xuất hàng gốc',
    noAllocations:
      'Lô xuất hàng này không có LOT nào được phân bổ. Hãy đăng ký không cần lô xuất hàng gốc.',
  },
  sourceFixed:
    'Nguồn gốc được cố định là khiếu nại của khách hàng. Loại nhập kho là nhập kho hàng trả.',
  lot: {
    label: 'Số LOT',
    placeholder: 'Nhập chính xác số LOT',
    notFound: (lotNo: string): string => `Không tìm thấy LOT ${lotNo}. Hãy kiểm tra lại số.`,
    alreadyAdded: (lotNo: string): string => `LOT ${lotNo} đã có trong các dòng rồi.`,
    searching: 'Đang tìm LOT',
    searchFailed: 'Không tìm được LOT. Hãy thử lại sau giây lát.',
    help: 'Vì không biết số lượng của lô xuất hàng gốc nên số lượng trả hàng không có giới hạn trên.',
  },
  lines: {
    empty: 'Không có LOT nào để trả hàng',
    qtyPlaceholder: '0 là loại trừ',
    qtyNotNumber: 'Hãy nhập bằng số',
    qtyTooSmall: 'Hãy nhập từ 1 trở lên',
    qtyExceeds: (max: string): string => `Không được vượt quá số lượng xuất hàng ${max}`,
    noneEntered: 'Hãy nhập số lượng trả hàng cho ít nhất một dòng',
    partialNote:
      'Chia nhỏ để trả cùng một LOT cũng được. Những dòng bỏ trống hoặc để 0 số lượng trả hàng sẽ không được gửi.',
  },
  form: {
    reasonPlaceholder: 'Không chọn',
    reasonHelp: 'Chỉ chọn lý do trả hàng thuần túy. Giá trị lấy từ mã chung.',
    remarksHelp: 'Ghi lại nội dung và tình trạng khách hàng nói sẽ giúp ích cho việc đánh giá.',
    warehouseHelp: 'Hàng trả được ưu tiên nhập vào kho hàng lỗi.',
    warehouseNotDefect:
      'Đây không phải kho hàng lỗi. Tồn kho chưa đánh giá sẽ lẫn vào kho thường — dù vậy vẫn đăng ký được.',
    locationRequired: 'Hãy chỉ định vị trí nhập',
    locationLocked: 'Chọn kho nhập rồi mới chọn được vị trí nhập',
    locationEmpty: 'Kho này chưa đăng ký vị trí nào',
    qualityFixed: 'Cố định tạm giữ (Hold) — chưa đánh giá',
    qualityFixedNote:
      'LOT hàng trả bị chặn xuất hàng và lấy hàng cho tới khi việc đánh giá kết thúc.',
    effectTitle: 'Việc đăng ký này làm gì',
    effectStock: (qty: string, uom: string, warehouse: string): string =>
      `Tồn kho ${warehouse} tăng thêm ${qty} ${uom}`.replace(/\s+/g, ' '),
    effectStockUnknown: 'Nhập số lượng trả hàng thì sẽ hiện phần tồn kho sẽ tăng',
    effectHold: 'Lot Status vào ở trạng thái tạm giữ (Hold) — xuất hàng và lấy hàng bị chặn',
    effectDisposition: 'Đánh giá làm lại hoặc hủy thì làm ở màn hình yêu cầu đánh giá',
    irreversible: 'Việc nhập kho đã đăng ký không hoàn tác được ở màn hình này.',
    success: 'Đã đăng ký nhập kho hàng trả',
  },
  lock: {
    noLines: 'Đăng ký nhập kho hàng trả cần có dòng LOT để trả hàng mới làm được.',
    noQty:
      'Đăng ký nhập kho hàng trả cần nhập số lượng trả hàng cho ít nhất một dòng mới làm được.',
    lineErrors: 'Đăng ký nhập kho hàng trả cần sửa xong lỗi số lượng mới làm được.',
    noLocation: 'Đăng ký nhập kho hàng trả cần chỉ định vị trí nhập mới làm được.',
    saving: 'Đang đăng ký nhập kho hàng trả.',
    uncertain:
      'Vẫn chưa biết kết quả của lần đăng ký trước. Hãy đọc lại bằng «Kiểm tra kết quả» rồi làm tiếp — bấm lại luôn thì có thể vào hai lần.',
  },
  outcome: {
    title: 'Nhập kho hàng trả đã đăng ký',
    receiptNo: 'Số nhập kho',
    lines: (count: number): string => `${String(count)} dòng`,
    next: 'Tiếp theo — đăng ký điểm không phù hợp và yêu cầu đánh giá ở màn hình yêu cầu đánh giá.',
  },
  page: {
    total: (total: number): string => `Tổng ${String(total)} mục`,
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / ${String(total)} mục`,
  },
};
