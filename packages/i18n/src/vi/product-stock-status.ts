import type { ko } from '../ko';
import type { Translated } from './translated';

/** W-04-08 완제품 재고·Lot Status 조회. 조회 전용이라 쓰기 어휘가 없다. */
export const productStockStatus: Translated<typeof ko.productStockStatus> = {
  title: 'Tra cứu tồn kho thành phẩm và Lot Status',
  breadcrumbRoot: 'Xuất hàng',
  panes: {
    list: 'Danh sách số dư tồn kho',
    detail: 'Chi tiết LOT',
  },
  fields: {
    warehouse: 'Kho',
    item: 'Mặt hàng',
    groupBy: 'Nhóm theo',
    availableOnly: 'Chỉ khả dụng',
  },
  views: {
    item: 'Theo mặt hàng',
    lot: 'Theo LOT',
    location: 'Theo vị trí',
  },
  actions: {
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
    refresh: 'Làm mới',
    select: 'Chi tiết',
    deselect: 'Bỏ chọn',
    selectRow: (lotName: string): string => `Chọn ${lotName}`,
    deselectRow: (lotName: string): string => `Bỏ chọn ${lotName}`,
    lotStatusLink: 'Xem ở màn hình Lot Status',
  },
  reasons: {
    warehouseRequired: 'Chọn kho rồi mới tra cứu. Màn hình này xem tồn kho của một kho.',
    lotViewNeedsItem:
      'Nhóm theo LOT chỉ mở sau khi chọn mặt hàng. Tên LOT được phân giải trong phạm vi mặt hàng.',
    filterReferencesFailed:
      'Không tải được tên kho và mặt hàng. Lý do sẽ hiện ở chỗ của các lựa chọn.',
    listReferencesFailed:
      'Không tải được tên mặt hàng, LOT và vị trí. Lý do sẽ hiện ở chỗ của tên.',
  },
  loading: {
    balances: 'Đang tải số dư tồn kho',
    lotDetail: 'Đang tải chi tiết LOT',
  },
  table: {
    item: 'Mặt hàng',
    lot: 'LOT',
    location: 'Vị trí',
    onHandQty: 'Đang giữ',
    availableQty: 'Khả dụng',
    availableRatio: 'Tỷ lệ khả dụng',
    blockedQty: 'Tạm giữ',
    qualityStatus: 'Trạng thái chất lượng',
    inventoryStatus: 'Trạng thái tồn kho',
    select: 'Chi tiết',
  },
  groupHeader: {
    item: (name: string): string => `Mặt hàng: ${name}`,
    location: (name: string): string => `Vị trí: ${name}`,
  },
  filters: {
    all: 'Tất cả',
    lookupTruncated:
      'Chỉ hiện một phần đầu của các lựa chọn. Nếu không có giá trị cần tìm, hãy báo người phụ trách.',
    lookupFailed: 'Không tải được các lựa chọn.',
    chipWarehouse: (value: string): string => `Kho: ${value}`,
    chipItem: (value: string): string => `Mặt hàng: ${value}`,
    chipAvailableOnly: 'Chỉ khả dụng',
    chipRemoveWarehouse: 'Bỏ điều kiện kho',
    chipRemoveItem: 'Bỏ điều kiện mặt hàng',
    chipRemoveAvailableOnly: 'Bỏ điều kiện chỉ khả dụng',
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)} mục`,
    totalOnly: (total: number): string => `Tổng ${String(total)} mục`,
  },
  empty: {
    notQueriedTitle: 'Chưa tra cứu',
    notQueriedDescription: 'Hãy chọn kho ở dòng điều kiện rồi tra cứu.',
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Hãy về trang đầu.',
    noResultTitle: 'Không có tồn kho nào khớp điều kiện',
    noResultDescription: 'Hãy bớt điều kiện rồi tra cứu lại.',
    noSelectionTitle: 'Chưa chọn LOT nào',
    noSelectionDescription: 'Chọn LOT ở bảng trên thì các mục tạm giữ chưa được gỡ sẽ hiện ở đây.',
  },
  values: {
    empty: '—',
    negativeOnHand: 'Đang giữ âm',
    heldLotCount: (count: number): string => `${String(count)} LOT tạm giữ`,
    availableRatioUnavailable: 'Không tính được',
  },
  notes: {
    groupScope: 'Nhóm chỉ gom trong trang đang xem. Các hàng ở trang khác không được gom cùng.',
  },
  summary: {
    title: 'Tóm tắt',
    itemCount: 'Số mặt hàng',
    lotCount: 'Số LOT',
    onHandQty: 'Tổng đang giữ',
    availableQty: 'Tổng khả dụng',
    blockedQty: 'Tổng tạm giữ',
    unavailableMark: 'ⓘ',
    unavailable:
      'Màn hình này hiện chưa nhận được tổng số mặt hàng, số LOT, đang giữ, khả dụng và tạm giữ. Phần tổng hợp mà hợp đồng quy định vẫn chưa được nối vào truy vấn của màn hình này.',
  },
  detail: {
    heading: (label: string): string => `LOT ${label}`,
    holds: {
      title: 'Các mục tạm giữ chưa được gỡ',
      reason: 'Lý do',
      status: 'Trạng thái',
      heldAt: 'Thời điểm tạm giữ',
      releaseCondition: 'Điều kiện gỡ',
      emptyTitle: 'Không có mục tạm giữ nào chưa được gỡ',
      emptyDescription: 'LOT này không có mục tạm giữ nào hoặc tất cả đã được gỡ.',
    },
  },
  asOf: (at: string): string => `Tính đến ${at}`,
};
