import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-06-10 연계 동기화 현황·실패 재처리. 조회가 주 동작이고 쓰기는 재처리뿐이다.
 *
 * 상태·연계 종류·방향·대상 유형의 코드 값은 확정되지 않았다 — 여기에 값 목록을 채워 넣지 않는다.
 * 연계 메시지는 `bản tin liên kết`, 재처리는 `xử lý lại`, 재시도는 `thử lại` 로 한 벌로 맞춘다.
 */
export const integrationSync: Translated<typeof ko.integrationSync> = {
  title: 'Tình hình đồng bộ liên kết',
  breadcrumbRoot: 'Quản trị hệ thống',
  menuPath: 'Quản trị hệ thống › Tình trạng · lịch sử liên kết ERP › Tình trạng · lịch sử liên kết',
  panes: {
    filter: 'Điều kiện tra cứu',
    list: 'Danh sách bản tin liên kết',
    detail: 'Chi tiết bản tin liên kết',
  },
  splitter: 'Kéo để điều chỉnh độ rộng danh sách·chi tiết',
  listCollapse: 'Thu gọn danh sách',
  listExpand: 'Mở danh sách',
  labels: {
    directions: {
      INBOUND: 'Nhận',
      OUTBOUND: 'Gửi',
    },
    statuses: {
      PENDING: 'Chờ',
      PROCESSING: 'Đang xử lý',
      DONE: 'Hoàn tất',
      FAILED: 'Thất bại',
    },
    interfaces: {
      'IF-ERP-CODE-RECV': 'Mã chung',
      'IF-ERP-EMP-RECV': 'Nhân viên',
      'IF-ERP-ITEM-RECV': 'Mặt hàng',
      'IF-ERP-BP-RECV': 'Đối tác',
      'IF-ERP-BOM-RECV': 'BOM',
      'IF-ERP-PO-RECV': 'Đơn mua hàng',
      'IF-ERP-SO-RECV': 'Đơn bán hàng',
      'IF-ERP-PRODORD-RECV': 'ERP W/O',
      'IF-WO-CLOSE-SEND': 'Kết quả sản xuất',
      'IF-GR-SEND': 'Nhập kho (G/R)',
      'IF-SHIPMENT-PGI-SEND': 'Xuất hàng (PGI)',
    },
  },
  fields: {
    periodFrom: 'Bắt đầu kỳ',
    periodTo: 'Kết thúc kỳ',
    status: 'Trạng thái',
    interfaceCode: 'Hạng mục',
    direction: 'Phân loại',
    targetType: 'Loại đối tượng',
    retryMin: 'Số lần thử lại (từ)',
  },
  actions: {
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
    retry: 'Xử lý lại',
    /* 행 버튼의 접근 이름. 보이는 글자(`Xử lý lại`)를 그대로 담아 음성 조작이 부를 수 있게 둔다. */
    retryRow: (messageKey: string): string => `Xử lý lại ${messageKey}`,
    reload: 'Tra cứu lại',
    batchRetry: 'Xử lý lại theo lô mục đã chọn',
  },
  /** 부분 실패를 허용하는 일괄 재처리라 성공 건수와 실패 사유를 함께 낸다. */
  batch: {
    selectionCount: (count: number): string => `Đã chọn ${String(count)}`,
    confirmTitle: (count: number): string => `Gửi lại ${String(count)} mục đã chọn?`,
    confirmDescription: 'Có thể chỉ một phần thành công. Kết quả được báo theo từng mục.',
    resultTitle: 'Kết quả xử lý lại',
    failedListLabel: 'Mục không gửi được',
    allSucceeded: (count: number): string => `Đã gửi lại ${String(count)} mục.`,
    partial: (succeeded: number, failed: number): string =>
      `Đã gửi lại ${String(succeeded)} mục. ${String(failed)} mục không gửi được.`,
    /** 서버가 준 위치 번호가 보낸 건수 밖일 때. 그 항목을 버리지 않고 이렇게 밝힌다. */
    unknownItem: 'Không rõ là mục nào.',
    noReason: 'Không nhận được lý do.',
  },
  /** 재처리는 같은 메시지 키로 다시 보내는 것이라 새 건을 만들지 않는다고 못 박는다. */
  retry: {
    confirmTitle: 'Gửi lại?',
    confirmDescription: 'Gửi lại cùng mục này. Không tạo mục mới.',
    requested: 'Đã yêu cầu gửi lại',
  },
  /** 이 화면의 쓰기는 저장이 아니라 재처리 요청이라 「저장」 어휘를 쓰지 않는다. */
  retryError: {
    title: 'Không gửi lại được',
    /** 상태가 실패가 아닌 건. 서버 문구가 비어도 이 안내는 남는다. */
    notRetryable:
      'Ở trạng thái hiện tại không gửi lại được. Hãy tra cứu lại danh sách để xem trạng thái.',
    workerLease: 'Tác vụ xử lý mục này đang chạy. Hãy thử lại sau giây lát.',
    /** 시작 시각을 알 때. 모르면 위 문구를 그대로 쓴다 — 시각을 지어내지 않는다. */
    workerLeaseAt: (time: string): string =>
      `Tác vụ xử lý mục này đang chạy từ ${time}. Hãy thử lại sau giây lát.`,
    user: 'Người dùng khác đã xử lý mục này trước. Hãy tra cứu lại danh sách để xem trạng thái.',
    erpSync:
      'Mục này đã được đồng bộ lại từ hệ thống ngoài. Hãy tra cứu lại danh sách để xem trạng thái.',
  },
  /** 목록 표의 머리글. 열 구성의 근거는 screens/integration-sync/message-table.tsx에 있다. */
  table: {
    direction: 'Phân loại',
    interfaceCode: 'Hạng mục',
    messageKey: 'Số',
    status: 'Trạng thái',
    retryCount: 'Thử lại',
    createdAt: 'Thời điểm phát sinh',
    lastErrorMessage: 'Nội dung lỗi',
    retry: 'Xử lý lại',
  },
  /** 비활성 사유는 그 컨트롤의 이름으로 시작한다. */
  reasons: {
    searchNeedsPeriod:
      'Tra cứu chỉ dùng được sau khi điền đủ kỳ. Hãy chọn ngày bắt đầu và ngày kết thúc.',
    periodReversed: 'Kết thúc kỳ không được sớm hơn bắt đầu kỳ.',
  },
  loading: {
    messages: 'Đang tải danh sách bản tin liên kết',
    messageDetail: 'Đang tải thông tin bản tin liên kết',
  },
  /** 상세. 전송 내용은 구획만 두고 값을 그리지 않는다 — 열람 범위가 정해지지 않았다. */
  detail: {
    title: 'Chi tiết bản tin liên kết',
    pick: 'Hãy chọn một bản tin trong danh sách',
    openAction: (messageKey: string): string => `Mở chi tiết ${messageKey}`,
    retryCount: 'Số lần thử lại',
    availableAt: 'Lần thử tiếp theo',
    sentAt: 'Thời điểm gửi',
    completedAt: 'Thời điểm hoàn tất',
    lockedBy: 'Đang xử lý',
  },
  /** 계약이 정의한 사실만 옮긴다 — 「잠금이 오래됐다」 같은 판정은 하지 않는다. */
  status: {
    failed: 'Thất bại',
    processing: (time: string): string => `Đang xử lý từ ${time}`,
    /** 처리 중인 것은 분명한데 시작 시각이 없을 때. 시각을 지어내지 않는다. */
    processingNoTime: 'Đang xử lý',
    autoRetry: (time: string): string => `Tự động thử lại ${time}`,
  },
  /** 선택지는 조회한 기록에서 만들므로 그 한계를 문구가 함께 밝힌다. */
  filters: {
    all: 'Tất cả',
    chipStatus: (value: string): string => `Trạng thái: ${value}`,
    chipInterface: (value: string): string => `Hạng mục: ${value}`,
    chipDirection: (value: string): string => `Phân loại: ${value}`,
    chipTargetType: (value: string): string => `Loại đối tượng: ${value}`,
    chipRetryMin: (value: string): string => `Thử lại từ ${value} lần`,
    chipRemoveStatus: 'Bỏ điều kiện trạng thái',
    chipRemoveInterface: 'Bỏ điều kiện hạng mục',
    chipRemoveDirection: 'Bỏ điều kiện phân loại',
    chipRemoveTargetType: 'Bỏ điều kiện loại đối tượng',
    chipRemoveRetryMin: 'Bỏ điều kiện số lần thử lại',
  },
  /** 쪽 이동. 번호 목록을 두지 않는다 — 조건을 좁히는 것이 정상 경로다. */
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)}`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `Tổng ${String(total)}`,
  },
  empty: {
    noResultTitle: 'Không có bản ghi khớp điều kiện',
    noPeriodTitle: 'Hãy chọn kỳ rồi tra cứu',
    beyondLastTitle: 'Trang này không có kết quả',
  },
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
  },
};
