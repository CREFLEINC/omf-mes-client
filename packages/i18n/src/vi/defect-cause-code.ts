import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-06-03 불량·원인코드 2계층 마스터. 두 탭이 문구 한 벌을 그대로 나눠 쓴다 —
 * 탭마다 달라지는 말은 `tabs`·`filters`에만 있다.
 *
 * 계층의 단은 `cấp`, 대분류는 `cấp lớn`, 상세는 `chi tiết` 으로 한 벌로 맞춘다.
 */
export const defectCauseCode: Translated<typeof ko.defectCauseCode> = {
  title: 'Mã lỗi · mã nguyên nhân',
  breadcrumbRoot: 'Quản lý chất lượng',
  tabs: {
    defect: 'Mã lỗi',
    cause: 'Mã nguyên nhân',
    mapping: 'Ánh xạ công đoạn',
  },
  panes: {
    list: (tab: string): string => `Danh sách ${tab}`,
    form: (tab: string): string => `Đăng ký · sửa ${tab}`,
    mapping: 'Ánh xạ mã lỗi chi tiết theo công đoạn',
  },
  actions: {
    addCategory: 'Thêm cấp lớn',
    addChild: 'Thêm mã cấp dưới',
  },
  actionReasons: {
    addChildNeedsCategory: 'Thêm chi tiết chỉ dùng được sau khi chọn một cấp lớn.',
    parentLockedByChildren:
      'Cấp lớn này có mã chi tiết bên dưới nên không đổi được cấp lớn bên trên.',
    codeLockedReferenced: 'Mã này đã được dùng trong hồ sơ khác nên không thể đổi.',
    deactivateNeedsActive: 'Ngừng sử dụng không làm được với mã đã ngừng dùng.',
  },
  loading: {
    codes: 'Đang tải danh sách mã',
    codeDetail: 'Đang tải thông tin mã',
    mapping: 'Đang tải ánh xạ công đoạn',
  },
  /** 서버가 목록을 잘라 내려보냈을 때. 잘림을 감추지 않고 조건을 좁힐 방법을 함께 알린다. */
  listTruncated: (shown: number, total: number): string =>
    `Hiển thị ${shown} trong tổng số ${total}. Hãy thu hẹp điều kiện rồi tra cứu.`,
  optionsTruncated:
    'Chỉ hiển thị một phần danh sách chọn. Không thấy giá trị cần tìm thì hãy báo người phụ trách.',
  optionsLoadFailed: 'Không tải được danh sách chọn. Chỉ hiển thị giá trị đang lưu.',
  /** 상위가 목록에 없는 코드를 모으는 그룹. 감추면 사용자는 코드가 사라진 줄 안다. */
  groupHeaderOrphan: 'Mã không tìm được cấp trên',
  categoryWarning: 'Cấp lớn được dùng chung cho mọi hiện trường.',
  parentListProvisional: 'Danh sách cấp lớn là tạm thời, có thể thay đổi sau khi chốt.',
  empty: {
    codeNoneTitle: 'Chưa đăng ký mã nào',
    codeNoneDescription: 'Hãy đăng ký cấp lớn đầu tiên bằng «Thêm cấp lớn».',
    codeNoMatchTitle: 'Không có kết quả khớp điều kiện',
    codeNoMatchDescription: 'Hãy giảm bớt hoặc đặt lại điều kiện rồi tra cứu lại.',
    codeNotSelected: 'Hãy chọn mã ở bên trái hoặc bắt đầu bằng «Thêm cấp lớn»',
    codeNotSelectedTitle: 'Hãy chọn mã',
    codeNotSelectedDescription: 'Chọn trong danh sách thì thông tin chi tiết sẽ hiện ra.',
    mappingNoneTitle: 'Không có mã lỗi chi tiết để ánh xạ',
    mappingNoneDescription: 'Hãy đăng ký mã chi tiết dưới cấp lớn ở tab mã lỗi trước.',
    processNoneTitle: 'Không có công đoạn để ánh xạ',
    processNoneDescription:
      'Hãy đăng ký công đoạn sẽ dùng ở tab dữ liệu gốc công đoạn của màn hình Routing trước.',
  },
  filters: {
    defectSearchLabel: 'Tìm mã lỗi',
    defectSearchPlaceholder: 'Nhập mã lỗi hoặc tên lỗi',
    causeSearchLabel: 'Tìm mã nguyên nhân',
    causeSearchPlaceholder: 'Mã nguyên nhân hoặc tên nguyên nhân',
    chipRemoveKeyword: 'Bỏ điều kiện từ khóa',
    chipRemoveIncludeInactive: 'Bỏ điều kiện gồm cả mục ngừng dùng',
    chipKeyword: (value: string): string => `Từ khóa: ${value}`,
  },
  fields: {
    code: 'Mã',
    name: 'Tên',
    parent: 'Cấp lớn bên trên',
    isActive: 'Sử dụng',
    kind: 'Phân loại',
    defectCode: 'Mã lỗi',
    defectName: 'Tên lỗi',
    disposition: 'Loại xử lý',
    process: 'Công đoạn',
    nameKo: 'Tên tiếng Hàn',
    nameVi: 'Tên tiếng Việt',
    referenceCount: 'Đang dùng',
  },
  tree: {
    childCount: (count: number): string => `${String(count)} mã cấp dưới`,
    collapse: 'Thu gọn mã cấp dưới',
    expand: 'Mở rộng mã cấp dưới',
  },
  usage: {
    label: 'Lọc theo trạng thái sử dụng',
    all: 'Tất cả',
    active: 'Sử dụng',
    inactive: 'Ngừng dùng',
    count: (label: string, count: number): string => `${label} ${String(count)}`,
  },
  listColumns: {
    defectCode: 'Mã lỗi',
    defectName: 'Tên lỗi',
    causeCode: 'Mã',
    causeName: 'Tên',
    kind: 'Phân loại mã',
    isActive: 'Sử dụng',
  },
  detail: {
    title: (tab: string): string => `Chi tiết ${tab}`,
    edit: 'Sửa',
    chipActive: 'Sử dụng',
    chipInactive: 'Ngừng dùng',
    kindCategory: 'Cấp lớn',
    kindChild: 'Chi tiết',
    childrenTitle: 'Mã chi tiết',
    childrenCount: (count: number): string => `Mã chi tiết ${String(count)}`,
    childrenEmpty: 'Chưa có mã chi tiết nào trong cấp lớn này.',
  },
  dialog: {
    createCategoryTitle: (tab: string): string => `Thêm cấp lớn ${tab}`,
    createChildTitle: (tab: string): string => `Thêm chi tiết ${tab}`,
    editTitle: (tab: string): string => `Sửa ${tab}`,
    defectCodePlaceholder: 'Nhập mã lỗi',
    defectNamePlaceholder: 'Nhập tên lỗi',
    causeCodePlaceholder: 'Nhập mã',
    causeNamePlaceholder: 'Nhập tên nguyên nhân',
  },
  values: {
    active: 'Đang dùng',
    inactive: 'Ngừng dùng',
    noParent: 'Không có (cấp lớn)',
    /** 미사용 항목을 선택지에 남길 때 라벨 뒤에 붙인다. */
    inactiveSuffix: ' (ngừng dùng)',
    disposition: { REWORKABLE: 'Có thể làm lại', SCRAP: 'Hủy bỏ' },
    referenceCount: (count: number): string => `${String(count)} bản ghi`,
    empty: '—',
    /** 그룹 머리글 — 대분류의 코드와 명칭을 함께 낸다. */
    groupHeader: (code: string, name: string): string => `${code} · ${name}`,
  },
  validation: {
    required: 'Đây là mục bắt buộc.',
    codeBlank: 'Mã không được chỉ gồm khoảng trắng.',
    parentSelfReference: 'Không chỉ định chính nó làm cấp trên được.',
    parentMustBeCategory: 'Cấp trên chỉ chỉ định được cấp lớn. Phân cấp tối đa 2 bậc.',
    parentBlockedByChildren:
      'Có mã cấp dưới nên không chỉ định được cấp trên. Phân cấp tối đa 2 bậc.',
  },
  /** 되돌리기 어려운 액션이라 확인을 한 단계 둔다. 무엇이 일어나는지 먼저 밝힌다. */
  deactivate: {
    title: 'Ngừng sử dụng?',
    description:
      'Ngừng sử dụng thì không chọn được mã này ở công việc mới. Dữ liệu cũ vẫn được giữ.',
    confirm: 'Ngừng sử dụng',
    /* 목록이 잘렸으면 하위 건수가 실제보다 적을 수 있어 「표시된 목록 기준」이라는 단서를 함께 남긴다. */
    childCount: (count: number): string => `Có ${String(count)} mã cấp dưới được liên kết.`,
  },
  mapping: {
    description:
      'Hàng là mã lỗi chi tiết, cột là công đoạn. Bấm vào ô thì ánh xạ được gán hoặc thu hồi ngay.',
    assigned: 'Đã ánh xạ',
    notAssigned: 'Chưa ánh xạ',
    saved: 'Đã áp dụng ánh xạ công đoạn',
    truncated:
      'Danh sách mã lỗi hoặc công đoạn chỉ hiển thị một phần nên không sửa được toàn bộ ánh xạ.',
  },
};
