import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-02-08 W/O 진행현황 조회.
 *
 * ⚠ **「아직 못 받는다」를 무르게 옮기지 않는다.** 이 화면의 문구 절반이 서버가 아직 내려
 * 주지 않는 것을 밝히는 말이다 — 「없습니다」로 줄이면 기능이 원래 없는 것으로 읽힌다.
 *
 * ⚠ **`지연` 은 화면이 낸 참고값이다.** `delayReference` 의 「참고값」(`giá trị tham khảo`)을
 * 빼면 서버 판정처럼 읽힌다.
 */
export const workOrderProgress: Translated<typeof ko.workOrderProgress> = {
  title: 'Tra cứu tiến độ W/O',
  breadcrumbRoot: 'Quản lý sản xuất',

  filters: {
    legend: 'Điều kiện tra cứu',
    period: 'Kỳ',
    from: 'Ngày bắt đầu',
    to: 'Ngày kết thúc',
    productionLine: 'Dòng',
    keyword: 'Số W/O',
    keywordPlaceholder: 'Nhập số W/O',
    search: 'Tra cứu',
    reset: 'Đặt lại',
    process: 'Công đoạn',
    chipProcess: (value: string): string => `Công đoạn: ${value}`,

    /** ⛔ 「고르지 않음」이 아니라 무엇이 조회되는지를 적는다. */
    all: 'Tất cả',

    periodRequired: 'Tra cứu: Hãy điền kỳ. Cần cả ngày bắt đầu và ngày kết thúc.',
    periodInvalid: 'Tra cứu: Ngày này không có trên lịch. Hãy chọn lại.',
    periodReversed: 'Tra cứu: Ngày bắt đầu ở sau ngày kết thúc. Hãy đổi chỗ hai ngày.',

    /** ⛔ 넓은 기간을 막지 않는다 — 예고이지 금지가 아니다. */
    periodWide: 'Kỳ vượt quá 3 tháng. Tra cứu có thể chậm.',

    lookupFailed: 'Chưa nhận được các lựa chọn. Hãy thử làm mới trang.',

    optionsTruncated: (shown: number) =>
      `Chỉ có ${String(shown)} mục đầu trong các lựa chọn. Không thấy thứ cần tìm thì có thể là chưa nhận được.`,
  },

  /** ⛔ 숫자 식별자로 메우지 않는다 — 모르면 모른다고 적는다. */
  nameUnknown: 'Đang xác nhận tên',

  list: {
    title: 'Danh sách',
    columns: {
      workOrderNo: 'Số W/O',
      productionLine: 'Dòng',
      itemId: 'Mặt hàng',
      itemCode: 'Mã mặt hàng',
      itemName: 'Tên mặt hàng',
      process: 'Công đoạn',
      orderQty: 'Lệnh',
      goodQty: 'Đạt',
      defectQty: 'Lỗi',
      holdQty: 'Tạm giữ',
      scrapQty: 'Phế liệu',
      reworkQty: 'Làm lại',
      achievementRate: 'Tỷ lệ đạt',
      statusCode: 'Trạng thái',
      plannedEndAt: 'Kết thúc kế hoạch',
      delay: 'Trễ',
    },

    /** 「0」이 아니라 「모른다」는 뜻이다. */
    blank: '—',

    empty: 'Không có W/O nào khớp điều kiện. Hãy nới rộng kỳ hoặc điều kiện.',
    loadError: 'Chưa nhận được danh sách. Hãy thử lại sau giây lát.',
    loading: 'Đang nhận danh sách.',

    select: (workOrderNo: string) => `Mở chi tiết ${workOrderNo}`,

    delayed: 'Trễ',

    /** ⛔ 빈칸으로 두면 「정상」으로 읽힌다 — 판정할 수 없다는 뜻을 값 자리에 적는다. */
    delayUnknown: 'Không đánh giá được',
  },

  summary: {
    label: 'Tóm tắt',
    total: 'Tổng W/O',
    countUnit: 'mục',
    achievementRate: 'Tỷ lệ đạt',
    goodQty: 'Đạt',
    defectQty: 'Lỗi',
    holdQty: 'Tạm giữ',
    scrapQty: 'Phế liệu',
    reworkQty: 'Làm lại',
    delayed: 'Trễ',
    undeterminable: 'Không đánh giá được',
    statusLabel: 'Trạng thái',
    statusAll: 'Tất cả',
    statusChip: (label: string, count: number): string =>
      `${label} ${count.toLocaleString('vi-VN')}`,
  },
  view: {
    label: 'Chế độ xem',
    table: 'Bảng',
    timeline: 'Lịch trình',
  },
  timeline: {
    title: 'Lịch trình',
    schedule: 'Lịch trình',
    legendPlan: 'Khoảng kế hoạch',
    legendDone: 'Tỷ lệ đã làm',
    legendWaiting: 'Chưa phát hành',
    legendLate: 'Khoảng trễ',
    legendNow: 'Thời điểm cơ sở',
    planned: (start: string, end: string): string => `Kế hoạch ${start} ~ ${end}`,
    plannedFrom: (start: string): string => `Bắt đầu kế hoạch ${start}`,
    noSchedule: 'Không có lịch kế hoạch',
  },
  page: {
    label: 'Chuyển trang',
    prev: 'Trước',
    next: 'Sau',
    range: (start: number, end: number, total: number) =>
      `${String(start)}–${String(end)} trong ${String(total)} mục`,
    total: (total: number) => `${String(total)} mục`,

    /** ⛔ 「결과가 없습니다」로 적으면 조건을 더 만지게 된다 — 어떻게 풀 것인지를 적는다. */
    beyondLast: 'Trang này không có kết quả. Điều kiện đã hẹp lại nên số trang còn sót.',
    toFirst: 'Về trang đầu',
  },

  detail: {
    title: 'Chi tiết W/O',
    close: 'Đóng',
    prev: 'W/O trước',
    next: 'W/O sau',
    loading: 'Đang nhận chi tiết.',
    loadError: 'Chưa nhận được chi tiết. Hãy thử lại sau giây lát.',

    statusCode: 'Trạng thái',
    steps: 'Các bước tiến độ',
    orderQty: 'Số lượng lệnh',
    goodQty: 'Đạt',
    defectQty: 'Lỗi',
    holdQty: 'Tạm giữ',
    scrapQty: 'Phế liệu',
    reworkQty: 'Làm lại',
    achievementRate: 'Tỷ lệ đạt',
    process: 'Công đoạn',
    productionLine: 'Dòng',
    equipment: 'Thiết bị',
    productionOrder: 'P/O',
    plannedPeriod: 'Thời gian kế hoạch',
    period: (startAt: string, endAt: string): string => `${startAt} ~ ${endAt}`,
    remarks: 'Ghi chú',

    noRecords: 'Không có phiên làm việc, kết quả, ghi nhận lỗi, vật tư thay đổi 4M.',
    crewLoading: 'Đang nhận phiên làm việc và kết quả theo người làm.',
    crewLoadError: 'Chưa nhận được phiên làm việc và kết quả theo người làm.',
    sessionsTruncated: 'Không tải được một phần phiên làm việc.',
    resultsTruncated: 'Không tải được một phần kết quả.',
    unknownWorker: 'Không rõ',
    roles: { MAIN: 'Chính', SUB: 'Phụ', BOTH: 'Chính·Phụ' },
    workerLabel: (workerName: string, workerNo: string): string => `${workerName} (${workerNo})`,
    sessions: {
      heading: 'Phiên làm việc',
      session: (sessionNo: number): string => `Phiên ${String(sessionNo)}`,
      range: (startedAt: string, endedAt: string): string => `${startedAt} ~ ${endedAt}`,
      ongoing: 'Đang làm',
      empty: 'Không có phiên làm việc.',
      noParticipants: 'Không có người tham gia.',
      columns: {
        worker: 'Người làm',
        role: 'Chính/Phụ',
        joinedAt: 'Tham gia',
        leftAt: 'Rời',
        minutes: 'Số phút tham gia',
      },
    },
    defectTypes: {
      heading: 'Theo loại lỗi',
      empty: 'Không có ghi nhận lỗi.',
      untyped: 'Không có loại',
      columns: { type: 'Loại lỗi', qty: 'Số lượng' },
    },
    workerResults: {
      heading: 'Kết quả theo người làm',
      empty: 'Không có kết quả.',
      columns: {
        worker: 'Người làm',
        role: 'Chính/Phụ',
        goodQty: 'Đạt',
        defectQty: 'Lỗi',
        holdQty: 'Tạm giữ',
        scrapQty: 'Phế liệu',
        reworkQty: 'Làm lại',
      },
    },
  },

  /** 집계는 조회 시점의 스냅샷이라 언제 기준인지가 값의 일부다. */
  basis: {
    label: (at: string) => `Cập nhật lần cuối ${at}`,
    refresh: 'Làm mới',
  },
};
