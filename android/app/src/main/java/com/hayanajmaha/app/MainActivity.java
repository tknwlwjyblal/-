package com.hayanajmaha.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.hayanajmaha.app.update.AppUpdaterPlugin;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
