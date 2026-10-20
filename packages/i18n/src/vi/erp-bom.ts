import type { ko } from '../ko';
import type { Translated } from './translated';

/** Tra cứu BOM (ERP). Chỉ đọc — đầu BOM và thành phần nhận từ ERP. */
export const erpBom: Translated<typeof ko.erpBom> = {
  title: 'Tra cứu BOM (ERP)',
  breadcrumbRoot: 'Quản trị hệ thống',
  readOnlyNote: 'Thông tin nhận từ ERP. Không thể sửa trong MES.',
  fields: {
    parentItem: 'Mặt hàng cha',
    bomCode: 'Mã BOM',
  },
  actions: {
    pickParent: 'Chọn mặt hàng cha',
    confirmPick: 'Chọn',
  },
  panes: {
    boms: 'Danh sách BOM',
    components: 'Thành phần',
  },
  bomTable: {
    bomCode: 'Mã BOM',
    bomVersion: 'Rev',
    status: 'Trạng thái',
    isDefault: 'Mặc định',
    effectiveFrom: 'Hiệu lực từ',
    effectiveTo: 'Hiệu lực đến',
    baseQty: 'Số lượng cơ sở',
    openAction: (bomCode: string, bomVersion: number): string =>
      `Xem thành phần ${bomCode} Rev ${String(bomVersion)}`,
  },
  componentTable: {
    sequenceNo: 'STT',
    componentItem: 'Mặt hàng con',
    requiredQty: 'Định mức',
    scrapRate: 'Tỷ lệ hao hụt',
    isMandatory: 'Bắt buộc',
    erpChildItemSeq: 'STT mặt hàng con ERP',
  },
  values: {
    empty: '—',
    yes: 'Có',
    no: 'Không',
    notPicked: 'Chưa chọn',
    loadingName: 'Đang tải',
    failedName: 'Không tải được',
    unknown: 'Không xác định',
  },
  loading: {
    boms: 'Đang tải danh sách BOM',
    components: 'Đang tải thành phần',
  },
  empty: {
    noParentTitle: 'Hãy chọn mặt hàng cha',
    noParentDescription: 'Chọn mặt hàng bằng «Chọn mặt hàng cha» để xem BOM của mặt hàng đó.',
    noBomTitle: 'Không có BOM phù hợp',
    noBomDescription: 'Hãy xóa mã BOM hoặc chọn mặt hàng cha khác.',
    notSelected: 'Chọn một BOM trong danh sách để xem thành phần.',
    noComponentTitle: 'Không có thành phần',
    noComponentDescription: 'BOM này không có thành phần nhận từ ERP.',
  },
};
