package com.crefle.omfmes.mobile;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 앱 안에 둔 플러그인은 브리지가 서기 전에 등록해야 화면이 부를 수 있다.
        registerPlugin(LocalNetworkPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
