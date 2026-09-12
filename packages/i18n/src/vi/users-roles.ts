import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-CO-02 사용자·역할·권한 관리.
 *
 * ⛔ **「관리자」(`quản trị viên`)라는 낱말을 이 슬라이스에 쓰지 않는다.** 어느 역할이
 * 관리자인지 판정할 근거가 계약에 없어 화면이 그 판정을 하지 않기로 했다(계획 결정 4) —
 * 옮기면서 그 낱말을 들이면 베트남어 화면에서만 화면이 판정하는 것처럼 읽힌다.
 *
 * ⚠ **로그인 ID 는 `tên đăng nhập`.** 로그인 화면(`vi/login.ts`)이 같은 값을 그 말로 부르고,
 * 사번(`mã nhân viên`)과는 다른 것이다 — 용어집이 가른 두 말을 지킨다.
 *
 * ⚠ **역할·권한 탭의 문구는 아직 없다.** 만든 화면의 몫만 옮긴다 — 없는 화면의 라벨을 미리
 * 지으면 무엇이 렌더되는지 흐려진다.
 */
export const usersRoles: Translated<typeof ko.usersRoles> = {
  title: 'Người dùng · vai trò · quyền',
  breadcrumbRoot: 'Quản trị hệ thống',
  tabs: {
    label: 'Người dùng · vai trò · quyền',
    users: 'Người dùng',
    roles: 'Vai trò · quyền',
  },
  panes: {
    userList: 'Người dùng',
    userForm: 'Thông tin người dùng',
    roleAssign: 'Gán vai trò',
    dataScope: 'Phạm vi truy cập dữ liệu',
    roleList: 'Vai trò',
    roleForm: 'Thông tin vai trò',
    permission: 'Quyền chức năng',
  },
  actions: {
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
    addUser: 'Thêm người dùng',
    addRole: 'Thêm vai trò',
  },
  /** 비활성 사유는 **그 컨트롤의 이름으로 시작한다**(배치 규범 4). 옮긴 말에서도 앞머리를 지킨다. */
  actionReasons: {
    statusLookupLoading: 'Trong lúc tải danh sách trạng thái thì chưa chọn được trạng thái.',
    statusLookupFailed:
      'Không tải được danh sách trạng thái. Thông tin khác vẫn lưu được và trạng thái cũ được giữ nguyên.',
    statusLookupEmpty: 'Chưa đăng ký trạng thái người dùng nào nên không chọn được trạng thái.',
    /** ⚠ 「언젠가 풀린다」가 아니라 **보낼 자리가 없다**는 뜻이다 — 그 사실 그대로 옮긴다. */
    loginIdLocked:
      'Tên đăng nhập chỉ đặt được lúc đăng ký, sau đó không đổi được. Cần đổi thì hãy hỏi người phụ trách.',
    deactivateAlreadyDone: 'Ngừng sử dụng không làm lại được với người dùng đã ngừng dùng.',
    deactivateRoleAlreadyDone: 'Ngừng sử dụng không làm lại được với vai trò đã ngừng dùng.',
    saveNoChanges: 'Lưu chỉ bấm được khi có nội dung đã sửa.',
    addNoInput: 'Thêm người dùng chỉ bấm được khi đã nhập nội dung.',
    addRoleNoInput: 'Thêm vai trò chỉ bấm được khi đã nhập nội dung.',
    dataScopeTargetRequired:
      'Xác nhận chỉ bấm được sau khi chọn ít nhất một trong đơn vị kinh doanh và nhà máy.',
    /** ⚠ 비운 축을 「(전체)」로 접어 판정한다 — 그 사실을 빼면 중복 사유가 설명되지 않는다. */
    dataScopeDuplicate:
      'Xác nhận chỉ bấm được khi không trùng với phạm vi đã có. Trục để trống được coi là «(Tất cả)».',
  },
  /** ⛔ 참조 건수·배정 건수를 내지 않는다 — 화면이 낼 수 있는 건수가 그 뜻이 아니다. */
  dialog: {
    deactivateUserTitle: 'Ngừng sử dụng người dùng này chứ?',
    deactivateUserDescription:
      'Ngừng sử dụng thì người dùng này không dùng được hệ thống nữa và dữ liệu đã tích lũy vẫn còn nguyên. Không có đường hoàn lại.',
    deactivateRoleTitle: 'Ngừng sử dụng vai trò này chứ?',
    /** ⚠ 사용자 문구를 그대로 쓰지 않는다 — 중지했을 때 일어나는 일이 서로 다르다. */
    deactivateRoleDescription:
      'Ngừng sử dụng thì không gán mới vai trò này được nữa và quyền đang mở bằng vai trò này sẽ mất. Dữ liệu đã tích lũy vẫn còn nguyên. Không có đường hoàn lại.',
  },
  optionsTruncated:
    'Danh sách lựa chọn chỉ hiện một phần. Không thấy giá trị cần tìm thì hãy báo người phụ trách.',
  optionsLoadFailed: 'Không tải được danh sách lựa chọn. Chỉ hiện giá trị đang lưu.',
  guard: {
    userDetailNeedsSelection: 'Không tra cứu chi tiết khi chưa chọn người dùng.',
    userAssignmentsNeedSelection: 'Không tra cứu phần đã gán khi chưa chọn người dùng.',
    userScopesNeedSelection: 'Không tra cứu phạm vi truy cập khi chưa chọn người dùng.',
    roleDetailNeedsSelection: 'Không tra cứu chi tiết khi chưa chọn vai trò.',
    rolePermissionsNeedSelection: 'Không tra cứu quyền chức năng khi chưa chọn vai trò.',
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / tổng ${String(total)} mục`,
    totalOnly: (total: number): string => `Tổng ${String(total)} mục`,
  },
  filters: {
    userSearchLabel: 'Tìm người dùng',
    userSearchPlaceholder: 'Tên đăng nhập hoặc tên',
    department: 'Phòng ban',
    departmentAll: 'Tất cả phòng ban',
    status: 'Trạng thái',
    statusAll: 'Tất cả trạng thái',
    chipKeyword: (value: string): string => `Từ khóa: ${value}`,
    chipRemoveKeyword: 'Bỏ điều kiện từ khóa',
    chipDepartment: (label: string): string => `Phòng ban: ${label}`,
    chipRemoveDepartment: 'Bỏ điều kiện phòng ban',
    chipStatus: (label: string): string => `Trạng thái: ${label}`,
    chipRemoveStatus: 'Bỏ điều kiện trạng thái',
    chipRemoveIncludeInactive: 'Bỏ điều kiện gồm cả mục ngừng dùng',
    roleSearchLabel: 'Tìm vai trò',
    roleSearchPlaceholder: 'Mã vai trò hoặc tên vai trò',
  },
  loading: {
    users: 'Đang tải danh sách người dùng',
    userDetail: 'Đang tải thông tin người dùng',
    roleAssign: 'Đang tải phần vai trò đã gán',
    dataScopes: 'Đang tải phạm vi truy cập dữ liệu',
    roles: 'Đang tải danh sách vai trò',
    roleDetail: 'Đang tải thông tin vai trò',
    permissions: 'Đang tải quyền chức năng',
  },
  empty: {
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Hãy về trang đầu.',
  },
  values: {
    empty: '—',
    inactiveSuffix: ' (ngừng dùng)',
    /** ⛔ 못 찾은 번호를 그대로 내지 않는다 — 내부 식별자가 화면에 서면 자료로 읽힌다. */
    unknown: 'Không rõ',
    active: 'Đang dùng',
    inactive: 'Ngừng dùng',
  },
  user: {
    fields: {
      loginId: 'Tên đăng nhập',
      userName: 'Tên',
      department: 'Phòng ban',
      email: 'Thư điện tử',
      status: 'Trạng thái',
    },
    statusDefault: 'Mặc định (đang làm việc)',
    /** 부서를 고르지 않은 상태. 계약이 널을 허용하므로 **비우는 것이 정상 값이다.** */
    departmentNone: 'Không chỉ định',
    empty: {
      noneTitle: 'Chưa đăng ký người dùng nào',
      noneDescription: 'Hãy đăng ký người dùng đầu tiên bằng «Thêm người dùng».',
      noMatchTitle: 'Không có người dùng khớp điều kiện',
      noMatchDescription: 'Hãy bớt điều kiện hoặc đặt lại rồi tra cứu lại.',
      notSelected: 'Chọn người dùng ở bên trái thì thông tin của người đó hiện ở đây',
    },
    validation: {
      required: 'Đây là mục bắt buộc.',
      loginIdBlank: 'Tên đăng nhập không được chỉ gồm khoảng trắng.',
      userNameBlank: 'Tên không được chỉ gồm khoảng trắng.',
      loginIdTooLong: 'Tên đăng nhập không được quá 100 ký tự.',
      userNameTooLong: 'Tên không được quá 200 ký tự.',
      emailTooLong: 'Thư điện tử không được quá 200 ký tự.',
      emailFormat: 'Không đúng dạng thư điện tử. Hãy nhập theo dạng «tên@tên miền».',
    },
  },
  role: {
    fields: {
      roleCode: 'Mã vai trò',
      roleName: 'Tên vai trò',
      description: 'Mô tả',
      status: 'Trạng thái',
    },
    empty: {
      noneTitle: 'Chưa đăng ký vai trò nào',
      noneDescription: 'Hãy đăng ký vai trò đầu tiên bằng «Thêm vai trò».',
      noMatchTitle: 'Không có vai trò khớp điều kiện',
      noMatchDescription: 'Hãy bớt điều kiện hoặc đặt lại rồi tra cứu lại.',
      notSelected: 'Chọn vai trò ở bên trái thì thông tin của vai trò đó hiện ở đây',
    },
    validation: {
      required: 'Đây là mục bắt buộc.',
      roleCodeBlank: 'Mã vai trò không được chỉ gồm khoảng trắng.',
      roleNameBlank: 'Tên vai trò không được chỉ gồm khoảng trắng.',
      roleCodeTooLong: 'Mã vai trò không được quá 50 ký tự.',
      roleNameTooLong: 'Tên vai trò không được quá 200 ký tự.',
    },
  },
  /** 기능 권한 격자 — **보는 것까지만 된다.** 그 사실을 감추지 않고 상시 안내로 밝힌다. */
  permission: {
    pendingNote:
      'Quyền chức năng chỉ đổi được ở đây sau khi danh sách quyền được chốt. Hiện chỉ xem được quyền đã cấp cho vai trò này.',
    /** ⚠ 부여되지 않은 칸의 접근 이름도 **화면이 만든다** — 없으면 빈 칸의 뜻이 닿지 않는다. */
    granted: 'Đã cấp',
    notGranted: 'Chưa cấp',
    empty: {
      none: 'Vai trò này chưa được cấp quyền chức năng nào',
      noneDescription: 'Danh sách quyền được chốt thì sẽ cấp được ở đây.',
    },
  },
  assign: {
    empty: {
      none: 'Không có vai trò nào để chọn',
      noneDescription: 'Vai trò được đăng ký thì sẽ gán được ở đây.',
    },
    /** ⚠ 미사용 역할은 **이미 부여돼 있을 때만** 남는다 — 빼면 저장할 때 그 부여가 사라진다. */
    lockedInactiveNote:
      'Vai trò ngừng dùng còn trong danh sách vì đã được gán sẵn. Ở đây không đổi được.',
  },
  scope: {
    fields: {
      businessUnit: 'Đơn vị kinh doanh',
      plant: 'Nhà máy',
      edit: 'Sửa',
    },
    values: {
      /** ⭐ 빈 축은 「고르지 않음」이 아니라 **고른 값**이다 — 그 축 전체를 뜻한다. */
      all: '(Tất cả)',
      pair: (businessUnit: string, plant: string): string => `${businessUnit} · ${plant}`,
    },
    actions: {
      add: 'Thêm phạm vi',
      editRow: (label: string): string => `Sửa phạm vi ${label}`,
      removeRow: (label: string): string => `Xóa phạm vi ${label}`,
      confirm: 'Xác nhận',
    },
    dialog: {
      addTitle: 'Thêm phạm vi truy cập',
      editTitle: 'Sửa phạm vi truy cập',
      /** ⚠ 확인이 저장이라고 오해하면 창을 닫고 화면을 떠난다. */
      notSavedNotice:
        'Bấm xác nhận vẫn chưa lưu. Chỉ phản ánh vào bảng, phải bấm «Lưu» thì mới gửi lên máy chủ.',
    },
    empty: {
      none: 'Chưa chỉ định phạm vi truy cập nào',
      noneDescription: 'Hãy dùng «Thêm phạm vi» để định phạm vi mà người dùng này xem được.',
    },
  },
};
