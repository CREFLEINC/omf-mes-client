import type { ko } from '../ko';
import type { Translated } from './translated';

/** M-01-04 자재 위치 확인. 조회 전용이라 쓰기 어휘가 없다. */
export const materialLocation: Translated<typeof ko.materialLocation> = {
  title: 'Kiểm tra vị trí vật tư',
  scan: {
    label: 'Chờ quét',
    placeholder: 'Hãy quét nhãn LOT vật tư',
    manualEntry: 'Nhập tay',
    manualSubmit: 'Đưa vào',
  },
  lot: {
    noLot: '(không theo LOT)',
  },
  location: {
    title: 'Vị trí',
    countSuffix: (count: number): string => `${String(count)} vị trí`,
    depleted: '(đã hết)',
    emptyTitle: 'Không có vị trí nào còn tồn kho',
    emptyDescription: 'LOT đã đăng ký nhưng hiện không có vị trí nào giữ tồn kho.',
  },
  quantity: {
    onHand: 'Tồn',
    available: 'Khả dụng',
    reserved: 'Đã giữ',
    negativeNotice: 'Số lượng tồn đang âm',
  },
  hold: {
    title: 'Đang tạm giữ',
    checking: 'Đang kiểm tra tình trạng tạm giữ',
    unconfirmed: 'Không kiểm tra được tình trạng tạm giữ',
    unconfirmedDescription: 'Có thể đang bị giữ, hãy kiểm tra sau khi có kết nối rồi mới chuyển.',
    wholeLot: 'Tạm giữ toàn bộ',
    quantity: (amount: string): string => `Tạm giữ ${amount}`,
    releaseCondition: (condition: string): string => `Điều kiện gỡ: ${condition}`,
  },
  nextScan: 'Quét tiếp',
  loading: 'Đang tra cứu',
  notFound: {
    title: 'LOT chưa được đăng ký',
    description: 'Hãy kiểm tra số vừa đọc rồi quét lại.',
  },
  loadFailed: {
    title: 'Không tra cứu được',
    retry: 'Thử lại',
  },
  invalidLength: (read: number, required: number): string =>
    `LOT vật tư có ${String(required)} ký tự. Đã đọc được ${String(read)} ký tự.`,
  offline: {
    title: 'Ngoại tuyến nên không tra cứu được',
    description: 'Không có dữ liệu lưu sẵn. Hãy thử lại khi có kết nối.',
    retry: 'Thử lại',
  },
};
