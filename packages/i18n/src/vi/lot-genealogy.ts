export const lotGenealogy = {
  inputs: {
    heading: 'Vật tư đã đưa vào',
    loading: 'Đang tải vật tư đã đưa vào.',
    loadFailed: 'Không tải được vật tư đã đưa vào.',
    none: 'Không có vật tư đưa vào nào gắn với LOT sản xuất này.',
    columns: { item: 'Vật tư', lot: 'LOT vật tư', fourM: 'Thay đổi 4M' },
  },
  usage: {
    heading: 'Lịch sử đưa vào sản xuất',
    /** 투입 이력 줄을 눌러 여는 생산 LOT 상세 팝업 제목(사용자 2026-11-02). */
    dialogTitle: 'Lịch sử chi tiết LOT',
    /** 팝업 안 — 그 생산 LOT 의 작업지시 진행현황으로 간다(사용자 2026-11-02). */
    workOrderHistory: 'Tra cứu lịch sử lệnh sản xuất',
    loading: 'Đang tải lịch sử đưa vào sản xuất.',
    loadFailed: 'Không tải được lịch sử đưa vào sản xuất.',
    none: 'Không có lịch sử đưa vào sản xuất',
    lotsCaption: 'LOT sản xuất đã dùng',
    serialsCaption: 'Số sê-ri đã dùng',
    lotColumns: { lotNo: 'LOT sản xuất', workOrderNo: 'Lệnh sản xuất' },
    serialColumns: { serialNo: 'Số sê-ri', lotNo: 'LOT sản xuất', producedAt: 'Thời điểm sản xuất' },
    serialRange: (from: number, to: number, total: number): string =>
      `${from}–${to} / ${total} số sê-ri`,
    prev: 'Số sê-ri trước',
    next: 'Số sê-ri sau',
  },
  basis: {
    LOT_GENEALOGY_ESTIMATE:
      'Ước tính theo thời điểm đưa vào — gắn với sản phẩm làm ra trước khi đưa LOT tiếp theo của cùng vật tư, cùng lệnh sản xuất.',
    WORK_ORDER_ESTIMATE:
      'Ước tính theo lệnh sản xuất — lệnh trước khi có ghi chép phả hệ nên tính toàn bộ vật tư đã đưa vào lệnh đó. Có thể rộng hơn thực tế.',
  },
  empty: '—',
};
