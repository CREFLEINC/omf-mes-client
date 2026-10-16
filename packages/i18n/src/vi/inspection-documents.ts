/** Đính kèm tài liệu kiểm tra · quét LOT (omf-all-around#58). */
export const inspectionDocuments = {
  heading: 'Tài liệu đính kèm',
  help: 'Chỉ tải lên được tài liệu có thể xem (PDF · hình ảnh · Excel/Word/PowerPoint · CSV) như phiếu kết quả thử nghiệm, file đo. Mỗi file tối đa 10MB.',
  upload: 'Tải tài liệu lên',
  uploading: 'Đang tải lên…',
  open: 'Mở',
  none: 'Chưa có tài liệu đính kèm.',
  loading: 'Đang tải tài liệu đính kèm.',
  loadFailed: 'Không tải được tài liệu đính kèm.',
  tooLarge: 'Không thể tải file lớn hơn 10MB. Hãy giảm độ phân giải của PDF scan.',
  uploaded: 'Đã tải tài liệu lên.',
  caption: 'Danh sách tài liệu đính kèm',
  columns: { fileName: 'File', uploadedAt: 'Thời điểm tải lên', size: 'Dung lượng' },
  scan: {
    label: 'Quét LOT',
    placeholder: 'Quét mã vạch LOT hoặc nhập số',
    find: 'Tìm',
    notFound: 'Không có LOT với số này.',
    noRequest: 'LOT này không có yêu cầu kiểm tra nhập đang chờ.',
    failed: 'Không tìm được LOT. Hãy kiểm tra kết nối rồi thử lại.',
  },
};
