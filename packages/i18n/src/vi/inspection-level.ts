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
    item: 'Vật tư',
    itemCode: 'Mã vật tư',
    itemName: 'Tên vật tư',
    level: 'Mức kiểm tra',
    reason: 'Lý do',
    reasonPlaceholder: 'Nhập lý do (không bắt buộc)',
    duplicate:
      'Vật tư này đã được chỉ định mức kiểm tra. Vui lòng mở tiêu chuẩn IQC của mặt hàng này trong Quản lý tiêu chuẩn kiểm tra và đổi tại 「Sửa thông tin cơ bản」.',
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
