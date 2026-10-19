/** Lịch sử đối tượng kiểm tra (omf-all-around#61). */
export const inspectionHistory = {
  heading: 'Lịch sử kiểm tra',
  loading: 'Đang tải lịch sử kiểm tra.',
  loadFailed: 'Không tải được lịch sử kiểm tra.',
  source: 'Chứng từ chuyển đến',
  sourceLot: 'LOT đối tượng',
  empty: '—',
  events: {
    REQUESTED: 'Chuyển đối tượng kiểm tra',
    RESULT_SAVED: 'Lưu kết quả kiểm tra',
    RESULT_CONFIRMED: 'Xác nhận kết quả kiểm tra',
    LOT_STATUS_CHANGED: 'Đổi trạng thái LOT',
  },
  round: (round: number): string => `Lần ${String(round)}`,
  quantities: (accepted: number, rejected: number, held: number): string =>
    `Đạt ${String(accepted)} · Không đạt ${String(rejected)} · Tạm giữ ${String(held)}`,
  judgment: (code: string): string => `Phán định ${code}`,
  lotStatus: (lotNo: string, from: string, to: string): string => `${lotNo} ${from} → ${to}`,
  by: (name: string): string => `Người xử lý ${name}`,
};
