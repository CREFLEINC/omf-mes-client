import type { ko } from '../ko';
import type { Translated } from './translated';

export const popMaterialLotLabel: Translated<typeof ko.popMaterialLotLabel> = {
  title: 'Đăng ký LOT vật tư · Phát hành nhãn',
  receipts: {
    paneLabel: 'Dòng nhập hàng',
    title: 'Dòng nhập hàng',
    caption: 'Dòng nhập hàng',
    selectRow: (receiptNo: string, itemName: string, qty: string) =>
      `Chọn nhập hàng ${receiptNo} · mặt hàng ${itemName} · số lượng ${qty}`,
    deselectRow: (receiptNo: string, itemName: string, qty: string) =>
      `Bỏ chọn nhập hàng ${receiptNo} · mặt hàng ${itemName} · số lượng ${qty}`,
    fields: {
      itemName: 'Tên mặt hàng',
      itemCode: 'Mã mặt hàng',
      qty: 'Số lượng',
      supplier: 'Nhà cung cấp',
      date: 'Ngày nhập',
    },
    empty: 'Không có vật tư cần phát hành.',
    emptyOnThisPage: 'Không có vật tư chưa phát hành. Hãy xem vật tư đã phát hành.',
    emptyOnThisPageMore: 'Trang này không có vật tư chưa phát hành. Hãy xem trang sau.',
    beyondLast: 'Trang này không có kết quả. Hãy quay lại trang trước.',
    filter: {
      label: 'Trạng thái phát hành',
      unissued: 'Chưa phát hành',
      issued: 'Đã phát hành',
    },
    issuedEmpty: 'Không có vật tư đã phát hành.',
    issuedEmptyOnThisPage:
      'Các phiếu nhập hàng ở trang này không có vật tư đã phát hành. Hãy xem trang sau.',
    refresh: 'Làm mới',
    loadFailed: 'Không tải được danh sách nhập hàng.',
    unsupported:
      'Máy chủ chưa hỗ trợ danh sách đối tượng phát hành. Khi máy chủ sẵn sàng, có thể chọn vật tư tại màn hình này.',
    retry: 'Tải lại',
  },
  device: {
    terminalLabel: 'Máy trạm#',
    terminalUnknown: 'Chưa xác nhận',
  },

  printer: {
    label: 'Máy in',
    select: 'Chọn máy in',
    shellOnly: 'Chỉ chọn được máy in trên bản cài đặt.',
    storedMissing: (name: string) =>
      `Không tìm thấy máy in đã lưu 「${name}」 nên sẽ in bằng máy in mặc định.`,
    none: 'Không có máy in nào dùng được.',
    unknown: 'Không kiểm tra được trạng thái máy in.',
    retry: 'Kiểm tra lại',
  },
  target: {
    paneLabel: 'Đối tượng cấp số',
    title: 'Đối tượng cấp số',
    empty: 'Hãy chọn vật tư ở bên trái.',
    lotPreview: {
      label: 'Số LOT',
      pending: 'Máy chủ cấp số khi đăng ký.',
      loading: 'Đang tải số LOT…',
      loadFailed: 'Không tải được số LOT.',
    },
    actions: {
      issue: 'Đăng ký · In',
      printOnly: 'Đăng ký · In',
      reissue: 'In lại',
      running: {
        register: 'Đang đăng ký LOT…',
        issue: 'Đang tạo bản ghi phát hành…',
        render: 'Đang nhận nhãn…',
        print: 'Đang gửi đến máy in…',
        report: 'Đang báo kết quả in…',
      },
    },
    outcome: {
      iqcPrinted: 'Đã in kèm nhãn IQC. Hãy dán khi chuyển vật tư đến khu chờ IQC.',
      iqcFailed: 'Nhãn IQC chưa được in. Nhãn vật tư vẫn bình thường — hãy kiểm tra máy in.',
      iqcNotPrinted: 'Nhãn IQC cũng chưa được in.',
      printed: (lotNo: string, seq: number) =>
        lotNo === '' ? `Đã in. Lượt ${seq}` : `Đã in. Số LOT ${lotNo} · lượt ${seq}`,
      lotCreated:
        'LOT vật tư đã được tạo. Bấm lại 「Đăng ký · In」 cho vật tư này sẽ chỉ in, không tạo LOT mới.',
      lotCreatedForbidden: 'LOT vật tư đã được tạo. Đừng đăng ký lại — có thể in ở máy trạm khác.',
      printFailed: 'Đã đăng ký nhưng nhãn chưa ra.',
      printFailedNext: 'Kiểm tra máy in rồi bấm 「In lại」 ở 「Đã phát hành」.',
      registerConflict: 'Chưa đăng ký xong lúc này. Lát nữa hãy bấm lại 「Đăng ký · In」.',
      issueForbidden: 'Máy trạm này không phát hành nhãn được. Hãy in ở máy trạm có máy in nhãn.',
      reportFailedAfterPrint:
        'Nhãn đã ra. Chỉ là chưa lưu được kết quả in lên máy chủ — đừng in lại.',
      iqcPlanMissing: 'Không có tiêu chuẩn kiểm tra IQC hợp lệ nên không thể đăng ký · in.',
      failed: 'Chưa đăng ký · in xong.',
      labelStateLocked: 'Không thể phát hành nhãn cho LOT này ở trạng thái hiện tại.',
      labelStateLockedNext:
        'LOT lỗi · hủy không được phát hành nhãn. Có thể phát hành khi xử lý xong và LOT trở lại bình thường.',
    },
    lotBlocked: {
      title: (status: string) =>
        `LOT này đang ở trạng thái 「${status}」 nên không thể phát hành nhãn.`,
      next: 'Có thể phát hành khi xử lý xong và LOT trở lại bình thường.',
      status: { DEFECTIVE: 'Lỗi', SCRAPPED: 'Hủy' } as Record<string, string | undefined>,
    },
    reissueDialog: {
      title: 'Lý do in lại',
      label: 'Lý do',
      placeholder: 'Hãy chọn lý do',
      confirm: 'In lại',
      cancel: 'Hủy',
      empty: 'Chưa có lý do phát hành lại nào để chọn. Không có lý do thì không in lại được.',
      loadFailed: 'Không tải được lý do phát hành lại.',
    },
    fields: {
      receipt: 'Số nhập hàng',
      itemCode: 'Mã mặt hàng',
      itemName: 'Tên mặt hàng',
      quantity: 'Số lượng',
      supplierCode: 'Mã nhà cung cấp',
      supplierName: 'Tên nhà cung cấp',
    },
  },
  pageNav: {
    label: 'Chuyển trang',
    prev: '◀ Trước',
    next: 'Sau ▶',
    position: (page: number, totalPages: number) => `Trang ${page} / ${totalPages}`,
  },
};
