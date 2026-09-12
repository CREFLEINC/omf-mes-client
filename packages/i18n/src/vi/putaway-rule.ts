import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-06-14 적치 규칙 마스터. 고유 어휘 둘의 성질을 옮긴 말에서도 지킨다 —
 * 「창고 전체」(`Toàn kho`)는 값이 빠진 것이 아니라 확정된 뜻이고,
 * 「규칙 없는 품목」 0건은 좋은 상태라 그 자리에 경고 어휘를 쓰지 않는다.
 */
export const putawayRule: Translated<typeof ko.putawayRule> = {
  title: 'Quy tắc cất hàng',
  breadcrumbRoot: 'Dữ liệu gốc',
  panes: {
    list: 'Danh sách quy tắc cất hàng',
    uncovered: 'Mặt hàng chưa có quy tắc',
    /** 등록과 수정이 한 구획을 쓴다 — 「수정」(`Sửa`)과 갈리게 편집은 `Chỉnh sửa`로 둔다. */
    form: 'Chỉnh sửa quy tắc cất hàng',
    /** 전환은 폼 저장과 다른 오퍼레이션이라 구획을 나눈다 — 초안이 서기 전에도 자리가 있어야 한다. */
    activation: 'Chuyển trạng thái sử dụng quy tắc',
  },
  fields: {
    warehouse: 'Kho',
    item: 'Mặt hàng',
    location: 'Vị trí',
    capacity: 'Sức chứa',
    uom: 'Đơn vị',
    remarks: 'Ghi chú',
    /** 용량 옆에 서는 열. 지금 얼마나 차 있는지가 옆에 있어야 그 수가 뜻을 얻는다. */
    onHand: 'Lượng chứa hiện tại',
    /** 목록 열 이름. 좁은 칸에서 접히지 않게 한 낱말로 둔다(폼의 `Trạng thái sử dụng`과 다르다). */
    status: 'Sử dụng',
    priorityNo: 'Mức ưu tiên',
    itemCode: 'Mã mặt hàng',
    itemName: 'Tên mặt hàng',
    lastReceivedAt: 'Nhập kho gần nhất',
  },
  actions: {
    openExistingRule: 'Mở quy tắc hiện có',
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
    /** 목록과 규칙 없는 품목을 함께 다시 부른다. */
    reload: 'Tra cứu lại',
    /** 같은 품목의 위치별 규칙이 여럿 설 수 있어 위치를 함께 담는다. 내부 번호는 담지 않는다. */
    selectRow: (itemLabel: string, locationLabel: string): string =>
      `Chọn ${itemLabel} · ${locationLabel}`,
    /** 손잡이 하나가 두 방향을 맡는다 — 접근 이름은 지금 무엇을 하는가로 적는다. */
    expandUncovered: 'Mở rộng mặt hàng chưa có quy tắc',
    collapseUncovered: 'Thu gọn mặt hàng chưa có quy tắc',
    create: 'Thêm quy tắc',
    /** 등록의 주 액션. 수정의 `Lưu`와 이름이 달라야 지금 어느 폼인지 버튼에서 읽힌다. */
    submitCreate: 'Đăng ký',
    /** `Ngừng sử dụng`과 짝이며 한 번에 하나만 선다. */
    activate: 'Dùng lại',
    /**
     * 어느 쪽인지 아직 모를 때 서는 중립 이름. 상세가 오기 전에는 사용 여부를 모르므로
     * 둘 중 하나를 세우면 화면이 확인하지 않은 상태를 단언하게 된다.
     */
    activation: 'Chuyển trạng thái sử dụng',
    /** 품목은 수천 건일 수 있어 펼침 목록에 담지 않는다 — 창을 열어 찾는다. */
    openItemPicker: 'Tìm mặt hàng',
    searchItems: 'Tìm',
    chooseItem: (itemLabel: string): string => `Chọn ${itemLabel}`,
    keepEditing: 'Tiếp tục sửa',
    discardDraft: 'Bỏ giá trị đã sửa',
  },
  loading: {
    list: 'Đang tải danh sách quy tắc cất hàng',
    uncovered: 'Đang tải mặt hàng chưa có quy tắc',
    detail: 'Đang tải quy tắc cất hàng',
    itemSearch: 'Đang tìm mặt hàng',
  },
  filters: {
    all: 'Tất cả',
    /** 기본은 꺼짐이다 — 끈 규칙을 다시 켜는 것이 이 마스터의 정상 운용이다. */
    activeOnly: 'Chỉ đang dùng',
    /** 창고를 고르기 전에는 좁힐 대상이 없다. 감추지 않고 사유를 밝힌다. */
    itemNeedsWarehouse: 'Điều kiện mặt hàng chỉ dùng được sau khi chọn kho.',
    /** 선택지가 0건일 때만 선다 — 「전체」도 붙이지 않는다. */
    noWarehouseOptions: 'Không có kho để chọn',
    noItemOptions: 'Không có mặt hàng để chọn',
    lookupTruncated:
      'Chỉ hiển thị phần đầu của danh sách chọn. Không thấy giá trị cần tìm thì hãy báo người phụ trách.',
    lookupFailed: 'Không tải được danh sách chọn.',
    chipWarehouse: (value: string): string => `Kho: ${value}`,
    chipItem: (value: string): string => `Mặt hàng: ${value}`,
    chipRemoveWarehouse: 'Bỏ điều kiện kho',
    chipRemoveItem: 'Bỏ điều kiện mặt hàng',
    chipRemoveActiveOnly: 'Bỏ điều kiện chỉ đang dùng',
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)}`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `Tổng ${String(total)}`,
  },
  empty: {
    /** 창고를 고르기 전. 빈 표가 아니라 안내다 — 빈 표는 「규칙이 없다」로 읽힌다. */
    noWarehouseTitle: 'Chọn kho thì sẽ thấy quy tắc cất hàng',
    noWarehouseDescription: 'Hãy chọn kho ở ô kho phía trên.',
    noResultTitle: 'Chưa đăng ký quy tắc nào',
    noResultDescription: 'Hãy giảm bớt điều kiện hoặc tắt «Chỉ đang dùng» rồi tra cứu lại.',
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Hãy chuyển về trang đầu.',
    /** 규칙을 고르기 전. 폼을 빈 칸으로 두면 「값이 없는 규칙」으로 읽힌다. */
    noSelectionTitle: 'Chọn một quy tắc thì có thể sửa ở đây',
    noSelectionDescription: 'Hãy bấm mặt hàng trong bảng hoặc tạo mới bằng «Thêm quy tắc».',
    /** 주소에 남은 번호가 가리키는 규칙이 없다. 실패와 다른 사실이라 다른 문구를 낸다. */
    notFoundTitle: 'Không tìm thấy quy tắc đã chọn',
    notFoundDescription: 'Quy tắc đã bị xóa hoặc địa chỉ sai. Hãy chọn lại trong bảng.',
  },
  values: {
    /** 이름 목록은 왔는데 그 안에 없다 — 값이 잘못됐다는 신호다. */
    unknown: 'Không rõ',
    /** 이름 목록이 아직 오지 않았다. `Không rõ`로 쓰면 정상 값이 잘못된 값으로 읽힌다. */
    referenceLoading: 'Đang tải tên',
    referenceFailed: 'Không tải được tên',
    inactiveSuffix: ' (ngừng dùng)',
    /** 빈 값이 아니라 확정된 뜻이다 — 그 창고 안 어디에 두어도 된다. */
    warehouseWide: 'Toàn kho',
    active: 'Đang dùng',
    inactive: 'Ngừng dùng',
    /** 용량은 수량과 단위가 한 몸이다. */
    capacity: (qty: string, uomLabel: string): string => `${qty} ${uomLabel}`,
    neverReceived: 'Chưa từng nhập kho',
    /** 용량과 같은 형태로 적는다 — 두 수가 같은 모양이라야 눈으로 견줄 수 있다. */
    onHandQty: (qty: string, uomLabel: string): string => `${qty} ${uomLabel}`,
    /** 막대는 값을 max로 자르므로 초과 사실을 말하는 것은 이 문자열뿐이다. */
    usagePercent: (percent: string): string => `${percent}%`,
    /** 수량·단위·비율을 한 줄에 둔다 — 비율만 보이면 무엇의 비율인지 되짚어야 한다. */
    usageSummary: (qty: string, uomLabel: string, percent: string): string =>
      `${qty} ${uomLabel} · ${percent}%`,
    usageBarLabel: 'Lượng chứa hiện tại so với sức chứa',
    /** 잔액 줄이 한 줄도 없다. 「0이다」와 다른 사실이다. */
    onHandNone: '—',
    /** 잔액이 아직 오지 않았다. 「없다」로 쓰면 확인하지 못한 것을 사실로 말하게 된다. */
    onHandLoading: 'Đang tải lượng chứa hiện tại',
    onHandFailed: 'Không tải được lượng chứa hiện tại',
    /** 잘린 목록으로 합을 내면 실제보다 적은 수가 사용률의 분자가 된다. */
    onHandTruncated: 'Chỉ nhận được một phần lượng chứa hiện tại',
    /** 축이 다른 줄을 함께 더하면 같은 재고를 두 번 센다 — 셈하지 않고 그 사실을 말한다. */
    onHandAxisMixed: 'Trục gộp lượng chứa hiện tại đang bị trộn lẫn',
    /** 소유 구분 코드는 번역하지 않고 그대로 낸다(공유계약 G-2). */
    ownershipQty: (code: string, qty: string, uomLabel: string): string =>
      `${code} ${qty} ${uomLabel}`,
    /** 이 쪽 안의 사실만 말한다 — 쪽이 다른 중복은 저장 때 서버가 되돌린다. */
    duplicate: 'Trùng',
  },
  notes: {
    /** 이 쪽 안에서 센 수다 — 범위를 밝히지 않으면 전체 수로 읽힌다. */
    activeCountInPage: (count: number): string => `Đang dùng ${String(count)} ở trang này`,
    /**
     * 잘린 목록으로 이름을 풀면 정상 규칙이 `Không rõ`로 찍히는데, 그 낱말은 값이 잘못됐다는
     * 뜻이라 사용자가 반대로 읽는다 — 그 사실까지 말한다.
     */
    nameLookupTruncated:
      'Danh sách tên chỉ về phần đầu. Giá trị hiện là «Không rõ» thực tế vẫn có thể bình thường — hãy báo người phụ trách.',
    /** 환산 정의가 없는 조합이 있어 억지로 맞추지 않는다. */
    usageUnitMismatch: 'Đơn vị khác nhau nên không tính tỷ lệ.',
    /** 자사 재고와 고객 지급품을 더한 비율은 오독이다(공유계약 L-7). */
    usageOwnershipSplit: 'Phân loại sở hữu bị trộn lẫn nên không gộp lại.',
    usageCapacityNotPositive: 'Sức chứa của quy tắc từ 0 trở xuống nên không tính được tỷ lệ.',
    /** 비율을 내면 막대가 0으로 잘려 가장 비어 있는 위치와 같은 모양이 된다. */
    usageNegativeOnHand: 'Lượng chứa hiện tại đang âm nên không tính tỷ lệ.',
    /** 계약이 수정 본문에서 두 키를 뺐다 — 잠근 채 사유를 말하지 않으면 고장으로 읽힌다. */
    itemFixed: 'Mặt hàng và kho chỉ chọn được khi đăng ký. Muốn đổi thì hãy tạo quy tắc mới.',
    /** 빈 값이 아니라 확정된 뜻이라 칸 옆에서 말한다 — 말하지 않으면 「고르다 만 것」으로 읽힌다. */
    locationEmptyMeansWarehouseWide: 'Để trống vị trí thì quy tắc áp dụng cho toàn kho đó.',
    /** `WAREHOUSE` 수준에서는 Location을 받지 않는다. 해제 위치도 함께 안내한다(G-10). */
    locationNotManaged:
      'Kho này không quản lý vị trí. Có thể đổi mức quản lý ở màn hình Kho · Location.',
    /** 방향은 데이터에 적혀 있지 않고 계약이 정한 것이라 화면이 말해야 한다. */
    priorityDirection: 'Số càng nhỏ thì càng được đề xuất trước.',
    /** 위치 자체 용량을 나란히 보인다 — 규칙 용량 하나만으로는 그 수를 판단할 근거가 없다. */
    locationCapacity: (qty: string, uomLabel: string): string =>
      `Sức chứa của vị trí này ${qty} ${uomLabel}`,
    /** 막지 않는다 — 용량은 적치 판정에 쓰이지 않는다(`omf-mes#84`). */
    locationCapacityOver: 'Sức chứa của quy tắc lớn hơn sức chứa của vị trí này. Vẫn lưu được.',
    /** 단위가 다르면 두 수는 애초에 같은 종류가 아니다. */
    locationCapacityUnitMismatch: 'Đơn vị khác với sức chứa của vị trí nên không so sánh.',
    /** 판정하지 못했다 — 「중복 없음」으로 뭉개지 않되 막지도 않는다. */
    duplicateUnknown: 'Không kiểm tra được đã có quy tắc trùng tổ hợp này hay chưa. Vẫn lưu được.',
    /**
     * 켜기 갈래의 판정 불가. 저장 축과 문장을 나눈 이유는 겨누는 값이 다르고(저장은 폼 값,
     * 켜기는 서버 값) 뒤따르는 조작 이름이 다르기 때문이다.
     */
    activateDuplicateUnknown:
      'Không kiểm tra được có quy tắc đang dùng trùng tổ hợp này hay không. Vẫn dùng lại được — nếu trùng thì máy chủ sẽ trả về.',
    /**
     * ⛔ 폼 구획이 아니라 화면 수준에 서는 문장이다 — 폼이 닫힌 채 잠긴 갈래가 있고,
     * 그때 잠긴 이유가 화면 어디에도 없으면 사용자에게 고장으로 읽힌다(공유계약 G-30).
     */
    savingLock:
      'Cho đến khi yêu cầu đang gửi kết thúc thì không thể chuyển sang quy tắc khác, cũng không bắt đầu được lần lưu hay lần chuyển trạng thái sử dụng mới.',
    /**
     * ⭐ 응답을 받지 못한 요청은 「실패」가 아니다(공유계약 C-1). 금지를 먼저 두고
     * 확인 자리(`Tra cứu lại`)를 뒤에 붙인다 — 확인을 앞에 두면 실패한 사용자가 그대로 다시 보낸다.
     */
    networkUnconfirmed:
      'Không nhận được phản hồi nên chưa biết đã lưu hay chưa. Đừng lưu lại ngay cùng một giá trị — hãy dùng «Tra cứu lại» để xem kết quả trong danh sách trước.',
    /**
     * ⭐ 전환 축의 같은 갈래. 저장 축보다 무겁다 — 끄기가 닿았다면 그 순간부터 현장의
     * 적치 검증이 달라져 있다. 확인 자리는 목록의 사용 칸이다.
     */
    activationUnconfirmed:
      'Không nhận được phản hồi nên chưa biết trạng thái sử dụng đã đổi hay chưa. Đừng bấm lại ngay cùng một nút — hãy dùng «Tra cứu lại» để xem cột sử dụng trong danh sách trước.',
  },
  /** 등록·수정 폼에서만 쓰는 문구. 창고의 0건 문면은 `filters`의 것을 그대로 쓴다. */
  form: {
    /** 선택지가 0건일 때만 선다. 미도착·실패에는 아무 말도 하지 않는다. */
    noUomOptions: 'Không có đơn vị để chọn',
    /**
     * ⛔ `Không rõ`를 쓰지 않는다. 그 낱말은 이 슬라이스에서 「값이 잘못됐다」는 뜻이라
     * 빈 폼에 세우면 「아직 안 골랐다」와 갈리지 않는다.
     */
    itemNotChosen: 'Chưa chọn',
  },
  /** 보내기 전에 화면이 잡는 오류. 서버가 되돌려 주기를 기다리면 사용자가 두 번 기다린다. */
  validation: {
    itemRequired: 'Hãy chọn mặt hàng.',
    warehouseRequired: 'Hãy chọn kho.',
    capacityRequired: 'Hãy nhập sức chứa.',
    capacityNotNumber: 'Hãy nhập sức chứa bằng chữ số.',
    /** 계약이 「0 은 넣을 수 없다」로 못 박았다. 음수도 같은 자리에서 막는다. */
    capacityNotPositive: 'Sức chứa phải lớn hơn 0.',
    uomRequired: 'Hãy chọn đơn vị.',
    priorityRequired: 'Hãy nhập mức ưu tiên.',
    priorityNotInteger: 'Hãy nhập mức ưu tiên bằng số nguyên.',
  },
  /** 비활성 액션에는 반드시 사유가 붙는다(배치 규범 4). 컨트롤 이름으로 시작한다. */
  actionReasons: {
    saveNoChanges: 'Lưu chỉ bấm được khi có nội dung đã sửa.',
    /**
     * 조준 조회는 쪽을 넘어 보므로 막은 상대가 지금 보는 쪽에 없을 수 있다 —
     * 건수와 그 사실을 함께 말하지 않으면 사용자가 찾을 수 없는 규칙 때문에 막힌 채 남는다.
     */
    duplicateActive: (count: number): string =>
      `Đã có ${String(count)} quy tắc đang dùng trùng mặt hàng · kho · vị trí · mức ưu tiên. Có thể không nằm trong trang đang xem.`,
    saveLockedByOtherSave: 'Lưu chỉ thực hiện được sau khi lần lưu trước kết thúc.',
    createLockedByOtherSave: 'Đăng ký chỉ thực hiện được sau khi lần lưu trước kết thúc.',
    cancelLockedByOtherSave: 'Hủy chỉ thực hiện được sau khi lưu xong.',
    /** 머리글의 「규칙 추가」가 막힌 세 사유. 폼 안의 「등록」과 컨트롤이 달라 돌려 쓰지 않는다. */
    addNeedsWarehouse: 'Thêm quy tắc chỉ dùng được sau khi chọn kho.',
    addNeedsActiveWarehouse: 'Thêm quy tắc chỉ thực hiện được ở kho đang dùng.',
    addLockedByOtherSave: 'Thêm quy tắc chỉ dùng được sau khi yêu cầu đang gửi kết thúc.',
    /** 잠금 토큰이 상세 응답에서만 온다(위험 R2) — 사유가 없으면 고장으로 읽힌다. */
    activationNeedsDetail: 'Chuyển trạng thái sử dụng chỉ dùng được sau khi đã tải quy tắc.',
    activationLockedByOtherSave:
      'Chuyển trạng thái sử dụng chỉ dùng được sau khi yêu cầu đang gửi kết thúc.',
    activateDuplicate: (count: number): string =>
      `Đã có ${String(count)} quy tắc đang dùng trùng mặt hàng · kho · vị trí · mức ưu tiên. Có thể không nằm trong trang đang xem.`,
  },
  /** 품목 찾기 창. 창 안에 펼침 선택칸을 두지 않는다(`design-system-v2-webui#68`). */
  itemPicker: {
    title: 'Tìm mặt hàng',
    keywordLabel: 'Mã mặt hàng · Tên mặt hàng',
    keywordPlaceholder: 'Hãy nhập mặt hàng cần tìm',
    /** 검색어가 비면 조회하지 않는다 — 빈 검색어로 받은 앞 N건은 고를 만한 후보가 아니다. */
    beforeSearch: 'Hãy nhập từ khóa cần tìm rồi bấm «Tìm».',
    noResult: 'Không tìm thấy mặt hàng nào.',
    searchFailed: 'Không tìm được mặt hàng.',
    truncated:
      'Chỉ hiển thị phần đầu. Không thấy mặt hàng cần tìm thì hãy thu hẹp điều kiện rồi tìm lại.',
  },
  dialog: {
    /** 되돌릴 수 없는 조작 앞에 한 걸음을 둔다. */
    discardTitle: 'Bỏ giá trị đang sửa?',
    discardBody: 'Giá trị đã sửa sẽ mất và quay về giá trị đã lưu.',
    /** 계약에 이 오퍼레이션의 400이 아예 없어 화면의 경고가 유일한 방어다(G-12 규칙 2). */
    deactivateTitle: 'Ngừng sử dụng quy tắc này?',
    /** 무엇을 끄는지. 내부 번호가 아니라 품목·위치 이름이다. */
    deactivateTarget: (itemLabel: string, locationLabel: string): string =>
      `Ngừng sử dụng quy tắc ${itemLabel} · ${locationLabel}.`,
    /** ⭐ 마지막 활성 규칙일 때만 서는 문장이다 — 갈래 없이 늘 세우면 확인 안 한 사실을 단언한다. */
    deactivateLastRule:
      'Đây là quy tắc đang dùng duy nhất của mặt hàng này trong kho này. Tắt đi thì ở hiện trường sẽ qua mà không kiểm tra vị trí.',
    /** 남는 규칙이 있다 — 이 갈래에서 「위치 검증 없이 통과」는 참이 아니다. */
    deactivateRemaining: (count: number): string =>
      `Trong kho này mặt hàng này còn ${String(count)} quy tắc đang dùng. Sau khi tắt thì các quy tắc đó vẫn được áp dụng.`,
    /** 확인하지 못했다 — 「마지막이다」로도 「남는다」로도 단언하지 않고 조건부로 말한다. */
    deactivateCoverageUnknown:
      'Không kiểm tra được mặt hàng này còn quy tắc đang dùng nào khác hay không. Nếu đây là quy tắc cuối cùng thì ở hiện trường sẽ qua mà không kiểm tra vị trí.',
    /** ⛔ 무조건으로 약속하지 않는다 — 같은 조합이 사용 중이면 켜기는 화면도 계약도 막는다. */
    deactivateReversible:
      'Quy tắc đã tắt vẫn nằm trong danh sách và có thể dùng lại — nhưng nếu trong lúc đó có quy tắc trùng tổ hợp chuyển sang đang dùng thì sẽ bị chặn.',
    activateTitle: 'Dùng lại quy tắc này?',
    activateTarget: (itemLabel: string, locationLabel: string): string =>
      `Dùng lại quy tắc ${itemLabel} · ${locationLabel}.`,
    /** 어느 규칙이 이기는지는 이 창이 아는 사실이 아니다 — 「이 위치로만 간다」고 말하지 않는다. */
    activateApplies: 'Quy tắc này sẽ được dùng lại khi kiểm tra cất hàng ở hiện trường.',
  },
  /**
   * ⛔ 「Đã lưu」를 쓰지 않는다. 전환은 폼을 저장하지 않고 사용 여부만 뒤집는데,
   * 이 화면은 초안이 더러운 채로도 전환할 수 있어 저장 축 문면을 쓰면 고치던 값이
   * 저장된 것으로 읽힌다.
   */
  toast: {
    deactivated: 'Đã ngừng sử dụng',
    activated: 'Đã chuyển sang dùng lại',
  },
  /** 규칙이 없으면 현장이 위치 검증 없이 통과한다 — 목록만큼 중요한 자리다(공유계약 G-12). */
  uncovered: {
    /** 0건은 좋은 상태다. 경고 어휘를 쓰지 않는다. */
    noneTitle: 'Kho này không có mặt hàng nào chưa có quy tắc',
    noneDescription: 'Mọi mặt hàng từng nhập kho đều đã có quy tắc cất hàng.',
    countTitle: (count: number): string => `Kho này có ${String(count)} mặt hàng chưa có quy tắc`,
    countDescription: 'Mặt hàng không có quy tắc sẽ qua mà không kiểm tra vị trí ở hiện trường.',
    truncated: 'Chỉ hiển thị phần đầu. Phần còn lại nằm ở trang sau.',
    /** 펼쳤는데 목록이 비었다. 건수와 어긋나는 상태이므로 감추지 않고 그대로 말한다. */
    emptyListTitle: 'Không có danh sách để mở rộng',
    emptyListDescription: 'Nếu số đếm và danh sách lệch nhau thì hãy báo người phụ trách.',
  },
};
