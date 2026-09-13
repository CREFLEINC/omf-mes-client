import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-03-01 의심자재 등록. 후보 LOT 을 골라 보류를 건다 — 걸면 출고·출하·피킹이 막힌다.
 *
 * ⚠ 보류(`tạm giữ`)와 해제(`gỡ`)를 한 화면에서 함께 쓴다. 같은 말이 섞이지 않게 용어집의
 * 짝(보류 `tạm giữ` · 해제 조건 `điều kiện gỡ`)을 그대로 쓴다.
 */
export const suspiciousMaterialHold: Translated<typeof ko.suspiciousMaterialHold> = {
  title: 'Đăng ký vật tư nghi ngờ',
  breadcrumbRoot: 'Quản lý chất lượng',
  candidate: {
    pane: 'Ứng viên vật tư nghi ngờ',
    fields: {
      select: 'Chọn',
      lotNo: 'Số LOT',
      item: 'Mặt hàng',
      warehouse: 'Kho',
      location: 'Vị trí',
      quantity: 'Số lượng đang giữ · Đơn vị',
      status: 'Lot Status',
      statusAndTransition: 'Lot Status · Chuyển đổi gần nhất',
    },
    values: {
      all: 'Tất cả',
      statusUnknown: 'Chưa xác định tên Lot Status',
      itemUnknown: 'Chưa xác định tên mặt hàng',
      warehouseUnknown: 'Chưa xác định tên kho',
      locationUnknown: 'Chưa xác định tên vị trí',
      quantityUnknown: 'Chưa xác định số lượng',
      uomUnknown: 'Chưa xác định tên đơn vị',
      transitionNone: 'Chưa có lần chuyển đổi nào',
      fullyHeld: (lotNo: string): string => `${lotNo} · Đã tạm giữ toàn bộ nên không chọn được.`,
      selected: (count: number): string => `Đã chọn ${String(count)} mục`,
    },
    actions: {
      select: (lotNo: string): string => `Chọn ${lotNo}`,
      search: 'Tra cứu',
      reset: 'Đặt lại',
      retry: 'Thử lại',
      previous: 'Trang trước',
      next: 'Trang sau',
    },
    summary: (total: string, page: number, pages: number): string =>
      `Tổng ${total} mục · trang ${String(page)} / ${String(pages)}`,
    loading: 'Đang tải ứng viên vật tư nghi ngờ',
    failed: 'Không tải được ứng viên vật tư nghi ngờ.',
    empty: 'Không có LOT nào khớp điều kiện.',
    pagination: 'Chuyển trang ứng viên vật tư nghi ngờ',
  },
  input: {
    pane: 'Nhập đăng ký tạm giữ',
    range: 'Phạm vi tạm giữ',
    full: 'Tạm giữ toàn bộ',
    partial: 'Tạm giữ một phần',
    fullDescription:
      'Tạm giữ toàn bộ không sao chép số lượng hiện tại thành con số, máy chủ xử lý toàn bộ số lượng tại thời điểm áp dụng.',
    quantity: 'Số lượng tạm giữ',
    reason: 'Lý do tạm giữ',
    reasonPlaceholder: 'Hãy chọn lý do',
    releaseCondition: 'Điều kiện gỡ',
    remarks: 'Ghi chú',
    reasonUnavailable:
      'Danh sách lý do tạm giữ chưa đầy đủ. Chưa xác nhận được lý do thì chưa đăng ký được.',
    factsUnavailable:
      'Chưa xác nhận được vị trí · đơn vị hoặc trạng thái đến nơi thì chưa đăng ký được.',
    impact: 'Ảnh hưởng của việc tạm giữ',
    impactCount: (count: number): string =>
      `Sẽ chặn xuất kho · xuất hàng · lấy hàng của ${String(count)} LOT.`,
    quantityUnknown: 'Chưa xác định số lượng',
    uomUnknown: 'Chưa xác định tên đơn vị',
    locationUnknown: 'Chưa xác định tên vị trí',
    recovery:
      'Muốn gỡ thì cần một lần chuyển Release riêng ở W-03-02, và số lượng đã xuất kho sẽ không thu hồi lại được.',
  },
  execution: {
    pane: 'Thực hiện tạm giữ vật tư nghi ngờ',
    selectFirst: 'Chọn LOT ứng viên thì mới nhập được thông tin tạm giữ.',
    completeInput: 'Nhập lý do tạm giữ và điều kiện gỡ thì mới đăng ký được.',
    ready: (count: number): string =>
      `Hãy kiểm tra nội dung đăng ký tạm giữ của ${String(count)} mục.`,
    confirm: 'Xác nhận đăng ký',
    success: 'Đã đăng ký tạm giữ vật tư nghi ngờ.',
    successNext: 'Hãy xử lý tiếp ở màn hình Xử lý đánh giá · chuyển đổi Lot Status.',
    dialogTitle: 'Xác nhận đăng ký tạm giữ vật tư nghi ngờ',
    cancel: 'Hủy bỏ',
    register: 'Đăng ký tạm giữ',
    reload: 'Tải nội dung mới nhất',
    fieldError: 'Hãy kiểm tra lại giá trị đã nhập.',
    impact: 'Ảnh hưởng của đăng ký tạm giữ',
    impactDescription: (count: number): string =>
      `Chặn xuất kho · xuất hàng · lấy hàng của ${String(count)} LOT. Việc gỡ được xử lý riêng ở W-03-02 và số lượng đã xuất kho sẽ không thu hồi lại được.`,
    conflictOwner: 'Một trong các LOT đã chọn',
    conflictFallback:
      'Trạng thái của một trong các LOT đã chọn đã thay đổi. Hãy tải lại nội dung mới nhất.',
    conflictChanged: (owner: string): string =>
      `Trạng thái của ${owner} đã thay đổi. Hãy tải lại nội dung mới nhất.`,
    conflictServer: (owner: string, message: string): string => `${owner}: ${message}`,
  },
};
