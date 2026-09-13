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
  title: 'Tiến độ W/O',
  breadcrumbRoot: 'Thực thi sản xuất',

  filters: {
    legend: 'Điều kiện tra cứu',
    period: 'Kỳ',
    from: 'Ngày bắt đầu',
    to: 'Ngày kết thúc',
    productionLine: 'Dòng',
    status: 'Trạng thái',
    productionOrder: 'P/O',
    keyword: 'Số W/O',
    keywordPlaceholder: 'Một phần của số W/O',
    search: 'Tra cứu',
    reset: 'Đặt lại',

    /** ⛔ 「고르지 않음」이 아니라 무엇이 조회되는지를 적는다. */
    all: 'Tất cả',

    periodRequired: 'Tra cứu: Hãy điền kỳ. Cần cả ngày bắt đầu và ngày kết thúc.',
    periodInvalid: 'Tra cứu: Ngày này không có trên lịch. Hãy chọn lại.',
    periodReversed: 'Tra cứu: Ngày bắt đầu ở sau ngày kết thúc. Hãy đổi chỗ hai ngày.',

    /** ⛔ 넓은 기간을 막지 않는다 — 예고이지 금지가 아니다. */
    periodWide: 'Kỳ vượt quá 3 tháng. Tra cứu có thể chậm.',

    processUnavailable: 'Hiện chưa lọc được theo công đoạn.',

    statusUnavailable:
      'Chưa nhận được danh sách giá trị trạng thái. Hiện chưa lọc được theo trạng thái.',
    lookupFailed: 'Chưa nhận được các lựa chọn. Hãy thử làm mới trang.',

    optionsTruncated: (shown: number) =>
      `Chỉ có ${String(shown)} mục đầu trong các lựa chọn. Không thấy thứ cần tìm thì có thể là chưa nhận được.`,
  },

  /** ⛔ 숫자 식별자로 메우지 않는다 — 모르면 모른다고 적는다. */
  nameUnknown: 'Đang xác nhận tên',

  summary: {
    title: 'Tóm tắt',
    total: 'Tất cả',
    waiting: 'Chờ',
    running: 'Đang chạy',
    done: 'Xong',
    closed: 'Đã đóng',
    delayed: 'Trễ',

    goodQty: 'Đạt',
    defectQty: 'Lỗi',
    lossQty: 'Hao hụt',
    achievementRate: 'Tỷ lệ đạt',

    unavailableMark: 'ⓘ',

    /** ⛔ 무엇이 정확하고 무엇이 없는지를 한 문장에 담는다. */
    unavailable:
      'Số mục theo trạng thái, tổng số lượng và tỷ lệ đạt thì máy chủ chưa gửi về. Chỉ tổng số mục là chính xác.',
  },

  list: {
    title: 'Danh sách',
    columns: {
      workOrderNo: 'Số W/O',
      itemId: 'Mặt hàng',
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
    delayReference: 'Trễ là giá trị tham khảo do màn hình tính theo thời điểm cơ sở.',

    /** ⛔ 빈칸으로 두면 「정상」으로 읽힌다 — 판정할 수 없다는 뜻을 값 자리에 적는다. */
    delayUnknown: 'Không đánh giá được',

    quantityNote: 'Số lượng hiển thị nguyên năm nhánh mà máy chủ gửi về.',

    joinedColumnsNote: 'P/O và công đoạn không nhận được tên nên không đặt cột.',
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
    title: 'W/O đã chọn',
    close: 'Đóng',
    loading: 'Đang nhận chi tiết.',
    loadError: 'Chưa nhận được chi tiết. Hãy thử lại sau giây lát.',

    workOrderNo: 'Số W/O',
    statusCode: 'Trạng thái',
    orderQty: 'Số lượng lệnh',
    plannedStartAt: 'Bắt đầu kế hoạch',
    plannedEndAt: 'Kết thúc kế hoạch',
    completedAt: 'Hoàn thành',
    closedAt: 'Đóng',
    remarks: 'Ghi chú',

    historyUnavailable:
      'Lịch sử kết quả, LOT sản xuất và phiên làm việc hiện chưa hiện ở cửa sổ này.',
  },

  /** 집계는 조회 시점의 스냅샷이라 언제 기준인지가 값의 일부다. */
  basis: {
    label: (at: string) => `Cơ sở ${at}`,
    refresh: 'Làm mới',
    note: 'Màn hình này không tự làm mới. Hãy bấm «Làm mới» để tra cứu lại.',
  },
};
