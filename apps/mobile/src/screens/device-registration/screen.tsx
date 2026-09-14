import { AlertBanner, Button, Card, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import { readDeviceModel } from '../../patterns/device-model';
import { LocalNetworkNotice } from '../../patterns/local-network';
import { useScreenTitle } from '../../patterns/screen-title';
import type { QrCamera } from '../../patterns/qr-camera';
import { useRegistrationFlow } from './registration';
import './screen.css';

const t = messages.deviceRegistration;

const DeviceInfo = () => {
  const { model, platform } = readDeviceModel(navigator.userAgent);
  const parts = [model, platform].filter((part) => part !== null);

  return (
    <section className="device-registration__info">
      <h2>{t.device.label}</h2>
      <p>{parts.length === 0 ? t.device.unknown : parts.join(' · ')}</p>
    </section>
  );
};

/**
 * 미리보기는 웹 화면 뒤에 그려진다. 이 자리를 비워 두지 않으면 카메라가 켜져 있어도
 * 아무것도 보이지 않아, 작업자는 기기가 멈춘 것으로 읽는다.
 */
const CameraWindow = ({ scanning }: { scanning: boolean }) => (
  <div className="device-registration__viewfinder" data-open={scanning}>
    {scanning ? null : <p>{t.camera.preparing}</p>}
  </div>
);

export const DeviceRegistrationScreen = ({ camera }: { camera?: QrCamera }) => {
  useScreenTitle(t.title, { compact: true });
  const { phase, terminal, retry, submitCode, startCamera, showManualEntry, cameraEnabled } =
    useRegistrationFlow({ camera });
  const [code, setCode] = useState('');

  const scanning = phase === 'scanning';

  // 셸이 칠하는 바탕을 걷어야 그 뒤의 미리보기가 보인다. 화면을 떠나면 되돌린다.
  useEffect(() => {
    if (!scanning) {
      return;
    }

    const root = document.documentElement;
    root.classList.add('camera-open');

    return () => {
      root.classList.remove('camera-open');
    };
  }, [scanning]);

  return (
    <div className="device-registration" data-phase={phase}>
      {phase === 'receiving' ? null : (
        <h1 className="device-registration__headline">{t.unregistered.title}</h1>
      )}

      <LocalNetworkNotice />

      {phase === 'offline' ? (
        <AlertBanner
          variant="warning"
          title={t.offline.title}
          action={
            <Button variant="outlined" onClick={retry}>
              {t.retry}
            </Button>
          }
        >
          {t.offline.description}
        </AlertBanner>
      ) : null}

      {phase === 'denied' ? (
        <AlertBanner
          variant="warning"
          title={t.camera.denied}
          action={
            <Button variant="outlined" onClick={retry}>
              {t.retry}
            </Button>
          }
        >
          {t.camera.grant}
        </AlertBanner>
      ) : null}

      {phase === 'unsupported' ? (
        <AlertBanner variant="error" title={t.camera.unsupported} />
      ) : null}

      {phase === 'rejected' ? (
        <AlertBanner variant="error" title={t.rejected.title}>
          {t.rejected.description}
        </AlertBanner>
      ) : null}

      {phase === 'wrong-type' ? (
        <AlertBanner variant="error" title={t.wrongType.title}>
          {t.wrongType.description}
        </AlertBanner>
      ) : null}

      {/* 등록 자체가 맞았는지를 먼저 본다. 기준정보 수신 표시보다 앞에 둔다. */}
      {phase === 'receiving' && terminal !== null ? (
        <AlertBanner variant="success" title={t.registered.title}>
          {/*
            관리자에게 들은 코드와 눈으로 맞춰 보는 값이다. 문장에 묻히지 않게 둔다.
            코드가 안 실려 오면 대조할 것이 없으므로 빈 칸과 안내를 함께 숨긴다.
          */}
          {terminal.terminalCode === null ? null : (
            <>
              <p>
                <strong>{terminal.terminalCode}</strong>
              </p>
              <p>{t.registered.confirm}</p>
            </>
          )}
        </AlertBanner>
      ) : null}

      {phase === 'receiving' ? (
        <AlertBanner variant="info" title={t.receiving.title}>
          {t.receiving.description}
        </AlertBanner>
      ) : null}

      {phase !== 'receiving' && !cameraEnabled ? (
        <form
          className="device-registration__code-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitCode(code);
          }}
        >
          <TextField
            label={t.code.label}
            type="password"
            autoComplete="off"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            fullWidth
          />
          <Button type="submit" disabled={code.trim() === '' || phase === 'offline'}>
            {t.code.submit}
          </Button>
          <p>{t.code.help}</p>
        </form>
      ) : null}

      {phase !== 'receiving' && cameraEnabled ? (
        <Button variant="outlined" onClick={showManualEntry}>
          {t.code.switch}
        </Button>
      ) : null}

      {phase !== 'receiving' && !cameraEnabled ? (
        <Button variant="outlined" disabled={phase === 'offline'} onClick={startCamera}>
          {t.camera.start}
        </Button>
      ) : null}

      {cameraEnabled && (phase === 'preparing' || scanning) ? (
        <>
          <CameraWindow scanning={scanning} />
          <p className="device-registration__guide">{t.unregistered.description}</p>
        </>
      ) : null}

      {/* 받는 중에는 위 등록 표시가 같은 코드를 보인다. 두 번 보이면 어느 쪽을 볼지 갈린다. */}
      {terminal === null || terminal.terminalCode === null || phase === 'receiving' ? null : (
        <Card bordered aria-label={t.terminal.label}>
          <Card.Body className="card-body">
            <p>{`${t.terminal.label} ${terminal.terminalCode}`}</p>
          </Card.Body>
        </Card>
      )}

      <p className="device-registration__where">{t.unregistered.where}</p>
      <DeviceInfo />
    </div>
  );
};
