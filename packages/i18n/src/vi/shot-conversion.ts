import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-05-01 타발수 환산 파라미터 설정. 타발수 = 생산 수량 × 비율이고, 이 화면은 그 비율과
 * 「환산을 쓸지」를 정한다 — 툴별 차이(캐비티 수)는 툴 마스터의 몫이다.
 */
export const shotConversion: Translated<typeof ko.shotConversion> = {
  title: 'Thiết lập tham số quy đổi số nhát dập',
  breadcrumbRoot: 'Thiết bị / Công cụ',
  optionsTruncated:
    'Danh sách lựa chọn chỉ hiển thị một phần. Không thấy giá trị cần tìm thì hãy báo người phụ trách.',
  optionsLoadFailed: 'Không tải được danh sách lựa chọn. Chỉ hiển thị giá trị đang lưu.',
  /**
   * 환산을 켜고 끈다 — 이 화면의 스위치. 켜도 손 입력이 사라지지 않는다는 것을 반드시
   * 함께 적는다.
   */
  enabled: {
    paneTitle: 'Sử dụng quy đổi',
    switchLabel: 'Quy đổi số nhát dập từ số lượng sản xuất',
    loading: 'Đang tải thiết lập sử dụng quy đổi',
    offNote: 'Tắt thì chỉ nhập số nhát dập bằng tay.',
    /** ⭐ 켤 때 반드시 함께 읽혀야 하는 문장이다 — 없으면 손 입력이 막힌 줄 안다. */
    stillManual:
      'Bật vẫn nhập tay được như cũ. Quy đổi là đường phụ; bật thì phần nhập kết quả công việc có thêm lựa chọn «Quy đổi từ số lượng sản xuất».',
    /** ⚠ 막지 않는다 — 다만 지금 상태로는 동작하지 않는다고 말한다. */
    noRatioWarning:
      'Không có chính sách tỷ lệ nào nên quy đổi không chạy. Hãy thêm chính sách ở bên dưới.',
    noRatioTitle: 'Đã bật quy đổi nhưng không có tỷ lệ để dùng',
    /** ⛔ 아직 정하지 않은 것을 「끔」으로 그리지 않는다. */
    notSetTitle: 'Chưa quyết định',
    notSet:
      'Chưa quyết định có dùng quy đổi hay không. Trước khi quyết định thì chỉ nhập số nhát dập bằng tay.',
    loadFailed: 'Không tải được thiết lập sử dụng quy đổi.',
  },
  ratioList: {
    paneTitle: 'Chính sách tỷ lệ',
    loading: 'Đang tải chính sách tỷ lệ',
    emptyTitle: 'Chưa có chính sách tỷ lệ nào được đăng ký',
    emptyDescription:
      'Thêm chính sách thì sẽ hiện ở đây. Không có chính sách thì quy đổi không chạy.',
    noMatchTitle: 'Không có chính sách nào hiệu lực vào ngày đó',
    noMatchDescription: 'Để trống ngày cơ sở thì xem được cả những chính sách đã kết thúc.',
    /** ⭐ 범위가 겹치는 것이 정상이다 — 무엇이 이기는지를 표 곁에서 말해 둔다. */
    overlapNote:
      'Phạm vi chồng nhau thì cái hẹp hơn thắng — theo thứ tự mặt hàng · công đoạn · nhà máy · đơn vị kinh doanh.',
    /** ⚠ 화면이 판정하지 않는다 — 실제로 무엇이 적용되는지는 미리보기가 서버에 물어 답한다. */
    resolvedElsewhere: 'Chính sách nào đang được áp dụng thì hãy xem ở phần xem trước bên dưới.',
    listTruncated: (shown: number, total: number): string =>
      `Hiển thị ${String(shown)} trong tổng ${String(total)} mục. Hãy thu hẹp bằng ngày cơ sở.`,
    effectiveOnLabel: 'Ngày cơ sở',
    /** 비운 것이 기본이고, 그것이 「끝난 것까지 본다」는 뜻이다. */
    effectiveOnNote: 'Để trống thì xem cả chính sách đã kết thúc.',
    /**
     * ⛔ 범위 문구에 덧붙이지 않는다 — 붙이면 값 이름의 일부로 읽힌다. 끝났다는 것은
     * «기간»의 성질이므로 기간 칸에 둔다.
     */
    ended: 'Đã kết thúc',
  },
  /** 범위 축을 사람의 말로. 차례가 곧 우선순위다(품목 · 공정 · 공장 · 사업부). */
  scope: {
    all: 'Tất cả',
    itemId: 'Mặt hàng',
    processId: 'Công đoạn',
    plantId: 'Nhà máy',
    businessUnitId: 'Đơn vị kinh doanh',
    /** ⛔ 값 이름 «안»에서 쓰는 이음쇠(`·`)와 달라야 한다 — 같으면 축 경계가 사라진다. */
    join: ' / ',
    entry: (axisLabel: string, valueLabel: string): string => `${axisLabel} ${valueLabel}`,
  },
  actions: {
    addPolicy: 'Thêm chính sách',
  },
  form: {
    createTitle: 'Đăng ký chính sách tỷ lệ',
    editTitle: 'Sửa chính sách tỷ lệ',
    scopeLegend: 'Phạm vi áp dụng',
    /** ⭐ 비운 축이 「전체」다 — 「고르지 않음」이 아니라 값이다. */
    scopeNote:
      'Trục không chọn nghĩa là tất cả. Chỉ định càng hẹp thì khi chồng nhau càng được áp dụng trước — theo thứ tự mặt hàng · công đoạn · nhà máy · đơn vị kinh doanh.',
    scopeAll: 'Tất cả',
    ratioPlaceholder: 'Ví dụ: 0.25',
    /** ⭐ 무엇을 뜻하는 수인지 칸 옆에서 말한다 — 「비율」만으로는 무엇의 비율인지 모른다. */
    ratioNote:
      'Nhân số lượng sản xuất với số này để ra số nhát dập. Khuôn có 4 khoang thì là 0.25.',
    effectiveFrom: 'Ngày bắt đầu hiệu lực',
    effectiveTo: 'Ngày kết thúc hiệu lực',
    effectiveToNote: 'Để trống thì không có ngày kết thúc.',
    /** ⛔ 코드와 축은 바꾸지 않는다 — 바꾸면 다른 정책이 된다. */
    scopeFixed:
      'Phạm vi áp dụng được định khi đăng ký và không đổi được ở cửa sổ này. Muốn đổi phạm vi thì hãy kết thúc chính sách này rồi đăng ký mới.',
  },
  /**
   * 정책을 끝낸다. 지우지 않는다 — 과거 실적이 그때의 비율로 계산됐고, 지우면 그 계산의
   * 근거가 사라진다.
   */
  end: {
    action: 'Kết thúc chính sách',
    label: (scope: string): string => `Kết thúc chính sách ${scope}`,
    title: 'Kết thúc chính sách này?',
    target: (scope: string): string => `Kết thúc chính sách phạm vi ${scope}.`,
    dateLabel: 'Ngày kết thúc hiệu lực',
    /** ⭐ 「지우는 것이 아니다」를 먼저 말한다 — 이 창에서 가장 오해하기 쉬운 자리다. */
    notDeleted:
      'Đây không phải xóa mà là đặt ngày kết thúc hiệu lực. Chính sách và giá trị của nó vẫn còn, kết quả tính đến ngày kết thúc vẫn giữ nguyên như đã tính bằng tỷ lệ này.',
    /** ⚠ 끝낸 뒤 무엇이 적용될지는 이 창이 알 수 없다 — 서버가 판정한다. */
    afterNote:
      'Sau khi kết thúc thì chính sách phạm vi rộng hơn sẽ được áp dụng thay. Không còn chính sách nào thì quy đổi không chạy.',
    dateRequired: 'Hãy đặt ngày kết thúc hiệu lực.',
    dateBeforeStart: (from: string): string =>
      `Ngày kết thúc hiệu lực phải bằng hoặc sau ngày bắt đầu (${from}).`,
    /** 이미 끝난 정책은 끝낼 것이 없다 — 감추지 않고 사유와 함께 잠근다. */
    alreadyEnded:
      'Chính sách này đã kết thúc. Muốn đổi kỳ hạn thì hãy sửa ngày kết thúc ở phần sửa.',
  },
  validation: {
    required: 'Mục bắt buộc.',
    /** ⛔ 0이면 타발수가 늘 0이라 예방보전이 영영 오지 않는다. DB가 막지 않아 화면이 막는다. */
    ratioPositive:
      'Tỷ lệ phải lớn hơn 0. Bằng 0 thì số nhát dập luôn là 0 và bảo trì phòng ngừa sẽ không đến.',
    ratioNumber: 'Hãy nhập tỷ lệ bằng số.',
    /** ⚠ 막지 않는다 — 한 번에 여러 번 타발하는 공정이 있을 수 있다. */
    ratioOverOne:
      'Tỷ lệ lớn hơn 1. Số nhát dập sẽ nhiều hơn số lượng, hãy xác nhận có đúng không. Vẫn lưu được như vậy.',
    periodOrder: 'Ngày kết thúc hiệu lực phải bằng hoặc sau ngày bắt đầu.',
  },
  /**
   * 미리보기 — 범위 해석을 서버가 한다. 화면이 우선순위를 다시 구현하지 않는다.
   */
  preview: {
    paneTitle: 'Xem trước',
    description:
      'Chọn công cụ · mặt hàng · công đoạn thì sẽ thấy chính sách thực sự áp dụng cho tổ hợp đó và số nhát dập tính theo nó.',
    toolLabel: 'Công cụ',
    itemLabel: 'Mặt hàng',
    processLabel: 'Công đoạn',
    quantityLabel: 'Số lượng sản xuất',
    quantityPlaceholder: 'Ví dụ: 500',
    toolPlaceholder: 'Hãy chọn công cụ',
    anyScope: 'Không chỉ định',
    loading: 'Đang xác nhận chính sách áp dụng',
    loadFailed: 'Không xác nhận được chính sách áp dụng.',
    appliedTitle: 'Chính sách áp dụng',
    /** ⭐ 서버가 「어느 축으로 이겼는가」를 함께 준다 — 그것이 곧 왜 이 값인지의 설명이다. */
    matchedBy: (scopeLabel: string): string => `Khớp theo phạm vi ${scopeLabel}.`,
    matchedScope: {
      ITEM: 'Mặt hàng',
      PROCESS: 'Công đoạn',
      PLANT: 'Nhà máy',
      BUSINESS_UNIT: 'Đơn vị kinh doanh',
      ALL: 'Tất cả',
    },
    /** ⛔ 「1.0」으로 채우지 않는다 — 없는 정책을 있는 것으로 만들면 계산이 조용히 돈다. */
    unresolvedTitle: 'Không có chính sách áp dụng — không quy đổi được',
    unresolved:
      'Không có chính sách tỷ lệ nào khớp tổ hợp này. Hãy thêm chính sách phạm vi rộng hơn, hoặc đăng ký chính sách khớp tổ hợp này.',
    ratioLabel: 'Tỷ lệ áp dụng',
    cavityLabel: 'Số khoang khuôn',
    cavitySource: 'Được định ở dữ liệu gốc công cụ.',
    /** 남는 「없음」은 툴을 아직 고르지 않은 것 하나뿐이고, 그것은 오류가 아니다. */
    cavityNeedsTool: 'Chọn công cụ thì sẽ hiện kèm số khoang khuôn.',
    shotLabel: 'Số nhát dập',
    shotCount: (shots: number): string => `${String(shots)} lần`,
    /** ⭐ 셈을 그대로 보인다 — 결과만 보이면 왜 그 수인지 알 수 없다. */
    formula: (quantity: number, ratio: number, shots: number): string =>
      `${String(quantity)} × ${String(ratio)} = ${String(shots)}`,
    cavityNote: (cavityCount: number): string =>
      `Công cụ này mỗi lần ra ${String(cavityCount)} cái.`,
    /** ⚠ 캐비티 수와 비율이 어긋나면 알린다 — 둘은 같은 것을 두 곳에서 말한다. */
    cavityMismatch: (cavityCount: number, expected: string): string =>
      `Có ${String(cavityCount)} khoang khuôn thì tỷ lệ phải là ${expected}. Khác với tỷ lệ đang áp dụng.`,
    needsQuantity: 'Nhập số lượng sản xuất thì sẽ tính và hiện số nhát dập.',
    quantityNumber: 'Hãy nhập số lượng sản xuất là số lớn hơn 0.',
  },
  fields: {
    scope: 'Phạm vi',
    ratio: 'Tỷ lệ',
    period: 'Kỳ hiệu lực',
    formula: 'Công thức',
    notRecorded: 'Không có ghi nhận',
  },
  /** ⭐ 무엇을 뜻하는 수인지 계산식으로 보인다 — 「0.25」만으로는 무엇의 0.25인지 모른다. */
  formula: (ratio: number): string => `Số lượng × ${String(ratio)}`,
  period: {
    open: (from: string): string => `${from} ~`,
    closed: (from: string, to: string): string => `${from} ~ ${to}`,
  },
};
