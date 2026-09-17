import type { ko } from '../ko';
import type { Translated } from './translated';

/** P-02-08 포장 작업(LOT 스캔·제품 포장) — POP. */
export const packingWork: Translated<typeof ko.packingWork> = {
  title: 'Đóng gói sản xuất',

  device: {
    /* ⚠ 머리줄 표기는 「W/O」로 통일한다(사용자 지시 2026-09-10). */
    workOrderLabel: 'W/O',
    workOrderUnknown: 'Không có W/O',
    terminalLabel: 'Máy trạm',
    terminalUnknown: 'Chưa xác nhận',
  },

  entry: {
    missingWorkOrder:
      'Không biết lệnh sản xuất nên không tải được đối tượng đóng gói. Hãy chọn lệnh sản xuất ở màn hình bắt đầu công việc rồi vào lại.',
    missingWorker:
      'Chưa xác nhận mã nhân viên nên không bắt đầu đóng gói được. Hãy chỉ định công nhân trước.',
  },

  lotList: {
    sectionLabel: 'Đối tượng đóng gói',
    lotNoColumn: 'Số LOT',
    initialQtyColumn: 'Số lượng ban đầu',
    select: 'Chọn',
    empty: 'Không có LOT hoàn thành nào để đóng gói.',
    loadFailed: 'Không tải được danh sách đối tượng đóng gói.',
  },

  scan: {
    sectionLabel: 'Quét',
    label: 'Quét LOT / thẻ nhận diện',
    submit: 'Cho vào',
    manualEntry: 'Nhập tay',
    quantityLabel: 'Số lượng',
    keypadLabel: 'Bàn phím số lượng',
    keypadBackspace: 'Xóa một ký tự',
    keypadClear: 'Xóa hết',
    keypadDecimal: 'Dấu thập phân',
    unknownLot:
      'LOT không có trong danh sách đóng gói. Chỉ cho vào được LOT hoàn thành của lệnh sản xuất này.',
    quantityRequired: 'Hãy nhập số lượng.',
    quantityPositive: 'Số lượng phải lớn hơn 0.',
    quantityNumber: 'Hãy nhập số lượng bằng chữ số.',
  },

  unit: {
    sectionLabel: 'Kiện',
    typeLabel: 'Loại',
    typeRequired: 'Hãy chọn loại kiện.',
    typePlaceholder: 'Chọn',
    typeLoadFailed: 'Không tải được danh sách loại kiện.',
    parentLabel: 'Kiện cha',
    parentNone: '(Không có)',
    parentLoadFailed: 'Không tải được danh sách kiện cha.',
    /*
     * ⚠ **화면에 «줄»로 세우지 않는다**(사용자 지시 2026-09-10 — 그 문장을 걷었다). 다만 칸이
     * 잠기는 이유가 어디에도 없으면 왜 못 바꾸는지 알 길이 없다(리뷰 지적) — 잠긴 칸에만
     * 붙여 설명으로 읽히게 한다.
     */
    lockedReason: 'Đã bắt đầu cho hàng vào thì không đổi được.',
    offlineStartBlocked: 'Mất kết nối nên không bắt đầu kiện mới được. Số kiện do máy chủ cấp.',
    discardAction: 'Hủy kiện',
  },

  contents: {
    sectionLabel: 'Hàng bên trong',
    unknownCode: '—',
    lineLabel: (lotNo: string, itemCode: string, qty: string) =>
      `LOT ${lotNo} · Mặt hàng ${itemCode} · Số lượng ${qty}`,
    empty: 'Chưa có hàng bên trong.',
    totalLabel: 'Tổng',
    mixedTitle: 'Một kiện đang lẫn nhiều LOT',
  },

  confirm: {
    submit: 'Xác nhận kiện',
    submitting: 'Đang xác nhận',
    blockedPacked: 'Kiện này đã xác nhận xong. Hãy bấm 「Bắt đầu kiện tiếp theo」.',
    done: 'Đã xác nhận kiện.',
    startNext: 'Bắt đầu kiện tiếp theo',
  },

  outbox: {
    pending: (count: number) => `Chờ gửi ${String(count)} mục`,
    queued: 'Chưa đến được máy chủ. Có kết nối sẽ tự gửi.',
    offline: 'Đang ngoại tuyến. Có kết nối sẽ tự gửi.',
    rejected: 'Máy chủ không nhận việc xác nhận kiện này.',
    stalled: 'Máy chủ vẫn không nhận. Nội dung đã xác nhận vẫn còn nguyên.',
    retryNow: 'Gửi lại',
  },

  error: {
    startTitle: 'Không bắt đầu đóng gói được.',
    confirmTitle: 'Không xác nhận được kiện.',
    emptyContents: 'Chưa có hàng bên trong nên máy chủ trả lại. Hãy cho hàng vào rồi xác nhận lại.',
    forbidden: 'Máy trạm này không có quyền đóng gói. Hãy hỏi người phụ trách.',
  },
};
