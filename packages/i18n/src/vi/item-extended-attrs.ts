import type { ko } from '../ko';
import type { Translated } from './translated';

/**
 * W-06-05 품목 확장속성. 문구가 원본(hệ thống ngoài 소유)과 확장(이쪽 소유)을 말로 갈라 놓는다 -
 * 옮긴 말에서도 그 경계가 살아 있어야 한다. 원본 안내·충돌·상태 잠금은 공통 문구를 그대로 쓴다.
 */
export const itemExtendedAttrs: Translated<typeof ko.itemExtendedAttrs> = {
  title: 'Mặt hàng · BOM',
  breadcrumbRoot: 'Dữ liệu gốc',
  tabs: {
    label: 'Khu vực chi tiết mặt hàng',
    attrs: 'Thuộc tính mở rộng',
    subsidiary: 'Thông tin phụ',
    bom: 'BOM',
  },
  sections: {
    label: 'Phân loại mặt hàng · BOM',
    item: 'Mặt hàng',
    bom: 'BOM',
  },
  /* 화면 스펙의 구획 이름이라 여기서 새로 짓지 않는다. */
  subTabs: {
    label: 'Thông tin phụ',
    buMap: 'Ánh xạ đơn vị kinh doanh',
    uomConversion: 'Quy đổi đơn vị',
    externalCode: 'Mã ngoài',
  },
  panes: {
    item: 'Mặt hàng',
    itemOrigin: 'Thông tin gốc của mặt hàng',
    itemAttrs: 'Thuộc tính mở rộng',
  },
  actions: {
    prevPage: 'Trước',
    nextPage: 'Sau',
    goFirstPage: 'Về trang đầu',
  },
  pageNav: {
    label: 'Chuyển trang',
    range: (start: number, end: number, total: number): string =>
      `${String(start)}–${String(end)} / Tổng ${String(total)}`,
    /** 이 쪽에 보일 것이 없을 때. 범위를 지어내지 않고 전체 건수만 밝힌다. */
    totalOnly: (total: number): string => `Tổng ${String(total)}`,
  },
  filters: {
    itemSearchLabel: 'Tìm mặt hàng',
    itemSearchPlaceholder: 'Mã mặt hàng hoặc tên mặt hàng',
    chipKeyword: (value: string): string => `Từ khóa: ${value}`,
    chipRemoveKeyword: 'Bỏ điều kiện từ khóa',
    chipRemoveIncludeInactive: 'Bỏ điều kiện gồm cả mục ngừng dùng',
  },
  loading: {
    items: 'Đang tải danh sách mặt hàng',
    itemDetail: 'Đang tải thông tin mặt hàng',
  },
  /* 잘렸거나 못 받았다는 사실을 감추지 않는다 - 감추면 값이 사라진 줄로 읽는다. */
  optionsTruncated:
    'Chỉ hiển thị một phần danh sách chọn. Không thấy giá trị cần tìm thì hãy báo người phụ trách.',
  optionsLoadFailed: 'Không tải được danh sách chọn. Chỉ hiển thị giá trị đang lưu.',
  empty: {
    /* 결과는 있는데 이 쪽에만 없다 - 「등록된 것이 없다」로 내면 사실과 다른 안내가 된다. */
    beyondLastTitle: 'Trang này không có kết quả',
    beyondLastDescription: 'Hãy chuyển về trang đầu.',
    /* 여기서 만들 수 없는 자료라 「추가하세요」가 아니라 「원본 시스템을 보라」로 남긴다. */
    noneTitle: 'Không có mặt hàng để hiển thị',
    noneDescription:
      'Mặt hàng được nhận từ hệ thống ngoài. Hãy kiểm tra xem hệ thống gốc có dữ liệu hay không.',
    noMatchTitle: 'Không có mặt hàng khớp điều kiện',
    noMatchDescription: 'Hãy giảm bớt hoặc đặt lại điều kiện rồi tra cứu lại.',
    notSelected: 'Chọn mặt hàng ở bên trái thì thông tin của mặt hàng đó hiện ở đây',
  },
  values: {
    empty: '—',
    /** 좁은 좌 페인이라 열을 더하지 않고 이름 뒤 접미로 붙인다. */
    inactiveSuffix: ' (ngừng dùng)',
    unknown: 'Không rõ',
    /** 「알 수 없음」과 가른다 - 둘을 같은 말로 내면 자료가 잘못 담긴 것으로 읽힌다. */
    loading: 'Đang tải…',
  },
  /* 원본 구획 - 외부 시스템이 소유하는 네 열. 안내는 공통 `editability.receivedFromErp`가 낸다. */
  origin: {
    fields: {
      itemCode: 'Mã mặt hàng',
      itemName: 'Tên mặt hàng',
      /** 값 목록이 미정이라 코드 문자열을 그대로 낸다 - 이름을 지어내지 않는다. */
      itemType: 'Loại mặt hàng',
      baseUom: 'Đơn vị cơ sở',
    },
  },
  /* 확장 구획 - 이쪽이 소유해 고치는 값. 원본 구획과 말이 갈려 있어야 한다. */
  attrs: {
    groups: {
      names: 'Tên đa ngôn ngữ',
      lot: 'Mặc định · nhận diện LOT',
      shelfLife: 'Hạn sử dụng · thứ tự xuất',
      inventory: 'Kiểm tra · tồn kho · bảo quản',
    },
    fields: {
      nameKo: 'Tên mặt hàng (tiếng Hàn)',
      nameVi: 'Tên mặt hàng (tiếng Việt)',
      developmentItem: 'Hàng phát triển',
      lotControlled: 'Quản lý LOT',
      defaultLotStorageUom: 'Đơn vị bảo quản LOT mặc định',
      defaultProductionLotSize: 'Kích thước LOT sản xuất mặc định',
      serialControlType: 'Loại quản lý serial',
      shelfLifeManaged: 'Quản lý hạn sử dụng',
      shelfLifeDays: 'Hạn sử dụng (ngày)',
      inspectionRequired: 'Đối tượng kiểm tra nhập kho',
      fifoPolicy: 'Chính sách thứ tự xuất',
      negativeStockAllowed: 'Cho phép tồn kho âm',
      storageCondition: 'Điều kiện bảo quản',
      openedShelfLifeHours: 'Thời hạn sau khi mở (giờ)',
      isActive: 'Trạng thái sử dụng',
    },
    values: {
      active: 'Đang dùng',
      inactive: 'Ngừng dùng',
      unspecified: 'Không chỉ định',
    },
    /* 바꿀 수단이 없는 자리는 감추지 않고 밝힌다 - 감추면 화면이 빠뜨린 것으로 읽힌다. */
    isActiveNote:
      'Trạng thái sử dụng không đổi được ở màn hình này. Dù lưu thì giá trị hiện tại vẫn giữ nguyên.',
    validation: {
      required: 'Đây là mục bắt buộc.',
      codeTooLong: 'Mã không được vượt quá 50 ký tự.',
      /* 계약 A-2 - 「유효기한 관리」가 켜져 있을 때만 필수다. */
      shelfLifeDaysRequired: 'Bật quản lý hạn sử dụng thì phải nhập hạn sử dụng (ngày).',
      /* 계약 minimum: 0 - 0은 허용값이다. */
      shelfLifeDaysInvalid: 'Hãy nhập hạn sử dụng (ngày) là số nguyên từ 0 trở lên.',
      /* 계약 exclusiveMinimum: 0 - 유효기한(일)과 규칙이 다르다. */
      openedShelfLifeHoursInvalid: 'Hãy nhập thời hạn sau khi mở (giờ) là số nguyên từ 1 trở lên.',
      defaultLotStorageUomInvalid: 'Hãy chọn lại đơn vị bảo quản LOT mặc định.',
      defaultProductionLotSizeInvalid: 'Hãy nhập kích thước LOT sản xuất mặc định bằng số.',
    },
  },
  /* 대상 품목을 검색해서 고르는 묶음(결정 8) - 번호를 입력받지 않는다. */
  itemPicker: {
    keywordLabel: 'Tìm mặt hàng đích',
    keywordPlaceholder: 'Mã mặt hàng hoặc tên mặt hàng',
    search: 'Tìm',
    resultLabel: 'Mặt hàng đích',
    resultPlaceholder: 'Hãy chọn trong kết quả tìm',
    /* 검색 전에 선택칸이 빈 것이 정상이다 - 밝히지 않으면 고장으로 읽힌다. */
    beforeSearch: 'Hãy nhập mã mặt hàng hoặc tên mặt hàng rồi bấm tìm.',
    truncated: 'Kết quả tìm quá nhiều nên chỉ hiển thị một phần. Hãy thu hẹp từ khóa.',
    noResult: 'Không có mặt hàng khớp từ khóa. Hãy đổi từ khóa rồi tìm lại.',
    searchFailed: 'Không tìm được mặt hàng. Lát nữa hãy tìm lại.',
  },
  /* 부속 하위 탭① - 사업부 매핑. 계약에 유일 제약이 없어 중복 안내를 두지 않는다(결정 7). */
  buMap: {
    paneTitle: 'Ánh xạ đơn vị kinh doanh',
    fields: {
      fromBusinessUnit: 'Đơn vị kinh doanh gửi',
      toBusinessUnit: 'Đơn vị kinh doanh nhận',
      toItem: 'Mặt hàng đích',
      validPeriod: 'Thời hạn hiệu lực',
      effectiveFrom: 'Hiệu lực từ',
      effectiveTo: 'Hiệu lực đến',
      edit: 'Sửa',
    },
    values: {
      period: (from: string, to: string): string => `${from} ~ ${to}`,
    },
    actions: {
      add: 'Thêm ánh xạ',
      editRow: (name: string): string => `Sửa ánh xạ ${name}`,
      removeRow: (name: string): string => `Xóa ánh xạ ${name}`,
    },
    loading: {
      list: 'Đang tải ánh xạ đơn vị kinh doanh',
    },
    empty: {
      noneTitle: 'Chưa đăng ký ánh xạ đơn vị kinh doanh',
      noneDescription: 'Hãy tạo dòng bằng «Thêm ánh xạ» rồi lưu.',
    },
    dialog: {
      addTitle: 'Thêm ánh xạ đơn vị kinh doanh',
      editTitle: 'Sửa ánh xạ đơn vị kinh doanh',
      confirm: 'Xác nhận',
      /* 확인이 저장이라고 오해하면 창을 닫고 화면을 떠난다 - 저장이 따로 있다는 말을 남긴다. */
      notSavedNotice: 'Bấm xác nhận thì vẫn chưa lưu. Hãy kiểm tra bảng rồi lưu.',
    },
    /* 이름을 못 받은 것은 저장을 막지 않는다 - 표시만의 문제다. */
    itemNamesLoadFailed: 'Không tải được tên mặt hàng đích. Việc lưu không bị ảnh hưởng.',
    validation: {
      required: 'Đây là mục bắt buộc.',
      /* 계약 ck_item_bu_map_distinct */
      sameBusinessUnit: 'Đơn vị kinh doanh gửi và đơn vị kinh doanh nhận phải khác nhau.',
      /* 계약 ck_item_bu_map_dates - 짝 제약이라 두 칸에 함께 낸다. */
      validRangeReversed: 'Hiệu lực đến phải bằng hoặc sau hiệu lực từ.',
    },
  },
  /* 부속 하위 탭② - 단위 환산. 유일 제약이 있어 저장을 막는 사유 문구가 함께 있다. */
  uomConversion: {
    paneTitle: 'Quy đổi đơn vị',
    fields: {
      fromUom: 'Đơn vị trước quy đổi',
      toUom: 'Đơn vị sau quy đổi',
      conversionRate: 'Tỷ lệ quy đổi',
      validPeriod: 'Thời hạn hiệu lực',
      effectiveFrom: 'Hiệu lực từ',
      effectiveTo: 'Hiệu lực đến',
      edit: 'Sửa',
    },
    values: {
      period: (from: string, to: string): string => `${from} ~ ${to}`,
    },
    actions: {
      add: 'Thêm quy đổi',
      editRow: (name: string): string => `Sửa quy đổi ${name}`,
      removeRow: (name: string): string => `Xóa quy đổi ${name}`,
    },
    /* 「무엇이 막혔는지 + 어떻게 푸는지」를 담고 그 컨트롤의 이름으로 시작한다. */
    actionReasons: {
      saveBlockedByDuplicate:
        'Không lưu được. Có từ hai dòng trở lên trùng cả đơn vị trước quy đổi · đơn vị sau quy đổi · hiệu lực từ. Hãy sửa hoặc xóa dòng trùng rồi lưu.',
    },
    loading: {
      list: 'Đang tải quy đổi đơn vị',
    },
    empty: {
      noneTitle: 'Chưa đăng ký quy đổi đơn vị',
      noneDescription: 'Hãy tạo dòng bằng «Thêm quy đổi» rồi lưu.',
    },
    dialog: {
      addTitle: 'Thêm quy đổi đơn vị',
      editTitle: 'Sửa quy đổi đơn vị',
      confirm: 'Xác nhận',
      notSavedNotice: 'Bấm xác nhận thì vẫn chưa lưu. Hãy kiểm tra bảng rồi lưu.',
    },
    validation: {
      required: 'Đây là mục bắt buộc.',
      /* 계약 ck_item_uom_distinct */
      sameUom: 'Đơn vị trước quy đổi và đơn vị sau quy đổi phải khác nhau.',
      /* 계약 exclusiveMinimum: 0 - 0은 허용값이 아니다. */
      conversionRateInvalid: 'Hãy nhập tỷ lệ quy đổi là số lớn hơn 0.',
      /* 계약 ck_item_uom_dates - 짝 제약이라 두 칸에 함께 낸다. */
      validRangeReversed: 'Hiệu lực đến phải bằng hoặc sau hiệu lực từ.',
      /* 계약 uq_item_uom_conversion - 유효 종료·환산 비율은 이 키에 들어가지 않는다. */
      duplicateKey: 'Đã có dòng trùng cả đơn vị trước quy đổi · đơn vị sau quy đổi · hiệu lực từ.',
      /* 표 위에 낸다 - 어느 줄이 문제인지 저장을 눌러야 알게 하지 않는다. */
      duplicateInList:
        'Có dòng trùng cả đơn vị trước quy đổi · đơn vị sau quy đổi · hiệu lực từ. Hãy dọn các dòng trùng.',
    },
  },
  /*
   * 부속 하위 탭③ - 외부 코드. 유일 제약이 `COALESCE(partner_id,0)`으로 접혀(A-7)
   * 거래처를 비운 두 줄이 같은 짝이 된다 - 그 사실을 문구가 밝힌다.
   */
  externalCode: {
    paneTitle: 'Mã ngoài',
    fields: {
      externalSystem: 'Hệ thống ngoài',
      partner: 'Đối tác',
      externalItemCode: 'Mã mặt hàng ngoài',
      edit: 'Sửa',
    },
    values: {
      /* 계약이 「비우면 (전체)」로 정했다(A-7) - 빈 칸은 빠뜨린 것으로 읽힌다. */
      allPartners: '(Tất cả)',
    },
    actions: {
      add: 'Thêm mã ngoài',
      editRow: (name: string): string => `Sửa mã ngoài ${name}`,
      removeRow: (name: string): string => `Xóa mã ngoài ${name}`,
    },
    actionReasons: {
      saveBlockedByDuplicate:
        'Không lưu được. Có từ hai dòng trở lên trùng cả hệ thống ngoài và đối tác. Hãy sửa hoặc xóa dòng trùng rồi lưu.',
    },
    loading: {
      list: 'Đang tải mã ngoài',
    },
    empty: {
      noneTitle: 'Chưa đăng ký mã ngoài',
      noneDescription: 'Hãy tạo dòng bằng «Thêm mã ngoài» rồi lưu.',
    },
    dialog: {
      addTitle: 'Thêm mã ngoài',
      editTitle: 'Sửa mã ngoài',
      confirm: 'Xác nhận',
      notSavedNotice: 'Bấm xác nhận thì vẫn chưa lưu. Hãy kiểm tra bảng rồi lưu.',
    },
    externalSystemPlaceholder: 'Hãy chọn hệ thống ngoài',
    validation: {
      required: 'Đây là mục bắt buộc.',
      externalItemCodeTooLong: 'Mã mặt hàng ngoài không được vượt quá 100 ký tự.',
      /* 계약 uq_item_external_code - COALESCE(partner_id,0) 접기를 문구가 밝힌다(A-7). */
      duplicateKey:
        'Đã có dòng trùng cả hệ thống ngoài và đối tác. Các dòng để trống đối tác cũng được xem là trùng nhau.',
      duplicateInList:
        'Có dòng trùng cả hệ thống ngoài và đối tác. Các dòng để trống đối tác cũng được xem là trùng nhau nên hãy dọn các dòng trùng.',
    },
  },
  /*
   * 탭③ - BOM. 헤더는 전부 원본이고 바꿀 수 있는 것은 둘뿐이다(기본 지정·구성품 확장 열 넷).
   * 상태는 값 목록이 미정이라 이름을 지어내지 않고 코드 문자열을 그대로 낸다.
   */
  bom: {
    paneTitle: 'Danh sách BOM',
    detailPaneTitle: 'Thông tin BOM',
    fields: {
      bomCode: 'Mã BOM',
      bomVersion: 'Rev',
      status: 'Trạng thái',
      isDefault: 'Mặc định',
      validPeriod: 'Thời hạn hiệu lực',
      /* 수량과 단위를 한 칸에 담으므로 단위 라벨을 따로 두지 않는다. */
      baseQty: 'Số lượng cơ sở',
      setDefault: 'Đặt mặc định',
    },
    values: {
      period: (from: string, to: string): string => `${from} ~ ${to}`,
      /** 기본인 줄에 붙이는 표식. 아닌 줄은 값 없음 표기(`values.empty`)를 쓴다 */
      isDefault: 'Mặc định',
      /** 「Rev 3」처럼 사람이 읽는 형태. 표의 숫자 열과 액션 이름이 함께 쓴다 */
      revision: (version: number): string => `Rev ${String(version)}`,
      /** BOM 하나를 한 줄로. 액션 이름과 확인 창이 같은 형태를 쓴다 */
      name: (code: string, version: number): string => `${code} · Rev ${String(version)}`,
    },
    actions: {
      setDefaultRow: (name: string): string => `Đặt ${name} làm mặc định`,
    },
    actionReasons: {
      /* 「무엇이 막혔는지 + 어떻게 푸는지」 - 이 컨트롤의 이름으로 시작한다. */
      alreadyDefault:
        'Đặt mặc định hiện không thực hiện được vì BOM này đã là mặc định. Muốn chuyển mặc định thì hãy đặt ở dòng khác.',
    },
    loading: {
      list: 'Đang tải BOM',
    },
    empty: {
      /* 여기서 만들 수 없는 자료다 - BOM 도 외부 정본이다. */
      noneTitle: 'Chưa đăng ký BOM',
      noneDescription:
        'BOM được nhận từ hệ thống ngoài. Hãy kiểm tra xem hệ thống gốc có dữ liệu hay không.',
      notSelected: 'Chọn BOM ở trên thì nội dung và thành phần của BOM đó hiện ở đây',
    },
    dialog: {
      setDefaultTitle: 'Đặt BOM mặc định',
      /* 고르지 않은 다른 줄이 함께 바뀐다 - 먼저 밝히지 않으면 어느 줄이 왜 내려갔는지 알 수 없다. */
      setDefaultDescription: 'BOM mặc định hiện có của cùng mặt hàng sẽ tự động được bỏ.',
      setDefaultConfirm: 'Đặt làm mặc định',
    },
    actionsColumn: {
      /** 헤더 목록에서 이 BOM 의 내용·구성품을 연다 */
      open: (name: string): string => `Xem thành phần của ${name}`,
    },
  },
  /*
   * 구성품 - 한 행에 원본 열 여섯과 확장 열 넷이 섞여 있다. 편집 창에 들어가는 라벨은 확장 열 넷뿐이다.
   * 스크랩률에 퍼센트 기호를 쓰지 않는다 - 계약이 0~1 비율이라 못 박았다(A-8).
   */
  component: {
    paneTitle: 'Thành phần',
    fields: {
      sequence: 'Thứ tự',
      componentItem: 'Thành phần',
      /** 수량과 단위를 한 칸에 담는다 - 둘은 따로 읽히지 않는다 */
      requiredQty: 'Lượng cần',
      scrapRate: 'Tỷ lệ hao hụt',
      isMandatory: 'Bắt buộc',
      /** 「등록 공정 · 실사용 공정」을 한 칸에. 나란히 놓아야 비교된다 */
      process: 'Công đoạn',
      /** 켜진 확장 표시만 칩으로 */
      extensions: 'Chỉ báo mở rộng',
      edit: 'Sửa',
      routingOperation: 'Công đoạn đăng ký',
      actualUseProcess: 'Công đoạn dùng thực tế',
      lotTraceRequired: 'Bắt buộc truy vết LOT',
      backflushAllowed: 'Cho phép backflush',
    },
    values: {
      mandatory: 'Bắt buộc',
      optional: 'Tùy chọn',
      /** 소요량 한 칸 - 「수량 단위」 */
      quantity: (qty: string, uom: string): string => `${qty} ${uom}`,
      /** 공정 한 칸 - 「등록 · 실사용」 */
      process: (registered: string, actual: string): string => `${registered} · ${actual}`,
      lotTraceRequired: 'Truy vết LOT',
      backflushAllowed: 'Backflush',
      /* 계약이 널을 허용한다 - 비우는 것이 정상 값이라 선택지로 둔다. */
      unassigned: 'Không chỉ định',
      /** 등록 공정 선택지 라벨. 순서는 **목록 내 위치**이며 서버 채번 값이 아니다 */
      routingOperation: (version: number, position: number, name: string): string =>
        `Rev ${String(version)} · ${String(position)}. ${name}`,
    },
    actions: {
      editRow: (name: string): string => `Sửa cột mở rộng của ${name}`,
    },
    actionReasons: {
      /* 「무엇이 막혔는지 + 어떻게 푸는지」 - 이 컨트롤의 이름으로 시작한다. */
      routingOperationEmpty:
        'Công đoạn đăng ký hiện không chọn được vì mặt hàng này chưa có luồng công đoạn nào. Hãy đăng ký luồng công đoạn trước rồi mở lại.',
    },
    loading: {
      list: 'Đang tải thành phần',
      /* 행 상세를 받는 동안. 이 조회가 끝나야 저장을 열 수 있다(§5.3 6행). */
      detail: 'Đang tải thông tin thành phần',
    },
    dialog: {
      title: (name: string): string => `Sửa cột mở rộng của thành phần — ${name}`,
      /* 창에 원본 열이 없다는 사실을 밝힌다 - 서버가 막지 않으므로 화면이 지키는 자리다. */
      originNotice:
        'Cột gốc do hệ thống ngoài sở hữu nên không đổi được ở đây. Chỉ bốn mục dưới đây được lưu.',
    },
    empty: {
      /* 여기서 만들 수 없는 자료다 - 계약에 구성품 추가·삭제 경로가 없다. */
      noneTitle: 'Chưa đăng ký thành phần',
      noneDescription:
        'Thành phần được nhận từ hệ thống ngoài. Hãy kiểm tra xem hệ thống gốc có dữ liệu hay không.',
    },
    /* 이름을 못 받은 것은 편집을 막지 않는다 - 표시만의 문제다. */
    itemNamesLoadFailed: 'Không tải được tên thành phần. Việc sửa không bị ảnh hưởng.',
  },
};
