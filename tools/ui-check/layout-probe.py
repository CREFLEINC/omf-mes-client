"""화면 구성 규범(docs/screen-composition.md) 화면 실측 검사.

실행 중인 관리웹(목 서버에 연결)을 검증 크기로 열어 화면마다 다음을 판정한다.

  P-1 행 클릭 선택     첫 표의 첫 행 빈 곳을 눌렀을 때 화면이 반응하는가 (C-1)
  P-2 끝 열 선택 버튼  행 안의 선택 버튼이 마지막 열에 있는가, 화면 밖으로 밀렸는가 (C-1)
  P-3 아래 적층        선택 후 페이지 높이가 늘고 새 제목이 목록 아래에 생기는가 (C-2)
  P-4 주 동작 가시성   채움 버튼이 첫 화면(스크롤 없이) 안에 있는가 (C-14)
  P-5 진입 직후 오류   처음 연 화면에 오류 알림이 보이는가 (C-7)

사용:
  python -I tools/ui-check/layout-probe.py --base http://127.0.0.1:5173 --routes /logistics/goods-receipt /logistics/iqc-inspection
  python -I tools/ui-check/layout-probe.py --base http://127.0.0.1:5173 --catalog   관리웹 화면 목록 전체
  옵션: --size 1280x800 (기본), --out <폴더> (결과 JSON, 표, 캡처)

Playwright(Python)가 필요하다. 이 검사는 목 데이터에 의존하므로, 행이 없는 화면은 「판정 불가」로 남긴다.
판정은 자동 측정값이고, 최종 판단은 캡처를 함께 보고 사람이 한다.
"""
import argparse, json, pathlib, re, sys, time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]

SNAP = """() => {
  const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const main = document.querySelector('main') || document.body;
  const scroller = [...document.querySelectorAll('main, [class*=main]')].find(e => e.scrollHeight > e.clientHeight + 2) || document.scrollingElement;
  const heads = [...main.querySelectorAll('h1,h2,h3,h4,legend')].filter(vis).map(h => { const r = h.getBoundingClientRect(); return {t: h.textContent.trim().slice(0, 40), x: Math.round(r.left), y: Math.round(r.top + (scroller.scrollTop || 0))}; });
  const filled = [...main.querySelectorAll('button')].filter(b => vis(b) && /filled/.test(b.className)).map(b => { const r = b.getBoundingClientRect(); return {t: b.textContent.trim().slice(0, 20), top: Math.round(r.top), bottom: Math.round(r.bottom), disabled: b.disabled}; });
  const alerts = [...document.querySelectorAll('[role=alert]')].filter(vis).map(a => a.textContent.trim().slice(0, 60));
  return {path: location.pathname, height: Math.round(scroller.scrollHeight), vh: innerHeight, heads, filled, alerts, tables: [...main.querySelectorAll('table')].filter(vis).length};
}"""

ROW = """() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const t = [...(document.querySelector('main') || document.body).querySelectorAll('table')].filter(vis)[0];
  if (!t) return null;
  const row = [...t.querySelectorAll('tbody tr')].find(r => r.querySelectorAll('td').length > 1 && vis(r));
  if (!row) return {rows: 0};
  const cells = [...row.querySelectorAll('td')];
  let sc = t.parentElement; while (sc && sc !== document.body && !(sc.scrollWidth > sc.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(sc).overflowX))) sc = sc.parentElement;
  const right = sc && sc !== document.body ? Math.min(sc.getBoundingClientRect().right, innerWidth) : innerWidth;
  const ctrls = [...row.querySelectorAll('button, a')].filter(vis).map(c => ({text: (c.textContent || '').trim().slice(0, 16), col: cells.indexOf(c.closest('td')), cols: cells.length, off: c.getBoundingClientRect().right > right + 1}));
  row.setAttribute('data-probe-row', '1');
  return {rows: 1, ctrls};
}"""


def snap(page):
    time.sleep(0.9)
    return page.evaluate(SNAP)


def judge(page, route, out, tag):
    r = {"route": route}
    page.goto(BASE + route, wait_until="networkidle", timeout=20000)
    for _ in range(10):
        if "로그인 상태를 확인" not in page.inner_text("body"):
            break
        time.sleep(0.5)
    s0 = snap(page)
    page.screenshot(path=str(out / f"{tag}-entry.png"))
    r["P-5 진입 직후 오류"] = "위반" if s0["alerts"] else "통과"
    r["alerts"] = s0["alerts"]
    first_view = [b for b in s0["filled"] if b["bottom"] <= s0["vh"]]
    r["P-4 주 동작 가시성"] = "통과" if (first_view or not s0["filled"]) else "위반"
    btn = page.get_by_role("button", name="조회", exact=True)
    try:
        if btn.count() and btn.first.is_enabled():
            btn.first.click(timeout=2000)
    except Exception:
        pass
    s1 = snap(page)
    info = page.evaluate(ROW)
    if not info or not info.get("rows"):
        r.update({"P-1 행 클릭 선택": "판정 불가(행 없음)", "P-2 끝 열 선택 버튼": "판정 불가", "P-3 아래 적층": "판정 불가"})
        return r
    last = [c for c in info["ctrls"] if c["col"] == c["cols"] - 1 and re.search("선택|상세|보기", c["text"])]
    r["P-2 끝 열 선택 버튼"] = ("위반(화면 밖)" if any(c["off"] for c in last) else "위반") if last else "통과"
    row = page.locator("[data-probe-row='1']").first
    try:
        row.click(position={"x": 4, "y": 6}, timeout=2000)
    except Exception:
        pass
    s2 = snap(page)
    changed = s2["path"] != s1["path"] or s2["height"] != s1["height"] or len(s2["heads"]) != len(s1["heads"]) or page.locator("[role=dialog]").count() > 0
    r["P-1 행 클릭 선택"] = "통과" if changed else "위반"
    if not changed and info["ctrls"]:
        try:
            row.locator("button, a").first.click(timeout=2000)
        except Exception:
            pass
        s2 = snap(page)
    page.screenshot(path=str(out / f"{tag}-selected.png"))
    maxy = max((h["y"] for h in s1["heads"]), default=0)
    new_below = [h for h in s2["heads"] if h["t"] not in {x["t"] for x in s1["heads"]} and h["y"] > maxy and h["x"] < s2["vh"] * 0.9]
    grew = s2["height"] - s1["height"]
    r["P-3 아래 적층"] = "위반" if s2["path"] == s1["path"] and (new_below or grew > 120) and page.locator("[role=dialog]").count() == 0 else "통과"
    r["height"] = {"before": s1["height"], "after": s2["height"]}
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
        for route in routes:
            tag = route.strip("/").replace("/", "_") or "root"
            try:
                results.append(judge(page, route, out, tag))
            except Exception as e:
                results.append({"route": route, "error": f"{e.__class__.__name__}: {str(e)[:100]}"})
            print(json.dumps(results[-1], ensure_ascii=False), flush=True)
        b.close()
    (out / "result.json").write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    keys = ["P-1 행 클릭 선택", "P-2 끝 열 선택 버튼", "P-3 아래 적층", "P-4 주 동작 가시성", "P-5 진입 직후 오류"]
    lines = ["| 경로 | " + " | ".join(keys) + " |", "|" + "---|" * (len(keys) + 1)]
    for r in results:
        lines.append(f"| {r['route']} | " + " | ".join(r.get(k, r.get("error", "-")) for k in keys) + " |")
    (out / "result.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    violations = sum(1 for r in results for k in keys if str(r.get(k, "")).startswith("위반"))
    print(f"\n위반 {violations}건. 결과: {out / 'result.md'}")
    sys.exit(1 if violations else 0)
