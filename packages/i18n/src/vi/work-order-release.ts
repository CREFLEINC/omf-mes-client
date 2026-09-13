import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-02-04 W/O 확정·배포·생산LOT 선발행.
 *
 * ⚠ **`확정` 은 `chốt`, `배포` 는 `phát hành`, `선발행` 은 `phát trước`** — 사이드바 이름
 * (`Chốt · phát hành W/O · phát trước LOT sản xuất`)이 정본이다.
 *
 * ⚠ **막지 않는 경고는 막지 않는다고 말한다** — `warning.description` 의 뒷문장을 빼지 않는다.
 */
export const workOrderRelease: Translated<typeof ko.workOrderRelease> = {
  title: 'Chốt · phát hành W/O · phát trước LOT sản xuất',
  breadcrumbRoot: 'Sản xuất',
  filter: {
    pane: 'Điều kiện tra cứu ứng viên phát hành',
    productionLine: 'Dòng sản xuất',
    plannedStartFrom: 'Ngày bắt đầu kế hoạch (từ)',
    plannedStartTo: 'Ngày bắt đầu kế hoạch (đến)',
    status: 'Trạng thái chờ chốt',
    all: 'Tất cả',
    search: 'Tra cứu',
    reset: 'Đặt lại',
    statusRequired: 'Hãy chọn trạng thái chờ chốt.',
    dateRange: 'Ngày bắt đầu kế hoạch không được muộn hơn ngày kết thúc.',
    statusEmpty: 'Không có trạng thái lệnh sản xuất nào để chọn.',
    statusLookupLoading: 'Đang tải danh sách trạng thái lệnh sản xuất.',
    statusLookupFailed: 'Không tải được danh sách trạng thái lệnh sản xuất.',
    statusLookupTruncated:
      'Chỉ tải được một phần danh sách trạng thái lệnh sản xuất nên chưa chọn được.',
    productionLineLookupLoading: 'Đang tải danh sách dòng sản xuất.',
    productionLineLookupFailed: 'Không tải được danh sách dòng sản xuất.',
    productionLineLookupTruncated:
      'Chỉ tải được một phần danh sách dòng sản xuất nên chưa chọn được.',
  },
  input: {
    pane: 'Nhập phát trước LOT sản xuất',
    heading: 'Phát trước LOT sản xuất',
    fields: { lotSize: 'Cỡ LOT', handoverNote: 'Nội dung bàn giao' },
    helper: {
      lotSize: (unit: string) =>
        `Mặt hàng không có giá trị mặc định. Hãy tự nhập mỗi lần. Đơn vị: ${unit}`,
      handoverNote: 'Lịch sử xác nhận thông báo được quản lý ở màn hình riêng.',
    },
    locked: {
      lotSize: (reason: string) => `Cỡ LOT: ${reason}`,
      handoverNote: (reason: string) => `Nội dung bàn giao: ${reason}`,
    },
    preview: {
      title: (slotCount: number) => `Sẽ phát trước ${String(slotCount)} suất.`,
      formula: (orderQty: string, lotSize: string, slotCount: number, unit: string) =>
        `${orderQty} ${unit} ÷ ${lotSize} ${unit} = ${String(slotCount)} suất`,
      planNotice:
        'Đây là giá trị kế hoạch. Sản xuất vượt sẽ cấp số thêm, còn suất thiếu sẽ bỏ số khi đóng.',
    },
    warning: {
      title: 'Cỡ LOT lớn hơn hoặc bằng số lượng lệnh.',
      description: 'Chỉ phát trước 1 suất LOT sản xuất. Điều kiện này không chặn việc phát hành.',
    },
    values: { unitUnavailable: 'Chưa rõ đơn vị' },
    empty: {
      title: 'Hãy chọn lệnh sản xuất để nhập.',
      description: 'Chọn một ứng viên phát hành để nhập cỡ LOT và nội dung bàn giao.',
    },
    errors: {
      lotSizeRequired: 'Hãy nhập cỡ LOT.',
      lotSizeNotNumber: 'Hãy nhập cỡ LOT bằng số.',
      lotSizeNotPositive: 'Cỡ LOT phải lớn hơn 0.',
      slotCountUnsafe: 'Hãy nhập cỡ LOT sao cho tính được số suất phát hành một cách an toàn.',
    },
  },
  summary: {
    pane: 'Tóm tắt lệnh sản xuất ứng viên phát hành',
    heading: (workOrderNo: string) => `W/O đã chọn — ${workOrderNo}`,
    fields: {
      item: 'Mặt hàng',
      quantity: 'Số lượng lệnh',
      operation: 'Công đoạn',
      routingRevision: 'Bản sửa đổi Routing',
      productionLine: 'Dòng sản xuất',
      equipment: 'Thiết bị',
      mold: 'Khuôn',
      shift: 'Ca làm việc',
      plannedPeriod: 'Kỳ kế hoạch',
    },
    values: { unavailable: 'Không có tên hiển thị' },
    empty: {
      title: 'Hãy chọn lệnh sản xuất ứng viên phát hành để xem tóm tắt.',
      description: 'Chọn một lệnh sản xuất trong danh sách để xem tóm tắt đã chuẩn bị.',
    },
  },
  actions: {
    label: 'Thao tác phát hành lệnh sản xuất',
    cancel: 'Hủy',
    release: 'Chốt phát hành',
    reasons: {
      noSelection: (action: string) => `${action}: Hãy chọn lệnh sản xuất để phát hành.`,
      submitting: (action: string) => `${action}: Đang chờ xử lý phát hành.`,
      release: (reason: string) => `Chốt phát hành: ${reason}`,
    },
  },
  readiness: {
    detailLoading: 'Đang tải chi tiết lệnh sản xuất.',
    detailUnavailable: 'Không tải được chi tiết lệnh sản xuất.',
    inputRequired: 'Hãy nhập cỡ LOT hợp lệ.',
  },
  execution: {
    released: 'Đã phát hành lệnh sản xuất và phát trước LOT sản xuất.',
    writeOwnerMismatch: 'Phản hồi phát hành không khớp với lệnh sản xuất đã chọn. Hãy tra cứu lại.',
    retryDetail: 'Thử lại chi tiết lệnh sản xuất',
    retryValidation: 'Thử lại kiểm tra lệnh sản xuất',
    reloadDetail: 'Tải lại chi tiết lệnh sản xuất',
  },
  candidateList: {
    pane: 'Danh sách lệnh sản xuất ứng viên phát hành',
    fields: { workOrderNo: 'Số W/O', item: 'Mặt hàng', quantity: 'Số lượng lệnh' },
    actions: { select: (workOrderNo: string) => `Chọn ${workOrderNo}` },
    values: { missingItem: 'Không có tên hiển thị mặt hàng' },
    loading: 'Đang tải danh sách lệnh sản xuất ứng viên phát hành.',
    empty: {
      title: 'Không có lệnh sản xuất ứng viên phát hành.',
      description: 'Hãy sang trang khác rồi xem lại.',
      beyondTitle: 'Trang hiện tại không có lệnh sản xuất ứng viên phát hành.',
      beyondDescription: 'Hãy về trang đầu hoặc trang trước rồi xem lại.',
    },
  },
  pane: 'Kiểm tra trước khi phát hành lệnh sản xuất',
  heading: (workOrderNo: string) => `W/O đã chọn — ${workOrderNo}`,
  empty: {
    notSelectedTitle: 'Hãy chọn lệnh sản xuất để phát hành.',
    notSelectedDescription: 'Chọn một lệnh sản xuất trong danh sách để xem kết quả kiểm tra tĩnh.',
  },
  status: {
    staticPassed: 'Đã qua kiểm tra tĩnh. Hãy tiếp tục kiểm các điều kiện nhập còn lại.',
    alreadyReleased: 'Lệnh sản xuất này đã phát hành. Không phát hành lại được.',
    validationBlocked: 'Hãy xử lý các mục bị chặn trong kết quả kiểm tra rồi xem lại.',
    validationUnavailable:
      'Không tải được kết quả kiểm tra. Hãy chọn lại hoặc làm mới trang rồi tiếp tục.',
    missingDefaultLocations:
      'Hãy thiết lập vị trí WIP, thành phẩm và phế liệu mặc định rồi kiểm tra lại.',
  },
  locations: {
    missingTitle: 'Thiếu vị trí mặc định',
    missingDescription: 'Các vị trí mặc định sau chưa được thiết lập.',
    wip: 'Vị trí WIP',
    finishedGoods: 'Vị trí thành phẩm',
    scrap: 'Vị trí phế liệu',
  },
};
