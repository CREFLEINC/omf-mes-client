import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-06-01 Routing(공정) 등록·관리. `Routing`·`Rev`는 계약이 쓰는 말이라 옮기지 않는다.
 *
 * 상태 문구(작성중·확정·폐기)는 화면이 매핑해서 고른다 — 매핑의 정본은
 * screens/routing/routing-status.ts 한 곳이다.
 */
export const routing: Translated<typeof ko.routing> = {
  title: 'Routing (công đoạn)',
  breadcrumbRoot: 'Dữ liệu gốc',
  tabs: {
    label: 'Routing · Danh mục công đoạn',
    routing: 'Routing',
    processes: 'Danh mục công đoạn',
  },
  panes: {
    item: 'Mặt hàng',
    revision: 'Danh sách Rev',
    header: 'Thông tin Routing',
    operations: 'Dòng công đoạn',
    processList: 'Danh sách công đoạn',
    processForm: 'Đăng ký · chỉnh sửa công đoạn',
  },
  actions: {
    newRevision: 'Phát hành Rev mới',
    createRouting: 'Đăng ký Routing',
    addOperation: 'Thêm công đoạn',
    addProcess: 'Thêm công đoạn',
    activateProcess: 'Dùng lại',
    confirm: 'Xác nhận',
    obsolete: 'Hủy bỏ',
    dependencies: 'Thiết lập trước sau',
    compareRevisions: 'So sánh Rev',
    changeHistory: 'Lịch sử thay đổi',
    /* 행 안의 아이콘 버튼은 보이는 글자가 없다 — 표시 번호를 함께 넣어야 행마다 이름이 갈린다. */
    editOperation: (displayNo: number): string => `Sửa công đoạn số ${displayNo}`,
    removeOperation: (displayNo: number): string => `Xóa công đoạn số ${displayNo}`,
  },
  actionReasons: {
    dependenciesUnavailable:
      'Việc thiết lập trước sau hiện chưa thể thực hiện. Khi cách định quan hệ trước sau giữa các công đoạn được ấn định thì có thể dùng nút này.',
    compareRevisionsUnavailable:
      'Việc so sánh Rev hiện chưa thể thực hiện. Khi chức năng so sánh sẵn sàng thì có thể dùng nút này.',
    changeHistoryUnavailable:
      'Lịch sử thay đổi hiện chưa thể xem. Khi chức năng tra cứu sẵn sàng thì có thể dùng nút này.',
    outsourcedUnavailable:
      'Công đoạn thuê ngoài hiện chưa thể chỉ định. Khi mục để lưu sẵn sàng thì có thể dùng ô đánh dấu này.',
    /** 계약이 라인 1건 이상을 요구한다(위반 시 400 LINE_REQUIRED) — 화면이 먼저 막고 사유를 밝힌다. */
    confirmNeedsOperations:
      'Việc xác nhận chỉ thực hiện được sau khi đã đăng ký ít nhất 1 công đoạn.',
    confirmNeedsDraft:
      'Việc xác nhận chỉ thực hiện được với Rev đang soạn. Muốn thay đổi thì hãy phát hành Rev mới.',
    /* 확정하면 그 Rev는 더 이상 수정할 수 없다 — 저장하지 않은 편집을 잃기 전에 막는다. */
    confirmBlockedByUnsaved:
      'Việc xác nhận không thực hiện được khi còn thay đổi chưa lưu. Hãy lưu hoặc hủy trước.',
    obsoleteNeedsConfirmed:
      'Việc hủy bỏ chỉ thực hiện được với Rev đã xác nhận. Hãy xác nhận trước.',
    /* 발행하면 새 판이 선택돼 지금 판을 떠난다 — 저장하지 않은 편집은 그때 사라진다. */
    newRevisionBlockedByUnsaved:
      'Việc phát hành Rev mới không thực hiện được khi còn thay đổi chưa lưu. Hãy lưu hoặc hủy trước.',
    /** 첫 Rev 등록 폼이 열려 있는 동안. 여러 컨트롤이 공유하는 안내라 무엇에 대한 안내인지로 시작한다. */
    transitionNeedsRouting: 'Việc xác nhận · hủy bỏ chỉ thực hiện được sau khi đã đăng ký Routing.',
    /*
     * 확정·폐기 Rev에서는 공정 라인도 잠긴다. 여러 컨트롤이 공유하는 안내라
     * 컨트롤 이름이 아니라 무엇에 대한 안내인지로 시작한다.
     */
    operationsLocked:
      'Dòng công đoạn chỉ sửa được ở Rev đang soạn. Muốn thay đổi thì hãy phát hành Rev mới.',
    /* 라인을 저장하면 헤더도 다시 불러온다 — 저장하지 않은 헤더 편집을 조용히 잃지 않도록 먼저 막는다. */
    operationsSaveBlockedByHeader:
      'Việc lưu công đoạn không thực hiện được khi thông tin Routing còn thay đổi chưa lưu. Hãy lưu hoặc hủy trước.',
    operationsSaveBlockedByInvalid:
      'Việc lưu công đoạn không thực hiện được khi còn công đoạn chưa nhập xong. Hãy sửa công đoạn đó trong bảng.',
  },
  /** 확정·폐기 Rev의 편집 잠금 안내. 「어떻게 풀 것인가」를 함께 담는다. */
  stateLock: {
    title: 'Đây là Rev hiện không sửa được',
    confirmed: 'Rev đã xác nhận thì không sửa được. Muốn thay đổi thì hãy phát hành Rev mới.',
    obsolete: 'Rev đã hủy bỏ thì không sửa được. Muốn thay đổi thì hãy phát hành Rev mới.',
  },
  filters: {
    searchLabel: 'Tìm mặt hàng',
    searchPlaceholder: 'Mã mặt hàng hoặc tên mặt hàng',
    onlyWithoutRouting: 'Chỉ mục chưa có Routing',
    processSearchLabel: 'Tìm công đoạn',
    processSearchPlaceholder: 'Mã công đoạn hoặc tên công đoạn',
    chipRemoveKeyword: 'Bỏ điều kiện từ khóa',
    chipRemoveOnlyWithoutRouting: 'Bỏ điều kiện chỉ mục chưa có Routing',
    chipKeyword: (value: string): string => `Từ khóa: ${value}`,
  },
  loading: {
    items: 'Đang tải danh sách mặt hàng',
    revisions: 'Đang tải danh sách Rev',
    header: 'Đang tải thông tin Routing',
    operations: 'Đang tải dòng công đoạn',
    processes: 'Đang tải danh sách công đoạn',
    processDetail: 'Đang tải chi tiết công đoạn',
  },
  listTruncated: (shown: number, total: number): string =>
    `Hiển thị ${shown} trong tổng số ${total}. Hãy thu hẹp điều kiện rồi tra cứu.`,
  optionsTruncated:
    'Chỉ hiển thị một phần danh sách chọn. Không thấy giá trị cần tìm thì hãy báo người phụ trách.',
  optionsLoadFailed: 'Không tải được danh sách chọn. Chỉ hiển thị giá trị đang lưu.',
  empty: {
    itemNoneTitle: 'Chưa đăng ký mặt hàng',
    itemNoneDescription: 'Khi mặt hàng được đăng ký thì có thể chọn trong danh sách này.',
    itemNoMatchTitle: 'Không có mặt hàng khớp điều kiện',
    itemNoMatchDescription: 'Hãy giảm bớt hoặc đặt lại điều kiện rồi tra cứu lại.',
    itemNotSelected: 'Hãy chọn mặt hàng ở bên trái trước',
    revisionNoneTitle: 'Chưa đăng ký Rev',
    revisionNoneDescription: 'Hãy tạo Rev đầu tiên bằng «Đăng ký Routing».',
    revisionNotSelected: 'Hãy chọn Rev ở giữa trước',
    operationNoneTitle: 'Chưa đăng ký công đoạn',
    operationNoneDescription: 'Hãy đăng ký công đoạn đầu tiên bằng «Thêm công đoạn».',
    processNoneTitle: 'Chưa đăng ký công đoạn',
    processNoneDescription: 'Hãy đăng ký công đoạn đầu tiên bằng «Thêm công đoạn».',
    processNoMatchTitle: 'Không có công đoạn khớp điều kiện',
    processNoMatchDescription: 'Hãy giảm bớt hoặc đặt lại điều kiện rồi tra cứu lại.',
    processNotSelected: 'Hãy chọn công đoạn ở bên trái hoặc thêm công đoạn mới',
  },
  fields: {
    item: 'Mặt hàng',
    itemCode: 'Mã mặt hàng',
    itemName: 'Tên mặt hàng',
    routingCode: 'Mã Routing',
    revision: 'Rev',
    status: 'Trạng thái',
    effectiveFrom: 'Hiệu lực từ',
    effectiveTo: 'Hiệu lực đến',
    operationNo: 'Thứ tự',
    process: 'Công đoạn',
    processCode: 'Mã công đoạn',
    processName: 'Tên công đoạn',
    processType: 'Loại công đoạn',
    isActive: 'Trạng thái sử dụng',
    operationName: 'Tên công đoạn',
    managedItems: 'Hạng mục quản lý',
    /** 단위를 라벨에 적는다 — 값만 보고는 분·초를 구분할 수 없다. */
    standardCycleTimeSec: 'C/T tiêu chuẩn (giây)',
    /** 허용 범위를 라벨에 적는다 — 퍼센트로 오입력하면 100배가 조용히 통과한다. */
    standardYieldRate: 'Tỷ lệ đạt tiêu chuẩn (0~1)',
    outsourced: 'Công đoạn thuê ngoài',
    /** 행 안의 수정·삭제 열. 머리글이 없으면 보조기술이 열의 뜻을 읽을 수 없다. */
    rowActions: 'Chỉnh sửa',
  },
  /** 공정 라인의 관리 플래그 7종. 표에서는 켜진 것의 이름만 이어 낸다. */
  operationFlags: {
    mesManaged: 'Quản lý MES',
    materialInputManaged: 'Quản lý đưa vật tư vào',
    productionResultManaged: 'Quản lý sản lượng',
    inspectionManaged: 'Quản lý kiểm tra',
    outputLotRequired: 'Bắt buộc LOT đầu ra',
    equipmentRequired: 'Bắt buộc thiết bị',
    moldRequired: 'Bắt buộc khuôn',
  },
  values: {
    draft: 'Đang soạn',
    confirmed: 'Đã xác nhận',
    obsolete: 'Đã hủy bỏ',
    /** 공정 마스터의 사용여부. 표의 칸과 편집 폼이 같은 말을 써야 두 자리가 갈리지 않는다. */
    active: 'Đang dùng',
    inactive: 'Ngừng dùng',
    none: 'Không có',
    empty: '—',
    inactiveSuffix: ' (ngừng dùng)',
    revision: (version: number): string => `Rev ${version}`,
  },
  validation: {
    required: 'Đây là mục bắt buộc.',
    codeBlank: 'Mã Routing không được chỉ gồm khoảng trắng.',
    effectiveRangeReversed: 'Hiệu lực đến phải bằng hoặc sau Hiệu lực từ.',
    operationNameBlank: 'Tên công đoạn không được chỉ gồm khoảng trắng.',
    processCodeBlank: 'Mã công đoạn không được chỉ gồm khoảng trắng.',
    processNameBlank: 'Tên công đoạn không được chỉ gồm khoảng trắng.',
    processTypeRequired: 'Hãy chọn loại công đoạn.',
    /** 단위가 초이고 0은 불가다 — 라벨과 같은 말을 오류에도 적어야 무엇을 고칠지 알 수 있다. */
    cycleTimeInvalid: 'C/T tiêu chuẩn phải là số theo đơn vị giây và lớn hơn 0.',
    /** 퍼센트로 넣으면 여기서 막힌다. 막지 않으면 100배 오입력이 조용히 통과한다. */
    yieldRateInvalid: 'Tỷ lệ đạt tiêu chuẩn phải là tỷ lệ giữa 0 và 1. Không phải phần trăm.',
  },
  dialog: {
    operationCreateTitle: 'Thêm công đoạn',
    operationEditTitle: 'Sửa công đoạn',
    /* 되돌리기 어려운 전이라 무엇이 일어나는지와 그 뒤에 무엇을 할 수 있는지를 먼저 밝힌다. */
    confirmTitle: 'Xác nhận Rev này?',
    confirmDescription:
      'Đã xác nhận thì Rev này không sửa được nữa. Muốn thay đổi thì phải phát hành Rev mới.',
    obsoleteTitle: 'Hủy bỏ Rev này?',
    obsoleteDescription:
      'Không xóa. Sau khi hủy bỏ thì không dùng Rev này cho công việc mới được nữa.',
    /*
     * 순서 컬럼에 유일 제약이 있어 행 단위 저장이 성립하지 않는다 —
     * 이 창의 확인은 표에만 반영된다는 사실을 감추지 않는다.
     */
    operationLocalNote:
      'Bấm Xác nhận thì chỉ áp dụng vào bảng. Phải bấm «Lưu» mới áp dụng lên máy chủ.',
    deactivateProcessTitle: 'Ngừng sử dụng công đoạn này?',
    deactivateProcessDescription:
      'Các Routing đã xác nhận vẫn giữ nguyên, chỉ từ nay không chọn được ở dòng công đoạn mới.',
    deactivateProcessReferences: (count: number): string =>
      `Có ${String(count)} nơi đang tham chiếu công đoạn này.`,
    activateProcessTitle: 'Dùng lại công đoạn này?',
    activateProcessDescription: 'Từ nay có thể chọn lại công đoạn này ở dòng công đoạn mới.',
  },
};
