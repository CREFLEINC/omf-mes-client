import type { ko } from '../ko';
import type { Translated } from './translated';

/** P-02-13 PQC 제품 검사. */
export const pqcInspection: Translated<typeof ko.pqcInspection> = {
  title: 'Kiểm tra sản phẩm PQC',
  emptyValue: '—',
  header: {
    synced: 'Đã đồng bộ',
  },
  detail: {
    heading: 'Đối tượng',
    nothingSelected: 'Hãy chọn đối tượng kiểm tra ở màn hình công việc rồi vào.',
    loading: 'Đang tải yêu cầu kiểm tra.',
    fields: {
      inspectionRequestNo: 'Số yêu cầu',
      inspectionPlanVersionId: 'Phiên bản tiêu chuẩn kiểm tra',
      lotId: 'LOT đối tượng',
      itemId: 'Mặt hàng',
      /* ⚠ 머리줄 표기는 「W/O」로 통일한다(사용자 지시 2026-09-10). */
      workOrderId: 'W/O',
    },
    planLabel: (code: string, version: number): string => `Tiêu chuẩn ${code} v${String(version)}`,
    sample: (ratio: number): string => `Mẫu ${String(ratio)}%`,
  },
  coverage: {
    heading: 'Khoảng sản xuất áp dụng',
    from: 'Bắt đầu',
    to: 'Kết thúc',
    date: 'Ngày',
    time: 'Giờ',
    note: 'Giờ bắt đầu · kết thúc kiểm tra được nhập tự động, có thể sửa nếu cần.',
    invalidOrder: 'Kết thúc không được sớm hơn bắt đầu.',
  },
  pad: {
    title: 'Bàn phím số',
    keypadLabel: 'Bàn phím số lượng',
    extraKeysLabel: 'Dấu và dấu thập phân',
    negative: 'Số âm',
    positive: 'Số dương',
    decimal: 'Dấu thập phân',
    backspace: 'Xóa một ký tự',
    clear: 'Xóa hết',
    noTarget: 'Hãy chọn ô cần nhập rồi nhập số.',
  },
  result: {
    heading: 'Nhập kết quả',
    loading: 'Đang tải kết quả kiểm tra.',
    confirmed:
      'Lượt này đã xác nhận nên không sửa được. Muốn kiểm tra lại thì thêm lượt kiểm tra lại.',
    fields: {
      inspectedQty: 'Số lượng kiểm tra',
      accepted: 'Đạt',
      rejected: 'Không đạt',
      held: 'Tạm giữ',
    },
    sum: 'Tổng',
    of: (sum: string, inspected: string): string => `${sum} / ${inspected}`,
    matched: 'Khớp với số lượng kiểm tra',
    short: (remaining: string): string => `Còn thiếu ${remaining}`,
    over: (over: string): string => `Thừa ${over}`,
    quantityInvalid: 'Số lượng từ 0 trở lên, tối đa sáu chữ số thập phân.',
    save: 'Lưu tạm',
    saved: 'Đã lưu.',
    saveBlockedByInvalid: 'Hãy sửa ô số lượng rồi mới lưu được.',
    saveBlockedByWorker:
      'Chưa xác nhận được mã nhân viên nên không lưu được kết quả kiểm tra. Hãy chỉ định công nhân trước.',
    judgment: 'Đánh giá tổng hợp',
    judgmentPlaceholder: 'Hãy chọn đánh giá',
    judgmentUnavailable: 'Đang chuẩn bị danh sách đánh giá',
    judgmentUnknown: (code: string): string =>
      `Đánh giá đã lưu (${code}) không có trong danh sách.`,
    confirm: 'Xác nhận kiểm tra',
    confirmBlockedByTotals: 'Tổng số lượng phải khớp với số lượng kiểm tra mới xác nhận được.',
    confirmBlockedByJudgment: 'Phải chọn đánh giá tổng hợp mới xác nhận được.',
    confirmBlockedByItems: 'Phải đánh giá hết hạng mục kiểm tra mới xác nhận được.',
    confirmBlockedByTerminal:
      'Máy trạm này không có quyền nhập kiểm tra ở công đoạn này. Hãy cấp quyền trong cài đặt máy trạm.',
    confirmSucceeded: 'Đã xác nhận kiểm tra.',
  },
  disposition: {
    heading: 'Quyết định xử lý hàng không đạt',
    rework: 'Có thể làm lại',
    scrap: 'Hủy',
    note: 'Khi có số lượng không đạt thì chọn được cách xử lý; được xác nhận sau khi nhập kho hàng lỗi.',
  },
  noStandard: {
    heading: 'Đánh giá kiểm tra',
    note: 'Yêu cầu này chưa có tiêu chuẩn kiểm tra. Hãy tự ghi đánh giá và nội dung.',
    remarks: 'Nội dung kiểm tra',
  },
  measurements: {
    heading: 'Hạng mục kiểm tra',
    progress: (judged: number, total: number): string => `Tiến độ ${judged} / ${total}`,
    judgmentPlaceholder: 'Đánh giá',
    judgmentUnavailable: 'Đang chuẩn bị danh sách đánh giá',
    judgmentUnknown: (code: string): string =>
      `Giá trị đánh giá tự động (${code}) không có trong danh sách.`,
    valueInvalid: 'Hãy nhập bằng chữ số.',
    autoJudgmentNoLimits: 'Không có quy cách — hãy tự đánh giá',
    booleanTrue: 'Tốt',
    booleanFalse: 'Lỗi',
    loading: 'Đang tải hạng mục kiểm tra.',
    noItems:
      'Phiên bản tiêu chuẩn kiểm tra này không có hạng mục kiểm tra. Hãy liên hệ người phụ trách dữ liệu gốc.',
    columns: {
      item: 'Hạng mục',
      spec: 'Quy cách',
      sample: 'Mẫu',
      value: 'Giá trị đo',
      judgment: 'Đánh giá',
    },
    requiredMark: 'Bắt buộc',
    sampleOf: (sampleNo: number, count: number): string => `${sampleNo}/${count}`,
    range: (lower: number, upper: number): string => `${lower} ~ ${upper}`,
    atLeast: (lower: number): string => `Từ ${lower} trở lên`,
    atMost: (upper: number): string => `Từ ${upper} trở xuống`,
    target: (value: number): string => `Mục tiêu ${value}`,
    outOfSpec: 'Ngoài quy cách',
  },
};
