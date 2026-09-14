import type { ko } from '../ko';
import type { Translated } from './translated';

/** P-02-02 작업 전 점검 이력 확인·통제. */
export const workPrecheckGate: Translated<typeof ko.workPrecheckGate> = {
  title: 'Xác nhận kiểm tra trước sản xuất',

  header: {
    equipmentUnknown: 'Chưa xác nhận thiết bị',
    /* ⭐ 「설비 <이름>」으로 읽힌다 — 이름이 비면 코드(사용자 지시 2026-09-14). */
    equipmentLabel: (code: string, name: string): string =>
      `Thiết bị ${name.trim() === '' ? code : name}`,
    workOrderLabel: (workOrderNo: string): string => workOrderNo,
    workerUnset: 'Chưa nhập mã nhân viên',
    workerLabel: (workerNo: string): string => `Mã nhân viên ${workerNo}`,
  },

  verdict: {
    checking: 'Đang kiểm tra lịch sử kiểm tra định kỳ.',

    blockedMissing: 'Không thể bắt đầu sản xuất',
    blockedMissingDetail: (types: string): string => `Không có bản ghi kiểm tra ${types}.`,

    blockedFailed: 'Không thể bắt đầu sản xuất',
    blockedFailedDetail: (types: string): string => `Kiểm tra ${types} có kết quả Không đạt.`,

    warned: 'Tiếp tục khi không có bản ghi kiểm tra',
    warnedDetail: (types: string): string =>
      `Không có bản ghi kiểm tra ${types}. Nếu tiếp tục, việc này sẽ được ghi lại.`,

    levelBlock: 'Mức kiểm soát: Chặn',
    levelWarn: 'Mức kiểm soát: Cảnh báo',
    scopeSuffix: (scope: string): string => ` (chính sách ${scope})`,
    scope: {
      ITEM: 'mặt hàng',
      PROCESS: 'công đoạn',
      PLANT: 'nhà máy',
      BUSINESS_UNIT: 'đơn vị kinh doanh',
      ALL: 'toàn công ty',
    } as Record<string, string>,
    levelUnresolved: 'Mức kiểm soát: Cảnh báo (không có chính sách áp dụng)',

    recordRetry: 'Đã qua xác nhận kiểm tra nhưng chưa ghi lại được',
    recordRetryDetail: 'Phải ghi lại được mới bắt đầu sản xuất. Hãy thử lại.',
  },

  history: {
    title: 'Lịch sử kiểm tra định kỳ',
    scope: (equipment: string, from: string): string =>
      `Thiết bị ${equipment} · trong chu kỳ (${from}~)`,
    equipmentUnknown: 'Chưa xác nhận thiết bị',

    columnType: 'Loại kiểm tra',
    columnResult: 'Đánh giá',
    columnDetail: 'Khi nào · Ai',
    tableCaption: 'Lịch sử kiểm tra định kỳ trong chu kỳ',
    none: 'Không có',
    pass: 'Đạt',
    fail: 'Không đạt',
    entry: (inspectedAt: string, workerNo: string, result: string): string =>
      workerNo.trim() === ''
        ? `${inspectedAt} · ${result}`
        : `${inspectedAt} · Mã nhân viên ${workerNo} · ${result}`,

    notTargeted: 'Thiết bị này chưa được gán hạng mục kiểm tra định kỳ.',

    openBreakdowns: (count: number): string => `Thiết bị này có ${count} sự cố đang xử lý`,
  },

  guide: {
    title: 'Cần làm gì',
    step1: '① Nhập kết quả kiểm tra trên máy quét di động rồi gửi đi.',
    step2: '② Khi đã gửi xong, bấm [ Kiểm tra lại ] trên màn hình này.',
    emergency: 'Nếu là lệnh sản xuất khẩn thì có thể bỏ qua (sẽ được ghi lại).',
    emergencyOnly: 'Bỏ qua và bắt đầu: chỉ dùng được với lệnh sản xuất khẩn.',
    failedNoOverride:
      'Bỏ qua và bắt đầu: không thể bỏ qua kiểm tra Không đạt. Hãy báo người phụ trách thiết bị.',
  },

  actions: {
    back: 'Quay lại',
    recheck: 'Kiểm tra lại',
    proceed: 'Tiếp tục',
    override: 'Bỏ qua và bắt đầu',
    retryRecord: 'Ghi lại lần nữa',
    working: 'Đang ghi lại',
  },

  confirm: {
    title: 'Tiếp tục khi không có bản ghi kiểm tra?',
    body: 'Nếu tiếp tục, «Bắt đầu khi không có bản ghi kiểm tra» sẽ được ghi lại.',
    overrideTitle: 'Bỏ qua kiểm tra và bắt đầu?',
    overrideBody: 'Việc bỏ qua bằng lệnh sản xuất khẩn sẽ được ghi lại.',
    cancel: 'Hủy',
    confirm: 'Xác nhận',
  },

  blocked: {
    offline: 'Mất kết nối nên không kiểm tra được lịch sử. Khi kết nối lại, hãy kiểm tra lại.',
    lookupFailed: 'Không kiểm tra được lịch sử nên không thể bắt đầu. Hãy thử lại.',
    equipmentUnknown:
      'Không xác nhận được thiết bị gắn với máy trạm này nên không đánh giá được kiểm tra.',
    workerMissing: 'Chỉ đánh giá được sau khi xác nhận mã nhân viên.',
    recordFailed: 'Không ghi lại được kết quả đánh giá nên chưa bắt đầu. Hãy thử lại.',
  },
};
