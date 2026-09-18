import type { ko } from '../ko';
import type { Translated } from './translated';
import { common } from './common';

/** P-02-01 작업 시작(작업지시 선택). */
export const workStart: Translated<typeof ko.workStart> = {
  title: 'Bắt đầu sản xuất',

  header: {
    /**
     * ⭐ **머리줄은 단말을 말한다**(사용자 지시 2026-09-13). 스펙 §4 도면은 이 자리에 설비를
     * 그렸지만, 등록한 단말이 맞는지를 작업자가 보는 자리라 사번 확인 화면(P-CO-01)과 같이
     * 단말 코드를 낸다. 못 받았으면 «모른다»고 적는다.
     */
    terminalUnknown: 'Chưa xác nhận máy trạm',
    terminalLabel: (code: string): string => `Máy trạm ${code}`,
    /**
     * ⭐ **설비는 타이틀 옆에 선다**(스펙 §4 도면 · 사용자 지시 2026-09-14). 단말은 오른쪽 상태
     * 쪽에 남는다. 설비를 모르거나 매핑이 없으면 자리를 비운다 — 사유는 막힘 띠가 말한다.
     */
    /* ⭐ 「설비 <이름>」으로 읽힌다 — 이름이 비면 코드(사용자 지시 2026-09-14). */
    equipmentLabel: (code: string, name: string): string =>
      `Thiết bị ${name.trim() === '' ? code : name}`,

    workerUnset: 'Chưa nhập mã nhân viên',
    workerLabel: (workerNo: string): string => `Mã nhân viên ${workerNo}`,

    connected: common.connection.online,
    disconnected: common.connection.offline,
  },

  worker: {
    title: 'Mã nhân viên',
    fieldLabel: 'Mã nhân viên',
    keypadLabel: 'Bàn phím số nhập mã nhân viên',
    backspace: 'Xóa một ký tự',
    clear: 'Xóa hết',
    confirm: 'Xác nhận',
    change: 'Nhập lại',
    checking: 'Đang kiểm tra',

    unknown: 'Mã nhân viên chưa được đăng ký.',
    inactive: 'Mã nhân viên này không còn làm việc.',
    lookupFailed: 'Không xác nhận được mã nhân viên. Hãy thử lại.',
    retry: 'Thử lại',
  },

  list: {
    title: 'Lệnh sản xuất',
    scopeEquipment: 'Thiết bị này',
    scopeAll: 'Tất cả',
    showAll: 'Xem tất cả',
    showEquipmentOnly: 'Chỉ xem thiết bị này',

    scopeNoteEquipment:
      'Chỉ hiện lệnh sản xuất đã phát hành cho thiết bị này. Muốn xem lệnh của thiết bị khác, hãy bấm «Xem tất cả».',
    scopeNoteAll:
      'Đang hiện cả lệnh sản xuất đã phát hành cho thiết bị khác. Có thể quay lại bằng «Chỉ xem thiết bị này».',

    select: 'Chọn',
    caption: 'Lệnh sản xuất có thể thực hiện',

    emergencyBadge: 'Khẩn',
    heldBadge: 'Đang tạm dừng',

    columns: {
      plannedStart: 'Kế hoạch',
      priority: 'Ưu tiên',
    },

    empty:
      'Không có lệnh sản xuất nào phát hành cho thiết bị này. Có thể xem lệnh của thiết bị khác bằng «Xem tất cả».',
    emptyAll: 'Không có lệnh sản xuất nào có thể thực hiện.',
    loading: 'Đang nhận lệnh sản xuất.',
    loadError: 'Không nhận được danh sách lệnh sản xuất. Hãy thử lại.',
    retry: 'Thử lại',

    truncated: (shown: number, total: number): string =>
      `Đang hiện ${String(shown)} / ${String(total)} mục.`,

    pageNav: 'Chuyển trang danh sách lệnh sản xuất',

    equipmentMissing: 'Khi máy trạm này được gán thiết bị, lệnh sản xuất sẽ hiện ở đây.',
    equipmentUnknown:
      'Không xác nhận được máy trạm này gắn với thiết bị nào. Có thể tiếp tục bằng «Xem tất cả».',
  },

  selection: {
    title: 'Xác nhận lựa chọn',
    notSelected: 'Hãy chọn lệnh sản xuất ở danh sách trên.',
    equipment: 'Thiết bị',
    mold: 'Khuôn',
    unknown: 'Đang kiểm tra',
    none: 'Không có',

    otherEquipment: (code: string): string => `Thiết bị theo kế hoạch của lệnh này là ${code}.`,

    precheckPending: 'Kết quả kiểm soát kiểm tra trước sản xuất sẽ được xác nhận khi bắt đầu.',
  },

  actions: {
    start: 'Bắt đầu sản xuất',
    resume: 'Tiếp tục lại',
    starting: 'Đang bắt đầu',
  },

  blocked: {
    unidentified: 'Không xác nhận được máy trạm này. Hãy hoàn tất đăng ký máy rồi bắt đầu lại.',
    /**
     * ⭐ **사유별로 가른다**(사용자 지시 2026-09-13). 등록은 끝났는데 관리웹 매핑이 비어 있는
     * 것을 「단말을 확인하지 못했다」로 말하면 설치 담당자가 토큰부터 다시 의심한다.
     */
    equipmentMissing:
      'Máy trạm này chưa được ánh xạ thiết bị. Hãy gán thiết bị tại Web quản trị > Ánh xạ máy quét - công đoạn.',
    processNone:
      'Máy trạm này chưa được ánh xạ công đoạn. Hãy gán công đoạn tại Web quản trị > Ánh xạ máy quét - công đoạn.',
    processMultiple:
      'Máy trạm này được ánh xạ nhiều công đoạn nên không xác nhận được quyền bắt đầu sản xuất.',
    checking: 'Đang kiểm tra cấu hình chức năng của máy trạm.',
    denied:
      'Máy trạm này không được bắt đầu công việc của công đoạn này. Hãy cấp quyền trong thiết lập máy trạm (Thiết lập ánh xạ máy quét - công đoạn).',
    unavailable: 'Không xác nhận được quyền của máy trạm này. Hãy thử lại.',
    retry: 'Kiểm tra lại',

    offline: 'Mất kết nối nên không bắt đầu được. Khi kết nối lại, danh sách sẽ tự tải lại.',

    notSelected: 'Bắt đầu sản xuất: hãy chọn lệnh sản xuất trước.',

    alreadyOpen: 'Lệnh sản xuất này đang có công việc đang làm. Hãy làm tiếp công việc đó.',
    continueToSession: 'Vào việc đang làm',
  },

  resume: {
    sessionNotFound: 'Không tìm thấy phiên làm việc để tiếp tục lại. Hãy liên hệ quản trị viên.',
    sessionLookupFailed: 'Không xác nhận được phiên làm việc. Hãy thử lại.',
    checking: 'Đang kiểm tra phiên làm việc.',
  },

  result: {
    started: (workOrderNo: string): string => `Đã bắt đầu sản xuất ${workOrderNo}.`,
    resumed: (workOrderNo: string): string => `Đã tiếp tục lại ${workOrderNo}.`,
    conflict: 'Trạng thái lệnh sản xuất đã thay đổi. Đang tải lại danh sách.',
    notOpened: 'Đánh giá kiểm tra đã được ghi nhận nhưng công việc chưa bắt đầu. Hãy thử lại.',
    startFailed: 'Không bắt đầu được công việc.',
    resumeFailed: 'Không tiếp tục lại được công việc.',
  },
};
