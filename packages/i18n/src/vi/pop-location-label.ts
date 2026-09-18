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

  entry: {
    workerLabel: 'Mã nhân viên',
  },

  warehouse: {
    label: 'Kho',
    placeholder: 'Hãy chọn kho',
    loadFailed: 'Không tải được danh sách kho. Hãy kiểm tra kết nối rồi thử lại.',
    none: 'Không có kho nào dùng được. Hãy đăng ký kho trước.',
    retry: 'Thử lại',
  },

  location: {
    heading: 'Vị trí',
    awaitingWarehouse: 'Hãy chọn kho trước.',
    empty: 'Kho này chưa có vị trí nào.',
    loading: 'Đang tải danh sách vị trí',
    loadFailed: 'Không tải được danh sách vị trí. Hãy kiểm tra kết nối rồi thử lại.',
    retry: 'Thử lại',
    columnCode: 'Mã vị trí',
    columnName: 'Tên vị trí',
    columnIssued: 'Phát hành',
    notIssued: 'Lần đầu',
    issuedCount: (count: number) => `${String(count)} lượt`,
    inactive: 'Ngừng dùng',
    pick: 'Chọn',
    selectAll: 'Chọn tất cả',
    clearSelection: 'Bỏ chọn',
    tooMany: (max: number) =>
      `Mỗi lần chỉ phát hành được ${String(max)} vị trí. Hãy chia thành nhiều lần.`,
  },

  printer: {
    label: 'Máy in',
    unknown: 'Không kiểm tra được danh sách máy in',
    retry: 'Thử lại',
    none: 'Máy này chưa đăng ký máy in. Bản ghi phát hành vẫn lưu nhưng nhãn sẽ không in ra.',
    unselected: 'Không chọn thì sẽ dùng máy in mặc định của máy chủ.',
    noStatusMessage: 'Không rõ trạng thái',
  },

  issue: {
    action: 'Phát hành nhãn',
    pending: 'Đang phát hành',
    succeeded: (count: number) => `Đã phát hành ${String(count)} nhãn.`,
    checkingHistory: 'Đang kiểm tra lịch sử phát hành.',
    summaryFailed:
      'Không kiểm tra được lịch sử phát hành nên không thể phát hành. Hãy kiểm tra kết nối rồi thử lại.',
    retrySummary: 'Kiểm tra lại lịch sử',
  },

  reissue: {
    title: 'Phát hành lại',
    notice: (count: number) =>
      `Trong các mục đã chọn có ${String(count)} vị trí đã được phát hành nhãn. Vui lòng chọn lý do phát hành lại.`,
    reason: 'Lý do phát hành lại',
    reasonPlaceholder: 'Chọn lý do. Lý do phát hành lại là bắt buộc.',
    reasonLoadFailed: 'Không tải được lý do phát hành lại.',
    confirm: 'Phát hành lại',
    cancel: 'Hủy',
  },

  print: {
    heading: 'Kết quả in',
    pending: 'Đang gửi nhãn tới máy in',
    noBridge: 'Máy này không có đường in nên chưa gửi được nhãn. Bản ghi phát hành vẫn lưu.',
    summary: (printed: number, failed: number) =>
      `In thành công ${String(printed)} · thất bại ${String(failed)}`,
    reportFailed: (count: number) =>
      `Chưa báo được ${String(count)} kết quả in lên máy chủ. Nhãn vẫn đã in ra.`,
    failedAt: (locationCode: string, reason: string) => `${locationCode}: ${reason}`,
  },
} as const;
