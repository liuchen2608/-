package com.daxiangabao.health;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.AlarmClock;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.inputmethod.InputMethodManager;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.TimePicker;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private static final String HOME_URL = "https://daxiang-abao-health.caokhoiq2.chatgpt.site/";
    private static final int INK = Color.rgb(31, 25, 20);
    private static final int MUTED = Color.rgb(105, 95, 83);
    private static final int PAPER = Color.rgb(242, 234, 223);
    private static final int CARD = Color.rgb(255, 250, 242);
    private static final int BROWN = Color.rgb(131, 91, 47);
    private static final int GREEN = Color.rgb(49, 112, 86);
    private static final int LINE = Color.rgb(211, 199, 181);
    private WebView websiteView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWindow();
        route(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        route(intent);
    }

    private void configureWindow() {
        Window window = getWindow();
        window.setStatusBarColor(PAPER);
        window.setNavigationBarColor(PAPER);
        window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
    }

    private void route(Intent intent) {
        Uri link = intent.getData();
        if (Intent.ACTION_VIEW.equals(intent.getAction()) && link != null && "daxiangabao".equals(link.getScheme())) {
            handleAlarmLink(link);
            return;
        }
        showHome();
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
        createAlarm(hour, minute, title);
    }

    private void showHome() {
        releaseWebsiteView();
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(PAPER);

        LinearLayout root = column();
        root.setPadding(dp(22), dp(24), dp(22), dp(36));
        scroll.addView(root, matchWrap());

        root.addView(brand());
        root.addView(space(22));
        root.addView(heroCard());
        root.addView(space(16));
        root.addView(alarmCard());
        root.addView(space(16));
        root.addView(helpCard());

        setContentView(scroll);
    }

    private View brand() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);

        TextView mark = text("象", 22, Color.WHITE, Typeface.BOLD);
        mark.setGravity(Gravity.CENTER);
        mark.setBackground(round(GREEN, 18));
        row.addView(mark, new LinearLayout.LayoutParams(dp(48), dp(48)));

        LinearLayout names = column();
        names.setPadding(dp(13), 0, 0, 0);
        names.addView(text("大象阿宝", 22, INK, Typeface.BOLD));
        TextView sub = text("健康生活助手", 13, MUTED, Typeface.NORMAL);
        sub.setPadding(0, dp(2), 0, 0);
        names.addView(sub);
        row.addView(names, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        TextView badge = text("手机端", 12, BROWN, Typeface.BOLD);
        badge.setGravity(Gravity.CENTER);
        badge.setBackground(stroke(Color.TRANSPARENT, LINE, 999));
        badge.setPadding(dp(12), dp(7), dp(12), dp(7));
        row.addView(badge);
        return row;
    }

    private View heroCard() {
        LinearLayout card = card();
        TextView eyebrow = text("今天从一件小事开始", 13, BROWN, Typeface.BOLD);
        eyebrow.setLetterSpacing(0.06f);
        card.addView(eyebrow);

        TextView title = text("你好，\n我是阿宝", 38, INK, Typeface.BOLD);
        title.setLineSpacing(0, 0.96f);
        title.setPadding(0, dp(12), 0, 0);
        card.addView(title);

        TextView body = text("把饮食、作息、运动和日常习惯整理成今天就能开始的小行动。", 16, MUTED, Typeface.NORMAL);
        body.setLineSpacing(dp(5), 1f);
        body.setPadding(0, dp(12), 0, dp(22));
        card.addView(body);

        Button openHome = button("进入大象阿宝主页  →", BROWN, Color.WHITE);
        openHome.setOnClickListener(view -> showWebsiteInApp());
        card.addView(openHome, matchHeight(dp(52)));
        return card;
    }

    private View alarmCard() {
        LinearLayout card = card();
        LinearLayout heading = new LinearLayout(this);
        heading.setOrientation(LinearLayout.HORIZONTAL);
        heading.setGravity(Gravity.CENTER_VERTICAL);
        heading.addView(text("◷", 25, BROWN, Typeface.NORMAL));
        TextView title = text("快速设置闹钟", 21, INK, Typeface.BOLD);
        title.setPadding(dp(8), 0, 0, 0);
        heading.addView(title);
        card.addView(heading);

        TextView note = text("输入任务，选择时间，然后到系统闹钟中确认保存。", 14, MUTED, Typeface.NORMAL);
        note.setLineSpacing(dp(3), 1f);
        note.setPadding(0, dp(8), 0, dp(16));
        card.addView(note);

        EditText task = new EditText(this);
        task.setTextSize(16);
        task.setTextColor(INK);
        task.setHintTextColor(Color.rgb(145, 135, 123));
        task.setHint("例如：晚上10点去散步");
        task.setSingleLine(true);
        task.setPadding(dp(14), 0, dp(14), 0);
        task.setBackground(stroke(Color.rgb(250, 245, 237), LINE, 12));
        card.addView(task, matchHeight(dp(52)));

        TimePicker picker = new TimePicker(this);
        picker.setIs24HourView(true);
        picker.setPadding(0, dp(8), 0, dp(8));
        card.addView(picker, matchWrap());

        Button create = button("设置系统闹钟", GREEN, Color.WHITE);
        create.setOnClickListener(view -> {
            hideKeyboard(task);
            String taskTitle = task.getText().toString().trim();
            if (taskTitle.isEmpty()) {
                task.setError("请先输入任务名称");
                task.requestFocus();
                return;
            }
            createAlarm(picker.getHour(), picker.getMinute(), taskTitle);
        });
        card.addView(create, matchHeight(dp(52)));

        Button show = button("查看我的闹钟", Color.TRANSPARENT, BROWN);
        show.setBackground(stroke(Color.TRANSPARENT, LINE, 14));
        LinearLayout.LayoutParams showParams = matchHeight(dp(48));
        showParams.topMargin = dp(10);
        show.setLayoutParams(showParams);
        show.setOnClickListener(view -> openClock(new Intent(AlarmClock.ACTION_SHOW_ALARMS), "无法打开系统闹钟列表"));
        card.addView(show);
        return card;
    }

    private View helpCard() {
        LinearLayout card = card();
        card.setBackground(stroke(Color.rgb(229, 219, 203), LINE, 18));
        card.addView(text("网页任务也能连接闹钟", 17, INK, Typeface.BOLD));
        TextView body = text("在网页的“习惯计划”里，为“晚上10点去散步”这类带时间的任务打开闹钟开关，本助手会自动接收任务和时间。", 14, MUTED, Typeface.NORMAL);
        body.setLineSpacing(dp(4), 1f);
        body.setPadding(0, dp(8), 0, 0);
        card.addView(body);
        return card;
    }

    private void createAlarm(int hour, int minute, String title) {
        Intent alarm = new Intent(AlarmClock.ACTION_SET_ALARM)
                .putExtra(AlarmClock.EXTRA_HOUR, hour)
                .putExtra(AlarmClock.EXTRA_MINUTES, minute)
                .putExtra(AlarmClock.EXTRA_MESSAGE, "大象阿宝 · " + title)
                .putExtra(AlarmClock.EXTRA_VIBRATE, true)
                .putExtra(AlarmClock.EXTRA_SKIP_UI, false);
        openClock(alarm, "手机中没有可处理闹钟的应用");
    }

    private void showWebsiteInApp() {
        LinearLayout shell = column();
        shell.setBackgroundColor(PAPER);

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(10), dp(8), dp(10), dp(8));
        toolbar.setBackgroundColor(CARD);

        Button back = button("‹", Color.TRANSPARENT, INK);
        back.setTextSize(28);
        back.setOnClickListener(view -> showHome());
        toolbar.addView(back, new LinearLayout.LayoutParams(dp(50), dp(48)));

        TextView title = text("大象阿宝", 18, INK, Typeface.BOLD);
        title.setGravity(Gravity.CENTER_VERTICAL);
        title.setPadding(dp(8), 0, dp(8), 0);
        toolbar.addView(title, new LinearLayout.LayoutParams(0, dp(48), 1f));

        Button refresh = button("刷新", Color.TRANSPARENT, BROWN);
        refresh.setTextSize(13);
        refresh.setOnClickListener(view -> {
            if (websiteView != null) websiteView.reload();
        });
        toolbar.addView(refresh, new LinearLayout.LayoutParams(dp(68), dp(48)));
        shell.addView(toolbar, matchWrap());

        websiteView = new WebView(this);
        websiteView.setBackgroundColor(PAPER);
        WebSettings settings = websiteView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) settings.setSafeBrowsingEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(websiteView, true);
        websiteView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleWebsiteNavigation(request.getUrl().toString());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleWebsiteNavigation(url);
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
                super.onReceivedHttpError(view, request, errorResponse);
                if (request.isForMainFrame() && errorResponse.getStatusCode() == 403) {
                    view.stopLoading();
                    view.post(() -> showWebsiteBlocked());
                }
            }
        });
        shell.addView(websiteView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(shell);
        websiteView.loadUrl(HOME_URL);
    }

    private void showWebsiteBlocked() {
        releaseWebsiteView();
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(PAPER);

        LinearLayout root = column();
        root.setPadding(dp(22), dp(24), dp(22), dp(36));
        root.addView(brand());
        root.addView(space(22));

        LinearLayout card = card();
        TextView eyebrow = text("连接提示", 13, BROWN, Typeface.BOLD);
        eyebrow.setLetterSpacing(0.06f);
        card.addView(eyebrow);

        TextView title = text("网页安全验证未通过", 28, INK, Typeface.BOLD);
        title.setPadding(0, dp(12), 0, 0);
        card.addView(title);

        TextView body = text("线上安全服务拒绝了应用内页面请求。你的闹钟和手机主页仍可继续使用；可以稍后重试，或由你主动选择系统浏览器打开完整网页。", 16, MUTED, Typeface.NORMAL);
        body.setLineSpacing(dp(5), 1f);
        body.setPadding(0, dp(12), 0, dp(22));
        card.addView(body);

        Button retry = button("重新尝试", GREEN, Color.WHITE);
        retry.setOnClickListener(view -> showWebsiteInApp());
        card.addView(retry, matchHeight(dp(52)));

        Button browser = button("使用系统浏览器打开", Color.TRANSPARENT, BROWN);
        browser.setBackground(stroke(Color.TRANSPARENT, LINE, 14));
        LinearLayout.LayoutParams browserParams = matchHeight(dp(50));
        browserParams.topMargin = dp(10);
        browser.setLayoutParams(browserParams);
        browser.setOnClickListener(view -> openWebsiteInBrowser());
        card.addView(browser);

        Button home = button("返回手机主页", Color.TRANSPARENT, MUTED);
        LinearLayout.LayoutParams homeParams = matchHeight(dp(48));
        homeParams.topMargin = dp(6);
        home.setLayoutParams(homeParams);
        home.setOnClickListener(view -> showHome());
        card.addView(home);

        root.addView(card);
        scroll.addView(root, matchWrap());
        setContentView(scroll);
    }

    private void openWebsiteInBrowser() {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(HOME_URL)));
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, "手机中没有可打开网页的浏览器", Toast.LENGTH_LONG).show();
        }
    }

    private boolean handleWebsiteNavigation(String target) {
        try {
            if (target.startsWith("intent://")) {
                Intent parsed = Intent.parseUri(target, Intent.URI_INTENT_SCHEME);
                Uri link = parsed.getData();
                if (link != null && "daxiangabao".equals(link.getScheme())) handleAlarmLink(link);
                else Toast.makeText(this, "不支持打开这个外部链接", Toast.LENGTH_LONG).show();
                return true;
            }
            Uri link = Uri.parse(target);
            if ("daxiangabao".equals(link.getScheme())) {
                handleAlarmLink(link);
                return true;
            }
            return !("http".equals(link.getScheme()) || "https".equals(link.getScheme()));
        } catch (Exception error) {
            Toast.makeText(this, "这个页面暂时无法打开", Toast.LENGTH_LONG).show();
            return true;
        }
    }

    private void releaseWebsiteView() {
        if (websiteView == null) return;
        websiteView.stopLoading();
        websiteView.destroy();
        websiteView = null;
    }

    @Override
    public void onBackPressed() {
        if (websiteView != null && websiteView.canGoBack()) {
            websiteView.goBack();
            return;
        }
        if (websiteView != null) {
            showHome();
            return;
        }
        super.onBackPressed();
    }

    private void openClock(Intent intent, String errorMessage) {
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException error) {
            showError(errorMessage);
        }
    }

    private void showError(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(PAPER);
        LinearLayout root = column();
        root.setGravity(Gravity.CENTER_VERTICAL);
        root.setPadding(dp(28), dp(40), dp(28), dp(40));
        root.addView(text("没有创建闹钟", 26, INK, Typeface.BOLD));
        TextView body = text(message, 17, MUTED, Typeface.NORMAL);
        body.setPadding(0, dp(12), 0, dp(24));
        root.addView(body);
        Button back = button("返回手机主页", BROWN, Color.WHITE);
        back.setOnClickListener(view -> showHome());
        root.addView(back, matchHeight(dp(52)));
        scroll.addView(root, matchMatch());
        setContentView(scroll);
    }

    private LinearLayout card() {
        LinearLayout card = column();
        card.setPadding(dp(20), dp(22), dp(20), dp(22));
        card.setBackground(round(CARD, 20));
        card.setElevation(dp(2));
        return card;
    }

    private LinearLayout column() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        return layout;
    }

    private Button button(String label, int background, int foreground) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(16);
        button.setTextColor(foreground);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setAllCaps(false);
        button.setGravity(Gravity.CENTER);
        button.setPadding(dp(16), 0, dp(16), 0);
        button.setBackground(round(background, 14));
        button.setStateListAnimator(null);
        return button;
    }

    private TextView text(String content, int size, int color, int style) {
        TextView view = new TextView(this);
        view.setText(content);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setTypeface(Typeface.DEFAULT, style);
        return view;
    }

    private View space(int height) {
        View view = new View(this);
        view.setLayoutParams(new LinearLayout.LayoutParams(1, dp(height)));
        return view;
    }

    private GradientDrawable round(int color, int radius) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radius));
        return drawable;
    }

    private GradientDrawable stroke(int color, int strokeColor, int radius) {
        GradientDrawable drawable = round(color, radius);
        drawable.setStroke(dp(1), strokeColor);
        return drawable;
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    private LinearLayout.LayoutParams matchHeight(int height) {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, height);
    }

    private LinearLayout.LayoutParams matchMatch() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
    }

    private void hideKeyboard(View view) {
        InputMethodManager keyboard = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (keyboard != null) keyboard.hideSoftInputFromWindow(view.getWindowToken(), 0);
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
