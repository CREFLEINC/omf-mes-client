/** Quản lý mức kiểm tra (web quản trị · Quản lý chất lượng). */
export const inspectionLevel = {
  title: 'Thiết lập mức kiểm tra',
  breadcrumbRoot: 'Quản lý chất lượng',

  levels: {
    NONE: 'Miễn kiểm',
    REDUCED: 'Giảm nhẹ',
    NORMAL: 'Bình thường',
    TIGHTENED: 'Nghiêm ngặt',
  } as Record<string, string>,

  list: {
    caption: 'Danh sách mức kiểm tra theo vật tư',
    keyword: 'Tìm vật tư',
    keywordPlaceholder: 'Nhập mã hoặc tên vật tư',
    keywordClear: 'Xóa điều kiện vật tư',
    level: 'Chọn mức',
    levelAll: 'Tất cả',
    add: 'Thêm vật tư',
    empty: 'Chưa có vật tư nào được chỉ định mức kiểm tra.',
    emptyHint: 'Dùng 「Thêm vật tư」 để chỉ định mức kiểm tra.',
    loading: 'Đang tải mức kiểm tra.',
    loadFailed: 'Không tải được mức kiểm tra.',
    retry: 'Thử lại',
  },

  columns: {
    item: 'Tên / mã vật tư',
    level: 'Mức hiện tại',
    updatedAt: 'Thời điểm sửa',
    actions: 'Thao tác',
  },

  actions: {
    changeLevel: 'Đổi',
    changeLevelRow: (itemCode: string) => `Đổi mức ${itemCode}`,
    showHistory: 'Lịch sử',
    showHistoryRow: (itemCode: string) => `Xem lịch sử chuyển ${itemCode}`,
  },

  dialog: {
    addTitle: 'Chỉ định mức kiểm tra',
    changeTitle: 'Đổi mức kiểm tra',
    item: 'Vật tư',
    pickItem: 'Tìm vật tư',
    pickConfirm: 'Chọn',
    noItem: 'Hãy chọn vật tư.',
    itemPlaceholder: 'Hãy chọn vật tư',
    level: 'Mức kiểm tra',
    reason: 'Lý do',
    reasonPlaceholder: 'Nhập lý do (không bắt buộc)',
    sameLevel: 'Trùng với mức kiểm tra hiện tại.',
    duplicate: 'Vật tư này đã được chỉ định mức kiểm tra. Hãy dùng 「Đổi」 trong danh sách.',
  },

  history: {
    heading: 'Lịch sử chuyển',
    caption: 'Lịch sử chuyển mức kiểm tra',
    filteredBy: (itemCode: string) => `Đang xem lịch sử của vật tư ${itemCode}`,
    showAll: 'Xem toàn bộ lịch sử chuyển',
    empty: 'Không có lịch sử chuyển.',
    emptyHint: 'Khi chỉ định hoặc đổi mức kiểm tra, lịch sử sẽ hiện ở đây.',
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
