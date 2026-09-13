import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-06-06 공통코드·조직·작업자. 탭이 여럿이라 같은 말이 되풀이된다 — 코드그룹 `nhóm mã`,
 * 코드값 `giá trị mã`, 부서 `phòng ban`, 거래처 `đối tác`, 작업자 `công nhân`,
 * 자격 `chứng chỉ` 를 파일 끝까지 한 낱말로 지킨다.
 *
 * `codeValue` 묶음은 통째로 옮겨질 것을 전제로 모아 둔 자리라 바깥과 같은 문구도 따로 둔다.
 */
export const commonCode: Translated<typeof ko.commonCode> = {
  title: 'Mã chung · Tổ chức · Công nhân',
  breadcrumbRoot: 'Dữ liệu gốc',
  /** 탭 라벨. 만든 탭만 둔다. */
  tabs: {
    label: 'Mã chung · Tổ chức · Công nhân',
    code: 'Mã chung',
    org: 'Tổ chức (phòng ban)',
    worker: 'Công nhân',
    /* 이 탭이 다루는 것은 역할뿐이라 이름도 «거래처»가 아니라 «거래처 역할»이다. */
    partner: 'Vai trò đối tác',
  },
  panes: {
    codeGroup: 'Nhóm mã',
    codeGroupForm: 'Thông tin nhóm mã',
    department: 'Phòng ban',
    departmentForm: 'Thông tin phòng ban',
    worker: 'Công nhân',
    workerDetail: 'Thông tin cơ bản của công nhân',
    partner: 'Đối tác',
    partnerDetail: 'Thông tin cơ bản của đối tác',
    partnerRoles: 'Vai trò đối tác',
  },
  actions: {
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
    addCodeGroup: 'Thêm nhóm',
    addDepartment: 'Thêm phòng ban',
  },
  /** 비활성 사유는 컨트롤 이름으로 시작한다 — 옮긴 말도 `Ngừng sử dụng` 으로 연다. */
  actionReasons: {
    deactivateAlreadyDone: (target: string): string =>
      `Ngừng sử dụng không thể thực hiện lại với ${target} vốn đã ngừng dùng.`,
    deactivateNeedsSaved: (target: string): string =>
      `Ngừng sử dụng chỉ thực hiện được sau khi đăng ký ${target} trước.`,
  },
  /** 사용 중지 확인 창. 참조 건수를 내지 않는다. */
  dialog: {
    deactivateCodeGroupTitle: 'Ngừng sử dụng nhóm mã này?',
    deactivateDepartmentTitle: 'Ngừng sử dụng phòng ban này?',
    deactivateDescription:
      'Khi ngừng sử dụng, mục này bị loại khỏi các lựa chọn mới và dữ liệu đã dùng vẫn giữ nguyên. Không có đường quay lại.',
  },
  optionsTruncated:
    'Chỉ hiển thị một phần danh sách chọn. Không thấy giá trị cần tìm thì hãy báo người phụ trách.',
  optionsLoadFailed: 'Không tải được danh sách chọn. Chỉ hiển thị giá trị đang lưu.',
  /** 쪽 이동. 번호 목록을 두지 않는다 — 조건을 좁히는 것이 정상 경로다. */
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)}`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `Tổng ${String(total)}`,
  },
  filters: {
    codeGroupSearchLabel: 'Tìm nhóm mã',
    codeGroupSearchPlaceholder: 'Mã nhóm hoặc tên nhóm',
    departmentSearchLabel: 'Tìm phòng ban',
    departmentSearchPlaceholder: 'Mã phòng ban hoặc tên phòng ban',
    businessUnit: 'Đơn vị kinh doanh',
    businessUnitAll: 'Tất cả đơn vị kinh doanh',
    workerSearchLabel: 'Tìm công nhân',
    workerSearchPlaceholder: 'Mã nhân viên hoặc họ tên',
    department: 'Phòng ban',
    departmentAll: 'Tất cả phòng ban',
    partnerSearchLabel: 'Tìm đối tác',
    partnerSearchPlaceholder: 'Mã đối tác hoặc tên đối tác',
    chipKeyword: (value: string): string => `Từ khóa: ${value}`,
    chipRemoveKeyword: 'Bỏ điều kiện từ khóa',
    chipRemoveIncludeInactive: 'Bỏ điều kiện gồm cả mục ngừng dùng',
    chipBusinessUnit: (label: string): string => `Đơn vị kinh doanh: ${label}`,
    chipRemoveBusinessUnit: 'Bỏ điều kiện đơn vị kinh doanh',
    chipDepartment: (label: string): string => `Phòng ban: ${label}`,
    chipRemoveDepartment: 'Bỏ điều kiện phòng ban',
  },
  loading: {
    codeGroups: 'Đang tải danh sách nhóm mã',
    codeGroupDetail: 'Đang tải thông tin nhóm mã',
    departments: 'Đang tải danh sách phòng ban',
    departmentDetail: 'Đang tải thông tin phòng ban',
    workers: 'Đang tải danh sách công nhân',
    workerDetail: 'Đang tải thông tin công nhân',
    partners: 'Đang tải danh sách đối tác',
    partnerDetail: 'Đang tải thông tin đối tác',
    partnerRoles: 'Đang tải vai trò đối tác',
  },
  /** 자원 이름 — 문장 가운데 끼는 자리라 소문자로 둔다. */
  targets: {
    codeGroup: 'nhóm mã',
    department: 'phòng ban',
  },
  empty: {
    /* 결과는 있는데 이 쪽에만 없다 — «등록된 것이 없다»로 내면 사실과 다르다. */
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Hãy chuyển về trang đầu.',
  },
  values: {
    empty: '—',
    inactiveSuffix: ' (ngừng dùng)',
    /* 내부 식별자를 그대로 내지 않는다 — 보이면 자료로 읽힌다. */
    unknown: 'Không rõ',
  },
  codeGroup: {
    provisionalCatalog:
      'Đây là danh sách tạm. Khi hệ thống mã được xác nhận, thành phần các nhóm mã hiển thị ở đây có thể thay đổi.',
    fields: {
      groupCode: 'Mã nhóm',
      groupName: 'Tên nhóm',
      description: 'Mô tả',
    },
    empty: {
      noneTitle: 'Chưa đăng ký nhóm mã',
      noneDescription: 'Hãy đăng ký nhóm mã đầu tiên bằng «Thêm nhóm».',
      noMatchTitle: 'Không có nhóm mã khớp điều kiện',
      noMatchDescription: 'Hãy giảm bớt hoặc đặt lại điều kiện rồi tra cứu lại.',
      /* 코드값 구획이 같은 자리에서 «먼저 고르세요»를 내므로 여기는 무엇이 채워지는지로 말한다. */
      notSelected: 'Chọn nhóm mã ở bên trái thì thông tin của nhóm đó hiện ở đây',
    },
    validation: {
      required: 'Đây là mục bắt buộc.',
      groupCodeBlank: 'Mã nhóm không được chỉ gồm khoảng trắng.',
      groupNameBlank: 'Tên nhóm không được chỉ gồm khoảng trắng.',
      groupCodeTooLong: 'Mã nhóm không được vượt quá 50 ký tự.',
      groupNameTooLong: 'Tên nhóm không được vượt quá 200 ký tự.',
    },
    actionReasons: {
      /* 잠금 사유가 갈린다 — 이 문구는 «다른 코드그룹의 저장»이라는 다른 사실을 말한다. */
      saveLockedByOtherCodeGroup:
        'Lưu chỉ thực hiện được sau khi việc lưu của nhóm mã khác kết thúc.',
      /* 같은 사실이되 컨트롤 이름이 달라 문면이 둘이다 — 이름으로 시작해야 어느 버튼인지 복원된다. */
      addLockedByOtherCodeGroup:
        'Thêm nhóm chỉ thực hiện được sau khi việc lưu của nhóm mã khác kết thúc.',
    },
  },
  department: {
    fields: {
      departmentCode: 'Mã phòng ban',
      departmentName: 'Tên phòng ban',
      parentDepartment: 'Phòng ban cấp trên',
      businessUnit: 'Đơn vị kinh doanh',
    },
    values: {
      groupHeader: (code: string, name: string): string => `${code} · ${name}`,
      /** «없음»만으로는 무엇이 없는지 읽히지 않아 뿌리 부서임을 함께 적는다. */
      noParent: 'Không có (phòng ban gốc)',
    },
    /* 상위가 다른 쪽에 있을 수 있다 — «없다»를 «뿌리다»로 읽지 않게 사실을 그대로 밝힌다. */
    groupHeaderOrphan: 'Phòng ban cấp trên không có ở trang này',
    notices: {
      deepHierarchy:
        'Có phân cấp từ 3 tầng trở lên. Danh sách này chỉ gom hiển thị đến 2 tầng cấp trên–cấp dưới nên hãy xem quan hệ sâu hơn ở mục phòng ban cấp trên trong thông tin phòng ban.',
    },
    empty: {
      noneTitle: 'Chưa đăng ký phòng ban',
      noneDescription: 'Hãy đăng ký phòng ban đầu tiên bằng «Thêm phòng ban».',
      noMatchTitle: 'Không có phòng ban khớp điều kiện',
      noMatchDescription: 'Hãy giảm bớt hoặc đặt lại điều kiện rồi tra cứu lại.',
      notSelected: 'Chọn phòng ban ở bên trái thì thông tin của phòng ban đó hiện ở đây',
    },
    actionReasons: {
      /* 목록에 자기 하나뿐이면 상위로 고를 대상이 없다 — 감추지 않고 사유를 밝힌다. */
      parentNeedsOthers:
        'Phòng ban cấp trên không chỉ định được vì không có phòng ban khác để chọn. Đăng ký thêm một phòng ban thì có thể dùng ô này.',
      saveLockedByOtherDepartment:
        'Lưu chỉ thực hiện được sau khi việc lưu của phòng ban khác kết thúc.',
      addLockedByOtherDepartment:
        'Thêm phòng ban chỉ thực hiện được sau khi việc lưu của phòng ban khác kết thúc.',
    },
    validation: {
      required: 'Đây là mục bắt buộc.',
      departmentCodeBlank: 'Mã phòng ban không được chỉ gồm khoảng trắng.',
      departmentNameBlank: 'Tên phòng ban không được chỉ gồm khoảng trắng.',
      departmentCodeTooLong: 'Mã phòng ban không được vượt quá 50 ký tự.',
      departmentNameTooLong: 'Tên phòng ban không được vượt quá 200 ký tự.',
    },
  },
  /** 작업자 — 읽기 전용이라 값 표기의 이름이며 비활성 사유를 두지 않는다. */
  worker: {
    readOnlyNotice:
      'Đây là dữ liệu nhận từ hệ thống ngoài nên không sửa được ở đây. Hãy thay đổi ở hệ thống gốc.',
    fields: {
      workerNo: 'Mã nhân viên',
      workerName: 'Họ tên',
      businessUnit: 'Đơn vị kinh doanh',
      plant: 'Nhà máy',
      department: 'Phòng ban',
      status: 'Trạng thái',
      appUser: 'Liên kết tài khoản',
      isActive: 'Trạng thái sử dụng',
    },
    values: {
      /* 계정 연결은 연결 여부만 낸다 — 내부 식별자를 그대로 내면 사용자가 쓸 수 없다. */
      appUserLinked: 'Đã liên kết',
      appUserNotLinked: 'Chưa liên kết',
      active: 'Đang dùng',
      inactive: 'Ngừng dùng',
    },
    empty: {
      noneTitle: 'Chưa đăng ký công nhân',
      noneDescription: 'Công nhân được nhận về từ hệ thống ngoài. Hãy kiểm tra hệ thống gốc.',
      noMatchTitle: 'Không có công nhân khớp điều kiện',
      noMatchDescription: 'Hãy giảm bớt hoặc đặt lại điều kiện rồi tra cứu lại.',
      notSelected: 'Chọn công nhân ở bên trái thì thông tin của công nhân đó hiện ở đây',
    },
  },
  /** 자격·인증 — 이 화면에서 편집 가능한 유일한 작업자 자료. 저장은 전체 치환이다. */
  qualification: {
    paneTitle: 'Chứng chỉ · chứng nhận',
    fields: {
      qualificationType: 'Loại chứng chỉ',
      process: 'Công đoạn',
      certificateNo: 'Số chứng nhận',
      validPeriod: 'Thời hạn hiệu lực',
      validFrom: 'Hiệu lực từ',
      validTo: 'Hiệu lực đến',
      certifiedBy: 'Người chứng nhận',
      edit: 'Sửa',
    },
    values: {
      /** 공정을 비운 자격은 모든 공정에 걸린다. */
      allProcesses: '(Toàn bộ công đoạn)',
      certifierNone: 'Không chỉ định',
      period: (from: string, to: string): string => `${from} ~ ${to}`,
    },
    actions: {
      add: 'Thêm chứng chỉ',
      /* 행 아이콘 버튼은 보이는 글자가 없다 — 어느 행의 것인지 이름에 담는다. */
      editRow: (label: string): string => `Sửa chứng chỉ ${label}`,
      removeRow: (label: string): string => `Xóa chứng chỉ ${label}`,
    },
    actionReasons: {
      needsWorker: 'Thêm chứng chỉ chỉ thực hiện được sau khi chọn công nhân ở bên trái.',
      saveBlockedByInvalid:
        'Lưu không thực hiện được vì có dòng trùng cặp loại chứng chỉ và công đoạn. Sửa hoặc xóa dòng đó thì có thể lưu.',
      saveLockedByOtherWorker:
        'Lưu chỉ thực hiện được sau khi việc lưu của công nhân khác kết thúc.',
      certifierLookupLoading:
        'Trong lúc đang tải danh sách người chứng nhận thì không đổi được người chứng nhận.',
      certifierLookupFailed:
        'Không tải được danh sách người chứng nhận nên không chọn được người chứng nhận mới. Giá trị cũ vẫn được giữ.',
      certifierLookupEmpty: 'Không có người dùng đang hoạt động nào để chọn.',
    },
    /* 창의 확인은 저장이 아니다 — 밝히지 않으면 창을 닫는 순간 저장된 줄 안다. */
    dialog: {
      addTitle: 'Thêm chứng chỉ',
      editTitle: 'Sửa chứng chỉ',
      notSavedNotice:
        'Xác nhận ở cửa sổ này không phải là lưu. Sau khi phản ánh vào bảng, phải bấm «Lưu» thì mới gửi lên máy chủ.',
      confirm: 'Xác nhận',
    },
    empty: {
      notSelected: 'Chọn công nhân ở bên trái thì chứng chỉ · chứng nhận của người đó hiện ra',
      noneTitle: 'Chưa đăng ký chứng chỉ · chứng nhận',
      noneDescription: 'Hãy đăng ký chứng chỉ đầu tiên bằng «Thêm chứng chỉ».',
    },
    loading: {
      list: 'Đang tải chứng chỉ · chứng nhận',
    },
    validation: {
      required: 'Đây là mục bắt buộc.',
      certificateNoTooLong: 'Số chứng nhận không được vượt quá 100 ký tự.',
      validRangeReversed: 'Hiệu lực đến phải bằng hoặc sau hiệu lực từ.',
      /* 계약이 공정을 비운 두 줄을 같은 짝으로 접는다. */
      duplicatePair:
        'Cặp loại chứng chỉ và công đoạn này đã có. Hãy chọn công đoạn khác hoặc sửa dòng đó.',
    },
  },
  /** 거래처 — 본체는 읽기 전용이고 이 탭이 고치는 것은 역할뿐이다. 내부 번호를 문구에 담지 않는다. */
  partner: {
    fields: {
      partnerCode: 'Mã đối tác',
      partnerName: 'Tên đối tác',
      country: 'Quốc gia',
      erpPartnerCode: 'Mã ERP',
      isActive: 'Trạng thái sử dụng',
    },
    values: {
      active: 'Đang dùng',
      inactive: 'Ngừng dùng',
    },
    empty: {
      noneTitle: 'Chưa đăng ký đối tác',
      /* «거래처 추가»가 없다 — 없는 조치를 지시하지 않고 어디서 오는 자료인지만 밝힌다. */
      noneDescription: 'Đối tác được nhận về từ hệ thống ngoài. Hãy kiểm tra hệ thống gốc.',
      noMatchTitle: 'Không có đối tác khớp điều kiện',
      noMatchDescription: 'Hãy giảm bớt hoặc đặt lại điều kiện rồi tra cứu lại.',
      notSelected: 'Chọn đối tác ở bên trái thì vai trò của đối tác đó hiện ở đây',
      /* 못 불러온 것과 없는 것은 할 수 있는 조치가 다르다 — 재시도가 아니라 다시 고르기로 안내한다. */
      notFoundTitle: 'Không tìm thấy đối tác đã chọn',
      notFoundDescription:
        'Đối tác này đã bị xóa ở hệ thống gốc hoặc số trên địa chỉ bị sai. Hãy chọn lại từ danh sách bên trái.',
    },
  },
  /** 거래처 역할 — 표시명이 사는 자리. 어휘 밖 코드의 이름은 서버가 준다. */
  partnerRole: {
    names: {
      customer: 'Khách hàng',
      supplier: 'Nhà cung cấp',
      subcontractor: 'Nhà gia công ngoài',
      disposal: 'Đơn vị xử lý hủy',
      other: 'Khác',
    },
    /* 통째 교체 저장에서 목록에 없는 역할은 조용히 해제되므로 감추지 않는다. */
    unknownBadge: 'Vai trò màn hình này không biết',
    unknownNote:
      'Vai trò mà màn hình này không biết sẽ bị gỡ khi lưu — vì giá trị ngoài năm vai trò do máy chủ quy định sẽ bị từ chối khi lưu. Đã gỡ rồi thì ở đây không gắn lại được.',
    /*
     * 공통 문구(«잠시 뒤 다시 저장하세요»)는 다시 시도하면 풀리는 자원을 전제한다 — 여기서는
     * 되풀이해도 같은 자리에서 멈추므로 없는 조치를 시키지 않고 상태만 밝히되 출구는 남긴다.
     */
    saveTokenUnavailable:
      'Thông tin cần cho việc lưu vẫn chưa được máy chủ cung cấp nên bây giờ chưa lưu được. Bấm lại cũng cho kết quả như vậy. Nếu lặp lại thì hãy báo người phụ trách.',
    actionReasons: {
      saveNoChanges: 'Lưu chỉ thực hiện được sau khi sửa vai trò.',
      saveLockedByOtherPartner:
        'Lưu chỉ thực hiện được sau khi việc lưu của đối tác khác kết thúc.',
    },
    /* 잃는 것이 있을 때만 서는 창. 버튼 문구가 «확인/취소»가 아니다 — 무엇을 누르는지 알아야 한다. */
    dialog: {
      title: 'Có vai trò sẽ bị gỡ',
      lead: 'Khi lưu, các vai trò dưới đây sẽ bị gỡ.',
      /* 계약이 빈 배열을 «전부 해제»로 정의한다 — 실제로 만들 수 있는 상태라 미리 밝힌다. */
      noneLeft: 'Khi lưu, đối tác này sẽ không còn vai trò nào.',
      confirm: 'Gỡ và lưu',
      keepEditing: 'Tiếp tục sửa',
    },
    empty: {
      noneTitle: 'Chưa chỉ định vai trò',
    },
  },
  /**
   * 코드값 편집 한 벌. 통째로 옮겨질 것을 전제로 모아 둔 자리라, 바깥 묶음에 같은 문구가
   * 있어도 여기 따로 둔다 — 한 벌은 자기 묶음만 들고 옮겨진다.
   */
  codeValue: {
    paneTitle: 'Giá trị mã',
    formPaneTitle: 'Thông tin giá trị mã',
    pageNavLabel: 'Chuyển trang giá trị mã',
    actions: {
      add: 'Thêm giá trị mã',
    },
    actionReasons: {
      addNeedsGroup: 'Thêm giá trị mã chỉ thực hiện được sau khi chọn nhóm mã ở bên trái.',
      /* 대상이 늘 코드값이라 바깥의 함수형을 대상 고정으로 여기 다시 둔다. */
      deactivateAlreadyDone:
        'Ngừng sử dụng không thể thực hiện lại với giá trị mã vốn đã ngừng dùng.',
    },
    loading: {
      list: 'Đang tải danh sách giá trị mã',
      detail: 'Đang tải thông tin giá trị mã',
    },
    /* 정렬은 화면이 한다 — 그 한계를 감추지 않되 겹친 순서는 막지 않고 알리기만 한다. */
    notices: {
      sortWithinPage: 'Sắp xếp chỉ áp dụng trong trang hiện tại.',
      duplicateDisplayOrder:
        'Có giá trị mã trùng thứ tự sắp xếp. Các giá trị trùng nhau hiển thị theo thứ tự mã.',
    },
    fields: {
      code: 'Mã',
      codeName: 'Tên mã',
      displayOrder: 'Thứ tự sắp xếp',
      effectivePeriod: 'Thời hạn hiệu lực',
      effectiveFrom: 'Hiệu lực từ',
      effectiveTo: 'Hiệu lực đến',
    },
    empty: {
      groupNotSelected: 'Hãy chọn nhóm mã ở bên trái trước',
      noneTitle: 'Nhóm mã này chưa đăng ký giá trị mã',
      noneDescription: 'Hãy đăng ký giá trị mã đầu tiên bằng «Thêm giá trị mã».',
      noMatchTitle: 'Không có giá trị mã khớp điều kiện',
      noMatchDescription: 'Bật «Gồm cả mục ngừng dùng» thì giá trị mã ngừng dùng cũng hiện ra.',
      notSelected: 'Hãy chọn giá trị mã ở danh sách trên trước',
      /* 바깥 묶음에 같은 문구가 있으나 한 벌은 자기 묶음만 들고 옮겨진다. */
      beyondLastTitle: 'Trang này không có kết quả',
      beyondLastDescription: 'Hãy chuyển về trang đầu.',
    },
    values: {
      /** 한쪽만 있는 것도 계약이 허용한다 — 없는 쪽을 지어내지 않는다. */
      period: (from: string, to: string): string => `${from} ~ ${to}`,
      empty: '—',
      inactiveSuffix: ' (ngừng dùng)',
    },
    validation: {
      required: 'Đây là mục bắt buộc.',
      codeBlank: 'Mã không được chỉ gồm khoảng trắng.',
      codeNameBlank: 'Tên mã không được chỉ gồm khoảng trắng.',
      codeTooLong: 'Mã không được vượt quá 50 ký tự.',
      codeNameTooLong: 'Tên mã không được vượt quá 200 ký tự.',
      /* 계약이 정수를 받는다. 하한이 없어 음수는 막지 않는다. */
      displayOrderInvalid: 'Hãy nhập thứ tự sắp xếp bằng số nguyên.',
      effectiveRangeReversed: 'Hiệu lực đến phải bằng hoặc sau hiệu lực từ.',
    },
    dialog: {
      deactivateTitle: 'Ngừng sử dụng giá trị mã này?',
    },
  },
};
