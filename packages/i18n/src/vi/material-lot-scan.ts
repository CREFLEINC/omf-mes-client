import type { ko } from '../ko';
import type { Translated } from './translated';

/** M-01-02 자재LOT 스캔·등록. 도착 때 못 읽은 라인을 뒤에 채운다. */
export const materialLotScan: Translated<typeof ko.materialLotScan> = {
  title: 'Quét và đăng ký LOT vật tư',
  record: {
    registered: 'Đăng ký LOT vật tư',
  },
  receipt: {
    legend: 'Chọn phiếu nhập hàng',
    loading: 'Đang tìm phiếu nhập hàng',
    loadFailed: 'Không tải được phiếu nhập hàng. Hãy kiểm tra kết nối.',
    none: 'Không có phiếu nhập hàng dán sẵn nào còn trống LOT',
    pick: 'Phiếu nhập hàng',
    pickPlaceholder: 'Hãy chọn phiếu nhập hàng',
    item: (no: string, date: string) => `${no} · ${date}`,
  },
  line: {
    legend: 'Chọn dòng nhập hàng',
    loading: 'Đang tải các dòng',
    loadFailed: 'Không tải được các dòng. Hãy kiểm tra kết nối.',
    none: 'Phiếu nhập hàng này không còn dòng dán sẵn nào trống LOT',
    pick: 'Dòng nhập hàng',
    pickPlaceholder: 'Hãy chọn dòng',
    item: (lineNo: string, itemCode: string, qty: string) => `#${lineNo} · ${itemCode} · ${qty}`,
    pickedLine: (lineNo: string, itemCode: string, qty: string) =>
      `Dòng #${lineNo} · ${itemCode} · ${qty}`,
  },
  scan: {
    legend: 'Quét',
    scanLabel: 'Quét LOT vật tư',
    scanPlaceholder: 'Hãy quét nhãn LOT vật tư',
    manualLabel: 'Nhập tay',
    manualSubmit: 'Đưa vào',
    counter: (length: string, total: string) => `${length}/${total} ký tự`,
    problem: {
      length: (length: string, total: string) =>
        `Số LOT vật tư có ${total} ký tự (hiện ${length} ký tự)`,
      notDigits: 'Chỉ nhập được chữ số',
      badDate: 'Phần ngày trên nhãn không phải là ngày',
      duplicate: 'Số LOT này đã được đăng ký',
      otherItem: 'LOT này khác mặt hàng của dòng nhập hàng',
    },
  },
  qtyDiffers: (labelQty: string, lineQty: string) =>
    `Số lượng trên nhãn ${labelQty} khác số lượng của dòng ${lineQty}`,
  register: 'Đăng ký dòng này',
  registered: {
    legend: (count: string) => `Đã đăng ký (${count})`,
    item: (lotNo: string, qty: string) => `${lotNo} · ${qty}`,
  },
  noWorker: 'Hãy xác nhận mã nhân viên trước',
  noPlant: 'Không đọc được nhà máy của máy này. Hãy đăng ký lại máy.',
  saveFailed: {
    title: 'Không lưu được đăng ký',
    description: 'Chưa được đăng ký. Hãy thử lại.',
  },
  done: 'Xong đăng ký',
  sent: {
    title: 'Đã đăng ký',
  },
  held: {
    title: 'Đã đưa đăng ký vào hàng chờ gửi',
    description: 'Sẽ gửi khi có kết nối.',
  },
  rejected: {
    title: 'Không gửi được đăng ký',
    description: 'Nếu số này đã tồn tại thì gửi lại cũng không được. Hãy quét nhãn khác. ',
    action: 'Xem bản ghi gửi thất bại',
  },
  another: 'Phiếu nhập hàng tiếp theo',
};
