import type { ko } from '../ko';
import type { Translated } from './translated';

/** M-02-01 WIP 공정 이동. 온라인 전용이라 그 사실을 먼저 말한다. */
export const wipHandover: Translated<typeof ko.wipHandover> = {
  title: 'Chuyển công đoạn WIP',
  offline: {
    title: 'Phải có kết nối mới làm được',
    description:
      'Bàn giao công đoạn không thể đưa vào hàng chờ gửi, vì phải xác nhận công đoạn kế tiếp là gì.',
    duringWork: 'Đã mất kết nối. Nội dung đã ghi vẫn còn, hãy làm tiếp khi có kết nối.',
  },
  done: {
    count: (count: string) => `Đã bàn giao ${count} lượt`,
    row: (lotNo: string, workOrderNo: string, qty: string) => `${lotNo} → ${workOrderNo} ${qty}`,
    submit: 'Kết thúc bàn giao',
  },
  lot: {
    legend: 'Quét LOT sản xuất',
    scanLabel: 'Quét LOT',
    scanPlaceholder: 'Hãy quét mã QR của LOT',
    manualLabel: 'Nhập tay',
    manualSubmit: 'Đưa vào',
    loading: 'Đang tải LOT',
    loadFailed: 'Không xác nhận được LOT. Hãy kiểm tra kết nối.',
    notFound: (code: string) => `Không tìm thấy LOT ${code}`,
    qty: (qty: string) => `Số lượng hoàn thành ${qty}`,
    qtyUnknown: 'Không xác nhận được số lượng hoàn thành nên không bàn giao được',
    problem: {
      notProduction: 'Đây không phải LOT sản xuất. Bàn giao công đoạn chỉ nhận LOT sản xuất.',
      notCompleted: 'Cần xử lý hoàn thành sản xuất trước',
      held: 'LOT đang bị tạm giữ',
      heldWhy:
        'Đưa hàng đang tạm giữ sang công đoạn sau sẽ làm lỗi lan rộng. Hãy gỡ tạm giữ trước.',
    },
  },
  next: {
    legend: 'Công đoạn kế tiếp',
    label: 'Công đoạn nhận bàn giao',
    placeholder: 'Hãy chọn công đoạn kế tiếp',
    loading: 'Đang tải công đoạn kế tiếp',
    loadFailed: 'Không xác nhận được công đoạn kế tiếp. Hãy kiểm tra kết nối.',
    none: 'Không có công đoạn kế tiếp. Nếu là công đoạn cuối thì chuyển sang xuất hàng.',
    notStarted: 'Công đoạn chưa bắt đầu. Vẫn có thể gửi trước.',
    option: (workOrderNo: string, operation: string, status: string) => {
      const head = operation === '' ? workOrderNo : `${operation} (${workOrderNo})`;

      return status === '' ? head : `${head} · ${status}`;
    },
  },
  qty: {
    label: 'Số lượng bàn giao',
    problem: {
      notNumber: 'Hãy ghi số lượng bằng chữ số',
      notPositive: 'Số lượng phải lớn hơn 0',
      overCompleted: (limit: string) => `Không được vượt số lượng hoàn thành ${limit}`,
    },
  },
  submit: 'Xác nhận bàn giao',
  noWorker: 'Hãy xác nhận mã nhân viên trước',
  sent: {
    title: 'Đã bàn giao',
    description: 'Việc tiếp nhận cũng đã được ghi. Bên nhận không phải xác nhận thêm.',
  },
  failed: {
    title: 'Không bàn giao được',
    retry: 'Gửi lại',
  },
  another: 'Bàn giao tiếp',
};
