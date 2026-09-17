import type { ko } from '../ko';
import type { Translated } from './translated';

/** P-04-01 Packing(P&P) 실적 등록 — POP. */
export const packingResult: Translated<typeof ko.packingResult> = {
  title: 'Đăng ký kết quả xuất hàng',
  panes: {
    scan: 'Quét',
    packing: 'Cấu thành kiện',
    progress: 'Tiến độ',
  },
  header: {
    shipment: (shipmentId: number): string => `Xuất hàng #${String(shipmentId)}`,
    shipmentContext: (shipmentRequestNo: string, customerName: string): string =>
      `${shipmentRequestNo} · ${customerName}`,
    worker: (workerNo: string): string => `Mã nhân viên ${workerNo}`,
    workerUnknown: 'Chưa xác nhận mã nhân viên',
    terminalUnknown: 'Chưa xác nhận máy trạm',
    online: 'Trực tuyến',
    offline: 'Ngoại tuyến',
  },
  scan: {
    label: {
      shipment: 'Số xuất hàng',
      productionLot: 'LOT sản xuất',
    },
    manualEntry: 'Nhập tay',
    shipmentSelection: 'Đối tượng xuất hàng',
    shipmentListLoading: 'Đang tải danh sách…',
    todayPickedShipments: 'Xuất hàng đã lấy hàng xong hôm nay',
    lotLocked: 'Hãy chọn đối tượng xuất hàng trước',
    shipmentChosen: 'Đã chọn · Nếu là đối tượng xuất hàng khác, hãy quét lại số xuất hàng',
  },
  match: {
    ok: (lotNo: string): string => `${lotNo} là LOT thuộc lô xuất hàng đã chọn.`,
    itemMismatch: (itemCode: string): string => `Mặt hàng của xuất hàng đã chọn là ${itemCode}`,
    notAllocated: 'Số LOT sản xuất không thuộc lô xuất hàng đã chọn.',
    unknownReason: 'LOT này không khớp với nhãn giao hàng',
    shipmentNotFound: 'Không tìm thấy số xuất hàng đã lấy hàng xong',
    openUnitBlocksShipmentChange: 'Hãy hủy kiện đang mở rồi mới quét xuất hàng khác',
    lookupFailed: 'Không tra cứu được. Hãy quét lại',
  },
  contents: {
    total: (packed: number, allocated: number): string =>
      `Tổng ${String(packed)} / ${String(allocated)}`,
    empty: 'Chưa có cấu hình đóng gói nào được thêm.',
    remove: 'Bỏ',
  },
  qty: {
    label: 'Số lượng',
    entryLabel: 'Số lượng cho vào',
    entryEmpty: '—',
    keypad: 'Bàn phím số lượng',
    backspace: 'Xóa một ký tự',
    clear: 'Xóa',
    decimal: 'Dấu thập phân',
    submit: 'Xác nhận',
    room: (room: number): string => `Còn ${String(room)}`,
    overRemaining: (remaining: number): string => `Không được vượt số phân bổ ${String(remaining)}`,
    notPositive: 'Số lượng phải lớn hơn 0',
  },
  fields: {
    handlingUnitType: 'Loại',
    typePlaceholder: 'Hãy chọn loại',
  },
  notes: {
    typeUnavailable: 'Không nhận được loại kiện. Hãy thử lại',
  },
  progress: {
    packed: (count: number): string => `Xuất hàng này có ${String(count)} kiện`,
    unpacked: (qty: number): string => `Chưa đóng gói ${String(qty)}`,
    unassigned: (count: number): string => `${String(count)} kiện chưa cấu thành`,
    unassignedUnknown: 'Không xác nhận được số kiện chưa cấu thành',
  },
  oqc: {
    label: 'Trạng thái OQC',
    status: {
      NOT_REQUIRED: 'Không áp dụng',
      PENDING: 'Chờ',
      PASSED: 'Đạt',
      REJECTED: 'Không đạt',
      HELD: 'Tạm giữ',
    },
  },
  actions: {
    rescan: 'Quét lại',
    confirm: 'Xác nhận kiện',
    confirming: 'Đang xác nhận…',
    retry: 'Thử lại',
    labels: 'Trạng thái nhãn · in lại',
    packing: 'Quay lại đăng ký đóng gói',
    cancelUnit: 'Hủy kiện',
  },
  automaticLabels: {
    region: 'Trạng thái in nhãn tự động',
    packingConfirmed: 'Đã xác nhận kiện',
    failures: {
      summary: 'Không xác nhận được lịch sử phát hành nên đã dừng in tự động.',
      issue: 'Không tạo được bản ghi phát hành.',
      render: 'Đã phát hành nhưng không nhận được hình ảnh nhãn.',
      print: 'Đã phát hành nhưng không in ra máy in được.',
      report: 'Không báo được kết quả in lên máy chủ.',
    },
    packingFailure: (reason: string): string => `Nhãn kiện: ${reason}`,
    complete: (handlingUnitNo: string): string =>
      `Đã in nhãn đóng gói - đã xác nhận kiện ${handlingUnitNo}.`,
    reissueRequired: (count: number): string =>
      `${String(count)} mục đã có bản ghi phát hành nhưng chưa in xong. Hãy vào in lại nhãn, chọn lý do rồi xử lý.`,
    retryPackingIssue: 'Phát hành lại nhãn kiện',
    retryPackingRendition: 'Nhận lại hình ảnh nhãn kiện',
    openReissue: 'Mở in lại nhãn',
  },
  /*
   * ⛔ **조작 이름(「포장 확정 —」)을 앞에 붙이지 않는다.** 이 문구는 [ 포장 확정 ] 바로 옆에
   * 서므로 무엇에 대한 말인지는 «자리»가 말한다(사용자 지시 2026-09-07 · 전례 `P-01-02`).
   */
  locks: {
    noContents: 'Kiện chưa có gì bên trong',
    noType: 'Hãy chọn loại',
    offline: 'Đang mất kết nối. Màn hình này chỉ xác nhận được khi có kết nối',
    gateChecking: 'Đang kiểm tra quyền của máy trạm',
    gateDenied: 'Máy trạm·công đoạn này không có quyền nhập kết quả',
    gateUnavailable: 'Không kiểm tra được quyền của máy trạm',
    gateUnidentified: 'Chưa xác nhận được máy trạm·công đoạn',
    workerMissing: 'Chưa xác nhận mã nhân viên. Hãy xác thực mã nhân viên trước.',
    shipmentMissing: 'Hãy chọn đối tượng xuất hàng trước',
    warehouseMissing: 'Phiếu xuất hàng không có kho nên không xác nhận được',
    unitOpening: 'Đang tạo kiện',
    unitMissing: 'Không tạo được kiện. Hãy quét lại hàng bên trong',
  },
  confirmed: (handlingUnitNo: string): string => `Đã xác nhận kiện ${handlingUnitNo}`,
  confirmDialog: {
    title: 'Xác nhận kiện này?',
    shipment: 'Số xuất hàng',
    type: 'Loại kiện',
    contents: 'Nội dung',
    lotCount: (count: number): string => `${count} LOT`,
    lotCountWithQty: (count: number, qty: string): string => `${count} LOT · SL ${qty}`,
    labelNotice: 'Sau khi xác nhận, nhãn kiện sẽ được in ngay.',
    cancel: 'Hủy',
    confirm: 'Xác nhận',
  },
};
