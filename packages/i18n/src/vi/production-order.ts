import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-02-01 ERP W/O 수신·조회. ERP 가 내려 준 ERP W/O 를 **읽기만** 하는 화면이다.
 *
 * ⚠ **고칠 수 없다는 사실을 문구가 진다.** 화면에 수정 컨트롤이 없으므로, 왜 없는지와 어디서
 * 고치는지를 `values.erpReadOnlyNotice` 가 대신 말한다.
 */
export const productionOrder: Translated<typeof ko.productionOrder> = {
  title: 'Nhận · tra cứu ERP W/O',
  breadcrumbRoot: 'Sản xuất',
  fields: {
    productionOrderNo: 'Số ERP W/O',
    erpProductionOrderNo: 'Số gốc ERP',
    item: 'Mặt hàng',
    orderedQty: 'Số lượng đặt · đơn vị',
    dueDate: 'Ngày giao',
    workOrderProgress: 'W/O đã tạo / dự kiến',
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
    filters: 'Điều kiện tra cứu ERP W/O',
    list: 'Danh sách ERP W/O',
    basic: 'Chi tiết cơ bản ERP W/O',
    plans: 'Chi tiết kế hoạch ERP W/O',
    workOrders: 'Chi tiết triển khai ERP W/O',
  },
  actions: {
    select: (orderNo: string) => `Chọn ${orderNo}`,
    expand: (orderNo: string) => `Mở ERP W/O con của ${orderNo}`,
    collapse: (orderNo: string) => `Thu ERP W/O con của ${orderNo}`,
    firstPage: 'Về trang đầu',
    prevPage: 'Trước',
    nextPage: 'Sau',
    integrationSync: 'Xem tình trạng liên kết',
    productionPlan: 'Triển khai · lập W/O',
  },
  values: {
    erpReadOnlyNotice:
      'Thông tin nhận từ ERP nên không sửa được trên màn hình này. Hãy sửa ở ERP rồi đồng bộ lại.',
    erpSyncHint: 'Có thể xem kết quả đồng bộ ở tình trạng liên kết.',
    searchPlaceholder: 'Số ERP W/O',
    workOrderProgressHelp:
      'W/O đã tạo / dự kiến — số W/O hiện đã tạo / tổng số W/O sẽ được tạo theo kế hoạch sản xuất. 0 / 0 là trạng thái chưa có kế hoạch sản xuất.',
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
    loading: 'Đang tải thông tin cơ bản ERP W/O',
    loadFailedTitle: 'Không tải được thông tin cơ bản',
    loadFailedDescription: 'Hãy chọn lại ERP W/O sau giây lát.',
  },
  detail: {
    planHeading: 'Kế hoạch sản xuất',
    planDescription: 'Kế hoạch sản xuất đã lập cho ERP W/O này.',
    workOrderHeading: 'W/O đã triển khai',
    workOrderDescription: 'W/O được tạo khi triển khai kế hoạch sản xuất.',
    unselectedNote: 'Sẽ hiển thị khi chọn ERP W/O.',
    planLoading: 'Đang tải danh sách kế hoạch sản xuất',
    workOrderLoading: 'Đang tải danh sách W/O',
    planLoadFailedTitle: 'Không tải được kế hoạch sản xuất',
    workOrderLoadFailedTitle: 'Không tải được W/O',
    loadFailedDescription: 'Hãy chọn lại ERP W/O sau giây lát.',
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
  loading: 'Đang tải danh sách ERP W/O',
  listLoadFailedTitle: 'Không tải được danh sách ERP W/O',
  listLoadFailedDescription: 'Hãy áp dụng lại điều kiện tra cứu sau giây lát.',
  empty: {
    title: 'Không có ERP W/O để hiển thị',
    description: 'Hãy đổi điều kiện tra cứu rồi xem lại.',
    beyondTitle: 'Trang này không có ERP W/O để hiển thị',
    beyondDescription: 'Hãy về trang đầu để xem ERP W/O.',
  },
  page: {
    label: 'Chuyển trang ERP W/O',
    range: (start: number, end: number, total: number) =>
      `${String(start)}–${String(end)} / tổng ${String(total)} mục`,
    total: (total: number) => `Tổng ${String(total)} mục`,
  },
};
