import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-06-15 결재선 정의.
 *
 * ⚠ **결재함(#1120)과 같은 낱말을 쓴다** — 결재선 `luồng phê duyệt` · 승인/결재 `phê duyệt` ·
 * 상신 `trình` · 반려 `từ chối` · 단계 `bước`. 두 화면이 같은 요청을 가리키므로 낱말이 갈리면
 * 사용자는 서로 다른 두 제도로 읽는다.
 *
 * ⛔ **내부 번호를 문구로 만들지 않는다.** 이름을 못 풀면 그 사실을 적고 번호를 대신 내지
 * 않는다 — 번호를 담을 자리가 옮긴 문구에도 없어야 새는 경로가 없다.
 *
 * ⛔ **화면이 아는 것만 말한다.** 「이 결재선이 지금 상신에 쓰인다」로 읽히는 말을 만들지
 * 않는다 — 고르는 규칙은 서버가 갖는다.
 */
export const approvalRoute: Translated<typeof ko.approvalRoute> = {
  title: 'Định nghĩa luồng phê duyệt',
  breadcrumbRoot: 'Quản trị hệ thống',
  panes: {
    list: 'Danh sách luồng phê duyệt',
    detail: 'Luồng đã chọn',
    create: 'Luồng phê duyệt mới',
    steps: 'Bước phê duyệt',
  },
  fields: {
    approvalTypeCode: 'Loại phê duyệt',
    businessUnit: 'Đơn vị kinh doanh',
    minValue: 'Cận dưới khoảng giá trị',
    maxValue: 'Cận trên khoảng giá trị',
    /** ⚠ 목록 열 이름이라 **한 낱말**이어야 한다 — 길면 좁은 칸에서 접힌다. */
    status: 'Dùng',
    stepCount: 'Bước',
    inProgressCount: 'Đang xử lý',
    stepNo: 'Thứ tự',
    approver: 'Người phê duyệt',
    approverStatus: 'Trạng thái',
    stepRowActions: 'Xóa',
    approverType: 'Loại người phê duyệt',
    q: 'Tìm loại phê duyệt',
  },
  actions: {
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
    reload: 'Tra cứu lại',
    create: 'Luồng phê duyệt mới',
    /** 등록의 주 액션. 수정의 「저장」과 갈라 적는다 — 없던 것이 생기는 일이다. */
    submitCreate: 'Đăng ký',
    activate: 'Dùng lại',
    openExisting: 'Xem luồng phê duyệt đã có',
    keepEditing: 'Tiếp tục sửa',
    discardDraft: 'Hủy thay đổi',
    /** ⚠ 보이는 글자(승인 유형)를 그대로 담고 **내부 번호는 접근 이름에도 넣지 않는다.** */
    selectRow: (approvalTypeCode: string, businessUnitLabel: string): string =>
      `Chọn ${approvalTypeCode} · ${businessUnitLabel}`,
    addStep: 'Thêm bước',
    removeStep: (stepNo: number): string => `Xóa bước thứ ${String(stepNo)}`,
    /** 「저장」이 아니라 무엇을 저장하는지 적는다 — 이 화면에는 저장이 둘이다. */
    saveSteps: 'Lưu bước phê duyệt',
  },
  loading: {
    list: 'Đang tải danh sách luồng phê duyệt',
    detail: 'Đang tải chi tiết luồng phê duyệt',
    steps: 'Đang tải bước phê duyệt',
  },
  filters: {
    all: 'Tất cả',
    lookupTruncated:
      'Lựa chọn chỉ hiện một phần ở đầu. Không thấy giá trị cần tìm thì hãy báo người phụ trách.',
    lookupFailed: 'Không tải được lựa chọn.',
    chipApprovalType: (value: string): string => `Loại phê duyệt: ${value}`,
    chipBusinessUnit: (value: string): string => `Đơn vị kinh doanh: ${value}`,
    chipKeyword: (value: string): string => `Từ khóa: ${value}`,
    chipRemoveApprovalType: 'Bỏ điều kiện loại phê duyệt',
    chipRemoveBusinessUnit: 'Bỏ điều kiện đơn vị kinh doanh',
    chipRemoveKeyword: 'Bỏ điều kiện từ khóa',
    chipRemoveIncludeInactive: 'Bỏ điều kiện gồm cả mục ngừng dùng',
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / tổng ${String(total)} mục`,
    totalOnly: (total: number): string => `Tổng ${String(total)} mục`,
  },
  empty: {
    noResultTitle: 'Không có luồng phê duyệt khớp điều kiện',
    noResultDescription: 'Hãy bớt điều kiện hoặc bật «Gồm cả mục ngừng dùng» rồi tra cứu lại.',
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Hãy về trang đầu.',
    noSelectionTitle: 'Chọn luồng phê duyệt thì sẽ thấy nội dung và bước phê duyệt',
    noSelectionDescription: 'Hãy bấm loại phê duyệt ở danh sách bên trái.',
    notFoundTitle: 'Không tìm thấy luồng phê duyệt đã chọn',
    notFoundDescription: 'Đã bị xóa hoặc số trên địa chỉ sai. Hãy chọn lại từ danh sách bên trái.',
    /** ⭐ 등록 직후가 늘 이 상태다 — 사실만 적지 않고 **무엇을 하면 열리는지**까지 적는다. */
    noStepsTitle: 'Luồng phê duyệt này không có bước phê duyệt nào',
    noStepsDescription:
      'Không có bước thì yêu cầu trình của loại này sẽ bị từ chối. Thêm ít nhất một bước là mở lại.',
  },
  values: {
    unknown: 'Không rõ',
    referenceLoading: 'Đang tải tên',
    referenceFailed: 'Không tải được tên',
    inactiveSuffix: ' (ngừng dùng)',
    /** ⭐ 빈 값이 아니라 **확정된 뜻**이다 — 「알 수 없음」이나 대시로 두면 정반대가 된다. */
    allBusinessUnits: 'Chung mọi đơn vị kinh doanh',
    active: 'Đang dùng',
    inactive: 'Không dùng',
    noSteps: 'Không có bước',
    /** ⛔ 승인자 번호를 대신 내지 않는다 — 한 번 화면에 서면 그것이 식별자로 읽힌다. */
    approverUnknown: 'Không xác nhận được thông tin người phê duyệt',
    approverActive: 'Đang dùng',
    approverInactive: 'Đã ngừng sử dụng',
    approverTypeUser: 'Người dùng',
    approverTypeRole: 'Vai trò',
    approverTypeDepartment: 'Phòng ban',
  },
  notes: {
    valueRangeUnused: 'Đợt 1 không dùng khoảng giá trị này để chọn luồng phê duyệt.',
    inProgressSome: (count: number): string =>
      `Đang có ${String(count)} yêu cầu đang xử lý. Những yêu cầu này sẽ kết thúc bằng luồng phê duyệt hiện tại.`,
    inProgressNone: 'Không có yêu cầu nào đang xử lý.',
    stepGuideApproverAbsent: 'Người phê duyệt vắng mặt thì yêu cầu dừng lại ở bước đó.',
    stepGuideNotRetroactive: 'Sửa luồng phê duyệt cũng không áp dụng cho yêu cầu đang xử lý.',
    stepGuideRejectResubmit:
      'Muốn cho yêu cầu đang xử lý chạy theo luồng đã sửa thì phải từ chối rồi trình lại.',
    approverInactiveWarning: 'Người phê duyệt này đang ngừng sử dụng — phê duyệt sẽ dừng lại.',
    /** ⭐ **막지 않는다** — 없는 규칙을 지어내는 대신 보이기만 한다. */
    approverDuplicateWarning: 'Cùng người phê duyệt này còn ở bước khác nữa. Vẫn lưu như vậy được.',
    stepReplaceWholeList: 'Lưu thì thay toàn bộ bước phê duyệt đúng theo thứ tự đang hiện.',
    /** ⭐ 선택지를 감추지 않고 잠근 채 사유를 붙인다 — 감추면 없는 기능으로 읽힌다. */
    approverTypePending:
      'Đợt 1 chưa mở người phê duyệt theo vai trò · phòng ban — chỉ chọn được người dùng.',
    approverListTruncated:
      'Lựa chọn người phê duyệt chỉ hiện một phần ở đầu. Không thấy người cần tìm thì hãy báo người phụ trách.',
    approverListFailed: 'Không tải được lựa chọn người phê duyệt.',
    approvalTypeFixed: 'Không đổi được loại phê duyệt — đổi thì đó là luồng phê duyệt khác.',
    businessUnitEmpty: 'Để trống đơn vị kinh doanh thì áp dụng cho mọi đơn vị kinh doanh.',
    valueRangeEmpty: 'Để trống khoảng giá trị thì áp dụng cho mọi khoảng.',
    /** ⭐ **막지 않는다** — 화면의 선검사는 마지막 방어가 아니고 서버가 다시 검사한다. */
    duplicateUnknown:
      'Chưa xác nhận được có luồng phê duyệt nào đang dùng cùng loại phê duyệt · đơn vị kinh doanh hay không. Vẫn lưu được và máy chủ sẽ kiểm tra lại.',
    /** ⭐ 응답이 오지 않은 요청은 **실패가 아니다** — 다시 보내면 같은 것이 둘 생길 수 있다. */
    networkUnconfirmed:
      'Không xác nhận được yêu cầu đã tới nơi hay chưa. Trước khi lưu lại hãy bấm «Tra cứu lại» để xem kết quả.',
  },
  validation: {
    approvalTypeRequired: 'Hãy chọn loại phê duyệt.',
    valueNotNumber: 'Chỉ nhập được số.',
    maxLessThanMin: 'Cận trên phải lớn hơn hoặc bằng cận dưới.',
  },
  /** 비활성 사유는 **그 컨트롤의 이름으로 시작한다**(배치 규범 4). 옮긴 말에서도 앞머리를 지킨다. */
  actionReasons: {
    createPendingCode:
      'Đăng ký: Không tải được danh sách loại phê duyệt nên không tạo được luồng mới. Luồng đã có thì vẫn sửa, tắt và bật lại được.',
    createNoType: 'Đăng ký: Chọn loại phê duyệt thì đăng ký được.',
    saveNoChanges: 'Lưu: Không có nội dung nào đã sửa. Đổi giá trị thì lưu được.',
    /** ⭐ **기존 것을 고치라고 말한다** — 결재선에는 물리 삭제가 없어 잘못 만들면 지울 수 없다. */
    duplicateActive:
      'Đã có luồng phê duyệt đang dùng với cùng loại phê duyệt · đơn vị kinh doanh. Hãy sửa luồng đã có.',
    activateNoSteps:
      'Dùng lại: Không có bước phê duyệt nào. Hãy thêm ít nhất một bước rồi dùng lại.',
    activateDuplicate:
      'Dùng lại: Đã có luồng phê duyệt đang dùng với cùng loại phê duyệt · đơn vị kinh doanh. Hãy ngừng luồng đó trước.',
    stepSaveFormDirty:
      'Lưu bước phê duyệt: Luồng phê duyệt còn thay đổi chưa lưu. Hãy lưu hoặc hủy trước.',
    stepSaveNoSteps: 'Lưu bước phê duyệt: Không có bước nào. Thêm ít nhất một bước thì lưu được.',
    stepSaveApproverMissing:
      'Lưu bước phê duyệt: Có bước không xác nhận được người phê duyệt. Hãy xóa bước đó rồi thêm lại.',
    stepSaveNoChanges: 'Lưu bước phê duyệt: Không có nội dung nào đã sửa.',
    stepAddNoApprover: 'Thêm bước: Hãy chọn người phê duyệt.',
    stepRemoveLast:
      'Xóa: Không xóa được bước cuối cùng. Không có bước thì yêu cầu trình của loại này sẽ bị từ chối.',
  },
  dialog: {
    deactivateTitle: 'Ngừng sử dụng luồng phê duyệt này chứ?',
    deactivateBlocks: (approvalTypeCode: string): string =>
      `Ngừng thì yêu cầu trình của loại «${approvalTypeCode}» sẽ bị từ chối.`,
    deactivateInProgress: (count: number): string =>
      `${String(count)} yêu cầu đang xử lý vẫn chạy tiếp như cũ.`,
    deactivateInProgressNone: 'Hiện không có yêu cầu nào đang xử lý.',
    deactivateReversible: 'Sau này có thể hoàn lại bằng «Dùng lại».',
    activateTitle: 'Dùng lại luồng phê duyệt này chứ?',
    activateOpens: (approvalTypeCode: string): string =>
      `Yêu cầu trình của loại «${approvalTypeCode}» sẽ mở lại.`,
    activateStepCount: (count: number): string => `Có ${String(count)} bước phê duyệt.`,
    /** ⚠ 「확인/취소」로 두지 않는다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */
    discardTitle: 'Hủy các thay đổi chứ?',
  },
};
