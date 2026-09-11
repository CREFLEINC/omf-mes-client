import type { ko } from '../ko';
import type { Translated } from './translated';

/** M-05-01 설비 점검. 못 보낸 건이 작업 통제에 반영되지 않는다는 것을 이름으로 적는다. */
export const equipmentInspection: Translated<typeof ko.equipmentInspection> = {
  title: 'Kiểm tra định kỳ thiết bị',
  record: 'Kiểm tra định kỳ thiết bị',
  equipment: {
    legend: 'Chọn thiết bị',
    scanLabel: 'Quét thiết bị',
    scanPlaceholder: 'Hãy quét mã QR thiết bị',
    pickLabel: 'Chọn từ danh sách',
    pickPlaceholder: 'Hãy chọn thiết bị',
    loading: 'Đang tải danh sách thiết bị',
    loadFailed: 'Không tải được danh sách thiết bị',
    notFound: (code: string) => `Không tìm thấy thiết bị ${code}`,
  },
  type: {
    legend: 'Loại kiểm tra',
    daily: 'Hằng ngày',
    monthly: 'Định kỳ',
    todayDone: (at: string, workerNo: string) =>
      `Hôm nay đã có bản ghi kiểm tra (${at} mã nhân viên ${workerNo})`,
    todayNone: 'Hôm nay chưa có bản ghi kiểm tra',
    todayUnknown: 'Không xác nhận được bản ghi kiểm tra hôm nay',
  },
  items: {
    legend: 'Kiểm tra theo hạng mục',
    progress: (done: number, total: number) => `${String(done)} / ${String(total)}`,
    loading: 'Đang tải hạng mục kiểm tra',
    loadFailed: 'Không xác nhận được hạng mục kiểm tra. Hãy kiểm tra kết nối rồi chọn lại.',
    none: 'Thiết bị này chưa được đăng ký hạng mục kiểm tra',
    noneForType: 'Không có hạng mục kiểm tra nào đăng ký cho loại này',
    receivedAt: (at: string) => `Hạng mục kiểm tra nhận lúc ${at}`,
    required: 'Bắt buộc',
    range: (lower: string, upper: string, uom: string) => `Chuẩn ${lower} ~ ${upper} ${uom}`,
    noRange: 'Không có chuẩn — hãy đánh giá bằng mắt',
    measured: 'Giá trị đo',
    ok: 'Đạt',
    ng: 'NG',
    remarks: 'Ghi chú hạng mục',
  },
  summary: {
    legend: 'Tổng hợp',
    counts: (ok: number, ng: number) => `Đạt ${String(ok)} · NG ${String(ng)}`,
    ngNotice: 'Có NG nên sẽ yêu cầu bảo trì.',
    remarks: 'Ghi chú',
    remarksRequired: 'Có NG thì phải ghi chú',
    remainingRequired: (name: string) => `Còn hạng mục bắt buộc chưa kiểm tra — ${name}`,
  },
  submit: 'Xong kiểm tra',
  saveFailed: {
    title: 'Không lưu được kết quả kiểm tra',
    description: 'Chưa được ghi nhận. Hãy thử lại.',
  },
  noWorker: 'Hãy xác nhận mã nhân viên trước',
  unsent: (count: number) =>
    `${String(count)} bản ghi kiểm tra đang chờ gửi — chưa phản ánh vào kiểm soát công việc`,
  sent: {
    title: 'Đã ghi nhận kiểm tra',
  },
  queued: {
    title: 'Đã đưa kết quả kiểm tra vào hàng chờ gửi',
    description: 'Sẽ gửi khi có kết nối. Chưa phản ánh vào kiểm soát công việc.',
  },
  rejected: {
    title: 'Không gửi được kết quả kiểm tra',
    description: 'Đã gửi nhưng không được đăng ký. Chưa phản ánh vào kiểm soát công việc.',
    action: 'Xem bản ghi gửi thất bại',
  },
  another: 'Kiểm tra thiết bị khác',
};
