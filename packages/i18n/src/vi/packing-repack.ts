import type { ko } from '../ko';
import type { Translated } from './translated';

/** M-04-03 포장 재구성. 되돌리기가 없으므로 이력을 화면 안에서 되짚게 한다. */
export const packingRepack: Translated<typeof ko.packingRepack> = {
  title: 'Sắp xếp lại đóng gói',
  record: {
    created: 'Kiện mới',
    replaced: 'Thành phần kiện gốc',
  },
  source: {
    legend: 'Quét kiện gốc',
    scanLabel: 'Quét kiện',
    scanPlaceholder: 'Hãy quét mã QR của kiện',
    manualLabel: 'Nhập tay',
    manualSubmit: 'Đưa vào',
    loading: 'Đang tải kiện',
    loadFailed: 'Không xác nhận được kiện. Hãy kiểm tra kết nối.',
    notFound: (code: string) => `Không tìm thấy kiện ${code}`,
    already: 'Kiện này đã được chọn',
    empty: 'Kiện này đang trống',
    scanned: (count: number) => `${String(count)} kiện gốc`,
    add: 'Quét thêm kiện',
    remove: 'Bỏ ra',
  },
  allocated: {
    title: (numbers: string) => `${numbers} là kiện đã được phân bổ cho xuất hàng`,
    description:
      'Sắp xếp lại thì bên xuất hàng sẽ không tìm thấy hàng này. Kiện này không sắp xếp lại được.',
  },
  unverified: {
    title: (numbers: string) => `Chưa xác nhận được ${numbers} đã phân bổ xuất hàng hay chưa`,
    description:
      'Hãy kiểm tra lại khi có kết nối. Nếu là kiện đã phân bổ thì gửi sắp xếp lại sẽ thất bại.',
  },
  type: {
    legend: 'Kiểu sắp xếp lại',
    merge: 'Gộp — nhiều kiện thành một',
    split: 'Tách — một kiện thành nhiều',
    reconfigure: 'Sắp xếp lại — đổi phần bên trong',
  },
  contents: {
    legend: 'Thành phần mới',
    pooled: (qty: string) => `Tổng của kiện gốc ${qty}`,
    qtyLabel: (lotNo: string) => `Số lượng ${lotNo}`,
    lot: (item: string, lotNo: string) => (item === '' ? lotNo : `${item} · ${lotNo}`),
    merged: (before: string, added: string, after: string) =>
      `${before} cộng thêm ${added} thành ${after}`,
    problem: {
      notNumber: 'Hãy ghi số lượng bằng chữ số',
      negative: 'Số lượng không được nhỏ hơn 0',
      overPooled: (limit: string) => `Không được vượt ${limit} đang có trong kiện gốc`,
    },
  },
  remainder: {
    legend: 'Phần còn lại',
    keepsNumber: (no: string) => `${no} — phần còn lại sau khi tách vẫn giữ số kiện gốc`,
    none: 'Kiện gốc sẽ trống',
  },
  labelNotice: 'Việc in nhãn do POP làm. Màn hình này chỉ đổi thành phần.',
  submit: 'Xác nhận sắp xếp lại',
  saveFailed: {
    title: 'Không lưu được việc sắp xếp lại',
    description: 'Chưa được ghi nhận. Hãy thử lại.',
  },
  noWorker: 'Hãy xác nhận mã nhân viên trước',
  noType: 'Hãy chọn kiểu sắp xếp lại',
  sent: {
    title: 'Đã ghi nhận việc sắp xếp lại',
  },
  queued: {
    title: 'Đã đưa việc sắp xếp lại vào hàng chờ gửi',
    description: 'Sẽ gửi khi có kết nối. Sau khi đồng bộ mới lên danh sách chờ của POP.',
  },
  rejected: {
    title: 'Không gửi được việc sắp xếp lại',
    description: 'Hãy xem lý do trong bản ghi gửi thất bại. ',
    action: 'Xem bản ghi gửi thất bại',
  },
  another: 'Lượt sắp xếp lại tiếp theo',
  history: {
    open: 'Xem lịch sử',
    close: 'Thu gọn lịch sử',
    legend: 'Lịch sử sắp xếp lại',
    loading: 'Đang tải lịch sử',
    loadFailed: 'Không xác nhận được lịch sử',
    none: 'Kiện này chưa từng được sắp xếp lại',
    type: { MERGE: 'Gộp', SPLIT: 'Tách', RECONFIGURE: 'Sắp xếp lại' },
    line: (role: string, name: string, before: string, after: string) =>
      `${role} ${name} ${before} → ${after}`,
    role: { SOURCE: 'Nguồn', RESULT: 'Kết quả' },
    at: (at: string) => `${at}`,
  },
};
