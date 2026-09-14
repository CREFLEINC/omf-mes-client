import type { ko } from '../ko';
import type { Translated } from './translated';

/** P-02-09 포장 라벨·인식표 재출력·부착. */
export const packingLabelReprint: Translated<typeof ko.packingLabelReprint> = {
  title: 'In lại nhãn kiện',

  entry: {
    handlingUnitLabel: 'Kiện',
    workerLabel: 'Mã nhân viên',
    missingHandlingUnit: 'Không nhận được kiện nên không tải được đối tượng in lại.',
    missingWorker:
      'Chưa xác nhận mã nhân viên nên không in lại được. Hãy xác nhận mã nhân viên trước.',
  },

  gate: {
    checking: 'Đang kiểm tra quyền in.',
    denied: 'Máy trạm này không in nhãn được. Hãy hỏi người phụ trách.',
    unavailable: 'Không kiểm tra được quyền in. Hãy thử lại sau.',
    unidentified: 'Chưa xác nhận được máy trạm nên không in lại được.',
  },

  device: {
    printerLabel: 'Máy in',
    printerUnknown: 'Không xác nhận được máy in',
    printerNone: 'Không có máy in dùng được',
    terminalLabel: 'Máy trạm',
    terminalUnknown: 'Chưa xác nhận',
  },

  handlingUnit: {
    sectionLabel: 'Kiện',
    typeLabel: 'Loại',
    contentsLabel: 'Hàng bên trong',
    lotColumn: 'LOT',
    itemColumn: 'Mặt hàng',
    qtyColumn: 'Số lượng',
    unknownValue: '—',
    empty: 'Kiện này không có hàng bên trong.',
    loadFailed: 'Không tải được kiện.',
    namesFailed: 'Không tải được tên LOT·mặt hàng nên một số ô để trống.',
    mixedLot: (lotCount: number): string => `Xếp lẫn (${String(lotCount)} LOT)`,
    mixedLotBody: 'Mỗi LOT dán nhãn riêng. Hãy kiểm tra từng đối tượng in lại.',
  },

  targets: {
    sectionLabel: 'Đối tượng in lại',
    packingLabel: 'Nhãn LOT',
    identificationTag: 'Thẻ nhận diện',
    unknownLot: 'Không xác nhận được LOT',
    serialUnavailable: 'Kiện này không có thông tin từng cái nên không phát hành nhãn được.',
    issueCount: (count: number): string => `Đã phát hành ${String(count)} lần`,
    neverIssued: 'Phát hành lần đầu',
    issueCountUnknown: 'Chưa xác nhận lịch sử phát hành',
    summaryFailed: 'Không tải được lịch sử phát hành nên không hiện được lượt.',
    select: 'Chọn',
    selected: 'Đã chọn',
    empty: 'Không có đối tượng để in lại.',
  },

  reason: {
    label: 'Lý do in lại',
    placeholder: 'Chọn lý do',
    required: 'In lại cần có lý do.',
    notNeeded: 'Chưa có lịch sử phát hành nên sẽ xử lý như phát hành lần đầu. Không cần lý do.',
    empty: 'Danh sách lý do chưa được đăng ký. Hãy hỏi người phụ trách.',
    loadFailed: 'Không tải được danh sách lý do.',
  },

  action: {
    submit: 'In lại',
    submitting: 'Đang in lại…',
  },

  error: {
    issueTitle: 'Không in lại được.',
    forbidden: 'Máy trạm này không có quyền in. Hãy hỏi người phụ trách.',
    rejected: 'Yêu cầu bị từ chối. Hãy kiểm tra giá trị rồi thử lại.',
  },

  print: {
    shellUnavailable: 'Bản ghi phát hành đã được lưu. Môi trường này không gửi ra máy in được.',
    succeeded: 'Đã in lại.',
    failedTitle: 'Bản ghi đã lưu, chỉ việc in bị lỗi.',
    failedBody: 'Bản ghi phát hành vẫn còn. Hãy kiểm tra máy in rồi in lại.',
    retry: 'Thử in lại',
    issued: 'Đã phát hành',
  },
};
