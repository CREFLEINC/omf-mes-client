/** 검사 문서 첨부·LOT 스캔(omf-all-around#58) — IQC 판정 화면 등이 함께 쓴다. */
export const inspectionDocuments = {
  heading: '첨부 문서',
  help: '시험성적서·측정 엑셀 등 볼 수 있는 문서(PDF·이미지·엑셀/워드/파워포인트·CSV)만 올릴 수 있습니다. 한 파일 10MB 까지입니다.',
  upload: '문서 올리기',
  uploading: '올리는 중…',
  open: '열기',
  none: '첨부된 문서가 없습니다.',
  loading: '첨부 문서를 불러오는 중입니다.',
  loadFailed: '첨부 문서를 불러오지 못했습니다.',
  tooLarge: '10MB 를 넘는 파일은 올릴 수 없습니다. 스캔 PDF 는 해상도를 낮춰 주세요.',
  uploaded: '문서를 올렸습니다.',
  /** 고른 파일은 [업로드]를 눌러야 올라간다(3단계 검증 · 담당자 지시). */
  submit: '업로드',
  remove: '제거',
  selected: '고른 파일',
  unsupported:
    '올릴 수 없는 형식입니다. PDF·이미지·엑셀/워드/파워포인트·CSV·TXT 만 올릴 수 있습니다.',
  caption: '첨부 문서 목록',
  columns: { fileName: '파일', uploadedAt: '올린 시각', size: '크기' },
  scan: {
    label: 'LOT 스캔',
    placeholder: 'LOT 바코드를 스캔하거나 번호를 입력하세요',
    find: '찾기',
    notFound: '이 번호의 LOT 이 없습니다.',
    noRequest: '이 LOT 의 대기 중인 수입검사 의뢰가 없습니다.',
    failed: 'LOT 을 찾지 못했습니다. 연결을 확인한 뒤 다시 시도하세요.',
  },
};
