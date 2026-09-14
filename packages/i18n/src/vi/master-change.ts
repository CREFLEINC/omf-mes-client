import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-06-11 마스터 변경관리. 읽기 전용 조회 화면이라 쓰기 어휘가 하나도 없다.
 *
 * 「Rev」는 사용자 문구에 쓰지 않는다 — 개정은 `bản sửa đổi` 로 적는다.
 * 전후 값의 항목 이름 문구는 여기에 두지 않는다 — 받은 키를 그대로 낸다.
 */
export const masterChange: Translated<typeof ko.masterChange> = {
  title: 'Quản lý thay đổi dữ liệu gốc',
  breadcrumbRoot: 'Dữ liệu gốc',
  fields: {
    /* 기간은 한 컨트롤이다(변경 통지 #63) — 시작·종료가 한 칸으로 합쳐져 라벨도 하나다. */
    period: 'Kỳ tra cứu',
    targetType: 'Loại đối tượng',
    targetId: 'Đối tượng',
    eventType: 'Loại sự kiện',
    performedBy: 'Người thực hiện',
    correlationId: 'Mã tương quan',
  },
  actions: {
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
    viewDiff: 'Xem',
    /* 행 버튼의 접근 이름. 보이는 글자(`Xem`)를 그대로 담아 음성 조작이 부를 수 있게 둔다. */
    viewDiffRow: (occurredAt: string): string => `Xem nội dung thay đổi ${occurredAt}`,
    newRevision: 'Phát hành bản sửa đổi mới',
  },
  /** 비활성 사유는 그 컨트롤의 이름으로 시작한다(배치 규범 4). */
  reasons: {
    searchNeedsPeriod:
      'Tra cứu chỉ dùng được sau khi điền đủ kỳ. Hãy chọn ngày bắt đầu và ngày kết thúc.',
    periodReversed: 'Kết thúc kỳ không được sớm hơn bắt đầu kỳ.',
    /* 버튼을 감추지 않는 이유는 개정 발행이 어디서 이루어지는지를 여기서 알 수 있어야 해서다. */
    newRevisionElsewhere:
      'Không phát hành bản sửa đổi mới ở màn hình này được. Bản sửa đổi được phát hành ở từng màn hình dữ liệu gốc.',
  },
  loading: {
    events: 'Đang tải danh sách lịch sử thay đổi',
  },
  /** 목록 표의 머리글. 열 구성의 근거는 screens/master-change/event-table.tsx에 있다. */
  table: {
    occurredAt: 'Thời điểm phát sinh',
    targetType: 'Loại đối tượng',
    targetId: 'Đối tượng',
    eventType: 'Loại sự kiện',
    performedBy: 'Người thực hiện',
    /** 받은 키 이름을 그대로 이어 담는 흡수 열. 이름을 옮기지 않는다. */
    changedKeys: 'Mục đã đổi',
    diff: 'Nội dung thay đổi',
  },
  /**
   * 변경 내용 창. 전후 값의 키는 받은 그대로 낸다.
   * 전후 값을 받지 못한 경우는 계약이 허용한다 — 빈 표를 내거나 값을 지어내지 않는다.
   */
  diff: {
    title: 'Nội dung thay đổi',
    auditEventId: 'Số lịch sử',
    terminalId: 'Máy quét',
    reason: 'Lý do',
    noValuesTitle: 'Không nhận được giá trị trước và sau',
    noValuesDescription: 'Sự kiện này không chứa mục trước và sau thay đổi.',
  },
  /** 선택지는 아직 임시이고 조회한 기간의 기록에서 만들므로 그 한계를 문구가 함께 밝힌다. */
  filters: {
    all: 'Tất cả',
    optionsNote:
      'Loại đối tượng · loại sự kiện là danh sách tạm, chưa được chốt. Danh sách tạo từ bản ghi trong kỳ đã tra cứu nên giá trị chưa từng được ghi hoặc không có trong kỳ này thì không nằm trong danh sách.',
    chipTargetType: (value: string): string => `Loại đối tượng: ${value}`,
    chipTargetId: (value: string): string => `Đối tượng: ${value}`,
    chipEventType: (value: string): string => `Loại sự kiện: ${value}`,
    chipPerformedBy: (value: string): string => `Người thực hiện: ${value}`,
    chipCorrelationId: (value: string): string => `Mã tương quan: ${value}`,
    chipRemoveTargetType: 'Bỏ điều kiện loại đối tượng',
    chipRemoveTargetId: 'Bỏ điều kiện đối tượng',
    chipRemoveEventType: 'Bỏ điều kiện loại sự kiện',
    chipRemovePerformedBy: 'Bỏ điều kiện người thực hiện',
    chipRemoveCorrelationId: 'Bỏ điều kiện mã tương quan',
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
    noResultTitle: 'Không có lịch sử thay đổi khớp điều kiện',
    noResultDescription: 'Hãy mở rộng kỳ hoặc giảm bớt điều kiện rồi tra cứu lại.',
    noPeriodTitle: 'Hãy chọn kỳ rồi tra cứu',
    noPeriodDescription: 'Lịch sử thay đổi chỉ tra cứu được khi đã định kỳ.',
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Hãy chuyển về trang đầu.',
  },
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
  },
};
