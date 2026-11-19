/**
 * P-06-01 창고 적재 위치 라벨 발행.
 *
 * 용어집을 따른다 — 창고 `kho` · 위치 `vị trí` · 라벨 `nhãn` · 발행 `phát hành` ·
 * 회차·재발행 `lượt`·`phát hành lại` · 사번 `mã nhân viên` · 사유 `lý do`.
 *
 * 명령은 동사로 시작한다(용어집 말미 규칙).
 */
export const popLocationLabel = {
  title: 'Phát hành nhãn vị trí kho',

  warehouse: {
    label: 'Kho',
    loadFailed: 'Không tải được danh sách kho. Hãy kiểm tra kết nối rồi thử lại.',
    none: 'Không có kho nào dùng được. Hãy đăng ký kho trước.',
    retry: 'Thử lại',
  },

  location: {
    heading: 'Vị trí',
    awaitingWarehouse: 'Hãy chọn kho ở bên trái.',
    empty: 'Kho này chưa có vị trí nào.',
    loadFailed: 'Không tải được danh sách vị trí. Hãy kiểm tra kết nối rồi thử lại.',
    retry: 'Thử lại',
    columnSelect: 'Chọn',
    columnCode: 'Mã vị trí',
    columnName: 'Tên vị trí',
    columnAlias: 'Bí danh',
    columnState: 'Trạng thái',
    active: 'Sử dụng',
    inactive: 'Không sử dụng',
    choose: (locationCode: string) => `Chọn ${locationCode}`,
    selectAll: (count: number) => `Chọn tất cả (${String(count)})`,
    clearAll: (count: number) => `Bỏ chọn tất cả (${String(count)})`,
    clearSelection: 'Bỏ chọn',
    tooMany: (max: number) =>
      `Mỗi lần chỉ phát hành được ${String(max)} vị trí. Hãy chia thành nhiều lần.`,
  },

  printer: {
    label: 'Máy in',
  },

  issue: {
    action: 'Phát hành nhãn',
    actionCount: (count: number) => `Phát hành ${String(count)} nhãn`,
    summaryFailed:
      'Không kiểm tra được lịch sử phát hành nên không thể phát hành. Hãy kiểm tra kết nối rồi thử lại.',
    retrySummary: 'Kiểm tra lại lịch sử',
  },

  reissue: {
    title: 'In lại',
    notice: (count: number) =>
      `${String(count)} vị trí đã chọn đã được phát hành nhãn. Vui lòng chọn lý do in lại.`,
    reason: 'Lý do in lại',
    reasonLoadFailed: 'Không tải được lý do in lại.',
    confirm: 'In lại',
    cancel: 'Hủy',
  },

  print: {
    pending: 'Đang gửi nhãn tới máy in',
    noBridge: 'Máy này chưa kết nối máy in nên không in được nhãn. Bản ghi phát hành vẫn lưu.',
    printed: (count: number) => `Đã phát hành ${String(count)} nhãn. Hãy dán vào vị trí.`,
    summary: (printed: number, failed: number) =>
      `In thành công ${String(printed)} · thất bại ${String(failed)}`,
    reportFailed: (count: number) =>
      `Chưa báo được ${String(count)} kết quả in lên máy chủ. Nhãn vẫn đã in ra.`,
    failedAt: (locationCode: string, reason: string) => `${locationCode}: ${reason}`,
  },
} as const;
