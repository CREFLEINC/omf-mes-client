import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-02-01 P/O 수신·조회. ERP 가 내려 준 생산 P/O 를 **읽기만** 하는 화면이다.
 *
 * ⚠ **고칠 수 없다는 사실을 문구가 진다.** 화면에 수정 컨트롤이 없으므로, 왜 없는지와 어디서
 * 고치는지를 `values.erpReadOnlyNotice` 가 대신 말한다.
 */
export const productionOrder: Translated<typeof ko.productionOrder> = {
  title: 'Nhận · tra cứu P/O',
  breadcrumbRoot: 'Sản xuất',
  fields: {
    productionOrderNo: 'Số P/O',
    erpProductionOrderNo: 'Số gốc ERP',
    item: 'Mặt hàng',
    orderedQty: 'Số lượng đặt · đơn vị',
    dueDate: 'Ngày giao',
    workOrderProgress: 'Triển khai / kế hoạch W/O',
    statusCode: 'Trạng thái',
    plant: 'Nhà máy',
    businessUnit: 'Đơn vị kinh doanh',
    dueFrom: 'Ngày giao từ',
    dueTo: 'Ngày giao đến',
    status: 'Trạng thái',
    q: 'Tìm kiếm',
    remarks: 'Ghi chú',
  },
  panes: {
    filters: 'Điều kiện tra cứu P/O sản xuất',
    list: 'Danh sách P/O sản xuất',
    basic: 'Chi tiết cơ bản P/O sản xuất',
    plans: 'Chi tiết kế hoạch P/O sản xuất',
    workOrders: 'Chi tiết triển khai P/O sản xuất',
  },
  actions: {
    select: (orderNo: string) => `Chọn ${orderNo}`,
    expand: (orderNo: string) => `Mở P/O con của ${orderNo}`,
    collapse: (orderNo: string) => `Thu P/O con của ${orderNo}`,
    firstPage: 'Về trang đầu',
    prevPage: 'Trước',
    nextPage: 'Sau',
    integrationSync: 'Đến tình trạng liên kết',
    productionPlan: 'Triển khai · lập W/O',
  },
  values: {
    erpReadOnlyNotice: 'Đây là bản nhận từ ERP. Hãy sửa ở ERP rồi đồng bộ lại.',
    statusOptionsPending: 'Giá trị trạng thái chưa được chốt nên không chọn trực tiếp được.',
    missingErpOrderNo: 'Không có số gốc ERP',
    missingItemLabel: 'Không có tên hiển thị mặt hàng',
    missingDueDate: 'Không có ngày giao',
    referenceFailed: 'Không tải được danh sách tham chiếu.',
    referenceTruncated: 'Danh sách tham chiếu chỉ tra được một phần.',
    referenceLoading: 'Đang tải danh sách tham chiếu.',
    referenceUnknown: 'Không tìm thấy tên tham chiếu.',
    itemLoading: 'Đang tải tên mặt hàng.',
    itemUnknown: 'Không tìm thấy tên mặt hàng.',
    itemFailed: 'Không tải được tên mặt hàng.',
    missingRemarks: 'Không có ghi chú',
  },
  basic: {
    heading: 'Thông tin cơ bản',
    unselectedTitle: 'Hãy chọn P/O sản xuất',
    unselectedDescription: 'Chọn một P/O sản xuất trong danh sách để xem thông tin cơ bản.',
    loading: 'Đang tải thông tin cơ bản P/O sản xuất',
    loadFailedTitle: 'Không tải được thông tin cơ bản',
    loadFailedDescription: 'Hãy chọn lại P/O sản xuất sau giây lát.',
  },
  detail: {
    planHeading: 'Kế hoạch',
    workOrderHeading: 'Triển khai (W/O)',
    unselectedTitle: 'Hãy chọn P/O sản xuất',
    unselectedDescription: 'Chọn một P/O sản xuất trong danh sách để xem danh sách chi tiết.',
    planLoading: 'Đang tải danh sách kế hoạch sản xuất',
    workOrderLoading: 'Đang tải danh sách W/O',
    planLoadFailedTitle: 'Không tải được kế hoạch sản xuất',
    workOrderLoadFailedTitle: 'Không tải được W/O',
    loadFailedDescription: 'Hãy chọn lại P/O sản xuất sau giây lát.',
    planEmptyTitle: 'Không có kế hoạch sản xuất nào được nối',
    workOrderEmptyTitle: 'Chưa có W/O nào được triển khai',
    unscheduled: 'Không có lịch kế hoạch',
    columns: {
      planNo: 'Số kế hoạch',
      planDate: 'Ngày kế hoạch',
      plannedQty: 'Số lượng kế hoạch · đơn vị',
      workOrderNo: 'Số W/O',
      workOrderType: 'Loại W/O',
      orderQty: 'Số lượng lệnh · đơn vị',
      plannedRange: 'Bắt đầu · kết thúc theo kế hoạch',
      status: 'Trạng thái',
    },
  },
  filters: {
    all: 'Tất cả',
    dueRangeError: 'Ngày giao từ không được muộn hơn ngày đến.',
  },
  loading: 'Đang tải danh sách P/O sản xuất',
  listLoadFailedTitle: 'Không tải được danh sách P/O sản xuất',
  listLoadFailedDescription: 'Hãy áp dụng lại điều kiện tra cứu sau giây lát.',
  empty: {
    title: 'Không có P/O sản xuất để hiển thị',
    description: 'Hãy đổi điều kiện tra cứu rồi xem lại.',
    beyondTitle: 'Trang này không có P/O sản xuất để hiển thị',
    beyondDescription: 'Hãy về trang đầu để xem P/O sản xuất.',
  },
  page: {
    label: 'Chuyển trang P/O sản xuất',
    range: (start: number, end: number, total: number) =>
      `${String(start)}–${String(end)} / tổng ${String(total)} mục`,
    total: (total: number) => `Tổng ${String(total)} mục`,
  },
};
