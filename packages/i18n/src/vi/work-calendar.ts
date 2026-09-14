import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-05-09 작업 캘린더 설정. 날짜 선택기가 아니라 한 달을 펼쳐 칸마다 상태를 칠하는 편집
 * 그리드다 — 옮긴 말도 「고른다」가 아니라 「칠한다」 쪽으로 읽히게 둔다.
 */
export const workCalendar: Translated<typeof ko.workCalendar> = {
  title: 'Thiết lập lịch làm việc',
  listTitle: 'Danh sách lịch làm việc',
  breadcrumbRoot: 'Thiết bị / Công cụ',
  actions: {
    addCalendar: 'Đăng ký lịch',
    editCalendar: 'Sửa lịch',
  },
  loading: {
    calendars: 'Đang tải danh sách lịch',
  },
  listTruncated: (shown: number, total: number): string =>
    `Hiển thị ${shown} trong tổng ${total} mục. Hãy thu hẹp điều kiện rồi tra cứu.`,
  empty: {
    noneTitle: 'Chưa có lịch nào được đăng ký',
    noneDescription: 'Đăng ký lịch thì sẽ hiện ở đây.',
    noMatchTitle: 'Không có lịch khớp điều kiện',
    noMatchDescription: 'Hãy bớt điều kiện hoặc đặt lại rồi tra cứu lại.',
  },
  filters: {
    searchLabel: 'Tìm lịch',
    searchPlaceholder: 'Mã lịch hoặc tên lịch',
    chipRemoveKeyword: 'Bỏ điều kiện từ khóa',
    chipRemoveIncludeInactive: 'Bỏ điều kiện gồm cả mục ngừng dùng',
    chipKeyword: (value: string): string => `Từ khóa: ${value}`,
  },
  fields: {
    calendarCode: 'Mã lịch',
    calendarName: 'Tên lịch',
    isActive: 'Sử dụng',
    applicationCount: 'Đối tượng theo lịch',
  },
  values: {
    active: 'Đang sử dụng',
    inactive: 'Ngừng dùng',
  },
  form: {
    createTitle: 'Đăng ký lịch',
    editTitle: 'Sửa lịch',
    /** 「몇이 이 캘린더를 따르는가」 — 사용 중지 판단의 근거가 되는 값이다. */
    applicationCount: (count: number): string => `${count} nơi`,
    applicationNone: 'Không có đối tượng nào theo lịch này.',
    /** ⛔ 모르는 것을 「0곳」으로 그리지 않는다 — 아직 안 불러온 것과 없는 것은 다르다. */
    applicationUnknown: 'Chưa tải được.',
  },
  grid: {
    title: 'Thiết lập theo ngày',
    loading: 'Đang tải thiết lập theo ngày',
    pickCalendar: 'Chọn lịch ở bên trái thì thiết lập từng ngày của tháng đó sẽ hiện ở đây.',
    monthLabel: (year: number, month: number): string => `Tháng ${month}/${year}`,
    previousMonth: 'Tháng trước',
    nextMonth: 'Tháng sau',
    thisMonth: 'Tháng này',
    loadFailed: 'Không tải được thiết lập theo ngày.',
    /** 눌러 보지 않고도 무엇을 여는지 알아야 한다 — 날짜와 지금 상태를 함께 담는다. */
    pickDay: (date: string, status: string): string =>
      `${date} · ${status} — Sửa thiết lập của ngày này`,
    /** 베트남 달력의 요일 줄임말 — 일요일이 `CN`(Chủ nhật)이고 월요일부터 `T2` 다. */
    weekdays: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
    /** ⭐ 네 갈래를 서로 다른 말로 그린다 — 받지 않은 날을 「가동」으로 그리면 쉬는 날이 일하는 날로 보인다. */
    status: {
      unset: 'Chưa thiết lập',
      working: 'Làm việc',
      holiday: 'Nghỉ',
      partial: 'Làm việc một phần',
    },
  },
  dayForm: {
    title: (date: string): string => `Thiết lập ngày ${date}`,
    dayType: 'Phân loại',
    startTime: 'Thời điểm bắt đầu',
    endTime: 'Thời điểm kết thúc',
    reason: 'Lý do',
    remarks: 'Ghi chú',
    saved: (count: number): string => `Đã lưu ${count} ngày.`,
    /** ⭐ 감추지 않고 「왜 여기서 못 하는지」를 말한다. */
    timeNeedsPartial: 'Chọn phân loại «Làm việc một phần» thì mới nhập được giờ.',
    /** 사유는 선택이라 비어 있어도 저장된다 — 그 사실을 함께 밝힌다. */
    reasonOptional: 'Để trống lý do vẫn lưu được.',
  },
  bulk: {
    open: 'Áp dụng hàng loạt',
    title: 'Áp dụng hàng loạt theo ngày',
    from: 'Ngày bắt đầu',
    to: 'Ngày kết thúc',
    weekdays: 'Thứ',
    /** ⭐ 하나도 고르지 않으면 기간 전체다 — 「요일 일괄」과 「기간 일괄」이 한 자리다. */
    weekdaysNote: 'Không chọn thứ nào thì áp dụng cho mọi ngày trong khoảng.',
    /** ⭐ 바꾸기 «전에» 몇 날이 바뀌는지 말한다 — 통째로 되돌리는 수단이 없다. */
    willChange: (count: number): string => `${count} ngày sẽ thay đổi.`,
    /** ⛔ 0일이면 누를 것이 없다 — 감추지 않고 잠그고 사유를 말한다. */
    nothingToChange: 'Không có ngày nào khớp điều kiện. Hãy chọn lại khoảng ngày hoặc thứ.',
    apply: 'Áp dụng',
    /** 덮어쓴 날 수는 서버가 세어 준다 — 화면이 센 것과 다를 수 있다. */
    applied: (count: number): string => `Đã ghi đè ${count} ngày.`,
    /** ⚠ 되돌리는 수단이 없다는 사실을 함께 말한다. */
    notReversible: 'Ghi đè cả những ngày đã thiết lập. Không có cách hoàn tác.',
  },
  bulkValidation: {
    rangeRequired: 'Hãy chọn cả ngày bắt đầu và ngày kết thúc.',
    dateFormat: 'Hãy nhập ngày theo dạng `YYYY-MM-DD`.',
    endAfterStart: 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.',
  },
  dayValidation: {
    dayTypeRequired: 'Hãy chọn phân loại.',
    timesRequired: 'Nếu là làm việc một phần thì hãy nhập cả giờ bắt đầu và giờ kết thúc.',
    timeFormat: 'Hãy nhập giờ theo dạng `HH:MM`.',
    /** ⛔ 같은 시각도 받지 않는다 — 길이가 0인 조업 시간은 부분 가동이 아니다. */
    endAfterStart: 'Thời điểm kết thúc phải sau thời điểm bắt đầu.',
  },
  applications: {
    title: 'Đối tượng áp dụng',
    loading: 'Đang tải đối tượng áp dụng',
    pickCalendar: 'Chọn lịch ở bên trái thì các đối tượng theo lịch đó sẽ hiện ở đây.',
    emptyTitle: 'Không có đối tượng nào theo lịch này',
    emptyDescription: 'Chỉ định nhà máy hoặc nhóm thiết bị thì sẽ hiện ở đây.',
    loadFailed: 'Không tải được đối tượng áp dụng.',
    add: 'Chỉ định đối tượng',
    addTitle: 'Chỉ định đối tượng áp dụng',
    targetType: 'Loại đối tượng',
    target: 'Đối tượng',
    targetPlaceholder: 'Hãy chọn đối tượng',
    types: {
      plant: 'Nhà máy',
      equipmentGroup: 'Nhóm thiết bị',
    },
    release: 'Gỡ',
    releaseLabel: (name: string): string => `Gỡ chỉ định ${name}`,
    /** ⭐ 해제하면 사라지는 것이 아니라 상위 층을 따르게 된다. */
    releaseNote: 'Gỡ thì đối tượng đó theo lịch của tầng trên.',
    assigned: 'Đã chỉ định',
    released: 'Đã gỡ',
    /** ⭐ 「필수」인데 없을 수 있다 — 저장을 막지 않고 그 사실만 세어 보인다. */
    unassignedPlants: (count: number): string =>
      `Có ${count} nhà máy chưa được chỉ định lịch mặc định. Thiết bị của những nhà máy đó không có lịch để theo.`,
    /** ⭐ 공장 기본을 바꾸는 것은 한 번의 부름이다 — 옛 지정 해제와 새 지정을 서버가 함께 한다. */
    plantMovesNote: 'Chọn nhà máy đang theo lịch khác thì chỉ định đó chuyển sang lịch này.',
  },
  /**
   * 해석 미리보기. 화면이 계산하지 않는다 — 「이 설비가 무엇을 따르는가」와 훑은 경로를
   * 서버가 함께 내려 준다.
   */
  effective: {
    title: 'Xem trước lịch áp dụng',
    equipment: 'Thiết bị',
    equipmentPlaceholder: 'Hãy chọn thiết bị',
    pickEquipment:
      'Chọn thiết bị thì sẽ thấy lịch mà thiết bị đó theo và đường đi dẫn đến kết quả ấy.',
    loading: 'Đang tải kết quả áp dụng',
    loadFailed: 'Không tải được kết quả áp dụng.',
    follows: (calendarCode: string, level: string): string =>
      `Theo ${calendarCode} — được quyết định ở tầng ${level}.`,
    /** ⛔ 어느 층에도 지정이 없으면 따르는 캘린더가 «없다» — 그 사실을 밝힌다. */
    none: 'Không tầng nào có chỉ định nên không có lịch để theo.',
    /** ⚠ 층은 알겠는데 이름을 못 받았을 때 — 지어내지 않는다. */
    unknownLevel: 'Không rõ kết quả được quyết định ở tầng nào.',
    pathTitle: 'Đường đã dò',
    /** ⛔ 이 칸의 값은 설비가 아니라 «층의 대상»이다 — 설비 그룹이거나 공장이다. */
    stepTarget: 'Đối tượng',
    levels: {
      equipmentGroup: 'Nhóm thiết bị',
      plant: 'Nhà máy',
    },
    hasApplication: 'Quyết định ở đây',
    noApplication: 'Không chỉ định',
    /** ⭐ 가까운 층부터 차례로 담긴다 — 그 차례가 곧 「가장 가까운 것이 이긴다」의 모습이다. */
    pathNote: 'Dò lần lượt từ tầng gần nhất. Dừng ở tầng đầu tiên có chỉ định.',
  },
  retire: {
    title: 'Ngừng sử dụng lịch này?',
    target: (label: string): string => `Ngừng sử dụng ${label}.`,
    /** ⭐ 참조가 있으면 건수를 함께 보인 뒤 부른다 — 물리 삭제가 없는 자원이다. */
    applicationCount: (count: number): string =>
      `Có ${count} nơi đang theo lịch này. Ngừng thì các đối tượng đó sẽ theo tầng trên.`,
    applicationNone: 'Không có đối tượng nào theo lịch này.',
    /** ⛔ 모르는 것을 「없다」로 그리지 않는다. */
    applicationUnknown: 'Chưa tải được số đối tượng đang theo lịch này.',
    /** 중지해도 일자 설정은 그대로다 — 감추는 것과 지우는 것은 다르다. */
    impact:
      'Thiết lập theo ngày đã nhập vào lịch này vẫn còn nguyên, chỉ bị bỏ khỏi danh sách khi chọn mới.',
    notReversibleHere:
      'Không xóa. Nhưng màn hình này không có cách bật lại, muốn hoàn tác thì phải nhờ người phụ trách.',
    confirm: 'Ngừng sử dụng',
    /** ⛔ 모르면 잠근다 — 열어 두면 눌러도 아무 일도 일어나지 않는다. */
    targetUnknown: 'Chưa tải được thông tin lịch.',
    alreadyInactive: 'Lịch này đã ngừng sử dụng.',
  },
  validation: {
    required: 'Mục bắt buộc.',
    codeBlank: 'Không thể tạo mã lịch chỉ bằng khoảng trắng.',
  },
};
