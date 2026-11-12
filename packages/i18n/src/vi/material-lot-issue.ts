import type { ko } from '../ko';
import type { Translated } from './translated';

export const materialLotIssue: Translated<typeof ko.materialLotIssue> = {
  title: 'Phát hành LOT quản lý vật tư',
  banner:
    'LOT quản lý vật tư được tạo trước theo nhà cung cấp · mặt hàng. Nhãn chỉ được in tại POP 「Nhãn LOT quản lý vật tư」(P-01-01), LOT tạo ở đây cũng hiện trong danh sách POP ở trạng thái chờ. LOT nhập hàng tự sinh ra khi quét nhập hàng trên PDA (M-01-01) nên không tạo ở đây.',
  filters: {
    label: 'Điều kiện tra cứu',
    plant: 'Nhà máy',
    supplier: 'Nhà cung cấp',
    supplierAll: 'Tất cả',
    item: 'Mặt hàng',
    itemPlaceholder: 'Mã · tên mặt hàng',
    view: 'Chế độ xem',
    waitingOnly: 'Chỉ dòng có LOT đang chờ',
  },
  list: {
    label: 'Nhà cung cấp · mặt hàng',
    count: (count: number) => `${count} nhà cung cấp · mặt hàng`,
    note: (plant: string, today: string) =>
      `${plant} · Hôm nay ${today} · Bấm vào một dòng để mở các LOT quản lý vật tư đang chờ`,
    issue: 'Phát hành LOT quản lý vật tư',
    columns: {
      supplier: 'Nhà cung cấp',
      item: 'Mặt hàng',
      baseUom: 'Đơn vị cơ sở',
      defaults: 'Thông tin mặc định (đóng gói · số lượng tồn kho mỗi LOT quản lý vật tư)',
      waiting: 'Chờ',
      unprinted: 'Chưa in nhãn',
      lastIssued: 'Phát hành gần nhất',
    },
    open: (supplier: string, item: string) => `Mở ${supplier} · ${item}`,
    empty: 'Không có nhà cung cấp · mặt hàng nào khớp điều kiện.',
    help: 'Chờ = LOT quản lý vật tư đã tạo nhưng chưa được quét nhập hàng trên PDA (chưa có tồn kho). Thông tin mặc định được thiết lập ở Quản lý dữ liệu gốc 「Thông tin mặc định nhà cung cấp · mặt hàng」.',
  },
  defaults: {
    noPackage: (qty: string) => `Không đóng gói · ${qty}`,
    missing: 'Chưa có thông tin mặc định',
    fromStorage: (unit: string) => `Điền theo đơn vị bảo quản mặc định của mặt hàng 「${unit}」`,
    manual: 'Nhập tay',
  },
  detail: {
    label: 'Chi tiết nhà cung cấp · mặt hàng',
    baseUom: 'Đơn vị cơ sở',
    storageUom: 'Đơn vị bảo quản mặc định của mặt hàng',
    storageNone: 'Không có',
    defaults: 'Thông tin mặc định',
    waitingTitle: 'LOT quản lý vật tư đang chờ',
    waitingCount: (count: number) => `${count} LOT · chưa quét nhập hàng`,
    void: (count: number) => (count > 0 ? `Hủy ${count} LOT` : 'Hủy'),
    issue: 'Phát hành LOT quản lý vật tư',
    columns: {
      lotNo: 'Số LOT quản lý vật tư',
      qty: 'Số lượng tồn kho',
      package: 'Đóng gói',
      supplierLot: 'LOT nhà cung cấp',
      status: 'Trạng thái',
      label: 'Nhãn',
      createdBy: 'Nơi tạo',
    },
    pick: (lotNo: string) => `Chọn ${lotNo}`,
    status: { WAITING: 'Chờ', VOIDED: 'Đã hủy', ACTIVE: 'Đã nhập hàng' },
    printed: (count: number) => `lần ${count}`,
    unprinted: 'Chưa in',
    channel: { POP: 'POP', WEB: 'Quản trị' },
    empty:
      'Không có LOT quản lý vật tư nào đang chờ. Hãy tạo bằng 「Phát hành LOT quản lý vật tư」 và in nhãn tại POP.',
    help: 'LOT quản lý vật tư đang chờ chưa có tồn kho và bị từ chối khi quét xuất kho · đưa vào sản xuất. Khi quét trên PDA, LOT sẽ vào LOT nhập hàng 「Đang nhập hàng」 của nhà cung cấp · mặt hàng này, hoặc một LOT nhập hàng mới được tạo. Sau khi hủy, LOT cũng bị từ chối khi quét nhập hàng trên PDA và số LOT không được dùng lại.',
    close: 'Đóng',
  },
  dialog: {
    title: 'Phát hành LOT quản lý vật tư',
    target: 'Nhà cung cấp · mặt hàng',
    targetPlaceholder: 'Hãy chọn nhà cung cấp · mặt hàng',
    targetOption: (supplier: string, itemCode: string, itemName: string, uom: string) =>
      `${supplier} · ${itemCode} ${itemName} (${uom})`,
    source: {
      default: 'Lấy từ thông tin mặc định — có thể thay đổi',
      itemStorage:
        'Chưa có thông tin mặc định nhà cung cấp · mặt hàng — điền theo đơn vị bảo quản mặc định của mặt hàng, số lượng nhập tay',
      none: 'Chưa có thông tin mặc định — nhập tay',
    },
    defaultsFailed: 'Không tải được thông tin mặc định. Vẫn có thể nhập tay để phát hành.',
    package: 'Đóng gói',
    packageOptional: '(tùy chọn)',
    packageOn: 'Có đóng gói',
    packageOff: 'Không đóng gói',
    packageUom: 'Đơn vị đóng gói',
    packageCount: 'Số kiện đóng gói',
    qtyPerPackage: (uom: string) => `Số lượng mỗi kiện đóng gói (${uom})`,
    packageNone: {
      default: 'Thông tin mặc định là 「Không đóng gói」. Nếu cần thì có thể thêm đóng gói.',
      itemStorage:
        'Nếu tạo không có đóng gói thì chỉ còn số lượng theo đơn vị cơ sở (ví dụ thùng có lẫn chiếc lẻ).',
      none: 'Chưa có thông tin mặc định lẫn đơn vị bảo quản mặc định của mặt hàng nên bắt đầu không đóng gói. Nếu cần thì có thể thêm đóng gói.',
    },
    lotQty: 'Số lượng tồn kho mỗi LOT quản lý vật tư',
    lotQtyHelpPackage: (uom: string) =>
      `Được điền bằng Số kiện đóng gói × Số lượng mỗi kiện. Nếu sửa tay thì phải bằng tích này. Đơn vị cố định theo đơn vị cơ sở của mặt hàng (${uom}).`,
    lotQtyHelp: (uom: string) =>
      `Đơn vị được cố định theo đơn vị cơ sở của mặt hàng (${uom}), không cần chọn.`,
    unitLocked: 'Cố định theo đơn vị cơ sở của mặt hàng',
    supplierLotNo: 'Số LOT nhà cung cấp (tùy chọn)',
    supplierLotHelp: 'Cùng một giá trị cho mọi LOT quản lý vật tư được tạo',
    lotCount: 'Số lượng LOT',
    lotCountHelp: 'Mỗi lần từ 1 đến 200 LOT',
    errors: {
      packageCount: 'Số kiện đóng gói phải là số nguyên từ 1 trở lên',
      qtyPerPackage: 'Số lượng mỗi kiện đóng gói phải lớn hơn 0',
      packageUom: 'Hãy chọn đơn vị đóng gói',
      lotQty: 'Hãy nhập số lượng tồn kho (số lớn hơn 0)',
      integer: (uom: string) => `Đơn vị ${uom} phải nhập số nguyên`,
      mismatch: (qty: string, pkg: string, product: string) =>
        `${qty} ≠ ${pkg} = ${product} — phải khớp thì mới phát hành được`,
      lotCount: 'Số lượng LOT phải là số nguyên từ 1 đến 200',
    },
    product: (pkg: string, product: string) => `${pkg} = ${product}`,
    summary: (
      count: number,
      each: string,
      pkg: string | null,
      total: string,
      supplierLot: string | null,
    ) =>
      `${count} LOT quản lý vật tư · mỗi LOT ${each}${pkg === null ? '' : ` (${pkg})`} · Tổng ${total}${
        supplierLot === null ? '' : ` · LOT nhà cung cấp ${supplierLot}`
      }`,
    summaryTail: (pattern: string) =>
      `Ví dụ số: ${pattern} … · Được tạo ở trạng thái chờ và tồn kho không tăng. Nhãn được in tại POP.`,
    summaryEmpty: 'Nhập số lượng LOT thì các LOT quản lý vật tư sẽ được phát hành hiện ở đây.',
    cancel: 'Hủy',
    submit: (count: number | null) => (count === null ? 'Phát hành' : `Phát hành ${count} LOT`),
  },
  void: {
    title: (count: number) => `Hủy ${count} LOT quản lý vật tư đang chờ?`,
    body: 'Sau khi hủy, LOT bị từ chối khi quét nhập hàng trên PDA và số LOT không được cấp lại.',
    printed: (count: number) =>
      `Nhãn của ${count} LOT đã in nhãn phải được bóc bỏ tại hiện trường.`,
    cancel: 'Hủy',
    confirm: (count: number) => `Hủy ${count} LOT`,
  },
  toast: {
    issued: (count: number) =>
      `Đã phát hành ${count} LOT quản lý vật tư ở trạng thái chờ — hãy in nhãn tại POP 「Nhãn LOT quản lý vật tư」`,
    voided: (count: number) => `Đã hủy ${count} LOT quản lý vật tư`,
    voidedPartly: (count: number, failed: number) =>
      `Đã hủy ${count} LOT quản lý vật tư · thất bại ${failed}`,
  },
  noPlant: 'Không có nhà máy nào có thể xem.',
  today: (day: string) => day,
};
