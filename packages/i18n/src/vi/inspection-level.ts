/** Quản lý mức kiểm tra (web quản trị · Quản lý chất lượng). */
export const inspectionLevel = {
  levels: {
    NONE: 'Miễn kiểm',
    REDUCED: 'Giảm nhẹ',
    NORMAL: 'Bình thường',
    TIGHTENED: 'Nghiêm ngặt',
  } as Record<string, string>,

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
    duplicate: 'Vật tư này đã được chỉ định mức kiểm tra. Hãy tải lại màn hình rồi dùng 「Đổi」.',
  },

  history: {
    itemColumns: {
      changedAt: 'Thời điểm thay đổi',
      from: 'Trước thay đổi',
      to: 'Sau thay đổi',
      changedBy: 'Người thay đổi',
      reason: 'Lý do thay đổi',
    },
    firstSetNote: 'Chỉ định lần đầu',
    caption: 'Lịch sử thay đổi mức kiểm tra',
    empty: 'Không có lịch sử thay đổi mức kiểm tra.',
    loading: 'Đang tải lịch sử thay đổi.',
    loadFailed: 'Không tải được lịch sử thay đổi.',
    acceptStreak: (count: number) => `${String(count)} LOT đạt liên tiếp`,
    rejected: (requestNo: string) => `Không đạt — yêu cầu ${requestNo}`,
  },
};
