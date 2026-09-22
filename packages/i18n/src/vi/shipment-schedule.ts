import type { ko } from '../ko';
import type { Translated } from './translated';

/** W-04-02 출하 예정 목록. 조회 전용이라 쓰기 어휘가 하나도 없다. */
export const shipmentSchedule: Translated<typeof ko.shipmentSchedule> = {
  title: 'Danh sách kế hoạch xuất hàng',
  breadcrumbRoot: 'Xuất hàng',
  panes: {
    list: 'Danh sách kế hoạch xuất hàng',
    fulfillmentPlant: 'Chỉ định nhà máy xuất hàng',
  },
  fields: {
    period: 'Kỳ xuất hàng',
    periodSeparator: '~',
    periodFromPlaceholder: 'Chọn ngày bắt đầu',
    periodToPlaceholder: 'Chọn ngày kết thúc',
    periodFrom: 'Ngày xuất hàng từ',
    periodTo: 'Ngày xuất hàng đến',
    customer: 'Khách hàng',
    shipToPartner: 'Nơi giao hàng',
    progress: 'Trạng thái tiến độ',
    inspection: 'Trạng thái kiểm tra',
    fulfillmentPlant: 'Nhà máy phụ trách xuất hàng',
  },
  actions: {
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
    assignPlant: 'Chỉ định nhà máy',
    changePlant: 'Thay đổi',
    savePlant: 'Lưu',
  },
  reasons: {
    periodRequired: 'Ngày xuất hàng từ bắt buộc phải nhập.',
    periodInvalid:
      'Ngày xuất hàng phải là ngày có thật. Hãy chọn lại ngày bắt đầu và ngày kết thúc.',
    periodReversed: 'Ngày xuất hàng đến không được sớm hơn ngày bắt đầu.',
    referencesFailed:
      'Không tải được tên khách hàng và nơi giao hàng. Lý do sẽ hiện ở chỗ của tên.',
  },
  loading: {
    list: 'Đang tải danh sách kế hoạch xuất hàng',
    detail: 'Đang tải lệnh xuất hàng',
  },
  table: {
    requestedShipDate: 'Ngày xuất hàng',
    shipmentRequestNo: 'Số lệnh xuất hàng',
    customer: 'Khách hàng',
    shipToPartner: 'Nơi giao hàng',
    qty: 'Yêu cầu / Phân bổ / Xuất hàng',
    inspection: 'Kiểm tra',
    progress: 'Tiến độ',
    fulfillmentPlant: 'Nhà máy phụ trách xuất hàng',
  },
  progressCodes: {
    NOT_ALLOCATED: 'Chưa lập',
    PARTIALLY_ALLOCATED: 'Lập một phần',
    PICKING: 'Đang lấy hàng',
    PICKED: 'Đã lấy hàng',
    PARTIALLY_SHIPPED: 'Xuất một phần',
    SHIPPED: 'Đã xuất hàng',
  },
  values: {
    empty: '—',
    unknown: 'Không xác định',
    referenceLoading: 'Đang tải tên',
    referenceFailed: 'Không tải được tên',
    inspectionPending: 'Chờ',
    inspectionPassed: 'Đạt',
  },
  filters: {
    all: 'Tất cả',
    inspectionRequired: 'Thuộc diện',
    inspectionNotRequired: 'Không thuộc diện',
    summaryNote: 'Đang chuẩn bị phần tổng hợp.',
    lookupTruncated:
      'Chỉ hiện một phần đầu của các lựa chọn. Nếu không có giá trị cần tìm, hãy báo người phụ trách.',
    lookupFailed: 'Không tải được các lựa chọn.',
    chipCustomer: (value: string): string => `Khách hàng: ${value}`,
    chipShipToPartner: (value: string): string => `Nơi giao hàng: ${value}`,
    chipProgress: (value: string): string => `Tiến độ: ${value}`,
    chipInspection: (value: string): string => `Kiểm tra: ${value}`,
    chipRemoveCustomer: 'Bỏ điều kiện khách hàng',
    chipRemoveShipToPartner: 'Bỏ điều kiện nơi giao hàng',
    chipRemoveProgress: 'Bỏ điều kiện tiến độ',
    chipRemoveInspection: 'Bỏ điều kiện kiểm tra',
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)} mục`,
    totalOnly: (total: number): string => `Tổng ${String(total)} mục`,
  },
  empty: {
    noResultTitle: 'Không có kế hoạch xuất hàng nào khớp điều kiện',
    noResultDescription: 'Hãy mở rộng khoảng thời gian hoặc bớt điều kiện rồi tra cứu lại.',
    notQueriedTitle: 'Hãy nhập điều kiện tra cứu',
    notQueriedDescription: 'Nhập ngày xuất hàng rồi tra cứu thì kết quả sẽ hiển thị.',
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Hãy về trang đầu.',
  },
  notes: {
    sortScope: 'Sắp xếp theo toàn bộ kết quả tìm kiếm.',
  },
};
