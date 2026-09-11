import type { ko } from '../ko';
import type { Translated } from './translated';

/** M-01-12 재생재 등록. 번호는 서버가 매긴다는 것을 저장 전에 말한다. */
export const recycleEntry: Translated<typeof ko.recycleEntry> = {
  title: 'Đăng ký vật tư tái chế',
  record: 'Đăng ký vật tư tái chế',
  item: {
    legend: 'Mặt hàng',
    label: 'Mã mặt hàng',
    placeholder: 'Hãy quét mã mặt hàng',
    manualLabel: 'Nhập tay',
    manualSubmit: 'Tìm',
    searching: 'Đang tìm mặt hàng',
    loadFailed: 'Không xác nhận được mặt hàng',
    notRecycled: 'Mặt hàng tái chế chưa được đăng ký',
    notRecycledWhy: 'Phải đăng ký mặt hàng tái chế ở Web quản trị trước.',
    chosen: (code: string, name: string) => `${code} ${name}`,
    uom: (code: string) => `Đơn vị ${code}`,
    uomUnknown: 'Không xác nhận được đơn vị',
    clear: 'Xóa mặt hàng',
  },
  place: {
    legend: 'Kho · Vị trí',
    warehouseLabel: 'Kho',
    warehousePlaceholder: 'Hãy chọn kho',
    warehouseLoading: 'Đang tải danh sách kho',
    warehouseLoadFailed: 'Không xác nhận được kho',
    warehouseNone: 'Không có kho nào để chọn',
    locationLabel: 'Vị trí',
    locationPlaceholder: 'Hãy chọn vị trí',
    locationLoading: 'Đang tải danh sách vị trí',
    locationLoadFailed: 'Không xác nhận được vị trí',
    locationNone: 'Kho này không có vị trí nào',
  },
  qty: {
    legend: 'Số lượng',
    label: 'Số lượng',
    remarks: 'Ghi chú',
    empty: 'Hãy ghi số lượng',
    notNumber: 'Hãy ghi số lượng bằng chữ số',
    notPositive: 'Số lượng phải lớn hơn 0',
  },
  numberLater: 'Số LOT vật tư được định sau khi đăng ký',
  submit: 'Đăng ký vật tư tái chế',
  sent: {
    title: 'Đã đăng ký vật tư tái chế',
    lotNo: (lotNo: string) => `LOT vật tư ${lotNo}`,
  },
  queued: {
    title: 'Đã đưa đăng ký vật tư tái chế vào hàng chờ gửi',
    description: 'Sẽ gửi khi có kết nối. Số sẽ được định sau khi gửi.',
    labelLater: 'Nhãn chỉ in được sau khi có số',
  },
  rejected: {
    title: 'Không gửi được đăng ký vật tư tái chế',
    description: 'Hãy xem lý do trong bản ghi gửi thất bại. ',
    action: 'Xem bản ghi gửi thất bại',
  },
  saveFailed: {
    title: 'Không lưu được đăng ký vật tư tái chế',
    description: 'Chưa được đăng ký. Hãy thử lại.',
  },
  noWorker: 'Hãy xác nhận mã nhân viên trước',
  another: 'Vật tư tái chế tiếp theo',
};
