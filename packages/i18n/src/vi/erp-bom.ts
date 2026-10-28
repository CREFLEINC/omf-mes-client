import type { ko } from '../ko';
import type { Translated } from './translated';

/** Tra cứu BOM (ERP). Chỉ đọc — đầu BOM và thành phần nhận từ ERP. */
export const erpBom: Translated<typeof ko.erpBom> = {
  title: 'Tra cứu BOM (ERP)',
  breadcrumbRoot: 'Quản trị hệ thống',
  fields: {
    parentItem: 'Mặt hàng cha',
  },
  actions: {
    pickParent: 'Chọn mặt hàng cha',
    confirmPick: 'Chọn',
  },
  panes: {
    filter: 'Điều kiện tra cứu',
    components: 'Thành phần',
  },
  parent: {
    label: 'Chi tiết mặt hàng cha',
    itemCode: 'Mã mặt hàng',
    itemName: 'Tên mặt hàng',
    itemType: 'Loại',
    spec: 'Quy cách',
    baseUom: 'Đơn vị cơ bản',
    bomCode: 'Mã BOM',
    bomVersion: 'Rev',
    status: 'Trạng thái',
    effective: 'Thời hạn hiệu lực',
    effectiveRange: (from: string, to: string): string => `${from} ~ ${to}`,
    baseQty: 'Số lượng cơ sở',
  },
  componentTable: {
    requiredQty: 'Định mức',
    scrapRate: 'Tỷ lệ hao hụt',
    isMandatory: 'Bắt buộc',
  },
  tree: {
    item: 'Mặt hàng',
    expand: (label: string): string => `Mở ${label}`,
    collapse: (label: string): string => `Thu gọn ${label}`,
    loading: 'Đang tải',
    failed: 'Không tải được cấu trúc con',
    cycle: 'Trùng mặt hàng ở cấp trên',
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
    boms: 'Đang tải BOM',
  },
  empty: {
    noParentTitle: 'Hãy chọn mặt hàng cha',
    noBomTitle: 'Mặt hàng này không có BOM',
  },
};
