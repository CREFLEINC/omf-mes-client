"""화면 구성 규범(docs/screen-composition.md) 화면 실측 검사.

실행 중인 관리웹(목 서버에 연결)을 검증 크기로 열어 화면마다 다음을 판정한다.

  P-1 행 클릭 선택     첫 표의 첫 행 빈 곳을 눌렀을 때 화면이 반응하는가 (C-1)
  P-2 끝 열 선택 버튼  행 안의 선택 버튼이 마지막 열에 있는가, 화면 밖으로 밀렸는가 (C-1)
  P-3 아래 적층        선택 후 페이지 높이가 늘고 새 제목이 목록 아래에 생기는가 (C-2)
  P-4 주 동작 가시성   채움 버튼이 첫 화면(스크롤 없이) 안에 있는가, 행 선택 뒤에도 보이는가 (C-3, C-14)
  P-5 진입 직후 오류   처음 연 화면에 오류 알림이 보이는가 (C-7)
  P-6 표 셀 줄바꿈     보이는 표의 셀 중 두 줄 이상으로 접힌 것이 있는가 (C-16)
  P-7 표 가로 넘침     보이는 표가 가로 스크롤 없이는 다 보이지 않는가, 가려진 열에 버튼이나 입력이 있는가 (C-16)
  P-8 제목 단계        화면 제목이 headline-lg인가, 아래 단계 제목이 위 단계보다 큰가, 상자 안에 상자가 한 겹이라도 있는가 (C-19)
  P-9 조회 조건 칸     조회 조건 칸 폭이 좁음(160), 보통(240), 넓음(320) 중 하나인가, 칸 간격이 같은가 (C-19)
  P-10 같은 이름 조작  확인 창 밖 화면에 접근 이름이 같은 버튼, 체크박스, 입력 칸이 두 곳에 보이는가 (C-1)
                       보이는 입력 칸에 접근 이름(aria-label, aria-labelledby, label, title)이 없으면 「이름 없음」으로 위반이다
  P-11 입력 값 잘림     입력 칸(참조 선택 포함)에 들어 있는 값이 칸 폭보다 길어 잘리는가 (C-19, T-W-C 편집 영역)
  P-12 행 안 높이       표 한 행 안 입력과 버튼의 높이가 서로 다른가 (C-19)
  P-13 내부 번호 노출   보이는 문구에 「설비(1)」처럼 이름 대신 괄호 숫자가 있는가 (C-13)
  P-14 제목과 라벨 줄바꿈 구획 제목, 소제목, 입력 칸 라벨, 단계 이름이 두 줄로 접히는가 (C-19)
  P-15 단계 본문 넘침  처리 화면(단계 표시가 있는 화면)에서 본문을 스크롤해야 하는가 (T-W-C 한 단계는 한 화면)

사용:
  python -I tools/ui-check/layout-probe.py --base http://127.0.0.1:5173 --routes /logistics/goods-receipt /logistics/iqc-inspection
  python -I tools/ui-check/layout-probe.py --base http://127.0.0.1:5173 --catalog   관리웹 화면 목록 전체
  옵션: --size 1280x800 (기본), --out <폴더> (결과 JSON, 표, 캡처)
        --login  실서버에 붙일 때 로그인 화면으로 먼저 로그인한다. 계정은 환경 변수 OMF_LOGIN_ID, OMF_LOGIN_PASSWORD

        --allow-undetermined  「판정 불가」 경로가 있어도 종료 코드를 0으로 둔다(위반이 없을 때)

Playwright(Python)가 필요하다. 이 검사는 목 데이터에 의존하므로, 행이 없는 화면은 「판정 불가」로 남긴다.
「판정 불가」와 실행 오류는 요약 줄에 따로 세고, 하나라도 있으면 종료 코드 2로 끝난다(위반이 있으면 1).
자료가 없는 경로가 통과로 보이지 않게 하려는 것이다. 표가 아예 없는 화면은 「해당 없음」이다.
판정은 자동 측정값이고, 최종 판단은 캡처를 함께 보고 사람이 한다.
"""
import argparse, json, pathlib, re, sys, time
from urllib.parse import urlsplit
from playwright.sync_api import Error as PlaywrightError, sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]

SNAP = """() => {
  const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const main = document.querySelector('main') || document.body;
  const scroller = [...document.querySelectorAll('main, [class*=main]')].find(e => e.scrollHeight > e.clientHeight + 2) || document.scrollingElement;
  const heads = [...main.querySelectorAll('h1,h2,h3,h4,legend')].filter(vis).map(h => { const r = h.getBoundingClientRect(); return {t: h.textContent.trim().slice(0, 40), x: Math.round(r.left), y: Math.round(r.top + (scroller.scrollTop || 0))}; });
  // 조회 조건 영역의 [조회]는 그 영역의 채움 버튼이라(C-3) 화면의 주 동작으로 세지 않는다.
  const inFilter = e => !!e.closest('form[role=search], [role=search], [class*=filter-bar]');
  const filled = [...main.querySelectorAll('button')].filter(b => vis(b) && /filled/.test(b.className) && !inFilter(b) && !b.closest('[role=dialog]')).map(b => { const r = b.getBoundingClientRect(); return {t: b.textContent.trim().slice(0, 20), top: Math.round(r.top), bottom: Math.round(r.bottom), disabled: b.disabled}; });
  const alerts = [...document.querySelectorAll('[role=alert]')].filter(vis).map(a => a.textContent.trim().slice(0, 60));
  // 조회 조건 밖에 값을 넣는 칸이 없으면 조회 전용 화면으로 본다(P-4 해당 없음 판단에 쓴다).
  const editable = [...main.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea, select, [role=combobox]')].filter(e => vis(e) && !inFilter(e) && !e.closest('[role=dialog]')).length;
  const t = [...main.querySelectorAll('table')].filter(vis)[0];
  const tb = t ? t.getBoundingClientRect() : null;
  return {path: location.pathname, height: Math.round(scroller.scrollHeight), vh: innerHeight, vw: innerWidth, heads, filled, alerts, editable, tables: [...main.querySelectorAll('table')].filter(vis).length,
          table: tb ? {left: Math.round(tb.left), right: Math.round(tb.right)} : null};
}"""

ROW = r"""() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const t = [...(document.querySelector('main') || document.body).querySelectorAll('table')].filter(vis)[0];
  if (!t) return null;
  const selected = r => r.getAttribute('aria-selected') === 'true' || r.getAttribute('aria-current') === 'true' || /selected|\bsel\b/.test(r.className);
  const rows = [...t.querySelectorAll('tbody tr')].filter(r => r.querySelectorAll('td').length > 1 && vis(r));
  const row = rows.find(r => !selected(r)) || rows[0];
  if (!row) return {rows: 0};
  const cells = [...row.querySelectorAll('td')];
  let sc = t.parentElement; while (sc && sc !== document.body && !(sc.scrollWidth > sc.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(sc).overflowX))) sc = sc.parentElement;
  const right = sc && sc !== document.body ? Math.min(sc.getBoundingClientRect().right, innerWidth) : innerWidth;
  const ctrls = [...row.querySelectorAll('button, a')].filter(vis).map(c => ({text: (c.getAttribute('aria-label') || c.textContent || '').trim().slice(0, 40), col: cells.indexOf(c.closest('td')), cols: cells.length, off: c.getBoundingClientRect().right > right + 1}));
  row.setAttribute('data-probe-row', '1');
  // 체크박스나 버튼이 없는 칸을 누를 자리로 고른다(일괄 동작 작업함은 체크박스 칸을 눌러도 이동하지 않아야 한다).
  const plain = cells.find(c => !c.querySelector('input, button, a, select, [role=combobox]') && c.innerText.trim());
  if (plain) { const rr = plain.getBoundingClientRect(), br = row.getBoundingClientRect(); row.setAttribute('data-probe-x', String(Math.round(rr.left - br.left + 4))); }
  const editable = row.querySelectorAll('input:not([type=checkbox]), select, textarea, [role=combobox]').length > 0;
  return {rows: 1, ctrls, editable};
}"""

WRAP = """() => {
  // 글자 단위로 세로 중심을 비교한다. 칩이나 버튼은 상자 위치가 달라 셀 단위로 세면 오탐이 난다.
  // 줄 높이의 0.6배보다 멀리 떨어진 글자가 있으면 줄바꿈이거나 값을 위아래로 쌓은 것이다.
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const multi = (cell) => {
    const lh = parseFloat(getComputedStyle(cell).lineHeight) || 20;
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
    const centers = []; let wrapped = false;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(n);
      const mids = [...range.getClientRects()].filter(r => r.width > 0).map(r => r.top + r.height / 2).sort((a, b) => a - b);
      if (mids.length > 1 && mids[mids.length - 1] - mids[0] > lh * 0.6) wrapped = true;
      centers.push(...mids);
    }
    centers.sort((a, b) => a - b);
    const stacked = centers.length > 1 && centers[centers.length - 1] - centers[0] > lh * 0.6;
    return wrapped || stacked;
  };
  return [...document.querySelectorAll('main table th, main table td, [role=dialog] table th, [role=dialog] table td')]
    .filter(vis).filter(c => !(c.colSpan > 1 && c.closest('tbody'))).filter(multi).map(c => c.innerText.trim().replace(/\\s+/g, ' ').slice(0, 30));
}"""

OVERFLOW = """() => {
  // 표가 보이는 영역(스크롤 상자 또는 창)보다 넓으면 가려진 열이 있다. 가려진 열에 조작 요소가 있으면 더 무겁다.
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  return [...document.querySelectorAll('main table, [role=dialog] table')].filter(vis).flatMap(t => {
    let sc = t.parentElement; while (sc && sc !== document.body && !/(auto|scroll|hidden)/.test(getComputedStyle(sc).overflowX)) sc = sc.parentElement;
    const right = Math.min(sc && sc !== document.body ? sc.getBoundingClientRect().right : innerWidth, innerWidth);
    const tr = t.getBoundingClientRect().left + t.scrollWidth;
    if (tr <= right + 2) return [];
    const hidden = [...t.querySelectorAll('thead th')].filter(th => th.getBoundingClientRect().left >= right - 4).map(th => th.innerText.trim() || '(제목 없음)');
    const ctrls = [...t.querySelectorAll('tbody button, tbody input, tbody select, tbody [role=combobox]')].filter(c => c.getBoundingClientRect().left >= right - 4).length;
    return [{over: Math.round(tr - right), hidden, ctrls}];
  });
}"""

BELOW = """() => {
  // 첫 표 아래에 있는 글의 양. 선택 전부터 빈 영역을 깔아 둔 화면은 높이가 그대로라 이것으로 아래 적층을 본다.
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const t = [...(document.querySelector('main') || document.body).querySelectorAll('table')].filter(vis)[0];
  if (!t) return 0;
  const tr = t.getBoundingClientRect();
  // 목록 오른쪽에 나란히 놓인 편집 영역(2단)은 아래 적층이 아니므로 목록 폭 안에서 시작하는 요소만 센다.
  return [...document.querySelectorAll('main section, main [class*=pane], main h2, main h3, main dl, main table')]
    .filter(e => { const r = e.getBoundingClientRect(); return vis(e) && r.top > tr.bottom + 40 && r.left < tr.right - 8 && !e.closest('[role=dialog]'); })
    .reduce((n, e) => n + (e.children.length ? 0 : e.innerText.length) + (e.matches('dl, table') ? e.innerText.length : 0), 0);
}"""

HEADS = """() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const main = document.querySelector('main') || document.body;
  const fs = e => parseFloat(getComputedStyle(e).fontSize);
  const hs = [...main.querySelectorAll('h1,h2,h3,h4')].filter(vis).filter(h => !h.closest('[role=dialog]'));
  const h1 = hs.find(h => h.tagName === 'H1');
  const issues = [];
  if (h1 && fs(h1) !== 28) issues.push(`화면 제목 ${fs(h1)}px`);
  for (const h of hs) if (h1 && h !== h1 && fs(h) > fs(h1)) issues.push(`${h.innerText.trim().slice(0, 12)} ${fs(h)}px > 화면 제목`);
  // 바깥 제목보다 큰 안쪽 제목
  for (const h of hs) {
    let box = h.parentElement; while (box && box !== main && !/^(SECTION|ARTICLE|FIELDSET)$/.test(box.tagName) && !/pane|card|box/.test(box.className)) box = box.parentElement;
    let outer = box && box.parentElement; while (outer && outer !== main && !/^(SECTION|ARTICLE|FIELDSET)$/.test(outer.tagName) && !/pane|card|box/.test(outer.className)) outer = outer.parentElement;
    if (!outer || outer === main) continue;
    const oh = [...outer.querySelectorAll(':scope > h2, :scope > h3, :scope > header h2, :scope > header h3, :scope > div > h2, :scope > div > h3')].filter(vis)[0];
    if (oh && oh !== h && fs(h) > fs(oh)) issues.push(`${h.innerText.trim().slice(0, 12)} ${fs(h)}px > ${oh.innerText.trim().slice(0, 12)} ${fs(oh)}px`);
  }
  // 상자 안 상자(C-19 「구획 상자 1겹」): 테두리와 둥근 모서리가 있는 상자 안에 그런 상자가 한 겹이라도 있으면 위반.
  // 빼는 것과 사유:
  //   확인 창 안: 창 자체가 상자라 그 안의 구획은 따로 본다
  //   표 안: 셀 안 부품은 표 규칙(P-6, P-7, P-12)으로 본다
  //   입력 칸과 그 감싸개: 값을 넣는 칸의 테두리는 구획 상자가 아니다
  //   칩과 배지: 상태 표시 부품이다
  const boxed = e => { const s = getComputedStyle(e); return parseFloat(s.borderTopWidth) > 0 && parseFloat(s.borderRadius) >= 8 && e.getBoundingClientRect().height > 80; };
  const exempt = e => e.closest('[role=dialog], dialog, table') || e.matches('input, textarea, select, [role=combobox], [class*=chip], [class*=Chip], [class*=badge], [class*=Badge]')
    || e.querySelector(':scope > input, :scope > textarea, :scope > select');
  const boxes = [...main.querySelectorAll('section, div, fieldset, article, aside')].filter(vis).filter(boxed).filter(e => !exempt(e));
  const label = e => (e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.split(/\\s+/)[0] : '')).slice(0, 40);
  const pairs = [];
  for (const b of boxes) { let a = b.parentElement; while (a && a !== main && !boxes.includes(a)) a = a.parentElement; if (a && a !== main) pairs.push(`${label(a)} > ${label(b)}`); }
  if (pairs.length) issues.push(`상자 안 상자 ${pairs.length}곳: ${[...new Set(pairs)].slice(0, 3).join(', ')}`);
  return issues;
}"""

FILTER = """() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const bar = [...document.querySelectorAll('main form, main [role=search], main [class*=filter-bar]')].filter(vis)[0];
  if (!bar) return null;
  const ctrls = [...bar.querySelectorAll('input:not([type=checkbox]):not([type=radio]), select, button[aria-haspopup], button[class*=trigger], [role=combobox]')]
    .filter(vis).map(c => c.closest('[class*=field], [class*=cell]') || c).filter((c, i, a) => a.indexOf(c) === i);
  const boxes = ctrls.map(c => c.getBoundingClientRect()).sort((a, b) => a.left - b.left);
  const widths = boxes.map(b => Math.round(b.width));
  const gaps = boxes.slice(1).map((b, i) => Math.round(b.left - boxes[i].right)).filter(g => g >= 0 && g < 80);
  return {widths, gaps};
}"""

DUP = r"""() => {
  const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'; };
  const dialogOpen = document.querySelector('[role=dialog][aria-modal=true], dialog[open]');
  const scope = dialogOpen || document.querySelector('main') || document.body;
  const nameOf = (b) => b.getAttribute('aria-label') || (b.labels && b.labels[0] && b.labels[0].innerText) || (b.matches('input, textarea') ? '' : b.innerText) || '';
  const names = [...scope.querySelectorAll('button, a[href], [role=button], [role=link], input[type=checkbox], input:not([type]), input[type=text], input[type=number]')].filter(vis).filter(b => dialogOpen || !b.closest('[role=dialog]'))
    .filter(b => !b.matches('[aria-haspopup=listbox], [role=combobox], [class*=trigger]'))  // 선택 칸은 값이 이름이라 겹칠 수 있다
    .map(b => nameOf(b).trim().replace(/\s+/g, ' ')).filter(Boolean);
  const count = {}; names.forEach(n => count[n] = (count[n] || 0) + 1);
  return Object.entries(count).filter(([, c]) => c > 1).map(([n, c]) => `${n} ×${c}`);
}"""

UNNAMED = r"""() => {
  // 접근 이름이 없는 입력 칸. aria-label, 글자가 있는 aria-labelledby, 연결된 label(감싸는 label 포함), title만 이름으로 본다.
  // placeholder는 값을 넣으면 사라지므로 이름으로 세지 않는다(P-10 nameOf와 같은 기준).
  const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'; };
  const sel = 'input:not([type=hidden]), select, textarea, [role=combobox], [role=textbox], [role=spinbutton], [contenteditable=true]';
  const scopes = [document.querySelector('main') || document.body, ...document.querySelectorAll('[role=dialog], dialog[open]')];
  const ctrls = [...new Set(scopes.flatMap(sc => [...sc.querySelectorAll(sel)]))].filter(vis);
  const text = e => (e && e.innerText || '').trim().replace(/\s+/g, ' ');
  const named = e => {
    if ((e.getAttribute('aria-label') || '').trim()) return true;
    const ids = (e.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
    if (ids.some(id => text(document.getElementById(id)))) return true;
    if (e.labels && [...e.labels].some(l => text(l))) return true;
    return !!(e.getAttribute('title') || '').trim();
  };
  const where = e => {
    const tag = e.tagName.toLowerCase() + (e.getAttribute('type') ? `[type=${e.getAttribute('type')}]` : '') + (e.getAttribute('role') ? `[role=${e.getAttribute('role')}]` : '');
    const tr = e.closest('tr');
    const near = tr ? '행 ' + text(tr.querySelector('td, th')) : text(e.closest('section, fieldset, [role=dialog], form')?.querySelector('h2, h3, h4, legend'));
    return `이름 없음 ${tag}` + (near ? ` (${near.slice(0, 20)})` : '');
  };
  return ctrls.filter(e => !named(e)).map(where);
}"""

CLIP = """() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const main = document.querySelector('main') || document.body;
  const ctx = document.createElement('canvas').getContext('2d');
  const out = [];
  for (const i of [...main.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden])')].filter(vis)) {
    if (!i.value) continue;
    const st = getComputedStyle(i); ctx.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
    const room = i.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
    if (ctx.measureText(i.value).width > room + 2) out.push(i.value.slice(0, 24));
  }
  // 말줄임으로 잘린 값 표시(선택 칸 트리거, 값 글자). 표 셀은 P-6과 C-16 말줄임 허용이라 뺀다.
  for (const e of [...main.querySelectorAll('*')].filter(vis)) {
    if (e.closest('table') || e.children.length > 1) continue;
    const st = getComputedStyle(e);
    if (st.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1 && e.innerText.trim()) out.push(e.innerText.trim().slice(0, 24));
  }
  return [...new Set(out)];
}"""

ROWH = """() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const out = [];
  for (const tr of [...document.querySelectorAll('main table tbody tr')].filter(vis).slice(0, 5)) {
    // 입력 상자는 바깥 테두리 상자(부모 감싸개 포함)의 높이로 본다.
    // 입력은 보이는 상자 높이로 본다. 글자 칸(input)은 감싸개가 상자를 그리므로, 칸 안에서 처음으로 더 높아지는 조상의 높이를 쓴다.
    const boxOf = (e) => { const h = e.getBoundingClientRect().height; for (let b = e.parentElement; b && b.tagName !== 'TD'; b = b.parentElement) { const bh = b.getBoundingClientRect().height; if (bh > h + 1) return e.tagName === 'INPUT' ? b : e; } return e; };
    const boxes = [...tr.querySelectorAll('input:not([type=checkbox]), button, [role=combobox]')].filter(vis).map(e => Math.round(boxOf(e).getBoundingClientRect().height));
    const hs = [...new Set(boxes)];
    if (hs.length > 1) out.push(hs);
  }
  return out;
}"""

WRAPPED_TITLES = r"""() => {
  // 글자 줄 수로 본다. 줄 높이의 1.5배보다 높은 글자 덩어리는 접힌 것이다.
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const main = document.querySelector('main') || document.body;
  const sel = 'h2, h3, h4, legend, label, [class*=label], [class*=group-title], [class*=step] [class*=label], [class*=step] [class*=name]';
  const out = [];
  for (const e of [...main.querySelectorAll(sel)].filter(vis)) {
    if (e.closest('table') || e.querySelector('input, select, textarea, button')) continue;
    const t = e.innerText.trim(); if (!t || t.length > 40) continue;
    // 화면 낭독용 숨김 글자(폭이나 높이 2px 이하 상자)는 줄로 세지 않는다.
    const tops = new Set(); const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const pr = n.parentElement.getBoundingClientRect(); if (!n.textContent.trim() || pr.width <= 2 || pr.height <= 2) continue;
      const range = document.createRange(); range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width > 0) tops.add(Math.round(r.top + r.height / 2));
    }
    const lines = [...tops].sort((x, y) => x - y).filter((v, i, a) => i === 0 || v - a[i - 1] > 4);
    if (lines.length > 1) out.push(e.innerText.trim().replace(/\s+/g, ' ').slice(0, 20));
  }
  return [...new Set(out)];
}"""

STEP_OVERFLOW = """() => {
  // 단계 표시가 있는 처리 화면만 본다. 하단에 고정된 동작 바의 윗변보다 아래에 있는 내용(바 자신 제외)이 있으면 넘친 것이다.
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const main = document.querySelector('main') || document.body;
  if (!main.querySelector('[aria-label*=단계], ol[class*=step], [class*=stepper]')) return null;
  // 하단 동작 바: 아래에 고정되고(sticky, fixed) 창 아래쪽 30% 안에 있는 넓은 상자 중 가장 아래 것.
  const bars = [...document.querySelectorAll('*')].filter(e => { const st = getComputedStyle(e); const r = e.getBoundingClientRect(); return (st.position === 'sticky' || st.position === 'fixed') && vis(e) && r.width > 400 && r.top > innerHeight * 0.7; });
  const bar = bars.sort((x, y) => y.getBoundingClientRect().top - x.getBoundingClientRect().top)[0];
  const limit = bar ? bar.getBoundingClientRect().top : innerHeight;
  let bottom = 0;
  for (const e of main.querySelectorAll('input, button, select, textarea, label, h2, h3, h4, td, [role=combobox], p, li')) {
    if (!vis(e) || (bar && bar.contains(e)) || e.closest('[role=dialog], nav, aside, [role=navigation], [role=menu], [role=listbox]')) continue;
    if (getComputedStyle(e).visibility === 'hidden') continue;
    bottom = Math.max(bottom, e.getBoundingClientRect().bottom);
  }
  return Math.max(0, Math.round(bottom - limit));
}"""

INTERNAL_ID = r"""() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const walker = document.createTreeWalker(document.querySelector('main') || document.body, NodeFilter.SHOW_TEXT);
  const out = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent; const m = t.match(/[가-힣A-Za-z](\(\d+\))/);
    if (m && n.parentElement && vis(n.parentElement)) out.push(t.trim().slice(0, 30));
  }
  return out;
}"""

ROW_STATE = """() => {
  const row = document.querySelector('[data-probe-row="1"]');
  if (!row) return null;
  return [row.getAttribute('aria-selected'), row.getAttribute('aria-current'), row.className, getComputedStyle(row.querySelector('td') || row).backgroundColor].join('|');
}"""


def snap(page):
    time.sleep(0.9)
    return page.evaluate(SNAP)


def p4(s, label):
    """주 동작(조회 조건 밖 채움 버튼)이 스크롤 없이 보이는가. 채움 버튼이 없으면 조회 전용 화면만 해당 없음, 나머지는 판정 불가."""
    if not s["filled"]:
        return f"해당 없음(조회 전용{label})" if s["editable"] == 0 else f"판정 불가(채움 버튼 없음{label})"
    in_view = [b for b in s["filled"] if b["top"] >= 0 and b["bottom"] <= s["vh"]]
    return f"통과{'(' + label.lstrip(', ') + ')' if label else ''}" if in_view else f"위반(첫 화면 밖{label})"


def judge(page, route, out, tag):
    r = {"route": route}
    page.goto(BASE + route, wait_until="networkidle", timeout=20000)
    for _ in range(10):
        if "로그인 상태를 확인" not in page.inner_text("body"):
            break
        time.sleep(0.5)
    # 로그인 화면 등 다른 경로로 옮겨졌으면 요청한 화면을 잰 것이 아니므로 실행 오류로 남긴다(조회 문자열은 비교하지 않는다).
    landed = urlsplit(page.url).path.rstrip("/") or "/"
    wanted = urlsplit(route).path.rstrip("/") or "/"
    if landed != wanted:
        return {"route": route, "error": f"경로 이탈: {landed}(으)로 이동"}
    s0 = snap(page)
    page.screenshot(path=str(out / f"{tag}-entry.png"))
    r["P-5 진입 직후 오류"] = "위반" if s0["alerts"] else "통과"
    r["alerts"] = s0["alerts"]
    wraps = page.evaluate(WRAP)
    r["P-6 표 셀 줄바꿈"] = f"위반({len(wraps)}칸)" if wraps else "통과"
    r["wrapped"] = wraps[:8]
    over = page.evaluate(OVERFLOW)
    r["P-7 표 가로 넘침"] = (f"위반(가려진 열 {sum(len(o['hidden']) for o in over)}, 조작 요소 {sum(o['ctrls'] for o in over)})" if over else "통과")
    r["overflow"] = over
    heads = page.evaluate(HEADS)
    r["P-8 제목 단계"] = f"위반({len(heads)}건)" if heads else "통과"
    r["heads"] = heads[:8]
    fb = page.evaluate(FILTER)
    if fb is None:
        r["P-9 조회 조건 칸"] = "해당 없음"
    else:
        odd = [w for w in fb["widths"] if min(abs(w - x) for x in (160, 240, 320)) > 8]
        uneven = len(set(fb["gaps"])) > 1 if fb["gaps"] else False
        r["P-9 조회 조건 칸"] = (f"위반(폭 {odd}" + (f", 간격 {fb['gaps']}" if uneven else "") + ")") if (odd or uneven) else "통과"
        r["filter"] = fb
    dup = page.evaluate(DUP) + page.evaluate(UNNAMED)
    r["P-10 같은 이름 조작"] = f"위반({', '.join(dup[:4])})" if dup else "통과"
    clip = page.evaluate(CLIP)
    r["P-11 입력 값 잘림"] = f"위반({', '.join(clip[:4])})" if clip else "통과"
    rowh = page.evaluate(ROWH)
    r["P-12 행 안 높이"] = f"위반({rowh[:3]})" if rowh else "통과"
    iid = page.evaluate(INTERNAL_ID)
    r["P-13 내부 번호 노출"] = f"위반({', '.join(iid[:3])})" if iid else "통과"
    so = page.evaluate(STEP_OVERFLOW)
    r["P-15 단계 본문 넘침"] = "해당 없음" if so is None else (f"위반({so}px)" if so > 4 else "통과")
    wt = page.evaluate(WRAPPED_TITLES)
    r["P-14 제목과 라벨 줄바꿈"] = f"위반({', '.join(wt[:4])})" if wt else "통과"
    r["P-4 주 동작 가시성"] = p4(s0, "")
    btn = page.get_by_role("button", name="조회", exact=True)
    try:
        if btn.count() and btn.first.is_enabled():
            btn.first.click(timeout=2000)
    except PlaywrightError as e:
        # 조회를 누르지 못해도 첫 화면 상태로 이어서 잰다. 원인은 notes에 남긴다.
        r.setdefault("notes", []).append(f"조회 누름 실패: {e.__class__.__name__}")
    s1 = snap(page)
    info = page.evaluate(ROW)
    if not info:
        r.update({"P-1 행 클릭 선택": "해당 없음(표 없음)", "P-2 끝 열 선택 버튼": "해당 없음", "P-3 아래 적층": "해당 없음"})
        return r
    if not info.get("rows"):
        r.update({"P-1 행 클릭 선택": "판정 불가(행 없음)", "P-2 끝 열 선택 버튼": "판정 불가", "P-3 아래 적층": "판정 불가"})
        return r
    picks = [c for c in info["ctrls"] if re.search("선택|상세|보기", c["text"])]
    if info.get("editable") and not picks:
        r.update({"P-1 행 클릭 선택": "해당 없음(편집 표)", "P-2 끝 열 선택 버튼": "해당 없음", "P-3 아래 적층": "해당 없음"})
        return r
    last = [c for c in picks if c["col"] == c["cols"] - 1]
    r["P-2 끝 열 선택 버튼"] = ("위반(화면 밖)" if any(c["off"] for c in last) else "위반") if last else "통과"
    row = page.locator("[data-probe-row='1']").first
    below0 = page.evaluate(BELOW)
    page.mouse.move(1, 1)
    before_state = page.evaluate(ROW_STATE)
    try:
        px = int(row.get_attribute("data-probe-x") or 4)
        row.click(position={"x": px, "y": 6}, timeout=2000)
    except PlaywrightError as e:
        # 누르지 못하면 화면 변화가 없어 P-1이 위반으로 나온다. 사람이 구분하도록 notes에 남긴다.
        r.setdefault("notes", []).append(f"행 누름 실패: {e.__class__.__name__}")
    s2 = snap(page)
    page.mouse.move(1, 1)
    time.sleep(0.3)
    after_state = page.evaluate(ROW_STATE)
    # 처리 화면처럼 선택이 행 표시만 바꾸는 경우도 선택으로 본다(aria-selected, aria-current, 클래스, 배경색).
    changed = (s2["path"] != s1["path"] or s2["height"] != s1["height"] or len(s2["heads"]) != len(s1["heads"])
               or page.locator("[role=dialog]").count() > 0 or (after_state is not None and after_state != before_state))
    r["P-1 행 클릭 선택"] = "통과" if changed else "위반"
    if not changed and info["ctrls"]:
        try:
            row.locator("button, a").first.click(timeout=2000)
        except PlaywrightError as e:
            r.setdefault("notes", []).append(f"행 버튼 누름 실패: {e.__class__.__name__}")
        s2 = snap(page)
    page.screenshot(path=str(out / f"{tag}-selected.png"))
    maxy = max((h["y"] for h in s1["heads"]), default=0)
    # 오른쪽 패널(마스터형, C-2 허용)의 제목은 목록 옆에 생기므로 뺀다. 가로 좌표는 창 높이가 아니라
    # 목록 표의 오른쪽 끝(표가 없으면 창 폭의 절반)과 비교한다. 목록 폭 안에서 시작하는 제목만 「목록 아래」다.
    edge = s1["table"]["right"] if s1.get("table") else s2["vw"] * 0.5
    new_below = [h for h in s2["heads"] if h["t"] not in {x["t"] for x in s1["heads"]} and h["y"] > maxy and h["x"] < edge]
    grew = s2["height"] - s1["height"]
    below1 = page.evaluate(BELOW)
    r["below_text"] = {"before": below0, "after": below1}
    r["P-3 아래 적층"] = "위반" if s2["path"] == s1["path"] and (new_below or grew > 120 or below1 - below0 > 60) and page.locator("[role=dialog]").count() == 0 else "통과"
    r["height"] = {"before": s1["height"], "after": s2["height"]}
    # 행 선택 뒤에 나타난 주 동작도 스크롤 없이 보여야 한다(C-14). 위반, 통과, 판정 불가, 해당 없음 순으로 앞선 판정을 남긴다.
    after = p4(s2, ", 선택 후")
    order = ("위반", "통과", "판정 불가", "해당 없음")
    entry = r["P-4 주 동작 가시성"]
    rank = lambda v: next(i for i, x in enumerate(order) if v.startswith(x))
    r["P-4 주 동작 가시성"] = entry if rank(entry) <= rank(after) else after
    wraps2 = page.evaluate(WRAP)
    if wraps2 and not wraps:
        r["P-6 표 셀 줄바꿈"] = f"위반({len(wraps2)}칸, 선택 후)"
        r["wrapped"] = wraps2[:8]
    # 선택 뒤에 나타나는 편집 영역과 상세도 같은 기준으로 본다.
    for key, js, label in (("P-10 같은 이름 조작", UNNAMED, "선택 후"), ("P-11 입력 값 잘림", CLIP, "선택 후"), ("P-13 내부 번호 노출", INTERNAL_ID, "선택 후"), ("P-14 제목과 라벨 줄바꿈", WRAPPED_TITLES, "선택 후")):
        found = page.evaluate(js)
        if found and r.get(key) == "통과":
            r[key] = f"위반({', '.join(found[:3])}, {label})"
    so2 = page.evaluate(STEP_OVERFLOW)
    if so2 and so2 > 4 and r.get("P-15 단계 본문 넘침") in ("통과", "해당 없음"):
        r["P-15 단계 본문 넘침"] = f"위반({so2}px, 선택 후)"
    rowh2 = page.evaluate(ROWH)
    if rowh2 and r.get("P-12 행 안 높이") == "통과":
        r["P-12 행 안 높이"] = f"위반({rowh2[:3]}, 선택 후)"
    over2 = page.evaluate(OVERFLOW)
    if over2 and not over:
        r["P-7 표 가로 넘침"] = f"위반(가려진 열 {sum(len(o['hidden']) for o in over2)}, 조작 요소 {sum(o['ctrls'] for o in over2)}, 선택 후)"
        r["overflow"] = over2
    return r


def catalog():
    src = (ROOT / "apps/web/src/patterns/web-screen-catalog.ts").read_text(encoding="utf-8")
    return [p for p, _c in re.findall(r"path:\s*'([^']+)',\s*code:\s*'([^']+)'", src)]


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:5173")
    ap.add_argument("--routes", nargs="*", default=[])
    ap.add_argument("--catalog", action="store_true")
    ap.add_argument("--size", default="1280x800")
    ap.add_argument("--login", action="store_true")
    ap.add_argument("--allow-undetermined", action="store_true")
    ap.add_argument("--out", default=str(ROOT / ".client-dev" / "ui-probe"))
    a = ap.parse_args()
    BASE = a.base.rstrip("/")
    w, h = (int(x) for x in a.size.split("x"))
    routes = catalog() if a.catalog else a.routes
    if not routes:
        sys.exit("--routes 또는 --catalog를 지정하세요.")
    out = pathlib.Path(a.out) / a.size
    out.mkdir(parents=True, exist_ok=True)
    results = []
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        page = b.new_context(viewport={"width": w, "height": h}, locale="ko-KR").new_page()
        if a.login:
            import os
            page.goto(BASE + "/login", wait_until="networkidle")
            page.get_by_label("아이디").fill(os.environ["OMF_LOGIN_ID"])
            page.get_by_label("비밀번호").fill(os.environ["OMF_LOGIN_PASSWORD"])
            page.get_by_role("button", name="로그인").click()
            page.wait_for_url(lambda u: "/login" not in u, timeout=15000)
        for route in routes:
            tag = route.strip("/").replace("/", "_") or "root"
            try:
                results.append(judge(page, route, out, tag))
            except Exception as e:  # 한 경로의 예기치 않은 오류로 나머지 경로 검사가 멈추지 않게 넓게 받고, 실행 오류로 기록한다.
                results.append({"route": route, "error": f"{e.__class__.__name__}: {str(e)[:100]}"})
            print(json.dumps(results[-1], ensure_ascii=False), flush=True)
        b.close()
    (out / "result.json").write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    keys = ["P-1 행 클릭 선택", "P-2 끝 열 선택 버튼", "P-3 아래 적층", "P-4 주 동작 가시성", "P-5 진입 직후 오류", "P-6 표 셀 줄바꿈", "P-7 표 가로 넘침", "P-8 제목 단계", "P-9 조회 조건 칸", "P-10 같은 이름 조작", "P-11 입력 값 잘림", "P-12 행 안 높이", "P-13 내부 번호 노출", "P-14 제목과 라벨 줄바꿈", "P-15 단계 본문 넘침"]
    lines = ["| 경로 | " + " | ".join(keys) + " |", "|" + "---|" * (len(keys) + 1)]
    for r in results:
        lines.append(f"| {r['route']} | " + " | ".join(r.get(k, r.get("error", "-")) for k in keys) + " |")
    (out / "result.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    violations = sum(1 for r in results for k in keys if str(r.get(k, "")).startswith("위반"))
    undetermined = sum(1 for r in results for k in keys if str(r.get(k, "")).startswith("판정 불가"))
    errors = [r["route"] for r in results if "error" in r]
    open_routes = [r["route"] for r in results if "error" in r or any(str(r.get(k, "")).startswith("판정 불가") for k in keys)]
    print(f"\n위반 {violations}건, 판정 불가 {undetermined}건(경로 {len(open_routes)}곳, 실행 오류 {len(errors)}곳). 결과: {out / 'result.md'}")
    if open_routes:
        print("판정 불가 경로: " + ", ".join(open_routes))
    sys.exit(1 if violations else (2 if open_routes and not a.allow_undetermined else 0))
