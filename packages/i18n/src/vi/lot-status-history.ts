import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-03-01 Lot Status 현황·변경이력 조회. LOT 의 현재 상태를 찾고 보류 사건 이력을 되짚는다.
 *
 * ⚠ 「전이」는 사이드바가 세운 `chuyển đổi` 를 그대로 쓴다. 「사건」(`sự kiện`)은 알림·알람과
 * 다른 말이므로 용어집의 `thông báo`·`cảnh báo` 와 섞지 않는다.
 */
export const lotStatusHistory: Translated<typeof ko.lotStatusHistory> = {
  title: 'Tra cứu Lot Status · lịch sử thay đổi',
  breadcrumbRoot: 'Quản lý chất lượng',
  modes: {
    label: 'Chế độ tra cứu Lot Status',
    lot: 'Tìm theo LOT',
    history: 'Tìm theo lịch sử',
  },
  actions: {
    search: 'Tra cứu',
    reset: 'Đặt lại',
    retry: 'Thử lại',
    retryLabel: (name: string): string => `Thử lại ${name}`,
    previousPage: 'Trang trước',
    nextPage: 'Trang sau',
  },
  range: {
    total: (total: string): string => `Tổng ${total} mục`,
    span: (start: string, end: string, total: string): string =>
      `${start}–${end} / tổng ${total} mục`,
  },
  optionNotes: {
    loading: (name: string): string => `Đang tải danh sách ${name}.`,
    failed: (name: string): string => `Không tải được danh sách ${name}.`,
    truncated: (name: string): string => `Chỉ hiển thị một phần ${name}.`,
  },
  values: {
    all: 'Tất cả',
    inactive: (label: string): string => `${label} (ngừng dùng)`,
    unlisted: (value: string): string => `${value} (chưa có trong danh sách)`,
  },
  scopeNotice:
    'Chỉ hiển thị lịch sử đăng ký · gỡ tạm giữ, toàn bộ chuyển đổi trạng thái không được ghi lại.',
  lotFilter: {
    pane: 'Điều kiện tra cứu LOT',
    fields: {
      lotType: 'Loại LOT',
      lotNo: 'Số LOT',
      item: 'Mặt hàng',
      status: 'Trạng thái hiện tại',
      warehouse: 'Kho',
      location: 'Vị trí',
    },
    notes: {
      lotTypeTruncated: 'Chỉ hiển thị một phần loại LOT.',
      lotStatusUnseeded: 'Giá trị gốc của trạng thái hiện tại chưa sẵn sàng.',
      locationNeedsWarehouse: 'Hãy chọn kho trước.',
      locationFailed: 'Không tải được danh sách vị trí.',
      locationTruncated: 'Chỉ hiển thị một phần vị trí.',
    },
    reasons: {
      lotTypeRequired: 'Hãy chọn loại LOT.',
      lotTypeLoading: 'Đang tải giá trị gốc của loại LOT.',
      lotTypeFailed: 'Không tải được giá trị gốc của loại LOT.',
      lotTypeUnseeded: 'Giá trị gốc của loại LOT chưa sẵn sàng.',
    },
  },
  historyFilter: {
    pane: 'Điều kiện tra cứu lịch sử',
    fields: {
      period: 'Khoảng thời gian',
      actor: 'Người thực hiện',
      lot: 'LOT',
    },
    actorUnknownOption: 'Người thực hiện đã chọn (không xác nhận được tên)',
    actorUnknownNote: 'Không xác nhận được tên người thực hiện đã chọn.',
    reasons: {
      missing: 'Chọn đủ khoảng thời gian thì mới tra cứu được.',
      invalid: 'Hãy chọn khoảng thời gian hợp lệ.',
      reversed: 'Ngày kết thúc không được trước ngày bắt đầu.',
    },
  },
  current: {
    pane: 'Trạng thái LOT hiện tại',
    beforeSearch: {
      title: 'Hãy chọn loại LOT rồi tra cứu',
      description:
        'Áp dụng điều kiện tra cứu thì tóm tắt trạng thái hiện tại và danh sách LOT sẽ hiện ra.',
    },
    columns: {
      lot: 'LOT',
      item: 'Mặt hàng',
      status: 'Trạng thái hiện tại',
      onHand: 'Đang giữ',
      latestTransition: 'Chuyển đổi gần nhất',
      reason: 'Lý do',
    },
    itemLabel: {
      loading: 'Đang tải…',
      failed: 'Tra cứu danh sách mặt hàng thất bại',
      unknown: 'Không rõ',
    },
    openDetail: (lotNo: string): string => `Xem chi tiết ${lotNo}`,
    summary: {
      pane: 'Tóm tắt trạng thái hiện tại',
      loading: 'Đang tải tóm tắt trạng thái hiện tại',
      failed: 'Không tải được tóm tắt trạng thái hiện tại.',
      unknownCount: 'Chưa chốt số liệu',
      unit: 'mục',
      asOf: (at: string): string => `Thời điểm cơ sở ${at}`,
      outOfScope: (count: number): string => `Đã loại ${String(count)} mục ngoài phạm vi quyền.`,
    },
    list: {
      title: 'Danh sách LOT',
      loading: 'Đang tải danh sách LOT',
      failed: 'Không tải được danh sách LOT.',
      refreshing: 'Đang làm mới danh sách LOT',
      refreshingText: 'Đang làm mới danh sách LOT.',
      emptyPage: 'Trang này không có kết quả',
      empty: 'Không có LOT nào khớp điều kiện',
      firstPage: 'Về trang đầu',
      pagination: 'Chuyển trang danh sách LOT',
    },
  },
  history: {
    pane: 'Lịch sử sự kiện tạm giữ',
    columns: {
      occurredAt: 'Thời điểm',
      lot: 'LOT',
      event: 'Chuyển đổi / sự kiện',
      actor: 'Người thực hiện',
      reason: 'Lý do',
    },
    events: {
      held: 'Đăng ký tạm giữ',
      released: 'Gỡ tạm giữ',
    },
    actorUnknown: 'Chưa xác định tên',
    beforeSearch: {
      title: 'Hãy chọn khoảng thời gian rồi tra cứu',
      description: 'Áp dụng đủ khoảng thời gian tra cứu thì lịch sử sự kiện tạm giữ sẽ hiện ra.',
    },
    loading: 'Đang tải lịch sử sự kiện tạm giữ',
    failed: 'Không tải được lịch sử sự kiện tạm giữ.',
    refreshing: 'Đang làm mới lịch sử sự kiện tạm giữ',
    refreshingText: 'Đang làm mới lịch sử sự kiện tạm giữ.',
    empty: {
      title: 'Khoảng thời gian này không có sự kiện tạm giữ nào',
      description: 'Không khớp với trạng thái LOT hiện tại cũng không phải là lỗi.',
    },
    pagination: 'Chuyển trang lịch sử sự kiện tạm giữ',
  },
  detail: {
    title: 'Chi tiết LOT',
    loading: 'Đang tải chi tiết LOT',
    failed: 'Không tải được chi tiết LOT.',
    close: 'Đóng',
    attributes: 'Thuộc tính LOT',
    fields: {
      lotNo: 'Số LOT',
      item: 'Mặt hàng',
      lotType: 'Loại LOT',
      status: 'Trạng thái hiện tại',
      initialQty: 'Số lượng ban đầu',
      expiryDate: 'Hạn sử dụng',
      manufacturedAt: 'Thời điểm sản xuất',
    },
    transition: 'Xử lý đánh giá · chuyển đổi',
    transitionNote: 'Dùng được khi màn hình W-03-02 đã sẵn sàng.',
    suspiciousNote: 'Hãy đăng ký vật tư nghi ngờ ở màn hình W-03-03.',
  },
  holdDocuments: {
    pane: 'Chứng từ tạm giữ',
    columns: {
      times: 'Đăng ký · gỡ',
      reason: 'Lý do',
      holdStatus: 'Trạng thái mục tạm giữ',
      holdQty: 'Số lượng tạm giữ',
      releaseCondition: 'Điều kiện gỡ',
    },
    fullQty: 'Toàn bộ',
    actorPending: 'Đang xác nhận…',
    loading: 'Đang tải chứng từ tạm giữ',
    failed: 'Không tải được chứng từ tạm giữ.',
    refreshingText: 'Đang làm mới chứng từ tạm giữ.',
    empty: 'Không có chứng từ tạm giữ nào',
    pagination: 'Chuyển trang chứng từ tạm giữ',
    actorsLimited:
      'Không xác nhận được tên một số người thực hiện nên hiển thị số hiệu người dùng.',
  },
};
