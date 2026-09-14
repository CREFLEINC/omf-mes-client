import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-01-07 재고 현황·상태 조회. 조회 전용이다.
 *
 * 「(LOT 무관)」·「(자사 소유)」는 빈 값이 아니라 확정된 뜻이라 「알 수 없음」과 가른다.
 * 정렬 안내는 W-01-09 와 반대로 **전체 결과 기준**이다.
 */
export const stockStatus: Translated<typeof ko.stockStatus> = {
  title: 'Tra cứu tồn kho · trạng thái',
  breadcrumbRoot: 'Kho vật tư',
  panes: {
    list: 'Danh sách số dư tồn kho',
    detail: 'Chi tiết LOT',
    history: 'Lịch sử xuất nhập',
  },
  views: {
    label: 'Cách xem',
    item: 'Theo mặt hàng',
    lot: 'Theo LOT',
    location: 'Theo vị trí',
  },
  fields: {
    warehouse: 'Kho',
    item: 'Mặt hàng',
    lot: 'LOT',
    location: 'Vị trí',
    qualityStatus: 'Trạng thái chất lượng',
    inventoryStatus: 'Trạng thái tồn kho',
    ownership: 'Phân loại sở hữu',
    includeZero: 'Gồm cả số dư 0',
  },
  actions: {
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
    refresh: 'Làm mới',
    select: 'Chọn',
    deselect: 'Bỏ chọn',
    selectRow: (lotName: string): string => `Chọn ${lotName}`,
    deselectRow: (lotName: string): string => `Bỏ chọn ${lotName}`,
  },
  reasons: {
    warehouseRequired: 'Hãy chọn kho rồi mới tra cứu. Màn hình này xem tồn kho của một kho.',
    lotViewNeedsItem:
      'Cách xem theo LOT chỉ mở khi đã chọn mặt hàng. Tên LOT được phân giải trong phạm vi mặt hàng.',
    filterReferencesFailed:
      'Không tải được tên kho, vị trí, mặt hàng và LOT. Lý do sẽ hiện ở chỗ của tên.',
    listReferencesFailed: 'Không tải được tên đơn vị và nơi sở hữu. Lý do sẽ hiện ở chỗ của tên.',
    historyNeedsPeriod:
      'Hãy điền cả ngày làm việc bắt đầu và kết thúc rồi mới tra cứu. Không có khoảng thời gian thì không tra cứu được lịch sử xuất nhập.',
    historyPeriodReversed: 'Ngày làm việc kết thúc sớm hơn ngày bắt đầu. Hãy đổi thứ tự hai ngày.',
  },
  loading: {
    balances: 'Đang tải số dư tồn kho',
    lotDetail: 'Đang tải chi tiết LOT',
    history: 'Đang tải lịch sử xuất nhập',
    transactionLines: 'Đang tải các dòng giao dịch',
  },
  table: {
    item: 'Mặt hàng',
    lot: 'LOT',
    location: 'Vị trí',
    onHandQty: 'Hiện có',
    availableQty: 'Khả dụng',
    blockedQty: 'Tạm giữ',
    uom: 'Đơn vị',
    qualityStatus: 'Trạng thái chất lượng',
    inventoryStatus: 'Trạng thái tồn kho',
    ownership: 'Sở hữu',
    lastTransactionAt: 'Giao dịch gần nhất',
    select: 'Chi tiết',
  },
  groupHeader: {
    item: (name: string): string => `Mặt hàng: ${name}`,
    location: (name: string): string => `Vị trí: ${name}`,
  },
  filters: {
    all: 'Tất cả',
    codeNote:
      'Đây là danh sách tạm, chưa được chốt. Danh sách được dựng từ các giá trị có trong lần tra cứu này, nên giá trị không có trong kết quả thì không có trong danh sách.',
    lookupTruncated:
      'Danh sách chọn chỉ hiện một phần đầu. Nếu không thấy giá trị cần tìm, hãy báo người phụ trách.',
    lookupFailed: 'Không tải được danh sách chọn.',
    locationNeedsWarehouse: 'Chọn kho thì danh sách chọn vị trí sẽ được điền.',
    lotNeedsItem:
      'Chọn mặt hàng rồi chuyển sang cách xem theo LOT thì danh sách chọn LOT sẽ được điền.',
    chipWarehouse: (value: string): string => `Kho: ${value}`,
    chipItem: (value: string): string => `Mặt hàng: ${value}`,
    chipLot: (value: string): string => `LOT: ${value}`,
    chipLocation: (value: string): string => `Vị trí: ${value}`,
    chipQualityStatus: (value: string): string => `Trạng thái chất lượng: ${value}`,
    chipInventoryStatus: (value: string): string => `Trạng thái tồn kho: ${value}`,
    chipOwnership: (value: string): string => `Phân loại sở hữu: ${value}`,
    chipIncludeZero: 'Gồm cả số dư 0',
    chipRemoveWarehouse: 'Bỏ điều kiện kho',
    chipRemoveItem: 'Bỏ điều kiện mặt hàng',
    chipRemoveLot: 'Bỏ điều kiện LOT',
    chipRemoveLocation: 'Bỏ điều kiện vị trí',
    chipRemoveQualityStatus: 'Bỏ điều kiện trạng thái chất lượng',
    chipRemoveInventoryStatus: 'Bỏ điều kiện trạng thái tồn kho',
    chipRemoveOwnership: 'Bỏ điều kiện phân loại sở hữu',
    chipRemoveIncludeZero: 'Bỏ gồm cả số dư 0',
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)} dòng`,
    totalOnly: (total: number): string => `Tổng ${String(total)} dòng`,
  },
  empty: {
    notQueriedTitle: 'Chưa tra cứu',
    notQueriedDescription: 'Hãy chọn kho ở dòng điều kiện rồi tra cứu.',
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Hãy về trang đầu.',
    noResultTitle: 'Không có tồn kho nào khớp điều kiện',
    noResultDescription: 'Hãy bớt điều kiện hoặc bật 「Gồm cả số dư 0」 rồi tra cứu lại.',
    noSelectionTitle: 'Chưa chọn LOT nào',
    noSelectionDescription:
      'Chọn một LOT ở bảng trên thì trạng thái và phần tạm giữ của LOT đó hiện ở đây.',
  },
  values: {
    empty: '—',
    unknown: 'Không xác định',
    referenceLoading: 'Đang tải tên',
    referenceFailed: 'Không tải được tên',
    noLot: '(Không theo LOT)',
    ownedBySelf: '(Công ty sở hữu)',
    negativeOnHand: 'Hiện có âm',
    heldLotCount: (count: number): string => `${String(count)} LOT tạm giữ`,
    inactiveSuffix: ' (không dùng)',
  },
  notes: {
    sortScope:
      'Sắp xếp do máy chủ làm trên toàn bộ kết quả. Không chọn được chiều sắp xếp, chỉ một chiều tăng dần.',
    groupScope: 'Nhóm chỉ gom trong trang đang xem. Các dòng ở trang khác không được gom cùng.',
  },
  detail: {
    attributes: (lotNo: string): string => `LOT ${lotNo}`,
    quantities: 'Số lượng hiện tại',
    quantitiesNote:
      'Là số lượng của dòng ứng với điều kiện tra cứu đang đặt. Khả dụng là giá trị do máy chủ tính và trả về.',
    onHandQty: 'Hiện có',
    reservedQty: 'Đã đặt trước',
    pickedQty: 'Đã lấy hàng',
    blockedQty: 'Tạm giữ',
    availableQty: 'Khả dụng',
    uom: 'Đơn vị',
    lotType: 'Loại LOT',
    status: 'Trạng thái',
    manufacturedAt: 'Thời điểm sản xuất',
    expiryDate: 'Hạn sử dụng',
    initialQty: 'Số lượng ban đầu',
    remarks: 'Ghi chú',
    expiryPassed: 'Đã quá hạn sử dụng',
    expirySoon: 'Sắp hết hạn sử dụng',
    expiryNote: (days: number): string =>
      `Mốc sắp hết hạn là ${String(days)} ngày và vẫn chưa được chốt. Quá hạn cũng không tự động bị tạm giữ.`,
    externalIdentifiers: 'Mã định danh bên ngoài',
    identifierType: 'Loại mã định danh',
    externalIdentifier: 'Mã định danh',
    issuedBy: 'Nơi cấp',
    externalSystem: 'Hệ thống bên ngoài',
    issuedBySelf: '(Tự cấp)',
    noExternalIdentifiers: 'Không có mã định danh bên ngoài nào được đăng ký.',
    referencesFailed: 'Không tải được tên đơn vị và nơi cấp. Lý do sẽ hiện ở chỗ của tên.',
    holds: {
      title: 'Phần tạm giữ chưa được gỡ',
      reason: 'Lý do',
      status: 'Trạng thái',
      holdQty: 'Số lượng tạm giữ',
      uom: 'Đơn vị',
      heldAt: 'Thời điểm tạm giữ',
      releaseCondition: 'Điều kiện gỡ',
      remarks: 'Ghi chú',
      wholeLot: 'Tạm giữ toàn bộ',
      emptyTitle: 'Không có phần tạm giữ nào chưa gỡ',
      emptyDescription: 'LOT này không bị tạm giữ hoặc đã được gỡ hết.',
      suspectMaterialPath:
        'Đăng ký vật tư nghi ngờ được làm ở Quản lý chất lượng > Đăng ký vật tư nghi ngờ (W-03-03). Màn hình này chỉ tra cứu.',
    },
  },
  history: {
    periodFrom: 'Ngày làm việc bắt đầu',
    periodTo: 'Ngày làm việc kết thúc',
    periodNote:
      'Sổ cái xuất nhập được chia theo ngày làm việc nên phải có khoảng thời gian mới tra cứu được. Chọn LOT thì một tháng gần nhất được điền sẵn.',
    table: {
      businessDate: 'Ngày làm việc',
      transactionNo: 'Số giao dịch',
      transactionType: 'Loại giao dịch',
      sourceDocumentType: 'Phiếu gốc',
      status: 'Trạng thái',
      occurredAt: 'Thời điểm phát sinh',
      select: 'Dòng',
    },
    reversal: 'Xử lý đảo',
    showLines: 'Xem',
    hideLines: 'Đóng',
    showLinesRow: (transactionNo: string): string => `Xem các dòng của ${transactionNo}`,
    hideLinesRow: (transactionNo: string): string => `Đóng các dòng của ${transactionNo}`,
    empty: {
      notQueriedTitle: 'Chưa tra cứu',
      notQueriedDescription: 'Hãy điền khoảng ngày làm việc rồi tra cứu.',
      beyondLastTitle: 'Trang này không có lịch sử',
      beyondLastDescription: 'Hãy về trang đầu.',
      noResultTitle: 'Không có ghi nhận biến động nào trong khoảng này',
      noResultDescription: 'Hãy nới rộng khoảng ngày làm việc rồi tra cứu lại.',
      noSelectionTitle: 'Chưa chọn giao dịch nào',
      noSelectionDescription:
        'Chọn một giao dịch ở bảng trên thì các dòng của giao dịch đó hiện ở đây.',
    },
    lines: {
      title: 'Dòng giao dịch',
      item: 'Mặt hàng',
      lot: 'LOT',
      qty: 'Số lượng',
      uom: 'Đơn vị',
      fromWarehouse: 'Kho đi',
      fromLocation: 'Vị trí đi',
      toWarehouse: 'Kho đến',
      toLocation: 'Vị trí đến',
      otherWarehouseLocation: '(Vị trí của kho khác)',
      scopeNote:
        'Tên vị trí chỉ phân giải được với kho đã chọn ở dòng điều kiện. Các dòng đi lại với kho khác sẽ ghi sự thật đó thay cho tên vị trí.',
      emptyTitle: 'Giao dịch này không có dòng nào',
      referencesFailed:
        'Không tải được tên mặt hàng, LOT, kho, vị trí và đơn vị. Lý do sẽ hiện ở chỗ của tên.',
    },
  },
  asOf: (at: string): string => `Tại thời điểm ${at}`,
};
