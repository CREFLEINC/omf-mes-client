import type { ko } from '../ko';
import type { Translated } from './translated';

/** Tra cứu BOM (ERP). Chỉ đọc — đầu BOM và thành phần nhận từ ERP. */
export const erpBom: Translated<typeof ko.erpBom> = {
  title: 'Tra cứu BOM (ERP)',
  breadcrumbRoot: 'Quản trị hệ thống',
  fields: {
    hasBom: 'Chỉ mặt hàng có BOM',
    itemType: 'Loại',
    q: 'Mã·tên mặt hàng',
  },
  splitter: 'Kéo để điều chỉnh độ rộng danh sách mặt hàng cha·BOM',
  listCollapse: 'Thu gọn danh sách mặt hàng cha',
  listExpand: 'Mở danh sách mặt hàng cha',
  pickParent: (itemCode: string): string => `Chọn ${itemCode}`,
  panes: {
    parents: 'Danh sách mặt hàng cha',
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
    depthLimit: 'Không mở thêm các cấp sâu hơn',
    retry: (label: string): string => `Tải lại cấu trúc con của ${label}`,
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
    loadingName: 'Đang tải',
    failedName: 'Không tải được',
    unknown: 'Không xác định',
  },
  loading: {
    parents: 'Đang tải danh sách mặt hàng cha',
    boms: 'Đang tải BOM',
  },
  empty: {
    parentsBeyondLast: 'Trang này không có mặt hàng cha',
    noParentsTitle: 'Không có mặt hàng cha phù hợp',
    noParentTitle: 'Hãy chọn mặt hàng cha',
    noBomTitle: 'Mặt hàng này không có BOM',
  },
};
