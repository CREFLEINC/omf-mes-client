import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-06-04 판정유형 코드 마스터. 편집기 안의 문구는 `commonCode.codeValue`가 쓰므로
 * 여기에는 편집기 바깥의 말만 있다 - 판정유형 값의 이름은 적지 않는다.
 */
export const judgmentCode: Translated<typeof ko.judgmentCode> = {
  title: 'Mã loại đánh giá',
  breadcrumbRoot: 'Quản lý chất lượng',
  loading: {
    group: 'Đang xác nhận nhóm mã loại đánh giá',
  },
  /* 그룹을 못 찾은 것은 오류가 아니라 정상 상태의 하나다 - 찾던 그룹코드를 문구가 밝힌다. */
  empty: {
    groupNotFoundTitle: 'Không tìm thấy nhóm mã loại đánh giá',
    groupNotFoundDescription: (groupCode: string): string =>
      `Không có nhóm mã nào có mã nhóm là «${groupCode}». Hãy đăng ký nhóm mã này ở màn hình mã chung trước.`,
  },
  notices: {
    /* 값을 지어내지 않으므로 그 한계를 문구가 밝힌다. */
    provisionalList:
      'Loại đánh giá vẫn là danh sách tạm chưa được chốt. Giá trị đang thấy có thể chưa phải tất cả, và khi chốt thì có thể khác đi.',
    /* 그룹이 꺼져 있어도 값은 그대로 고칠 수 있다 - 사실과 조치할 곳을 함께 밝힌다. */
    groupInactive:
      'Nhóm mã này đang ở trạng thái ngừng dùng. Vẫn sửa được giá trị, nhưng muốn mở dùng lại thì hãy kiểm tra nhóm mã ở màn hình mã chung.',
    /* 늘 보이는 경고는 읽히지 않는다 - 등록 폼이 열려 있는 동안에만 내는 말이다. */
    addAffectsOtherScreens:
      'Loại đánh giá thêm ở đây cũng xuất hiện ở các màn hình khác có dùng loại đánh giá. Nhiều nghiệp vụ cùng xem một danh sách nên hãy xác nhận với người phụ trách trước khi thêm giá trị.',
    /* 화면 이름은 「판정유형」인데 편집기 어휘는 「코드값」이다 - 그 어긋남을 밝힌다. */
    editorScope: 'Màn hình này sửa các giá trị mã của nhóm mã loại đánh giá.',
  },
  editor: {
    fields: {
      code: 'Mã loại đánh giá',
      name: 'Tên loại đánh giá',
      displayOrder: 'Thứ tự hiển thị',
      effectiveFrom: 'Ngày bắt đầu áp dụng',
      effectiveTo: 'Ngày kết thúc áp dụng',
      period: 'Thời gian áp dụng',
      isActive: 'Sử dụng',
      nameKo: 'Tên tiếng Hàn',
      nameVi: 'Tên tiếng Việt',
    },
    values: {
      empty: '—',
      periodAlways: 'Không giới hạn thời gian',
      period: (from: string, to: string): string => `${from} ~ ${to}`,
      chipActive: 'Sử dụng',
      chipInactive: 'Ngừng dùng',
    },
    placeholders: {
      code: 'Nhập mã loại đánh giá',
      name: 'Nhập tên loại đánh giá',
      displayOrder: 'Nhập thứ tự hiển thị',
    },
    actions: {
      add: 'Thêm loại đánh giá',
      edit: 'Sửa',
    },
    list: 'Danh sách loại đánh giá',
    detailTitle: 'Chi tiết mã loại đánh giá',
    createTitle: 'Thêm loại đánh giá',
    editTitle: 'Sửa loại đánh giá',
    empty: {
      noneTitle: 'Chưa có loại đánh giá nào',
      noneDescription: 'Hãy đăng ký loại đánh giá đầu tiên bằng «Thêm loại đánh giá».',
      notSelectedTitle: 'Hãy chọn loại đánh giá',
      notSelectedDescription: 'Chọn trong danh sách thì thông tin chi tiết sẽ hiện ra.',
    },
    loading: {
      list: 'Đang tải danh sách loại đánh giá',
      detail: 'Đang tải thông tin loại đánh giá',
    },
    deactivate: {
      title: 'Ngừng sử dụng?',
      description:
        'Ngừng sử dụng thì không chọn được loại đánh giá này ở công việc mới. Dữ liệu cũ vẫn được giữ.',
      alreadyInactive: 'Loại đánh giá này đã ngừng sử dụng.',
    },
  },
};
