export const lotGenealogy = {
  inputs: {
    heading: 'Vật tư đã đưa vào',
    loading: 'Đang tải vật tư đã đưa vào.',
    loadFailed: 'Không tải được vật tư đã đưa vào.',
    none: 'Không có vật tư đưa vào nào gắn với LOT sản xuất này.',
    columns: { item: 'Vật tư', lot: 'LOT vật tư', fourM: 'Thay đổi 4M' },
  },
  usage: {
    heading: 'Sản phẩm đã dùng',
    loading: 'Đang tải sản phẩm đã dùng.',
    loadFailed: 'Không tải được sản phẩm đã dùng.',
    none: 'Chưa có ghi chép đưa LOT này vào sản xuất.',
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
