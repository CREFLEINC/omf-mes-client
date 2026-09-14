import type { ko } from '../ko';
import type { Translated } from './translated';
import { common } from './common';

/** P-05-02 비가동 실적 입력(POP). */
export const downtimeRegister: Translated<typeof ko.downtimeRegister> = {
  title: 'Nhập kết quả dừng máy',
  header: {
    /* ⭐ 「설비 <이름>」으로 읽힌다 — 이름이 비면 코드(사용자 지시 2026-09-14). */
    equipment: (equipmentCode: string, equipmentName: string): string =>
      `Thiết bị ${equipmentName.trim() === '' ? equipmentCode : equipmentName}`,
    worker: (workerNo: string): string => `Mã nhân viên ${workerNo}`,
    workerUnknown: 'Chưa xác nhận mã nhân viên',
    unsent: (count: number): string => `Chờ gửi ${String(count)} mục`,
    sent: 'Đã gửi xong',
    offline: common.connection.offline,
  },
  ongoing: {
    title: 'Dừng máy đang diễn ra',
    elapsed: (startedAtLabel: string, elapsedLabel: string): string =>
      `Từ ${startedAtLabel}, đã ${elapsedLabel}`,
    reason: (reasonName: string): string => `Lý do: ${reasonName}`,
    close: 'Kết thúc ngay',
    closed: 'Đã kết thúc dừng máy',
    closedQueued:
      'Đã lưu kết thúc. Sẽ gửi lên máy chủ khi có kết nối; giờ kết thúc được ghi theo lúc máy chủ nhận.',
    blocksNew: 'Hãy kết thúc dừng máy đang diễn ra trước.',
  },
  interval: {
    title: 'Khoảng',
    startedAt: 'Bắt đầu',
    endedAt: 'Kết thúc',
    date: 'Ngày',
    time: 'Giờ',
    now: 'Bây giờ',
    stillOngoing: 'Vẫn đang diễn ra',
    duration: (value: string): string => `Thời lượng ${value}`,
    durationEmpty: common.reference.empty,
  },
  reason: {
    title: 'Lý do',
    detail: 'Lý do dừng máy',
    detailPlaceholder: 'Chọn lý do',
    remarks: 'Ghi chú',
    remarksPlaceholder: 'Ghi những gì mã lý do không diễn tả được',
  },
  breakdown: {
    title: 'Sự cố liên kết',
    select: 'Liên kết sự cố',
    detach: 'Gỡ',
    empty: 'Thiết bị này không có sự cố đang mở',
    suggestStart: (timeLabel: string): string =>
      `Dùng giờ dừng ${timeLabel} của sự cố này làm giờ bắt đầu?`,
    applySuggestion: 'Đưa vào giờ bắt đầu',
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
      interval: 'Khoảng',
      duration: 'Thời lượng',
      reason: 'Lý do',
    },
    localOnly: 'Chỉ phần nhập từ máy trạm này',
    localOnlyDescription: 'Chưa phản ánh phần nhập từ máy trạm khác và Web quản trị.',
    unsettled: (count: number): string => `Chưa vào tổng ${String(count)} mục`,
    unsettledDescription: 'Mục vừa nhập chưa được cộng vào tổng trên máy chủ.',
    ongoingRow: 'Đang diễn ra',
  },
  actions: {
    reset: 'Nhập lại',
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
    workerMissing: 'Không xác nhận được mã nhân viên nên không lưu được kết quả.',
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
