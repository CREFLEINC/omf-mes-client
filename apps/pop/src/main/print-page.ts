/**
 * 인쇄면 — **출력물을 라벨 대지에 꽉 채워 놓는 자리.**
 *
 * ⭐ **그림 파일을 그대로 띄우지 않는다.** 브라우저 엔진은 이미지 하나짜리 문서를 «종이
 * 한가운데»에 여백과 함께 놓는다. 대지가 라벨(예: 80×30mm)이면 그 여백만 라벨에 찍혀
 * **아무것도 없는 종이가 나온다**(실측 — 급지는 되는데 백지였다). 우리가 감싸서 대지 전체를
 * 쓰게 만든다.
 *
 * ⛔ **출력물을 다시 그리지 않는다**(설계 결정 18). 여기서 하는 것은 **놓는 자리**를 정하는
 *    것뿐이고, 그림 자체는 서버가 준 바이트 그대로다.
 *
 * ⚠ 크기를 숫자로 박지 않는다 — 라벨 규격은 드라이버가 안다. `100%` 로 두면 대지가 무엇이든
 *   그것에 맞춰 들어간다. `contain` 이라 비율이 찌그러지지 않고, 남는 쪽은 흰 여백이 된다.
 */

/** 감싸는 문서의 파일 이름. 임시 폴더 안에서만 쓴다. */
export const PRINT_PAGE_FILE = 'index.html';

/** 그림 파일 이름 — 확장자는 형식을 따라간다. */
export const labelFileName = (format: string): string => `label.${format}`;

export function renderPrintPage(imageFile: string): string {
  return `<!doctype html>
<meta charset="utf-8">
<title>label</title>
<style>
  /* 대지에 여백을 두지 않는다 — 라벨은 대지 크기가 곧 인쇄 영역이다. */
  @page { margin: 0; }
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #fff; }
  img { display: block; width: 100%; height: 100%; object-fit: contain; }
</style>
<img src="${imageFile}" alt="">
`;
}
