import type { ko } from '../ko';
import type { Translated } from './translated';

/** M-01-05 적치·입고 완료. 지시가 둬도 되는 위치 중 아무 데나 받는다. */
export const putaway: Translated<typeof ko.putaway> = {
  title: 'Cất hàng và hoàn tất nhập kho',
  record: 'Xong cất hàng',
  worker: {
    loading: 'Đang xác nhận mã nhân viên',
    loadFailed: 'Không xác nhận được mã nhân viên. Hãy kiểm tra kết nối.',
    notFound: (workerNo: string) => `Không tìm thấy người có mã nhân viên ${workerNo}`,
  },
  tasks: {
    legend: 'Lệnh cất hàng của tôi',
    loading: 'Đang tải lệnh cất hàng',
    loadFailed: 'Không xác nhận được lệnh cất hàng. Hãy kiểm tra kết nối.',
    none: 'Chưa nhận lệnh cất hàng nào',
    count: (count: string) => `${count} lệnh chờ cất hàng`,
    from: (code: string) => `Hiện tại ${code}`,
    itemLabel: 'Mặt hàng',
    itemNameLabel: 'Tên mặt hàng',
    taskNoLabel: 'Số lệnh',
    qtyLabel: 'Số lượng',
    allowedLabel: 'Vị trí bảo quản',
    allowed: (codes: string) => `Vị trí bảo quản ${codes}`,
    allowedMore: (first: string, rest: string) => `${first} và ${rest} vị trí khác`,
    allowedAll: (codes: string) => `Vị trí bảo quản (chỗ nào cũng được) ${codes}`,
    anywhere: 'Bất kỳ vị trí nào trong kho',
    change: 'Chọn lệnh khác',
  },
  location: {
    legend: 'Vị trí cất hàng',
    scanLabel: 'Quét mã vị trí',
    scanPlaceholder: 'Hãy quét nhãn vị trí',
    pickLabel: 'Vị trí cất hàng',
    pickPlaceholder: 'Hãy chọn vị trí',
    loading: 'Đang tải vị trí',
    loadFailed: 'Không xác nhận được vị trí. Hãy kiểm tra kết nối.',
    none: 'Kho này chưa đăng ký vị trí nào',
    notFound: (code: string) => `Không tìm thấy vị trí ${code} trong kho này`,
    manual: 'Nhập tay',
    manualSubmit: 'Dùng vị trí đã nhập',
    /** 스캔으로 정한 위치를 되돌리고 스캔 칸을 다시 연다. */
    rescan: 'Quét lại vị trí',
    /** 판정 배너 제목 — 읽은 위치(주 정보). 판정은 본문이 보조로 말한다. */
    scanned: (code: string, name: string) => `${code} · ${name}`,
  },
  lot: {
    legend: 'Quét LOT vật tư',
    scanLabel: 'Quét nhãn LOT',
    scanPlaceholder: 'Hãy quét nhãn vật tư',
    manual: 'Nhập tay',
    manualSubmit: 'Dùng LOT đã nhập',
    loading: 'Đang tải số LOT',
    loadFailed: 'Không xác nhận được số LOT. Hãy kiểm tra kết nối.',
    expected: (lotNo: string) => `LOT của lệnh ${lotNo}`,
    matched: 'Trùng LOT của lệnh',
    mismatch: 'Đây không phải LOT của lệnh này',
    rescan: 'Quét lại LOT',
  },
  verdict: {
    /** 판정(보조 정보) — 제목의 위치 아래에 선다. */
    matched: 'Đây là vị trí bảo quản của mặt hàng này',
    temporary: 'Nếu phải để tạm, hãy sang màn hình cất hàng vào vị trí tạm',
    /** 임시로 두는 화면으로 가는 버튼 — 안내 문구와 갈라 둔다. */
    temporaryMove: 'Chuyển sang xếp tạm',
    notAllowed: (allowed: string) => `Không phải vị trí bảo quản của mặt hàng này (${allowed})`,
    anywhere: 'Mặt hàng chưa định vị trí bảo quản. Có thể cất ở bất kỳ đâu trong kho này',
  },
  record1: 'Cất hàng theo lệnh này',
  locked: {
    location: 'Quét nhãn vị trí để tiếp tục',
    lot: 'Quét nhãn LOT vật tư để tiếp tục',
  },
  done: {
    count: (count: string) => `Đã cất ${count} lượt`,
    row: (lotNo: string, code: string, qty: string) => `${lotNo} → ${code} ${qty}`,
    submit: 'Xong cất hàng',
    locked: 'Cất ít nhất một lệnh thì mới hoàn tất được',
  },
  sent: {
    title: 'Đã ghi nhận cất hàng',
  },
  queued: {
    title: 'Đã đưa cất hàng vào hàng chờ gửi',
    description: 'Sẽ gửi khi có kết nối. Hiện chưa gửi.',
  },
  rejected: {
    title: 'Không gửi được cất hàng',
    description: 'Hãy xem lý do trong bản ghi gửi thất bại. ',
    action: 'Xem bản ghi gửi thất bại',
  },
  saveFailed: {
    title: 'Không lưu được cất hàng',
    description: 'Chưa được ghi nhận. Hãy thử lại.',
  },
  noWorker: 'Hãy xác nhận mã nhân viên trước',
};
