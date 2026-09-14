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
  breadcrumbRoot: 'Dữ liệu gốc',
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
    addChild: 'Thêm chi tiết',
  },
  actionReasons: {
    addChildNeedsCategory: 'Thêm chi tiết chỉ dùng được sau khi chọn một cấp lớn.',
    parentLockedByChildren:
      'Cấp lớn bên trên không đổi được khi còn mã cấp dưới. Chuyển mã cấp dưới sang cấp lớn khác thì dùng được mục này.',
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
  categoryWarning:
    'Cấp lớn là trục dùng chung toàn công ty. Thêm vào thì mọi hiện trường đều dùng, hãy cân nhắc kỹ.',
  parentListProvisional:
    'Danh sách cấp lớn hiện còn là tạm. Khi được chốt thì danh sách chọn của mục này có thể đổi.',
  empty: {
    codeNoneTitle: 'Chưa đăng ký mã nào',
    codeNoneDescription: 'Hãy đăng ký cấp lớn đầu tiên bằng «Thêm cấp lớn».',
    codeNoMatchTitle: 'Không có kết quả khớp điều kiện',
    codeNoMatchDescription: 'Hãy giảm bớt hoặc đặt lại điều kiện rồi tra cứu lại.',
    codeNotSelected: 'Hãy chọn mã ở bên trái hoặc bắt đầu bằng «Thêm cấp lớn»',
    mappingNoneTitle: 'Không có mã lỗi chi tiết để ánh xạ',
    mappingNoneDescription: 'Hãy đăng ký mã chi tiết dưới cấp lớn ở tab mã lỗi trước.',
    processNoneTitle: 'Không có công đoạn để ánh xạ',
    processNoneDescription:
      'Hãy đăng ký công đoạn sẽ dùng ở tab dữ liệu gốc công đoạn của màn hình Routing trước.',
  },
  filters: {
    defectSearchLabel: 'Tìm mã lỗi',
    defectSearchPlaceholder: 'Mã lỗi hoặc tên lỗi',
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
  },
  values: {
    active: 'Đang dùng',
    inactive: 'Ngừng dùng',
    noParent: 'Không có (cấp lớn)',
    /** 미사용 항목을 선택지에 남길 때 라벨 뒤에 붙인다. */
    inactiveSuffix: ' (ngừng dùng)',
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
    description: 'Không xóa. Ngừng sử dụng thì không chọn được ở công việc mới.',
    confirm: 'Ngừng sử dụng',
    /* 목록이 잘렸으면 하위 건수가 실제보다 적을 수 있어 「표시된 목록 기준」이라는 단서를 함께 남긴다. */
    childCount: (count: number): string =>
      `Cấp lớn này có ${count} mã chi tiết cấp dưới theo danh sách đang hiển thị.`,
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
