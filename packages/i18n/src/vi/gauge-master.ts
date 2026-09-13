import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-05-11 계측기 마스터 관리. 계측기는 설비의 한 종류이고 계약도 같은 자원을 쓴다 —
 * 문구만 「계측기(thiết bị đo)」의 말을 쓴다.
 */
export const gaugeMaster: Translated<typeof ko.gaugeMaster> = {
  title: 'Quản lý dữ liệu gốc thiết bị đo',
  paneTitle: 'Danh sách thiết bị đo',
  breadcrumbRoot: 'Thiết bị / Công cụ',
  actions: {
    addGauge: 'Đăng ký thiết bị đo',
  },
  loading: {
    gauges: 'Đang tải danh sách thiết bị đo',
  },
  listTruncated: (shown: number, total: number): string =>
    `Hiển thị ${shown} trong tổng ${total} mục. Hãy thu hẹp điều kiện rồi tra cứu.`,
  optionsTruncated:
    'Danh sách lựa chọn chỉ hiển thị một phần. Không thấy giá trị cần tìm thì hãy báo người phụ trách.',
  optionsLoadFailed: 'Không tải được danh sách lựa chọn. Chỉ hiển thị giá trị đang lưu.',
  /**
   * ⚠ 밀림 조건은 화면이 걸고, 서버가 목록을 자르면 받아 온 것만 덮는다 — 그 사실을
   * 감추면 잘려 나간 쪽의 밀린 계측기가 없는 것처럼 보인다.
   */
  overdueOnLoadedOnly:
    'Điều kiện trễ hiệu chuẩn chỉ áp dụng cho danh sách đang tải. Phần bị cắt có thể còn thiết bị đo trễ hạn, hãy thu hẹp điều kiện rồi tra cứu.',
  empty: {
    noneTitle: 'Chưa có thiết bị đo nào được đăng ký',
    noneDescription: 'Đăng ký thiết bị đo thì sẽ hiện ở đây.',
    noMatchTitle: 'Không có thiết bị đo khớp điều kiện',
    noMatchDescription: 'Hãy bớt điều kiện hoặc đặt lại rồi tra cứu lại.',
  },
  filters: {
    searchLabel: 'Tìm thiết bị đo',
    searchPlaceholder: 'Mã thiết bị đo hoặc tên thiết bị đo',
    plantAll: 'Tất cả nhà máy',
    /** ⭐ 뜻은 「이 그룹의 값 전부」다 — 「전체 설비」가 아니라 계측기 계열 유형 전부다. */
    typeAll: 'Tất cả loại thiết bị đo',
    /** 「아직 안 함」과 「만료」를 함께 잡는다 — 둘 다 채워야 할 것이다. */
    overdueOnly: 'Chỉ mục trễ hiệu chuẩn',
    chipRemoveKeyword: 'Bỏ điều kiện từ khóa',
    chipRemovePlant: 'Bỏ điều kiện nhà máy',
    chipRemoveType: 'Bỏ điều kiện loại',
    chipRemoveOverdue: 'Bỏ điều kiện trễ hiệu chuẩn',
    chipRemoveIncludeInactive: 'Bỏ điều kiện gồm cả mục ngừng dùng',
    chipRemoveIncludeDisposed: 'Bỏ điều kiện gồm cả mục đã thanh lý',
    chipKeyword: (value: string): string => `Từ khóa: ${value}`,
    chipPlant: (label: string): string => `Nhà máy: ${label}`,
    chipType: (label: string): string => `Loại: ${label}`,
    includeDisposed: 'Gồm cả mục đã thanh lý',
  },
  form: {
    typePlaceholder: 'Hãy chọn loại thiết bị đo',
    createTitle: 'Đăng ký thiết bị đo',
    editTitle: 'Sửa thiết bị đo',
    plantPlaceholder: 'Hãy chọn nhà máy',
    cyclePlaceholder: 'Hãy chọn đơn vị chu kỳ',
    uomPlaceholder: 'Hãy chọn đơn vị',
  },
  /** ⭐ 감추지 않고 「왜 여기서 못 하는지」를 말한다. */
  actionReasons: {
    plantFixed: 'Nhà máy được định khi đăng ký và không thể chuyển ở màn hình này.',
    cycleNeedsCalibration: 'Chỉ định là đối tượng hiệu chuẩn thì mới nhập được chu kỳ.',
    statusOwnedElsewhere: 'Trạng thái vận hành thay đổi qua ngừng sử dụng · xử lý thanh lý.',
    calibrationDateOwnedElsewhere:
      'Ngày hiệu chuẩn được định ở màn hình đăng ký lịch sử hiệu chuẩn.',
    alreadyInactive: 'Thiết bị đo này đã ngừng sử dụng.',
    /** ⛔ 모르면 잠근다 — 열어 두면 눌러도 아무 일도 일어나지 않는다. */
    targetUnknown: 'Chưa tải được thông tin thiết bị đo.',
    alreadyDisposed: 'Thiết bị đo này đã thanh lý.',
    /** ⚠ 값 목록이 없으면 이미 폐기된 자산인지 판정할 수 없다 — 시드가 들어오면 저절로 풀린다. */
    disposeUnavailable:
      'Danh sách giá trị trạng thái tài sản chưa sẵn sàng nên chưa thể xử lý thanh lý.',
  },
  retire: {
    deactivateTitle: 'Ngừng sử dụng thiết bị đo này?',
    /** 중지해도 그 계측기가 남긴 검교정 기록은 그대로다 — 감추는 것과 지우는 것은 다르다. */
    deactivateImpact:
      'Bản ghi hiệu chuẩn mà thiết bị đo này để lại vẫn còn nguyên, chỉ bị bỏ khỏi danh sách khi chọn mới.',
    deactivateNotReversibleHere:
      'Không xóa. Nhưng màn hình này không có cách bật lại, muốn hoàn tác thì phải nhờ người phụ trách.',
    deactivateConfirm: 'Ngừng sử dụng',
    disposeTitle: 'Xử lý thanh lý?',
    /** 사용 중지와 «다른 축»이다 — 그것은 감추는 것이고 이것은 자산이 끝난 것이다. */
    disposeImpact:
      'Đây là xử lý khác với ngừng sử dụng. Ngừng sử dụng là ẩn khỏi danh sách, còn thanh lý là tài sản đã kết thúc.',
    disposeNotReversible:
      'Không thể hoàn tác. Sau khi thanh lý thì tải lại cũng không mở được chỉnh sửa.',
    disposeConfirm: 'Xử lý thanh lý',
    target: (label: string): string => `Xử lý ${label}.`,
    deactivateTarget: (label: string): string => `Ngừng sử dụng ${label}.`,
    disposeTarget: (label: string): string => `Thanh lý ${label}.`,
  },
  fields: {
    plant: 'Nhà máy',
    calibrationRequired: 'Đối tượng hiệu chuẩn',
    calibrationCycleType: 'Đơn vị chu kỳ hiệu chuẩn',
    calibrationCycleInterval: 'Khoảng chu kỳ hiệu chuẩn',
    precisionValue: 'Độ chính xác',
    precisionUom: 'Đơn vị độ chính xác',
    lastCalibrationDate: 'Ngày hiệu chuẩn gần nhất',
    calibrationDueDate: 'Ngày hiệu chuẩn dự kiến kế tiếp',
    notRecorded: 'Không có ghi nhận',
    gaugeCode: 'Mã thiết bị đo',
    gaugeName: 'Tên thiết bị đo',
    gaugeType: 'Loại thiết bị đo',
    status: 'Trạng thái vận hành',
    calibration: 'Hiệu chuẩn',
    isActive: 'Sử dụng',
  },
  values: {
    active: 'Đang sử dụng',
    inactive: 'Ngừng dùng',
    inactiveSuffix: ' (ngừng dùng)',
  },
  /**
   * ⭐ 검교정을 네 모양으로 그린다. 「아직 안 함」과 「대상 아님」은 다른 말이어야 한다 —
   * 앞은 채워야 할 것이고 뒤는 정상이다.
   */
  calibration: {
    notRequired: 'Không thuộc đối tượng hiệu chuẩn',
    never: 'Chưa có lịch sử hiệu chuẩn',
    valid: (days: number): string => (days === 0 ? 'Hiệu lực đến hết hôm nay' : `Còn ${days} ngày`),
    expired: (days: number): string => `Hết hạn — đã qua ${days} ngày`,
  },
  history: {
    title: 'Lịch sử hiệu chuẩn',
    loading: 'Đang tải lịch sử hiệu chuẩn',
    /** ⭐ 이 화면은 이력을 읽기만 한다 — 등록은 검교정 이력 등록 화면의 몫이다. */
    readOnlyNote:
      'Lịch sử hiệu chuẩn được ghi ở màn hình đăng ký lịch sử hiệu chuẩn. Ở đây chỉ xem được.',
    emptyTitle: 'Không có lịch sử hiệu chuẩn',
    emptyDescription: 'Hiệu chuẩn xong và ghi lại lịch sử thì sẽ hiện ở đây.',
    loadFailed: 'Không tải được lịch sử hiệu chuẩn.',
    /**
     * ⛔ 「최근」이라 말하지 않는다 — 계약에 정렬 조건이 없어 어느 20건을 받았는지 화면이
     * 알 수 없다. 받은 것을 세어 말할 뿐이다.
     */
    truncated: (shown: number, total: number): string =>
      `Hiển thị ${shown} trong tổng ${total} mục. Toàn bộ thì xem ở màn hình lịch sử hiệu chuẩn.`,
    /** ⛔ 「다 보여 주고 있다」고 말하지 않는다 — 이 응답만으로는 알 수 없다. */
    mayHaveMore: (shown: number): string => `Hiển thị ${shown} mục. Có thể còn nữa.`,
    fields: {
      performedOn: 'Ngày thực hiện',
      historyType: 'Phân loại',
      result: 'Kết quả',
      nextDueOn: 'Ngày dự kiến kế tiếp',
      agency: 'Tổ chức hiệu chuẩn',
      certificateNo: 'Số giấy chứng nhận',
    },
  },
  validation: {
    required: 'Mục bắt buộc.',
    codeBlank: 'Không thể tạo mã thiết bị đo chỉ bằng khoảng trắng.',
    /** ⭐ 짝 제약 — 하나만으로는 다음 예정일을 셀 수 없다. */
    cycleRequired: 'Nếu là đối tượng hiệu chuẩn thì hãy nhập cả đơn vị chu kỳ và khoảng chu kỳ.',
    intervalPositiveInteger: 'Hãy nhập khoảng chu kỳ là số nguyên từ 1 trở lên.',
    precisionUomRequired: 'Đã nhập giá trị độ chính xác thì hãy chọn cả đơn vị.',
    precisionValueRequired: 'Đã chọn đơn vị thì hãy nhập cả giá trị độ chính xác.',
    precisionPositive: 'Hãy nhập độ chính xác là số lớn hơn 0.',
    precisionScale: (scale: number): string =>
      scale === 0
        ? 'Đơn vị đã chọn không dùng chữ số sau dấu thập phân.'
        : `Đơn vị đã chọn dùng được tối đa ${scale} chữ số sau dấu thập phân.`,
  },
};
