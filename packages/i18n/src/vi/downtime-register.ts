import type { ko } from '../ko';
import type { Translated } from './translated';
import { common } from './common';

/** P-05-02 비가동 실적 입력(POP). */
export const downtimeRegister: Translated<typeof ko.downtimeRegister> = {
  header: {
    unsent: (count: number): string => `Chờ gửi ${String(count)} mục`,
    offline: common.connection.offline,
  },
  ongoing: {
    title: 'Dừng máy đang diễn ra',
    loading: 'Đang kiểm tra dừng máy đang diễn ra.',
    since: (startedAtLabel: string): string => `Đang diễn ra từ ${startedAtLabel}`,
    reason: (reasonName: string): string => `Lý do: ${reasonName}`,
    close: 'Kết thúc dừng máy',
    closed: 'Đã kết thúc dừng máy',
    closedQueued:
      'Đã lưu kết thúc. Sẽ gửi lên máy chủ khi có kết nối; giờ kết thúc được ghi theo lúc máy chủ nhận.',
    blocksNew: 'Hãy kết thúc dừng máy đang diễn ra trước.',
  },
  interval: {
    startedAt: 'Bắt đầu',
    endedAt: 'Kết thúc',
    startedAtLabel: 'Thời điểm bắt đầu',
    endedAtLabel: 'Thời điểm kết thúc',
    date: 'Ngày',
    time: 'Giờ',
    now: 'Bây giờ',
    stillOngoing: 'Vẫn đang diễn ra',
    duration: 'Thời gian dừng máy',
    durationAuto: 'Tự tính',
  },
  reason: {
    title: 'Lý do',
    detail: 'Lý do dừng máy',
    detailPlaceholder: 'Hãy chọn lý do dừng máy',
    remarks: 'Ghi chú',
    remarksPlaceholder: 'Nhập nội dung cần thiết',
    optional: '(tùy chọn)',
  },
  breakdown: {
    title: 'Sự cố liên kết',
    select: 'Hãy chọn sự cố',
    detach: 'Gỡ',
    empty: 'Không có sự cố đang xử lý.',
    suggestStart: (timeLabel: string): string =>
      `Nhập thời điểm của sự cố liên kết (${timeLabel}) vào giờ bắt đầu?`,
    applySuggestion: 'Nhập vào giờ bắt đầu',
    offlineNotice: 'Trong lúc mất kết nối, không thấy sự cố do máy trạm khác tiếp nhận.',
  },
  today: {
    title: 'Hôm nay, thiết bị này',
    summary: (count: number, totalLabel: string): string =>
      `Dừng máy ${String(count)} mục · Tổng ${totalLabel}`,
    basis: (timeLabel: string): string => `Tính đến ${timeLabel}`,
    empty: 'Hôm nay chưa có dừng máy nào được ghi',
    notAsked: 'Khi máy trạm này được gán thiết bị, bản ghi hôm nay sẽ hiện ra',
    notAskedUnidentified: 'Hoàn tất đăng ký máy thì bản ghi hôm nay sẽ hiện ra',
    notAskedOffline: 'Khi có kết nối sẽ tải bản ghi hôm nay',
    durationInvalid: 'Cần kiểm tra khoảng',
    loadFailed: 'Không tải được bản ghi hôm nay.',
    retry: 'Thử lại',
    columns: {
      interval: 'Thời điểm',
      duration: 'Thời gian dừng máy',
      reason: 'Lý do',
      remarks: 'Ghi chú',
    },
    localOnly: 'Chỉ phần nhập từ máy trạm này',
    localOnlyDescription: 'Chưa phản ánh phần nhập từ máy trạm khác và Web quản trị.',
    unsettled: (count: number): string => `Chưa vào tổng ${String(count)} mục`,
    unsettledDescription: 'Mục vừa nhập chưa được cộng vào tổng trên máy chủ.',
    ongoingRow: 'Đang diễn ra',
  },
  actions: {
    reset: 'Xóa nhập liệu',
    save: 'Lưu kết quả',
    saved: 'Đã lưu kết quả dừng máy',
    queued: 'Đã lưu. Sẽ gửi lên máy chủ khi có kết nối.',
    needStarted: 'Hãy nhập ngày và giờ bắt đầu.',
    needReason: 'Hãy chọn lý do dừng máy.',
  },
  errors: {
    endedBeforeStarted: 'Giờ kết thúc sớm hơn giờ bắt đầu.',
    future: 'Thời điểm này chưa tới.',
    endedIncomplete: 'Hãy nhập đủ ngày và giờ kết thúc, hoặc chọn «Vẫn đang diễn ra».',
    summaryUnavailable: 'Không tải được tổng',
    startedIncomplete: 'Hãy nhập đủ ngày và giờ bắt đầu.',
    reasonsLoadFailed: 'Không tải được danh sách lý do dừng máy. Hãy kiểm tra kết nối rồi thử lại.',
    reasonsEmpty: 'Chưa có lý do dừng máy nào được đăng ký. Hãy nhờ quản trị viên đăng ký lý do.',
    overlapWarning: (rangeLabel: string): string =>
      `Trùng với ${rangeLabel}. Vẫn sẽ được lưu như vậy.`,
    equipmentMissing:
      'Máy trạm này chưa được gán thiết bị. Hãy nhờ quản trị viên gán thiết bị cho máy trạm.',
    gateDenied: 'Máy trạm này không nhập được kết quả.',
    gateUnidentified: 'Máy trạm này chưa được đăng ký. Hãy đăng ký máy rồi sử dụng.',
    gateUnavailable: 'Không xác nhận được quyền nhập.',
    gateChecking: 'Đang kiểm tra quyền nhập.',
    saveFailed: 'Không lưu được.',
    closeFailed: 'Không kết thúc được.',
  },
};
