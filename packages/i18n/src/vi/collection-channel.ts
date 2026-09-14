import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-05-07 수집 채널 매핑 관리. 이 화면이 하는 일은 「설비가 보내오는 이름」을 「검사 항목」에
 * 잇는 것 하나이고, 잇지 않은 채널의 값이 버려진다는 사실을 옮긴 말에서도 그대로 말한다.
 */
export const collectionChannel: Translated<typeof ko.collectionChannel> = {
  title: 'Quản lý ánh xạ kênh thu thập',
  breadcrumbRoot: 'Thiết bị / Công cụ',
  optionsTruncated:
    'Danh sách lựa chọn chỉ hiển thị một phần. Không thấy giá trị cần tìm thì hãy báo người phụ trách.',
  optionsLoadFailed: 'Không tải được danh sách lựa chọn. Chỉ hiển thị giá trị đang lưu.',
  equipment: {
    paneTitle: 'Danh sách thiết bị',
    searchLabel: 'Tìm thiết bị',
    searchPlaceholder: 'Số thiết bị hoặc tên thiết bị',
    plantAll: 'Tất cả nhà máy',
    loading: 'Đang tải danh sách thiết bị',
    emptyTitle: 'Chưa đăng ký thiết bị nào',
    emptyDescription: 'Đăng ký thiết bị thì sẽ hiện ở đây.',
    noMatchTitle: 'Không có thiết bị khớp điều kiện',
    noMatchDescription: 'Hãy bớt điều kiện hoặc đặt lại rồi tra cứu lại.',
    /** 잘림을 감추지 않는다 — 찾는 설비가 목록에 없을 수 있다. */
    truncated: (shown: number, total: number): string =>
      `Hiển thị ${shown} trong tổng ${total} mục. Hãy thu hẹp điều kiện rồi tra cứu.`,
    /** 행이 곧 손잡이다 — 접근 이름에 무엇이 열리는지 담는다. */
    selectLabel: (code: string, name: string): string => `Xem kênh thu thập của ${code} ${name}`,
    chipRemoveKeyword: 'Bỏ điều kiện từ khóa',
    chipRemovePlant: 'Bỏ điều kiện nhà máy',
    chipKeyword: (value: string): string => `Từ khóa: ${value}`,
    chipPlant: (label: string): string => `Nhà máy: ${label}`,
  },
  channels: {
    paneTitle: 'Ánh xạ kênh',
    paneOf: (code: string, name: string): string => `Kênh thu thập của ${code} · ${name}`,
    /** 설비를 고르기 전에는 조회 자체가 없다 — 무엇을 해야 하는지 말한다. */
    noEquipmentTitle: 'Hãy chọn thiết bị',
    noEquipmentDescription:
      'Chọn thiết bị ở bên trái thì kênh thu thập của thiết bị đó sẽ hiện ra.',
    loading: 'Đang tải danh sách kênh thu thập',
    emptyTitle: 'Chưa đăng ký kênh thu thập nào',
    emptyDescription: 'Đăng ký tín hiệu nhận từ thiết bị này thành kênh thì sẽ hiện ở đây.',
    noMatchTitle: 'Không có kênh thu thập khớp điều kiện',
    noMatchDescription: 'Hãy bớt điều kiện hoặc đặt lại rồi xem lại.',
    unmappedOnly: 'Chỉ xem kênh chưa ánh xạ',
    /** ⭐ 버려진다고 명시한다 — 「매핑 없음」이라고만 쓰면 결과를 알 수 없다. */
    unmappedSummary: (count: number): string =>
      `Có ${count} kênh không có hạng mục kiểm tra đích. Giá trị vào bằng kênh này không được lưu mà bị bỏ đi.`,
    unmappedSummaryTitle: 'Có kênh nhận vào nhưng không được dùng',
    unmappedOnLoadedOnly:
      'Điều kiện chưa ánh xạ chỉ áp dụng cho danh sách đang tải. Phần bị cắt có thể còn kênh chưa ánh xạ nên hãy thu hẹp điều kiện rồi tra cứu.',
    listTruncated: (shown: number, total: number): string =>
      `Hiển thị ${shown} mục trên tổng ${total} mục.`,
    mayHaveMore: (shown: number): string => `Hiển thị ${shown} mục. Có thể còn nữa.`,
  },
  /** 이 매핑이 언제 적용되는지 — 비면 「전체」다. 빈 칸이 아니라 전체를 뜻하는 값이다. */
  scope: {
    columnHeader: 'Điều kiện',
    all: 'Tất cả',
    itemLabel: 'Điều kiện mặt hàng',
    processLabel: 'Điều kiện công đoạn',
    anyOption: 'Tất cả (không điều kiện)',
    note: 'Để trống là tất cả — kênh này của thiết bị này luôn đi vào hạng mục đó.',
    /** 값 이름 안의 이음쇠(·)와 갈리는 쇠를 쓴다. */
    join: ' / ',
    entry: (axisLabel: string, valueLabel: string): string => `${axisLabel} ${valueLabel}`,
    item: 'Mặt hàng',
    process: 'Công đoạn',
  },
  fields: {
    activation: 'Sử dụng',
    plant: 'Nhà máy',
    equipment: 'Thiết bị',
    equipmentCode: 'Số thiết bị',
    equipmentName: 'Tên thiết bị',
    channelKey: 'Tên kênh',
    signalName: 'Tên tín hiệu',
    unit: 'Đơn vị',
    inspectionItem: 'Hạng mục kiểm tra đích',
    isActive: 'Sử dụng',
    notRecorded: 'Không có ghi nhận',
  },
  /**
   * ⛔ 「미매핑」과 「연결됨」을 같은 말로 그리지 않는다 — 앞은 값이 버려진다는 뜻이고 뒤는
   * 정상이다. 그래서 앞은 매핑의 말(`ánh xạ`)로, 뒤는 이어졌다는 말(`nối`)로 가른다.
   */
  mapping: {
    unmapped: 'Chưa ánh xạ',
    mapped: 'Đã nối',
    itemLabel: (code: string, name: string): string => `${code} · ${name}`,
    nameUnavailable:
      'Có dòng đã nối nhưng không nhận được tên hạng mục kiểm tra — chỉ hiển thị đã nối hay chưa.',
  },
  /** 이어 둔 뒤에 어긋난 것들. 값이 저장되긴 하되 조용히 어긋난다 — 미매핑과 성격이 다르다. */
  warnings: {
    summaryTitle: 'Có ánh xạ cần xem lại',
    staleRevisionChip: 'Rev trước',
    staleRevision: (count: number): string =>
      `Có ${count} kênh nối vào hạng mục kiểm tra của Rev trước. Hạng mục nào của Rev mới tương ứng thì chỉ người mới biết nên màn hình không chuyển.`,
    staleRevisionRow: (revision: number | null): string =>
      revision === null
        ? 'Là hạng mục kiểm tra của Rev trước.'
        : `Là hạng mục kiểm tra của Rev ${revision}.`,
    unitMismatchChip: 'Lệch đơn vị',
    unitMismatch: (count: number): string =>
      `Có ${count} kênh có đơn vị khác với đơn vị của hạng mục kiểm tra. Giá trị không được đổi tự động nên hãy chỉnh phía gửi hoặc định nghĩa hạng mục cho khớp.`,
    unitMismatchRow: (channelUnitCode: string, itemUnitCode: string): string =>
      `Kênh này nhận bằng ${channelUnitCode} còn hạng mục kiểm tra dùng ${itemUnitCode}.`,
  },
  actions: {
    addChannel: 'Thêm kênh',
    importFromLog: 'Lấy từ nhật ký nhận',
  },
  /**
   * ⭐ 외부에서 오는 이름은 손으로 치게 하지 않는다 — 오타 하나로 수신값이 조용히 버려진다.
   * 그렇다고 손 입력을 막지는 않는다.
   */
  importLog: {
    title: 'Lấy từ nhật ký nhận',
    description:
      'Đây là tín hiệu gần đây vào từ thiết bị này. Hãy chọn tín hiệu cần tạo thành kênh. Tên được lấy đúng như đã nhận nên không chép sai được.',
    loading: 'Đang tải tín hiệu nhận gần đây',
    /** ⭐ 비활성 사유는 그 컨트롤의 이름으로 시작한다. */
    noObservationsReason:
      'Lấy từ nhật ký nhận chỉ dùng được khi thiết bị này đã có bản ghi nhận. Hiện chưa có tín hiệu nào vào.',
    emptyTitle: 'Không có tín hiệu để chọn',
    emptyDescription: 'Không còn tín hiệu chưa nối. Muốn xem tất cả thì hãy tắt điều kiện.',
    unmappedOnly: 'Chỉ mục chưa nối',
    alreadyMapped: 'Đã đăng ký',
    loadFailed: 'Không tải được tín hiệu nhận gần đây.',
    confirm: 'Tạo kênh từ tín hiệu đã chọn',
    selectedCount: (count: number): string => `Đã chọn ${String(count)} mục`,
    /** ⛔ 「모두 만들었습니다」라고 말하지 않는다 — 한 건씩 나가므로 일부만 될 수 있다. */
    resultTitle: 'Kết quả lấy về',
    createdCount: (count: number): string => `Đã tạo ${String(count)} mục thành kênh.`,
    failedCount: (count: number): string =>
      `${String(count)} mục không tạo được. Đã để lại bên dưới, hãy thử lại hoặc đăng ký bằng tay.`,
    failedRow: (channelKey: string, reason: string): string => `${channelKey} — ${reason}`,
    unknownReason: 'Thất bại vì lý do không rõ.',
    fields: {
      channelKey: 'Tên tín hiệu',
      lastValue: 'Giá trị gần nhất',
      observedAt: 'Thời điểm nhận',
    },
    notRecorded: 'Không có ghi nhận',
  },
  form: {
    createTitle: 'Đăng ký kênh thu thập',
    editTitle: 'Sửa kênh thu thập',
    unitPlaceholder: 'Hãy chọn đơn vị',
    equipmentFixed: (code: string, name: string): string => `${code} · ${name}`,
  },
  /** 계약에 검사 항목의 전체 목록이 없다 — 세 칸을 차례로 좁혀야 항목에 닿는다. */
  itemPicker: {
    legend: 'Hạng mục kiểm tra đích',
    planLabel: 'Tiêu chuẩn kiểm tra',
    versionLabel: 'Phiên bản tiêu chuẩn kiểm tra',
    itemLabel: 'Hạng mục kiểm tra',
    planPlaceholder: 'Hãy chọn tiêu chuẩn kiểm tra',
    versionPlaceholder: 'Hãy chọn phiên bản',
    itemPlaceholder: 'Hãy chọn hạng mục kiểm tra',
    versionOption: (planVersion: number, statusLabel: string): string =>
      `Rev ${String(planVersion)} · ${statusLabel}`,
    unmapAction: 'Gỡ nối',
    unmapped:
      'Chưa nối hạng mục kiểm tra nào. Giá trị vào bằng kênh này không được lưu mà bị bỏ đi.',
    /** ⚠ 이 말은 「아직 못 찾았을 때」만 한다 — 이름을 알게 된 뒤에는 mappedKnown 이 선다. */
    mappedUnknown:
      'Đã nối hạng mục kiểm tra. Là hạng mục nào thì màn hình này không xác nhận được, muốn biết thì hãy chọn lại ở bên dưới.',
    mappedKnown: (name: string): string => `Giá trị của kênh này đi vào hạng mục ${name}.`,
    versionNeedsPlan: 'Chọn tiêu chuẩn kiểm tra trước thì mới chọn được phiên bản.',
    itemNeedsVersion: 'Chọn phiên bản trước thì mới chọn được hạng mục kiểm tra.',
    noVersions: 'Tiêu chuẩn kiểm tra này chưa có phiên bản.',
    noItems: 'Phiên bản này chưa có hạng mục kiểm tra.',
    plansLoadFailed: 'Không tải được danh sách tiêu chuẩn kiểm tra.',
    versionsLoadFailed: 'Không tải được danh sách phiên bản.',
    itemsLoadFailed: 'Không tải được danh sách hạng mục kiểm tra.',
  },
  /** ⭐ 단위가 다르면 경고만 한다 — 변환 규칙이 어디에도 저장돼 있지 않아 화면이 옮기지 않는다. */
  unitMatch: {
    mismatchTitle: 'Đơn vị khác nhau',
    mismatch: (channelUnitCode: string, itemUnitCode: string): string =>
      `Kênh này nhận bằng ${channelUnitCode} còn hạng mục kiểm tra đã chọn dùng ${itemUnitCode}. Giá trị không được đổi tự động nên hãy chỉnh phía gửi hoặc định nghĩa hạng mục cho khớp.`,
    /** ⛔ 「모른다」를 「같다」로 접지 않는다. */
    unknown:
      'Không xác nhận được đơn vị của hạng mục kiểm tra đã chọn nên chưa đối chiếu được với đơn vị của kênh này. Vẫn lưu được nhưng hãy tự kiểm tra xem đơn vị có khớp không.',
  },
  /** ⭐ 이 화면은 끄기와 켜기를 둘 다 갖는다 — 형제 화면과 갈리는 자리다. */
  activation: {
    deactivateAction: 'Ngừng sử dụng',
    resumeAction: 'Dùng lại',
    deactivateLabel: (channelKey: string): string => `Ngừng sử dụng ${channelKey}`,
    resumeLabel: (channelKey: string): string => `Dùng lại ${channelKey}`,
    deactivateTitle: 'Ngừng sử dụng kênh này?',
    resumeTitle: 'Bật lại kênh này?',
    target: (channelKey: string): string => `Xử lý kênh ${channelKey}.`,
    /** ⚠ 수집까지 멈추는지 아직 모른다 — 「값이 버려진다」고도 「담긴다」고도 말하지 않는다. */
    deactivateImpact:
      'Ngừng sử dụng thì kênh này không còn trong danh sách. Hạng mục kiểm tra đã nối với kênh không bị xóa.',
    deactivateReversible:
      'Đây là tắt chứ không phải xóa. Bật «gồm cả mục ngừng dùng» thì tìm lại và bật lại được.',
    resumeImpact:
      'Bật lại thì kênh này trở lại danh sách. Hạng mục kiểm tra đã nối cũng giữ nguyên.',
    loadingTarget: 'Đang tải thông tin kênh.',
  },
  /** ⭐ 감추지 않고 「왜 여기서 못 하는지」를 말한다. */
  actionReasons: {
    importNeedsObservations:
      'Đăng ký kênh thu thập vẫn làm bằng tay được. Hãy dùng «Thêm kênh» bên dưới.',
    equipmentFixed:
      'Thiết bị được định theo cái đã chọn ở bên trái và không thể chuyển ở cửa sổ này.',
    channelKeyFixed: 'Tên kênh được định khi đăng ký và không thể đổi về sau.',
  },
  validation: {
    required: 'Mục bắt buộc.',
    channelKeyBlank: 'Không thể tạo tên kênh chỉ bằng khoảng trắng.',
    /** ⛔ 유일 범위를 문구에 담는다 — 무엇이 겹쳤는지 말하지 않으면 고칠 자리를 찾지 못한다. */
    duplicateScope: (channelKey: string): string =>
      `Kênh ${channelKey} của thiết bị này đã có ánh xạ cùng điều kiện mặt hàng · công đoạn. Hãy đặt điều kiện khác hoặc sửa ánh xạ đó.`,
  },
  values: {
    active: 'Đang sử dụng',
    inactive: 'Ngừng dùng',
    inactiveSuffix: ' (ngừng dùng)',
  },
};
