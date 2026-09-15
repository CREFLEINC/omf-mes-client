package com.crefle.omfmes.mobile;

import android.Manifest;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * 사내망 서버에 닿기 위한 로컬 네트워크 권한.
 *
 * targetSdk 37 앱은 이 권한이 런타임에 허용되지 않으면 사설 주소(사내망 API 서버)로 연결이
 * 시간 초과로 끝난다 — 인터넷은 되는데 서버만 안 닿는다(REG-ALL-01 N15). manifest 선언만으로는
 * 열리지 않는다.
 *
 * Capacitor 에는 임의의 런타임 권한을 묻는 공용 API 가 없어 여기서 연다.
 */
@CapacitorPlugin(
    name = "LocalNetwork",
    permissions = { @Permission(alias = LocalNetworkPlugin.ALIAS, strings = { Manifest.permission.ACCESS_LOCAL_NETWORK }) }
)
public class LocalNetworkPlugin extends Plugin {

    static final String ALIAS = "localNetwork";

    /** 이 권한이 생긴 API 수준(Android 17). 그 아래에서는 제한 자체가 없다. */
    private static final int LOCAL_NETWORK_PERMISSION_SDK = 37;

    @Override
    @PluginMethod
    public void checkPermissions(PluginCall call) {
        call.resolve(result(currentState()));
    }

    @Override
    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (!isEnforced() || getPermissionState(ALIAS) == PermissionState.GRANTED) {
            call.resolve(result(currentState()));
            return;
        }
        requestPermissionForAlias(ALIAS, call, "onPermissionResult");
    }

    @PermissionCallback
    private void onPermissionResult(PluginCall call) {
        call.resolve(result(currentState()));
    }

    private boolean isEnforced() {
        return Build.VERSION.SDK_INT >= LOCAL_NETWORK_PERMISSION_SDK;
    }

    /* 제한이 없는 기기에서는 묻지 않고 허용으로 답한다 — 없는 권한을 물으면 거절로 돌아온다. */
    private PermissionState currentState() {
        return isEnforced() ? getPermissionState(ALIAS) : PermissionState.GRANTED;
    }

    private static JSObject result(PermissionState state) {
        JSObject out = new JSObject();
        out.put(ALIAS, state.toString());
        return out;
    }
}
