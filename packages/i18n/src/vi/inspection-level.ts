/** Quản lý mức kiểm tra (web quản trị · Quản lý chất lượng). */
export const inspectionLevel = {
  title: 'Quản lý mức kiểm tra',
  breadcrumbRoot: 'Quản lý chất lượng',

  levels: {
    NONE: 'Miễn kiểm',
    REDUCED: 'Giảm nhẹ',
    NORMAL: 'Bình thường',
    TIGHTENED: 'Nghiêm ngặt',
  } as Record<string, string>,

  rule: 'Dùng đúng mức người dùng đã chỉ định — không tự động chuyển theo kết quả IQC. Số lượng mẫu và tiêu chuẩn đánh giá không đổi.',

  list: {
    heading: 'Mức kiểm tra theo vật tư',
    caption: 'Danh sách mức kiểm tra theo vật tư',
    keyword: 'Mã · tên vật tư',
    level: 'Mức kiểm tra',
    levelAll: 'Tất cả',
    search: 'Tìm',
    add: 'Thêm vật tư',
    empty: 'Chưa có vật tư nào được chỉ định mức kiểm tra.',
    loading: 'Đang tải mức kiểm tra.',
    loadFailed: 'Không tải được mức kiểm tra.',
    retry: 'Thử lại',
  },

  columns: {
    itemCode: 'Mã vật tư',
    itemName: 'Tên vật tư',
    level: 'Mức hiện tại',
    updatedAt: 'Thời điểm sửa',
    actions: 'Thao tác',
  },

  actions: {
    changeLevel: 'Đổi mức',
    changeLevelRow: (itemCode: string) => `Đổi mức ${itemCode}`,
    showHistory: 'Lịch sử',
    showHistoryRow: (itemCode: string) => `Xem lịch sử chuyển ${itemCode}`,
  },

  dialog: {
    addTitle: 'Chỉ định mức kiểm tra',
    changeTitle: (itemCode: string) => `Đổi mức — ${itemCode}`,
    item: 'Vật tư',
    pickItem: 'Tìm vật tư',
    pickConfirm: 'Chọn',
    noItem: 'Hãy chọn vật tư.',
    level: 'Mức kiểm tra',
    reason: 'Lý do',
    reasonRequired: 'Hãy nhập lý do.',
    sameLevel: 'Trùng với mức hiện tại. Hãy chọn mức khác.',
    duplicate: 'Vật tư này đã được chỉ định mức kiểm tra. Hãy dùng Đổi mức trong danh sách.',
  },

  history: {
    heading: 'Lịch sử chuyển',
    caption: 'Lịch sử chuyển mức kiểm tra',
    filteredBy: (itemCode: string) => `Đang xem lịch sử của vật tư ${itemCode}`,
    showAll: 'Xem tất cả',
    empty: 'Không có lịch sử chuyển.',
    loading: 'Đang tải lịch sử chuyển.',
    loadFailed: 'Không tải được lịch sử chuyển.',
    columns: {
      changedAt: 'Thời điểm',
      item: 'Vật tư',
      change: 'Mức cũ → mới',
      type: 'Loại',
      reason: 'Lý do',
      changedBy: 'Người xử lý',
    },
    types: { AUTO: 'Tự động', MANUAL: 'Thủ công' } as Record<string, string>,
    firstSet: '(chỉ định lần đầu)',
    acceptStreak: (count: number) => `${String(count)} LOT đạt liên tiếp`,
    rejected: (requestNo: string) => `Không đạt — yêu cầu ${requestNo}`,
  },
};
