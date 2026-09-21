import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-02-07 긴급 W/O 발행.
 *
 * ⭐ **이 화면은 「하지 않는다」가 넷이다.** 컨트롤을 두지 않고 구조로 표현한 자리를 문구가
 * 대신하므로, 안내를 줄여 옮기면 화면이 설명을 잃는다 — 길이를 아끼지 않는다.
 *
 * ⛔ **「보내지 못했다」와 「답을 못 받았다」를 한 말로 합치지 않는다.** 앞은 단언해도 되고
 * (`chưa được phát hành`), 뒤는 단언하면 거짓일 수 있다(`chưa xác nhận được`). 합치면
 * 이미 배포된 것을 다시 눌러 이중 배포를 시도하게 된다.
 *
 * ⚠ `fixedTerms.materialRequest.note` 의 결정 번호는 **그대로 둔다** — 바꿀 수 없는 것을 두고
 * 「왜 못 바꾸나」를 묻는 사람이 근거를 짚을 자리다.
 */
export const emergencyWorkOrder: Translated<typeof ko.emergencyWorkOrder> = {
  title: 'Phát hành W/O khẩn',
  breadcrumbRoot: 'Thực thi sản xuất',

  /** 긴급 발행 조건 구획 — 값이 보여야 고정이 고정으로 읽힌다. */
  fixedTerms: {
    title: 'Điều kiện phát hành khẩn',

    type: {
      label: 'Loại',
      value: 'Khẩn',
    },
    approval: {
      label: 'Phê duyệt',
      value: 'Không có',
    },
    materialRequest: {
      label: 'Yêu cầu xuất kho vật tư',
      value: 'Không tự phát hành',
      note: 'Vật tư cần thiết hãy yêu cầu ở «Yêu cầu xuất kho vật tư bổ sung».',
    },
    resource: {
      label: 'Phân bổ nguồn lực',
      value: 'Không có',
      note: 'Nguồn lực do hiện trường phân bổ.',
    },

    /** 갈 곳이 있는 항목의 이동 단추. 나머지 셋에는 갈 곳이 없어 두지 않는다. */
    materialRequestLink: 'Đi tới màn hình yêu cầu xuất kho',

    internalOrder: 'W/O khẩn không gắn với P/O của ERP và được phát hành bằng số quản lý riêng.',
  },

  /** 발행 정보 입력. 고정된 넷은 여기 없다. */
  form: {
    title: 'Thông tin phát hành',
    item: 'Mặt hàng',
    orderQty: 'Số lượng',
    plannedEnd: 'Ngày giao',
    reason: 'Lý do phát hành',

    itemRequired: 'Hãy chọn mặt hàng trước.',
    qtyRequired: 'Hãy nhập số lượng.',
    qtyNotNumber: 'Số lượng phải nhập bằng số.',
    qtyTooLong: 'Số lượng chỉ nhập được tối đa 12 chữ số phần nguyên và 6 chữ số thập phân.',
    qtyNotPositive: 'Số lượng phải lớn hơn 0.',
    dueInvalid: 'Ngày này không có trên lịch. Hãy chọn lại.',

    reasonRequired: 'Hãy nhập lý do phát hành.',
    reasonPlaceholder: 'Hãy nhập lý do phát hành khẩn',

    optional: 'tùy chọn',
  },

  /** ⛔ 숫자 식별자로 메우지 않는다 — 모르면 모른다고 적는다. */
  uomUnknown: 'Đang xác nhận đơn vị',

  /** 한 번 누르면 만들고 배포까지 간다 — 이름이 그것을 말한다. */
  action: 'Phát hành · phát đi',
  actionTitle: 'Chuẩn bị phát hành',

  expansion: {
    title: 'Triển khai tự động',
    bom: 'BOM',
    routing: 'Routing',
    revision: 'Bản sửa đổi',
    revisionLabel: 'Hãy chọn phát hành theo bản sửa đổi Routing nào',
    operations: 'Công đoạn',

    columns: {
      seq: 'Thứ tự',
      operation: 'Công đoạn',
      qty: 'Số lượng',
    },

    selectItem: 'Chọn mặt hàng thì hệ thống sẽ tải thông tin BOM và Routing.',
    loading: 'Đang nhận phần triển khai.',
    loadError: 'Chưa nhận được phần triển khai. Hãy thử lại sau giây lát.',

    /** 여기 보이는 것은 판정 결과가 아니라 그 개정의 상태다. */
    revisionStatus: (statusCode: string) => `Trạng thái ${statusCode}`,

    /** ⭐ 두 구획의 동작이 갈리는 이유를 적는다 — 적지 않으면 사용자가 규칙을 지어낸다. */
    revisionChoiceReason:
      'Bảng vật tư có bản được chỉ định mặc định nên đã tự chọn. Thứ tự công đoạn không có chỉ định mặc định nên bạn phải tự chọn.',

    /** ⚠ 화면이 대신 고르지 않는다 — 고른 적 없는 개정으로 되돌릴 수 없는 지시가 나간다. */
    revisionMultiple: (count: number) =>
      `Hiện có ${String(count)} bản sửa đổi dùng được. Hãy tự chọn phát hành theo bản nào — màn hình không chọn thay bạn.`,

    lotNotice: 'Phát toàn bộ số lượng lệnh thành 1 LOT.',
  },

  /** ⭐ 이 구획은 있을 때만 선다 — 늘 서 있으면 밀린 것이 있는 상태처럼 읽힌다. */
  handover: {
    title: 'W/O khẩn chưa được phát đi',

    /** 구획 제목과 같은 말을 쓰지 않는다 — 같은 문구가 두 번 보인다. */
    tableCaption: 'Danh sách lệnh cần tiếp nhận',

    /** ⛔ 무엇인지와 왜 남았는지를 함께 적는다 — 새로 발행하면 같은 지시가 둘이 된다. */
    lead: 'Đây là những lệnh đã được tạo nhưng chưa phát đi xong. Phát hành và phát đi là hai bước nên có thể dừng ở giữa. Đừng phát hành mới, chỉ cần phát đi lại — phát hành mới sẽ thành hai lệnh giống nhau.',

    columns: {
      workOrderNo: 'Số W/O',
      orderQty: 'Số lượng lệnh',
      reason: 'Lý do',
    },

    /** 빈 칸을 「사유 없음」으로 단정하지 않는다. */
    reasonEmpty: '—',

    itemNotShown: 'Tên mặt hàng không hiện trong danh sách này. Hãy xác nhận bằng số W/O và lý do.',

    retry: 'Phát đi lại',
    retrying: 'Đang phát đi.',

    /** ⚠ 잘렸다는 사실을 말하지 않으면 「이게 전부」로 읽는다. */
    truncated: (shown: number, total: number) =>
      `Chỉ thấy ${String(shown)} mục đầu trong ${String(total)} mục. Xử lý xong rồi mở lại thì phần còn lại sẽ hiện tiếp.`,

    /** ⛔ 받지 못한 것을 「없음」으로 두지 않는다 — 구획을 감추면 화면이 조용해진다. */
    loadError:
      'Chưa xác nhận được có lệnh nào chưa phát đi hay không. Hãy mở lại sau giây lát để xem.',

    released: (workOrderNo: string) => `Đã phát đi ${workOrderNo}.`,

    /** 보내지 못한 것은 단언해도 된다. */
    notSent: (workOrderNo: string) => `Chưa phát đi được ${workOrderNo}. Hãy thử lại.`,

    /** ⛔ 보냈는데 답을 못 받은 것을 「안 됐다」고 말하면 거짓일 수 있다. */
    releaseUnknown: (workOrderNo: string) =>
      `Chưa xác nhận được ${workOrderNo} đã phát đi hay chưa. Thử lại cũng không bị phát đi hai lần.`,
  },

  itemPicker: {
    title: 'Chọn mặt hàng',
    label: 'Tìm mặt hàng',
    placeholder: 'Hãy chọn mặt hàng',
    clear: 'Xóa mặt hàng đã chọn',
    /** 공용 품목 창의 확인 단추 이름 — 이 화면에서는 「추가」가 아니라 «고르기»다. */
    confirm: 'Dùng mặt hàng này',
  },

  outcome: {
    released: (workOrderNo: string) => `Đã phát hành và phát đi ${workOrderNo}.`,

    /** ⛔ 「발행 실패」가 아니다 — 지시는 이미 만들어져 있다. */
    notSent: (workOrderNo: string) => `${workOrderNo} đã được tạo nhưng chưa được phát đi.`,
    releaseUnknown: (workOrderNo: string) =>
      `${workOrderNo} đã được tạo. Chưa xác nhận được đã phát đi hay chưa.`,
    retryRelease: 'Phát đi lại',
  },

  /** 비활성 사유는 전부 컨트롤 이름으로 시작하고, 무엇이 갖춰지면 열리는지를 함께 적는다. */
  lock: {
    issuing: 'Đang gửi.',

    notSent: (workOrderNo: string) =>
      `${workOrderNo} đã được tạo nhưng chưa được phát đi. Hãy thử phát đi lại. Phát hành mới sẽ thành hai lệnh giống nhau.`,
    releaseUnknown: (workOrderNo: string) =>
      `${workOrderNo} đã được tạo. Chưa xác nhận được đã phát đi hay chưa. Thử lại cũng không bị phát đi hai lần.`,

    uncertain:
      'Đã gửi nhưng chưa xác nhận được đã xử lý hay chưa. Hãy kiểm tra kết quả rồi thử lại.',

    forbidden: 'Tài khoản này không có quyền phát hành khẩn. Hãy đề nghị người phụ trách quyền.',

    /** ⚠ 정상 화면에서는 나올 수 없는 말이다 — 「기다리세요」가 아니라 알릴 상대를 적는다. */
    typeCodeUnknown:
      'Giá trị loại khẩn chưa được đặt trên màn hình nên không phát hành được. Gửi như vậy sẽ tạo ra lệnh sản xuất hàng loạt. Hãy báo cho người phụ trách.',

    itemNotChosen: 'Hãy chọn mặt hàng trước.',
    expansionLoading: 'Đang nhận BOM · Routing.',
    expansionError: 'Chưa nhận được BOM · Routing. Hãy thử lại.',
    revisionNotChosen: 'Hãy chọn phát hành theo bản sửa đổi Routing nào.',
    inputIncomplete: 'Hãy điền mặt hàng · số lượng · lý do.',

    /**
     * ⚠ **「없다」가 아니라 「지금 쓸 수 있는 것이 없다」로 적는다.** 「없습니다」로 읽으면
     * 사람이 새로 만들러 가고, 이미 있는 것을 하나 더 만든다.
     */
    blocked: {
      bomMissing:
        'Mặt hàng này hiện không có BOM nào dùng được. Dù đã đăng ký nhưng nếu bị hủy hoặc chưa chốt thì cũng không dùng được — hãy xem ở dữ liệu gốc.',
      routingMissing:
        'Mặt hàng này hiện không có bản sửa đổi Routing nào dùng được. Dù đã đăng ký nhưng nếu bị hủy hoặc chưa chốt thì cũng không dùng được — hãy xem ở dữ liệu gốc.',
      bothMissing:
        'Mặt hàng này hiện không có cả BOM lẫn bản sửa đổi Routing nào dùng được. Dù đã đăng ký nhưng nếu bị hủy hoặc chưa chốt thì cũng không dùng được — hãy xem ở dữ liệu gốc.',
      operationsMissing:
        'Bản sửa đổi Routing đã chọn không có công đoạn nào. Hãy chọn bản sửa đổi có công đoạn hoặc đăng ký công đoạn ở dữ liệu gốc.',
    },
  },
};
