import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-06-02 검사기준 등록. 샘플 비율의 라벨과 검증 문구는 단위 `%`를 그대로 담는다 —
 * 단위를 지우면 30을 30개로 읽는다(#201).
 */
export const inspectionStandard: Translated<typeof ko.inspectionStandard> = {
  title: 'Đăng ký tiêu chuẩn kiểm tra',
  breadcrumbRoot: 'Dữ liệu gốc',
  panes: {
    plan: 'Tiêu chuẩn kiểm tra',
    version: 'Danh sách phiên bản',
    planForm: 'Thông tin tiêu chuẩn',
    versionForm: 'Thông tin phiên bản',
    items: 'Hạng mục kiểm tra',
  },
  actions: {
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
    excelUpload: 'Tải lên Excel',
    addPlan: 'Thêm tiêu chuẩn',
    approve: 'Phê duyệt',
    createVersion: 'Đăng ký phiên bản',
    newRevision: 'Phát hành phiên bản mới',
    confirm: 'Xác nhận',
    obsolete: 'Hủy bỏ',
    compareVersions: 'So sánh phiên bản',
    changeHistory: 'Lịch sử thay đổi',
    addItem: 'Thêm hạng mục',
    /* 행 안의 아이콘 버튼은 보이는 글자가 없다 — 표시 번호를 함께 넣어야 행마다 이름이 갈린다. */
    editItem: (displayNo: number): string => `Sửa hạng mục số ${String(displayNo)}`,
    removeItem: (displayNo: number): string => `Xóa hạng mục số ${String(displayNo)}`,
  },
  actionReasons: {
    excelUploadUnavailable:
      'Việc tải lên Excel hiện chưa thể thực hiện. Khi biểu mẫu được ấn định thì có thể dùng nút này.',
    /* 계약의 Routing 조회가 품목을 필수 쿼리로 둔다 — 품목을 비우면 고를 라우팅 자체가 없다. */
    routingNeedsItem: 'Routing chỉ chọn được sau khi đã chọn mặt hàng. Hãy chọn mặt hàng trước.',
    approveAlreadyDone: 'Việc phê duyệt không thực hiện lại được với tiêu chuẩn đã phê duyệt.',
    approveNeedsPlan: 'Việc phê duyệt chỉ thực hiện được sau khi đã đăng ký tiêu chuẩn.',
    deactivateAlreadyDone:
      'Việc ngừng sử dụng không thực hiện lại được với tiêu chuẩn đã ngừng dùng.',
    deactivateNeedsPlan: 'Việc ngừng sử dụng chỉ thực hiện được sau khi đã đăng ký tiêu chuẩn.',
    /* 발행하면 새 버전이 선택돼 지금 버전을 떠난다 — 저장하지 않은 편집은 그때 사라진다. */
    newVersionBlockedByUnsaved:
      'Việc phát hành phiên bản mới không thực hiện được khi còn thay đổi chưa lưu. Hãy lưu hoặc hủy trước.',
    confirmNeedsDraft:
      'Việc xác nhận chỉ thực hiện được với phiên bản đang soạn. Muốn thay đổi thì hãy phát hành phiên bản mới.',
    /* 계약이 항목 1건 이상을 요구한다(위반 시 400 LINE_REQUIRED) — 화면이 먼저 막고 사유를 밝힌다. */
    confirmNeedsItems:
      'Việc xác nhận chỉ thực hiện được sau khi đã lưu ít nhất 1 hạng mục kiểm tra.',
    confirmBlockedByUnsaved:
      'Việc xác nhận không thực hiện được khi còn thay đổi chưa lưu. Hãy lưu hoặc hủy trước.',
    obsoleteNeedsConfirmed:
      'Việc hủy bỏ chỉ thực hiện được với phiên bản đã xác nhận. Hãy xác nhận trước.',
    /** 여러 컨트롤이 공유하는 안내라 무엇에 대한 안내인지로 시작한다. */
    transitionNeedsVersion:
      'Việc xác nhận · hủy bỏ chỉ thực hiện được sau khi đã đăng ký phiên bản.',
    compareVersionsUnavailable:
      'Việc so sánh phiên bản hiện chưa thể thực hiện. Khi chức năng so sánh sẵn sàng thì có thể dùng nút này.',
    changeHistoryUnavailable:
      'Lịch sử thay đổi hiện chưa thể xem. Khi chức năng tra cứu sẵn sàng thì có thể dùng nút này.',
    /*
     * 확정·폐기 버전에서는 검사 항목도 잠긴다. 여러 컨트롤이 공유하는 안내라
     * 컨트롤 이름이 아니라 무엇에 대한 안내인지로 시작한다.
     */
    versionLocked:
      'Hạng mục kiểm tra chỉ sửa được ở phiên bản đang soạn. Muốn thay đổi thì hãy phát hành phiên bản mới.',
    /* 항목을 저장하면 버전 정보도 다시 불러온다 — 저장하지 않은 버전 편집을 조용히 잃지 않도록 먼저 막는다. */
    itemsSaveBlockedByHeader:
      'Việc lưu hạng mục không thực hiện được khi thông tin phiên bản còn thay đổi chưa lưu. Hãy lưu hoặc hủy trước.',
    itemsSaveBlockedByInvalid:
      'Việc lưu hạng mục không thực hiện được khi còn lẫn hạng mục không thể lưu. Hãy sửa hạng mục đó trong bảng.',
  },
  /**
   * 서버가 코드로만 알려 주는 거부 사유의 화면 문구.
   * 서버 문구가 비어 있어도 무엇을 하라는 안내가 남아야 한다.
   */
  serverErrors: {
    confirmedVersionRequired:
      'Việc phê duyệt chỉ thực hiện được khi có phiên bản đã xác nhận. Hãy xác nhận phiên bản trước.',
    lineRequired: 'Việc xác nhận chỉ thực hiện được sau khi đã lưu ít nhất 1 hạng mục kiểm tra.',
  },
  /** 확정·폐기 버전의 편집 잠금 안내. 「어떻게 풀 것인가」를 함께 담는다. */
  stateLock: {
    title: 'Đây là phiên bản hiện không sửa được',
    confirmed:
      'Phiên bản đã xác nhận thì không sửa được. Muốn thay đổi thì hãy phát hành phiên bản mới.',
    obsolete:
      'Phiên bản đã hủy bỏ thì không sửa được. Muốn thay đổi thì hãy phát hành phiên bản mới.',
  },
  dialog: {
    approveTitle: 'Phê duyệt tiêu chuẩn kiểm tra này?',
    /* 계약이 승인 해제를 제공하지 않는다 — 되돌릴 수 없다는 사실을 먼저 밝힌다. */
    approveDescription:
      'Đã phê duyệt thì không hoàn tác được. Không có chức năng bỏ phê duyệt. Người phê duyệt và thời điểm phê duyệt do máy chủ ghi lại.',
    deactivateTitle: 'Ngừng sử dụng tiêu chuẩn kiểm tra này?',
    deactivateDescription:
      'Không xóa. Sau khi ngừng sử dụng thì không dùng tiêu chuẩn này cho lần kiểm tra mới được nữa.',
    confirmTitle: 'Xác nhận phiên bản này?',
    confirmDescription:
      'Đã xác nhận thì phiên bản này không sửa được nữa. Muốn thay đổi thì phải phát hành phiên bản mới.',
    obsoleteTitle: 'Hủy bỏ phiên bản này?',
    obsoleteDescription:
      'Không xóa. Sau khi hủy bỏ thì không dùng phiên bản này cho lần kiểm tra mới được nữa.',
    itemCreateTitle: 'Thêm hạng mục kiểm tra',
    itemEditTitle: 'Sửa hạng mục kiểm tra',
    /*
     * 순서 컬럼에 유일 제약이 있어 행 단위 저장이 성립하지 않는다 —
     * 이 창의 확인은 표에만 반영된다는 사실을 감추지 않는다.
     */
    itemLocalNote: 'Bấm Xác nhận thì chỉ áp dụng vào bảng. Phải bấm «Lưu» mới áp dụng lên máy chủ.',
  },
  /** 되돌리기 어려운 상태 변경은 일반 저장과 구별해 방금 끝난 일을 그대로 말한다. */
  result: {
    approved: 'Đã phê duyệt tiêu chuẩn kiểm tra.',
    deactivated: 'Đã ngừng sử dụng tiêu chuẩn kiểm tra.',
    confirmed: 'Đã xác nhận phiên bản.',
    obsoleted: 'Đã hủy bỏ phiên bản.',
  },
  filters: {
    searchLabel: 'Tìm tiêu chuẩn kiểm tra',
    searchPlaceholder: 'Mã tiêu chuẩn hoặc tên tiêu chuẩn',
    inspectionType: 'Loại kiểm tra',
    typeAll: 'Tất cả loại',
    chipKeyword: (value: string): string => `Từ khóa: ${value}`,
    chipInspectionType: (label: string): string => `Loại kiểm tra: ${label}`,
    chipRemoveKeyword: 'Bỏ điều kiện từ khóa',
    chipRemoveInspectionType: 'Bỏ điều kiện loại kiểm tra',
    chipRemoveIncludeInactive: 'Bỏ điều kiện gồm cả mục ngừng dùng',
  },
  loading: {
    plans: 'Đang tải danh sách tiêu chuẩn kiểm tra',
    planDetail: 'Đang tải thông tin tiêu chuẩn',
    versions: 'Đang tải danh sách phiên bản',
    versionDetail: 'Đang tải thông tin phiên bản',
    items: 'Đang tải hạng mục kiểm tra',
  },
  optionsTruncated:
    'Chỉ hiển thị một phần danh sách chọn. Không thấy giá trị cần tìm thì hãy báo người phụ trách.',
  optionsLoadFailed: 'Không tải được danh sách chọn. Chỉ hiển thị giá trị đang lưu.',
  empty: {
    planNoneTitle: 'Chưa đăng ký tiêu chuẩn kiểm tra',
    planNoneDescription: 'Hãy đăng ký tiêu chuẩn kiểm tra đầu tiên bằng «Thêm tiêu chuẩn».',
    planNoMatchTitle: 'Không có tiêu chuẩn kiểm tra khớp điều kiện',
    planNoMatchDescription: 'Hãy giảm bớt hoặc đặt lại điều kiện rồi tra cứu lại.',
    /* 결과는 있는데 이 쪽에만 없다 — 「등록된 것이 없다」로 내면 사실과 다른 안내가 된다. */
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Hãy chuyển về trang đầu.',
    planNotSelected: 'Hãy chọn tiêu chuẩn kiểm tra ở bên trái trước',
    versionNoneTitle: 'Chưa đăng ký phiên bản',
    versionNoneDescription: 'Hãy tạo phiên bản đầu tiên bằng «Đăng ký phiên bản».',
    versionNotSelected: 'Hãy chọn phiên bản ở giữa trước',
    itemNoneTitle: 'Chưa đăng ký hạng mục kiểm tra',
    itemNoneDescription: 'Hãy đăng ký hạng mục đầu tiên bằng «Thêm hạng mục».',
  },
  fields: {
    inspectionPlanCode: 'Mã tiêu chuẩn',
    inspectionPlanName: 'Tên tiêu chuẩn',
    inspectionType: 'Loại kiểm tra',
    item: 'Mặt hàng',
    process: 'Công đoạn',
    routing: 'Routing',
    approval: 'Phê duyệt',
    active: 'Sử dụng',
    planVersion: 'Phiên bản',
    status: 'Trạng thái',
    effectiveFrom: 'Hiệu lực từ',
    effectiveTo: 'Hiệu lực đến',
    samplingMethod: 'Phương pháp lấy mẫu',
    /* 단위를 라벨에 박는다 — 받는 값이 백분율인데 라벨이 그것을 말하지 않으면 30을 30개로 읽는다(#201). */
    samplingRatio: 'Tỷ lệ lấy mẫu (%)',
    aqlValue: 'AQL',
    /** 합격·불합격 판정 개수는 AQL 표의 Ac·Re 다 — 검사 결과 건수가 아니다. */
    acceptanceNumber: 'Số chấp nhận',
    rejectionNumber: 'Số bác bỏ',
    inspectionFrequency: 'Chu kỳ kiểm tra',
    frequencyIntervalValue: 'Giá trị chu kỳ',
    frequencyIntervalUom: 'Đơn vị chu kỳ',
    sequence: 'Thứ tự',
    /** 표의 「항목」 열 — 코드와 이름을 한 칸에 담는다. `item`(품목)과 다른 것이다. */
    itemSpec: 'Hạng mục',
    dataType: 'Kiểu dữ liệu',
    targetRange: 'Mục tiêu · Phạm vi',
    measurementCount: 'Số lần đo',
    judgment: 'Đánh giá',
    /** 행 안의 수정·삭제 열. 머리글이 없으면 보조기술이 열의 뜻을 읽을 수 없다. */
    rowActions: 'Chỉnh sửa',
    inspectionItemCode: 'Mã hạng mục',
    inspectionItemName: 'Tên hạng mục',
    uom: 'Đơn vị',
    targetValue: 'Giá trị mục tiêu',
    lowerLimit: 'Giới hạn dưới',
    upperLimit: 'Giới hạn trên',
    inspectionMethod: 'Phương pháp kiểm tra',
    defaultInspectionEquipment: 'Thiết bị kiểm tra chỉ định',
    requiredFlag: 'Bắt buộc',
    automaticJudgment: 'Đánh giá tự động',
  },
  values: {
    /** 값이 없는 칸. 빈 칸으로 두면 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
    empty: '—',
    inactiveSuffix: ' (ngừng dùng)',
    /** 「전 품목 공통 기준」. 계약이 품목 널을 허용한다 — 빈 칸으로 두면 빠뜨린 것처럼 보인다. */
    allItems: 'Chung mọi mặt hàng',
    /* 승인자 이름을 만들지 않는다 — 계약이 주는 것은 사용자 번호뿐이라 시각만 낸다. */
    approvedAt: (at: string): string => `Đã phê duyệt · ${at}`,
    notApproved: 'Chưa phê duyệt',
    active: 'Đang dùng',
    inactive: 'Ngừng dùng',
    /*
     * 검사 유형 3값. 약어(IQC·PQC·OQC)는 계약이 정한 코드라 옮기지 않고,
     * 괄호 안 풀이만 옮긴다 — `screens/inspection-standard/code-options.ts`가 짝이다.
     */
    inspectionTypes: {
      iqc: 'IQC (kiểm tra đầu vào)',
      pqc: 'PQC (kiểm tra công đoạn)',
      oqc: 'OQC (kiểm tra xuất hàng)',
    },
    routingOption: (code: string, version: number): string => `${code} · Rev ${String(version)}`,
    version: (planVersion: number): string => `Phiên bản ${String(planVersion)}`,
    draft: 'Đang soạn',
    confirmed: 'Đã xác nhận',
    obsolete: 'Đã hủy bỏ',
    none: 'Không có',
    /** 「코드 · 이름」. 코드가 앞에 온다 — 중복 검증의 대상이라 훑을 수 있어야 한다. */
    itemLabel: (code: string, name: string): string => `${code} · ${name}`,
    /** 목표·하한~상한·단위를 한 칸에 담는다. 없는 값은 지어내지 않고 자리를 비워 표기한다. */
    range: (lower: string, upper: string): string => `${lower}~${upper}`,
  },
  validation: {
    required: 'Đây là mục bắt buộc.',
    planCodeBlank: 'Mã tiêu chuẩn không được chỉ gồm khoảng trắng.',
    planNameBlank: 'Tên tiêu chuẩn không được chỉ gồm khoảng trắng.',
    effectiveRangeReversed: 'Hiệu lực đến phải bằng hoặc sau Hiệu lực từ.',
    /* 계약이 짝을 요구하나 데이터베이스 CHECK 가 없다 — 화면이 먼저 막는다. */
    frequencyPairRequired: 'Giá trị chu kỳ và đơn vị chu kỳ phải cùng điền hoặc cùng để trống.',
    /* 계약 CHECK > 0 — 0 은 「없음」이 아니라 위반이다. */
    rejectionNumberInvalid: 'Số bác bỏ phải là số lớn hơn 0.',
    /* 계약 CHECK ≥ 0 — 0 은 허용된다. 불합격판정개수와 규칙이 다르다. */
    acceptanceNumberInvalid: 'Số chấp nhận phải là số từ 0 trở lên.',
    /* 계약 exclusiveMinimum: 0 · maximum: 100. 라벨과 같은 말을 쓴다 — 단위 `%`를 빼지 않는다. */
    samplingRatioInvalid: 'Tỷ lệ lấy mẫu (%) phải là giá trị lớn hơn 0 và nhỏ hơn hoặc bằng 100.',
    /* 계약이 버전 내 유일 제약을 두지 않았다 — 중복이 저장되면 측정 기록의 임자를 가릴 수 없다. */
    itemCodeDuplicated: 'Mã hạng mục này đã có trong phiên bản này. Hãy nhập mã khác.',
    /* 계약 ck_inspection_limits — 데이터베이스가 막는다. 먼저 막는 것이 사용자에게 이롭다. */
    limitsReversed: 'Giới hạn trên phải bằng hoặc lớn hơn giới hạn dưới.',
    /* 계약 CHECK > 0. 측정 횟수는 표본 번호의 상한이라 정수여야 한다. */
    measurementCountInvalid: 'Số lần đo phải là số nguyên từ 1 trở lên.',
    /* 경고이지 차단이 아니다 — 관리 한계와 규격 한계가 다른 경우가 업무상 정상이다. */
    targetOutOfRange:
      'Giá trị mục tiêu nằm ngoài khoảng giới hạn dưới~giới hạn trên. Hãy kiểm tra xem có đúng ý định không.',
  },
  /** 쪽 이동. 번호 목록을 두지 않는다 — 조건을 좁히는 것이 정상 경로다. */
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)}`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `Tổng ${String(total)}`,
  },
};
