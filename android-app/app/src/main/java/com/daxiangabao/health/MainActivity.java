package com.daxiangabao.health;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.AlarmClock;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

public final class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Uri link = getIntent().getData();
        if (Intent.ACTION_VIEW.equals(getIntent().getAction()) && link != null) {
            handleAlarmLink(link);
            return;
        }
        showWelcome();
    }

    private void handleAlarmLink(Uri link) {
        String operation = value(link, "operation");
        if ("show".equals(operation)) {
            openClock(new Intent(AlarmClock.ACTION_SHOW_ALARMS), "无法打开系统闹钟列表");
            return;
        }

        int hour = intValue(link, "hour", -1);
        int minute = intValue(link, "minute", -1);
        String title = value(link, "title");
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || title.isEmpty()) {
            showError("任务中没有有效的闹钟时间，请返回网页修改任务标题。");
            return;
        }

        Intent alarm = new Intent(AlarmClock.ACTION_SET_ALARM)
                .putExtra(AlarmClock.EXTRA_HOUR, hour)
                .putExtra(AlarmClock.EXTRA_MINUTES, minute)
                .putExtra(AlarmClock.EXTRA_MESSAGE, "大象阿宝 · " + title)
                .putExtra(AlarmClock.EXTRA_VIBRATE, true)
                .putExtra(AlarmClock.EXTRA_SKIP_UI, false);
        openClock(alarm, "手机中没有可处理闹钟的应用");
    }

    private void openClock(Intent intent, String errorMessage) {
        try {
            startActivity(intent);
            finish();
        } catch (ActivityNotFoundException error) {
            showError(errorMessage);
        }
    }

    private void showWelcome() {
        LinearLayout root = baseLayout();
        root.addView(text("大象阿宝闹钟助手", 26, Color.rgb(34, 28, 22)));
        TextView body = text("安装已经完成。请回到“大象阿宝”网页，在带有明确时间的任务右侧打开闹钟开关。\n\n例如：晚上10点去散步", 17, Color.rgb(101, 91, 79));
        body.setLineSpacing(8, 1f);
        root.addView(body, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        setContentView(root);
    }

    private void showError(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
        LinearLayout root = baseLayout();
        root.addView(text("没有创建闹钟", 24, Color.rgb(34, 28, 22)));
        root.addView(text(message, 17, Color.rgb(101, 91, 79)));
        setContentView(root);
    }

    private LinearLayout baseLayout() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_VERTICAL);
        root.setPadding(dp(28), dp(40), dp(28), dp(40));
        root.setBackgroundColor(Color.rgb(238, 229, 216));
        return root;
    }

    private TextView text(String content, int size, int color) {
        TextView view = new TextView(this);
        view.setText(content);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setPadding(0, 0, 0, dp(24));
        return view;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private static String value(Uri uri, String name) {
        String value = uri.getQueryParameter(name);
        return value == null ? "" : value.trim();
    }

    private static int intValue(Uri uri, String name, int fallback) {
        try {
            return Integer.parseInt(value(uri, name));
        } catch (NumberFormatException error) {
            return fallback;
        }
    }
}
