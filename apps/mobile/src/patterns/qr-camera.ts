import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

export type CameraPermission = 'granted' | 'denied';

export interface QrCamera {
  /** 이 단말에서 카메라 인식을 쓸 수 있는가. 못 쓰면 화면이 등록 경로를 닫는다. */
  isSupported(): Promise<boolean>;
  requestPermission(): Promise<CameraPermission>;
  /**
   * 미리보기를 열고 코드를 읽을 때마다 onRead 를 부른다. 반환한 함수로 닫는다.
   *
   * 미리보기는 웹 화면 뒤에 그려지므로, 여는 쪽이 그 자리를 비워 두어야 보인다.
   *
   * ⭐ **onError 를 받는다.** 스캐너는 미리보기를 열어 둔 채로 실패할 수 있다 — 듣지 않으면
   * 작업자에게는 「비추고 있는데 아무 일도 안 일어난다」로만 보이고, 무엇이 잘못됐는지 아무도
   * 알 수 없다(#1103).
   */
  open(
    onRead: (value: string) => void,
    onError?: (message: string) => void,
  ): Promise<() => Promise<void>>;
}

/* 등록 QR 말고 다른 코드가 섞여 들어오면 값이 토큰이 아니게 된다. */
const REGISTRATION_FORMATS = [BarcodeFormat.QrCode];

export const createMlkitQrCamera = (): QrCamera => ({
  isSupported: async () => (await BarcodeScanner.isSupported()).supported,

  requestPermission: async () => {
    const { camera } = await BarcodeScanner.requestPermissions();
    return camera === 'granted' || camera === 'limited' ? 'granted' : 'denied';
  },

  open: async (onRead, onError) => {
    const listener = await BarcodeScanner.addListener('barcodesScanned', (event) => {
      for (const barcode of event.barcodes) {
        // 값을 읽지 못한 코드도 인식 결과로 올라온다.
        if (barcode.rawValue !== undefined && barcode.rawValue !== '') {
          onRead(barcode.rawValue);
        }
      }
    });

    /* 미리보기가 열린 뒤에 나는 실패는 이 통로로만 온다 — 듣지 않으면 화면이 조용하다. */
    const errors = await BarcodeScanner.addListener('scanError', (event) => {
      onError?.(event.message);
    });

    try {
      await BarcodeScanner.startScan({ formats: REGISTRATION_FORMATS });
    } catch (error) {
      // 열지 못했는데 듣는 것만 남으면 다시 시도할 때마다 쌓여 한 번 읽은 것이 여러 번이 된다.
      await listener.remove();
      await errors.remove();
      throw error;
    }

    return async () => {
      await listener.remove();
      await errors.remove();
      await BarcodeScanner.stopScan();
    };
  },
});
