import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-05-13 툴/금형/지그 마스터 관리. 테이블 이름은 금형이지만 담는 것은 모든 도구라,
 * 문구는 「툴」의 말(`công cụ`)을 쓰고 금형(`khuôn`)은 캐비티 자리에서만 선다.
 */
export const toolMaster: Translated<typeof ko.toolMaster> = {
  title: 'Dữ liệu gốc công cụ / khuôn / đồ gá',
  paneTitle: 'Danh sách công cụ',
  breadcrumbRoot: 'Thiết bị / Công cụ',
  actions: {
    addTool: 'Đăng ký công cụ',
    importTools: 'Tải lên Excel',
  },
  import: {
    title: 'Tải lên Excel công cụ',
    partialWarningTitle: 'Tải lên không hoàn tác toàn bộ',
    partialWarning:
      'Dòng thành công vẫn được đăng ký, chỉ dòng thất bại quay lại. Tải lên sai cũng không có cách hoàn tác nên hãy kiểm tra tệp trước.',
    noLabelNote: 'Tải lên chỉ tạo dòng dữ liệu gốc. Nhãn không được phát hành.',
    plantLabel: 'Nhà máy đích',
    plantPlaceholder: 'Hãy chọn nhà máy',
    plantRequired: 'Hãy chọn nhà máy cần tải lên trước.',
    fileLabel: 'Tệp Excel công cụ',
    filePlaceholder: 'Chọn tệp',
    fileNone: 'Chưa chọn tệp nào.',
    submit: 'Tải lên',
    fileRequired: 'Hãy chọn tệp cần tải lên trước.',
    resultTitle: 'Kết quả tải lên',
    succeeded: (count: number): string => `Đã đăng ký ${count} mục.`,
    failed: (count: number): string => `${count} mục thất bại.`,
    allSucceeded: 'Không có dòng nào thất bại.',
    noneSucceeded: 'Không có dòng nào được đăng ký.',
    /** ⛔ 엑셀 행 번호라고 말하지 않는다 — 아는 것은 「몇 번째 자료 줄인가」뿐이다. */
    rowLabel: (dataRowNumber: number): string => `Dòng dữ liệu thứ ${dataRowNumber}`,
    rowNote: 'Là số thứ tự dòng dữ liệu, không tính dòng tiêu đề.',
    fields: {
      row: 'Dòng',
      key: 'Giá trị định danh',
      reason: 'Lý do',
    },
    keyUnknown: 'Không có giá trị định danh',
  },
  loading: {
    tools: 'Đang tải danh sách công cụ',
  },
  listTruncated: (shown: number, total: number): string =>
    `Hiển thị ${shown} trong tổng ${total} mục. Hãy thu hẹp điều kiện rồi tra cứu.`,
  optionsTruncated:
    'Danh sách lựa chọn chỉ hiển thị một phần. Không thấy giá trị cần tìm thì hãy báo người phụ trách.',
  optionsLoadFailed: 'Không tải được danh sách lựa chọn. Chỉ hiển thị giá trị đang lưu.',
  empty: {
    noneTitle: 'Chưa đăng ký công cụ nào',
    noneDescription: 'Đăng ký công cụ thì sẽ hiện ở đây.',
    noMatchTitle: 'Không có công cụ khớp điều kiện',
    noMatchDescription: 'Hãy bớt điều kiện hoặc đặt lại rồi tra cứu lại.',
  },
  filters: {
    searchLabel: 'Tìm công cụ',
    searchPlaceholder: 'Mã công cụ hoặc tên công cụ',
    plantAll: 'Tất cả nhà máy',
    typeAll: 'Tất cả loại',
    /** 적정타수가 비면 사용 가능 타수도 초과율도 셀 수 없다 — 채울 것을 세는 자리다. */
    guaranteedMissingOnly: 'Chỉ công cụ không có số nhát dập đảm bảo',
    pmDueOnly: 'Chỉ mục đến hạn bảo trì phòng ngừa',
    sortLabel: 'Sắp xếp',
    sort: {
      shotUsageDesc: 'Tỷ lệ vượt cao trước',
      nextPmAsc: 'Ngày dự kiến kế tiếp sớm trước',
      code: 'Theo mã',
    },
    chipRemoveKeyword: 'Bỏ điều kiện từ khóa',
    chipRemovePlant: 'Bỏ điều kiện nhà máy',
    chipRemoveType: 'Bỏ điều kiện loại',
    chipRemoveGuaranteedMissing: 'Bỏ điều kiện «chỉ mục chưa có số nhát dập đảm bảo»',
    chipRemovePmDue: 'Bỏ điều kiện «chỉ mục đến hạn bảo trì phòng ngừa»',
    chipRemoveIncludeInactive: 'Bỏ điều kiện gồm cả mục ngừng dùng',
    chipKeyword: (value: string): string => `Từ khóa: ${value}`,
    chipPlant: (label: string): string => `Nhà máy: ${label}`,
    chipType: (label: string): string => `Loại: ${label}`,
  },
  fields: {
    toolCode: 'Mã công cụ',
    toolName: 'Tên công cụ',
    toolType: 'Loại công cụ',
    plant: 'Nhà máy',
    status: 'Trạng thái vận hành',
    pm: 'Bảo trì phòng ngừa',
    availableShotCount: 'Số nhát dập khả dụng',
    shotUsageRatio: 'Tỷ lệ vượt',
    cavityCount: 'Số khoang khuôn',
    guaranteedShotCount: 'Số nhát dập đảm bảo',
    currentShotCount: 'Số nhát dập lũy kế',
    pmTriggerType: 'Tiêu chí đánh giá bảo trì phòng ngừa',
    pmCycleInterval: 'Khoảng chu kỳ bảo trì phòng ngừa',
    pmCycleUnit: 'Đơn vị chu kỳ bảo trì phòng ngừa',
    lastPmDate: 'Ngày bảo trì phòng ngừa gần nhất',
    nextPmDate: 'Ngày dự kiến bảo trì phòng ngừa kế tiếp',
    labelIssueCount: 'Số lần đã phát hành nhãn',
    notRecorded: 'Không có ghi nhận',
  },
  form: {
    createTitle: 'Đăng ký công cụ',
    editTitle: 'Sửa công cụ',
    plantPlaceholder: 'Hãy chọn nhà máy',
    typePlaceholder: 'Hãy chọn loại công cụ',
    cycleUnitPlaceholder: 'Hãy chọn đơn vị chu kỳ',
    labelIssued: (count: number): string => `${count} lần`,
  },
  /** 계약이 네 값과 뜻을 함께 못박았다 — 화면이 지어낸 값이 아니다. */
  pmTrigger: {
    shot: 'Số nhát dập',
    date: 'Ngày',
    both: 'Số nhát dập và ngày',
    none: 'Không thực hiện',
  },
  pmCycleUnit: {
    day: 'Ngày',
    month: 'Tháng',
  },
  retire: {
    deactivateTitle: 'Ngừng sử dụng công cụ này?',
    deactivateImpact:
      'Kết quả mà công cụ này để lại vẫn giữ nguyên, chỉ khi chọn mới thì nó không còn trong danh sách.',
    deactivateNotReversibleHere:
      'Không xóa. Nhưng màn hình này không có cách bật lại, muốn hoàn tác thì phải nhờ người phụ trách.',
    deactivateConfirm: 'Ngừng sử dụng',
    deactivateTarget: (label: string): string => `Ngừng sử dụng ${label}.`,
    disposeTitle: 'Xử lý thanh lý?',
    /** 사용 중지와 다른 축이다 — 그것은 감추는 것이고 이것은 자산이 끝난 것이다. */
    disposeImpact:
      'Đây là xử lý khác với ngừng sử dụng. Ngừng sử dụng là ẩn khỏi danh sách, còn thanh lý là tài sản đã kết thúc.',
    disposeNotReversible:
      'Không thể hoàn tác. Sau khi thanh lý thì tải lại cũng không mở được chỉnh sửa.',
    disposeConfirm: 'Xử lý thanh lý',
    disposeTarget: (label: string): string => `Thanh lý ${label}.`,
    referenceCount: (count: number): string => `Có ${count} dữ liệu tham chiếu đến công cụ này.`,
    referenceNone: 'Không có dữ liệu nào tham chiếu đến công cụ này.',
    /** ⛔ 모르는 것을 「없다」로 그리지 않는다. */
    referenceUnknown: 'Không đếm được số dữ liệu tham chiếu đến công cụ này.',
    labelIssued: (count: number): string =>
      `Nhãn của công cụ này đã phát hành ${count} lần và đang ở hiện trường.`,
  },
  /** ⭐ 감추지 않고 「왜 여기서 못 하는지」를 말한다. */
  actionReasons: {
    plantFixed: 'Nhà máy được định khi đăng ký và không thể chuyển ở màn hình này.',
    cycleNeedsDateAxis: 'Đưa ngày vào tiêu chí đánh giá thì mới nhập được chu kỳ.',
    statusOwnedElsewhere: 'Trạng thái vận hành thay đổi qua ngừng sử dụng · xử lý thanh lý.',
    shotCountOwnedElsewhere:
      'Số nhát dập lũy kế do nhập kết quả sử dụng công cụ cộng thêm, và do đăng ký kết quả bảo trì phòng ngừa công cụ trả lại.',
    pmDateOwnedElsewhere:
      'Ngày bảo trì phòng ngừa gần nhất được định ở đăng ký kết quả bảo trì phòng ngừa công cụ.',
    alreadyInactive: 'Công cụ này đã ngừng sử dụng.',
    alreadyDisposed: 'Công cụ này đã thanh lý.',
    targetUnknown: 'Chưa tải được thông tin công cụ.',
    disposeUnavailable:
      'Danh sách giá trị trạng thái tài sản chưa sẵn sàng nên chưa thể xử lý thanh lý.',
  },
  notes: {
    cavityMeaningfulForMold: 'Số khoang khuôn chỉ có ý nghĩa với khuôn.',
    /** ⭐ 막지 않고 알린다 — 막으면 나중에 채우는 길이 사라진다. */
    guaranteedMissingBlocksShotAxis:
      'Nếu số nhát dập đảm bảo để trống thì không tính được số nhát dập khả dụng và tỷ lệ vượt, và bảo trì phòng ngừa không đến hạn theo số nhát dập.',
  },
  validation: {
    required: 'Mục bắt buộc.',
    codeBlank: 'Không thể tạo mã công cụ chỉ bằng khoảng trắng.',
    cavityPositiveInteger: 'Hãy nhập số khoang khuôn là số nguyên từ 1 trở lên.',
    guaranteedPositiveInteger:
      'Hãy nhập số nhát dập đảm bảo là số nguyên từ 1 trở lên. Không có thì để trống.',
    cycleRequired: 'Đã đưa ngày vào tiêu chí đánh giá thì hãy nhập cả khoảng chu kỳ và đơn vị.',
    intervalPositiveInteger: 'Hãy nhập khoảng chu kỳ là số nguyên từ 1 trở lên.',
  },
  values: {
    /** 미사용 표식은 칸이 아니라 이름에 붙는다 — 표가 넓어지지 않게 짧게 둔다. */
    inactiveSuffix: ' (ngừng dùng)',
  },
  shots: {
    guaranteedMissing: 'Không có số nhát dập đảm bảo',
    notCalculable: 'Không tính được',
    percent: (ratio: string): string => `${ratio}%`,
  },
  /** ⛔ 「판정 없음」과 「도래 전」은 다른 말이다 — 앞은 모르는 것이고 뒤는 정상이다. */
  pm: {
    notRequired: 'Không phải đối tượng',
    due: 'Đến hạn',
    dueByAxis: (axis: string): string => `Đến hạn theo ${axis}`,
    beforeDue: 'Chưa đến hạn',
    unknown: 'Không có đánh giá',
    /** 배지 문장 가운데에만 서므로 소문자로 둔다. */
    axis: {
      shot: 'số nhát dập',
      date: 'ngày',
    },
  },
};
