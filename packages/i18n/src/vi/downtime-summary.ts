import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-05-08 비가동 집계 조회. 집계는 빼는 것이 많은 자리라, 옮긴 말도
 * 「숫자가 무엇을 담고 무엇을 빼고 있는지」를 계속 말한다.
 */
export const downtimeSummary: Translated<typeof ko.downtimeSummary> = {
  title: 'Tra cứu tổng hợp dừng máy',
  breadcrumbRoot: 'Thiết bị / Công cụ',

  panes: {
    filters: 'Điều kiện tra cứu',
    summary: 'Tổng hợp',
    detail: 'Phân bố',
  },

  filters: {
    period: 'Khoảng thời gian',
    plant: 'Nhà máy',
    equipmentGroup: 'Nhóm thiết bị',
    equipment: 'Thiết bị',
    all: 'Tất cả',
    search: 'Tra cứu',
    reset: 'Đặt lại',
    download: 'Tải xuống',
    periodRequired:
      'Chọn khoảng thời gian thì mới tra cứu được. Hãy điền cả ngày bắt đầu và ngày kết thúc.',
    periodInvalid: 'Ngày không có trên lịch. Hãy chọn lại ngày bắt đầu và ngày kết thúc.',
    periodReversed: 'Ngày kết thúc trước ngày bắt đầu. Hãy đổi chỗ hai ngày.',
    lookupFailed: (name: string): string =>
      `Không tải được danh sách ${name} nên hiện chưa chọn được. Hãy thử lại.`,
    lookupTruncated: (name: string): string =>
      `Chỉ hiển thị một phần danh sách ${name}. Không thấy giá trị cần tìm thì hãy hỏi người phụ trách.`,
  },

  summary: {
    operating: 'Thời gian vận hành',
    plannedDowntime: 'Dừng máy theo kế hoạch',
    actualDowntime: 'Dừng máy thực tế',
    availability: 'Tỷ lệ thời gian hoạt động',
    availabilityUnavailable: 'Không tính được',
    availabilityUnavailableNote:
      'Không có thời gian vận hành nên không tính được tỷ lệ thời gian hoạt động.',
    scopeNote:
      'Màn hình này chỉ tính đến tỷ lệ thời gian hoạt động. Hiệu suất thiết bị tổng thể không tính ở đây.',

    openIntervals: 'Khoảng bị bỏ khỏi tổng hợp',
    openIntervalsNote:
      'Đây là các khoảng chưa kết thúc nên bị bỏ khỏi tổng. Nếu cắt theo «đến hiện tại» thì mỗi lần tra cứu giá trị lại khác.',
    openIntervalsOpen: 'Xem khoảng bị bỏ',

    overlappingIntervals: 'Khoảng chồng nhau chỉ đếm một lần',
    overlappingIntervalsNote:
      'Hai khoảng chồng lên cùng một quãng thời gian thì tổng chỉ đếm một lần. Không chia được phần đó thuộc lý do nào nên phân bố theo lý do không chứa phần đó.',
    overlappingIntervalsOpen: 'Xem khoảng chồng nhau',

    minorStops: 'Dừng ngắn',
    minorStopsNote: (threshold: number): string =>
      `Là các lần dừng ngắn hơn ${String(threshold)} phút. Đã nằm trong tổng ở trên và không trừ riêng — chính việc xảy ra thường xuyên đã là tín hiệu.`,
    minorStopsThresholdUnknown:
      'Phản hồi không trả về thời gian chuẩn để coi là dừng ngắn nên không ghi được căn cứ đánh giá.',

    sessionsWithoutEquipment: 'Công việc không gắn thiết bị',
    sessionsWithoutEquipmentNote:
      'Có tính vào thời gian vận hành nhưng không có trong phân bố theo thiết bị. Gắn thiết bị vào thì sẽ vào phân bố.',

    maintenance: 'Số mục bảo trì',
    corrective: 'Bảo trì khắc phục',
    preventive: 'Bảo trì phòng ngừa',
    breakdownsWithoutOrder: 'Sự cố đóng mà không có lệnh',
    breakdownsWithoutOrderNote:
      'Là số mục sự cố hoàn thành mà không có lệnh bảo trì. Mẫu số của tỷ lệ là tổng số mục bảo trì khắc phục và phòng ngừa.',

    unitMinutes: 'phút',
    unitCount: 'mục',
  },

  /** 분 표기를 대체하지 않고 곁들이는 꼴. 베트남어는 수와 단위 사이를 띄운다. */
  duration: {
    minutesOnly: (minutes: string): string => `${minutes} phút`,
    hoursOnly: (hours: string): string => `${hours} giờ`,
    hoursMinutes: (hours: string, minutes: string): string => `${hours} giờ ${minutes} phút`,
  },

  tabs: {
    reason: 'Theo lý do',
    equipment: 'Theo thiết bị',
    period: 'Diễn biến',
  },

  bucket: {
    label: 'Độ lớn ô',
    day: 'Ngày',
    week: 'Tuần',
    month: 'Tháng',
  },

  table: {
    reasonCode: 'Lý do',
    equipmentCode: 'Thiết bị',
    periodStart: 'Bắt đầu khoảng',
    count: 'Số mục',
    totalMinutes: 'Tổng (phút)',
    averageMinutes: 'Trung bình (phút)',
    sharePercent: 'Tỷ trọng',
    reasonCaption:
      'Phần của khoảng chồng nhau không thuộc về lý do nào. Tổng theo lý do có thể khác dừng máy thực tế.',
    equipmentCaption:
      'Công việc không gắn thiết bị không xuất hiện trong bảng này. Hãy xem kèm số mục ở phần tổng hợp.',
    periodCaption: 'Độ lớn của ô do «Độ lớn ô» ở trên quyết định.',
    unknownName: 'Không có tên',
    notAvailable: '—',
    emptyTitle: 'Không có phân bố',
    empty: 'Kỳ này không có dừng máy nào được tổng hợp.',
  },

  intervals: {
    openTitle: 'Khoảng bị bỏ khỏi tổng hợp',
    overlappingTitle: 'Khoảng chồng nhau chỉ đếm một lần',
    close: 'Đóng',
    equipment: 'Thiết bị',
    reason: 'Lý do',
    startedAt: 'Bắt đầu',
    endedAt: 'Kết thúc',
    duration: 'Độ dài (phút)',
    ongoing: 'Đang diễn ra',
    emptyTitle: 'Không có khoảng',
    empty: 'Không có khoảng nào tương ứng.',
    scopeMismatch:
      'Danh sách này không lọc theo điều kiện nhà máy · nhóm thiết bị. Có thể hiện nhiều hơn số mục ở phần tổng hợp trên.',
  },

  download: {
    note: 'Tải phân bố đang xem xuống thành tệp.',
    disabled:
      'Tải xuống chỉ dùng được sau khi tra cứu. Hãy chọn khoảng thời gian và tra cứu trước.',
    /** 파일 이름에는 성조 부호를 넣지 않는다 — 내려받는 쪽 파일 시스템이 깨뜨린다. */
    fileName: (tab: string, from: string, to: string): string =>
      `TongHopDungMay_${tab}_${from}_${to}.csv`,
  },
};
