import type { ko } from '../ko';
import type { Translated } from './translated';

export const supplierItemDefault: Translated<typeof ko.supplierItemDefault> = {
  title: 'Thông tin mặc định nhà cung cấp · mặt hàng',
  breadcrumbRoot: 'Quản lý dữ liệu gốc',
  intro:
    'Khi phát hành LOT quản lý vật tư (POP P-01-01, Quản trị W-01-14), đóng gói và số lượng tồn kho mỗi LOT quản lý vật tư được điền sẵn bằng giá trị này. Có thể thay đổi trên màn hình phát hành. Nhà cung cấp · mặt hàng không có ở đây sẽ được điền theo đơn vị bảo quản mặc định của mặt hàng, nếu cũng không có thì nhập tay.',
  filters: {
    label: 'Điều kiện',
    plant: 'Nhà máy',
    supplier: 'Nhà cung cấp',
    supplierPlaceholder: 'Tên hoặc mã nhà cung cấp',
    item: 'Mặt hàng',
    itemPlaceholder: 'Mã hoặc tên mặt hàng',
    reset: 'Đặt lại',
  },
  count: (count: number) => `${count} nhà cung cấp · mặt hàng`,
  plantNote: (plantName: string) => `Nhà máy: ${plantName}`,
  add: 'Thêm',
  tableLabel: 'Danh sách thông tin mặc định nhà cung cấp · mặt hàng',
  columns: {
    supplier: 'Nhà cung cấp',
    item: 'Mặt hàng',
    baseUom: 'Đơn vị cơ sở',
    packageUom: 'Đơn vị đóng gói',
    qtyPerPackage: 'Số lượng mỗi kiện (đơn vị cơ sở)',
    lotQty: 'Số lượng tồn kho mỗi LOT quản lý vật tư',
    preview: 'Xem trước nhãn',
    updated: 'Thời điểm thay đổi',
    actions: 'Quản lý',
  },
  values: {
    noPackage: 'Không có',
    none: '—',
    updated: (at: string, by: string | null) => (by === null ? at : `${at}, ${by}`),
  },
  edit: 'Sửa',
  delete: 'Xóa',
  editRow: (supplier: string, item: string) => `Sửa ${supplier} ${item}`,
  deleteRow: (supplier: string, item: string) => `Xóa ${supplier} ${item}`,
  empty: 'Không có nhà cung cấp · mặt hàng cần tìm. Hãy tạo bằng 「Thêm」.',
  help: 'Số lượng mỗi kiện = số lượng theo đơn vị cơ sở trong 1 kiện đóng gói. Số lượng tồn kho mỗi LOT quản lý vật tư phải là bội số nguyên của số lượng mỗi kiện (VD: túi 100 EA × 10 = 1,000 EA).',
  noPlant: 'Không có nhà máy nào trong phạm vi dữ liệu.',
  dialog: {
    addTitle: 'Thêm thông tin mặc định nhà cung cấp · mặt hàng',
    editTitle: 'Sửa thông tin mặc định',
    supplier: 'Nhà cung cấp',
    item: 'Mặt hàng',
    pick: 'Hãy chọn',
    baseUom: 'Đơn vị cơ sở',
    storage: (uomCode: string, qty: string, baseUomCode: string) =>
      `Đơn vị bảo quản mặc định của mặt hàng: ${uomCode} ${qty} ${baseUomCode}`,
    storageUnitOnly: (uomCode: string) => `Đơn vị bảo quản mặc định của mặt hàng: ${uomCode}`,
    storageNone: 'Mặt hàng chưa có đơn vị bảo quản mặc định',
    packageUom: 'Đơn vị đóng gói',
    noPackage: 'Không có',
    qtyPerPackage: 'Số lượng mỗi kiện đóng gói',
    qtyPerPackageHelp: (baseUomCode: string) =>
      baseUomCode === ''
        ? 'Số lượng theo đơn vị cơ sở trong 1 kiện đóng gói'
        : `Số lượng theo đơn vị cơ sở (${baseUomCode}) trong 1 kiện đóng gói`,
    lotQty: 'Số lượng tồn kho mỗi LOT quản lý vật tư',
    countOf: (uomCode: string, count: string) => `= ${count} ${uomCode}`,
    remarks: 'Ghi chú (tùy chọn)',
    footHint: 'Trên màn hình phát hành sẽ hiện 「Lấy từ thông tin mặc định」 và có thể thay đổi.',
    unchanged: 'Các LOT quản lý vật tư đã tạo không thay đổi',
    deleteTarget: (supplier: string, itemCode: string, itemName: string) =>
      `${supplier}, ${itemCode} ${itemName}`,
    cancel: 'Hủy',
    save: 'Lưu',
    close: 'Đóng',
  },
  errors: {
    pick: 'Hãy chọn nhà cung cấp và mặt hàng',
    duplicate: (supplier: string, item: string) =>
      `${supplier}, ${item} đã tồn tại — hãy sửa trong danh sách`,
    duplicateServer:
      'Thông tin mặc định của nhà cung cấp · mặt hàng này đã tồn tại — hãy sửa trong danh sách',
    qtyPerPackage: 'Số lượng mỗi kiện phải lớn hơn 0',
    lotQty: 'Hãy nhập số lượng tồn kho mỗi LOT quản lý vật tư (số lớn hơn 0)',
    integer: (uomCode: string) => `Đơn vị ${uomCode} phải nhập số nguyên`,
    multiple: (lotQty: string, _lotQtyWithTopic: string, qtyPerPackage: string) =>
      `Số lượng tồn kho mỗi LOT quản lý vật tư ${lotQty} phải là bội số nguyên của số lượng mỗi kiện ${qtyPerPackage}`,
    invalid: 'Số lượng tồn kho không khớp với tích đóng gói',
    conflict: 'Người khác đã sửa trước',
    reload: 'Tải lại',
  },
  deleteDialog: {
    title: 'Xóa thông tin mặc định?',
    body: 'Các LOT quản lý vật tư đã phát hành không thay đổi. Sau khi xóa, khi phát hành sẽ điền theo đơn vị bảo quản mặc định của mặt hàng hoặc nhập tay.',
    cancel: 'Hủy',
    confirm: 'Xóa',
  },
  toast: {
    saved: (supplier: string, item: string) => `${supplier}, ${item} đã lưu thông tin mặc định`,
    deleted: 'Đã xóa',
  },
};
