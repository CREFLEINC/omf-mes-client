/*
 * 기기 등록 관문을 넘겨 준다.
 *
 * 진짜 등록은 토큰을 두고 «곧바로 작업자 명부를 받아 둔다». 토큰만 두면 사번 확인에서
 * 막혀 한 걸음도 못 간다 - 등록이 하는 두 가지를 다 한다.
 *
 * 앱 코드에는 손대지 않는다. 앱이 이미 쓰는 보관 API 를 개발자 도구로 부를 뿐이라
 * 시험용 뒷문이 제품에 남지 않는다.
 */
const [, , terminalCode, plantId, apiBaseUrl] = process.argv;

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

// 서명은 검증하지 않는다 - 화면은 어느 단말인지 보이려고 읽을 뿐이고 판정은 서버가 한다.
const token = [
  base64url({ alg: 'none', typ: 'JWT' }),
  base64url({ terminalCode, plantId: Number(plantId) }),
  'dev',
].join('.');

const targets = await fetch('http://127.0.0.1:9444/json/list').then((response) => response.json());
const target = targets[0];

if (!target) {
  console.error('WebView 를 찾지 못했습니다 - 앱이 떠 있는지 확인하세요.');
  process.exit(1);
}

// 보관 플러그인은 접두가 붙은 열쇠와 네이티브 호출 이름을 쓴다. 앱이 부르는 것과 같은 자리다.
const script = `
  (async () => {
    const { SecureStorage, Preferences } = window.Capacitor.Plugins;

    await SecureStorage.internalSetItem({
      prefixedKey: 'capacitor-storage_device-token',
      data: ${JSON.stringify(token)},
      sync: false,
      access: 0,
    });

    const workers = [];
    for (let page = 0; ; page += 1) {
      const query = 'plantId=${plantId}&includeInactive=false&page=' + page + '&size=100';
      const body = await fetch(${JSON.stringify(apiBaseUrl)} + '/mdm/workers?' + query)
        .then((response) => response.json());

      for (const worker of body.items) {
        workers.push({ workerNo: worker.workerNo, workerName: worker.workerName });
      }

      if (body.items.length === 0 || workers.length >= body.page.total) break;
    }

    await Preferences.set({ key: 'worker-directory', value: JSON.stringify(workers) });
    return 'ok:' + workers.length;
  })().catch((error) => '실패: ' + error.message)
`;

const socket = new WebSocket(target.webSocketDebuggerUrl);

const result = await new Promise((resolve, reject) => {
  socket.addEventListener('open', () => {
    socket.send(
      JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: script, awaitPromise: true, returnByValue: true },
      }),
    );
  });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);

    if (message.id === 1) {
      resolve(message.result?.result?.value ?? JSON.stringify(message.result));
      socket.close();
    }
  });

  socket.addEventListener('error', reject);
  setTimeout(() => {
    reject(new Error('시간 초과'));
  }, 20000);
});

if (!String(result).startsWith('ok')) {
  console.error(result);
  process.exit(1);
}

console.log(`작업자 명부 ${String(result).split(':')[1]}명`);
