package com.device.manager;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.Uri;
import android.net.http.SslCertificate;
import android.net.http.SslError;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import java.security.MessageDigest;

/**
 * 设备管理器 - Android APK 封装
 *
 * 以 WebView 加载局域网内的设备管理器服务器（https://<服务器IP>:8000），
 * 每次启动弹出确认框核对/修改服务器地址，退出时再次确认。
 */
public class MainActivity extends Activity {

    private static final String PREFS_NAME = "device_manager_prefs";
    private static final String KEY_SERVER_URL = "server_url";
    /** 每个主机记住一张已确认的自签名证书指纹（TOFU） */
    private static final String KEY_TRUSTED_CERT_PREFIX = "trusted_cert_";

    private WebView webView;
    private ProgressBar progressBar;
    private TextView errorView;
    private FrameLayout container;
    private SharedPreferences prefs;
    // 防止同一次加载失败重复弹出服务器设置框
    private boolean serverDialogShown;
    // 当前显示的对话框，防止错误回调在弹窗之上再叠弹窗
    private AlertDialog activeDialog;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        buildUi();
        // 每次启动都确认服务器地址，可在此修改后连接
        showServerDialog(true);
    }

    private void buildUi() {
        container = new FrameLayout(this);

        // WebView
        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        // 让手机浏览器能识别触屏设备（版本号来自 BuildConfig，与 gradle 保持同步）
        s.setUserAgentString(s.getUserAgentString() + " DeviceManagerApp/" + BuildConfig.VERSION_NAME);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                serverDialogShown = false;
                progressBar.setVisibility(View.VISIBLE);
                progressBar.setProgress(0);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
                errorView.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                // 主框架加载失败才提示（避免子资源错误误报）
                if (request != null && request.isForMainFrame()) {
                    progressBar.setVisibility(View.GONE);
                    errorView.setVisibility(View.VISIBLE);
                    // 连接失败直接跳到服务器地址设置界面
                    showErrorServerDialog();
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
                // 服务器可达但返回 4xx/5xx 时 onReceivedError 不会触发，需单独处理
                if (request != null && request.isForMainFrame()
                        && errorResponse != null && errorResponse.getStatusCode() >= 400) {
                    progressBar.setVisibility(View.GONE);
                    errorView.setVisibility(View.VISIBLE);
                    showErrorServerDialog(errorResponse.getStatusCode());
                }
            }

            @Override
            public void onReceivedSslError(WebView view, final SslErrorHandler handler, SslError error) {
                // 内网服务器用自签名证书：系统无法验证，需人工核对指纹后放行
                final String host = error != null ? hostOf(error.getUrl()) : "";
                final String fingerprint = error != null ? certFingerprint(error.getCertificate()) : "";
                String trusted = host.isEmpty() ? ""
                        : prefs.getString(KEY_TRUSTED_CERT_PREFIX + host, "");
                if (!fingerprint.isEmpty() && fingerprint.equals(trusted)) {
                    handler.proceed();
                    return;
                }
                progressBar.setVisibility(View.GONE);
                showCertTrustDialog(handler, host, fingerprint, error);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
            }
        });

        // 进度条
        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setProgressTintList(android.content.res.ColorStateList.valueOf(0xFF2563EB));
        progressBar.setVisibility(View.GONE);

        // 错误提示
        errorView = new TextView(this);
        errorView.setText(R.string.load_failed);
        errorView.setTextSize(16);
        errorView.setTextColor(0xFF6B7280);
        errorView.setGravity(android.view.Gravity.CENTER);
        errorView.setVisibility(View.GONE);
        errorView.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                reloadCurrent();
            }
        });

        container.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        container.addView(progressBar, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, 8, android.view.Gravity.TOP));
        container.addView(errorView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        setContentView(container);
    }

    private String normalizeUrl(String raw) {
        String u = raw.trim();
        if (!u.startsWith("http://") && !u.startsWith("https://")) {
            u = "https://" + u;
        }
        if (u.startsWith("http://")) {
            u = "https://" + u.substring("http://".length());
        }
        // 只填 IP 时补默认端口，否则会去连 443
        Uri parsed = Uri.parse(u);
        String host = parsed.getHost();
        if (parsed.getPort() == -1 && host != null && !host.isEmpty()) {
            String path = parsed.getPath();
            u = "https://" + host + ":8000" + (path == null ? "" : path);
        }
        return u;
    }

    private void loadUrl(String url) {
        errorView.setVisibility(View.GONE);
        webView.loadUrl(url);
    }

    private void reloadCurrent() {
        if (webView.getUrl() != null) {
            loadUrl(webView.getUrl());
        } else {
            String saved = prefs.getString(KEY_SERVER_URL, "");
            if (saved != null && !saved.trim().isEmpty()) {
                loadUrl(normalizeUrl(saved.trim()));
            } else {
                showServerDialog(true);
            }
        }
    }

    private void showErrorServerDialog() {
        showErrorServerDialog(-1);
    }

    private String hostOf(String url) {
        if (url == null) {
            return "";
        }
        try {
            String host = Uri.parse(url).getHost();
            return host == null ? "" : host;
        } catch (Exception e) {
            return "";
        }
    }

    /** 取服务器证书的 SHA-256 指纹（大写冒号分隔），取不到则返回空串。 */
    private String certFingerprint(SslCertificate cert) {
        if (cert == null) {
            return "";
        }
        try {
            Bundle state = SslCertificate.saveState(cert);
            byte[] der = state == null ? null : state.getByteArray("x509-certificate");
            if (der == null || der.length == 0) {
                return "";
            }
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(der);
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                if (sb.length() > 0) {
                    sb.append(':');
                }
                sb.append(String.format("%02X", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    private void showCertTrustDialog(final SslErrorHandler handler, final String host,
                                     final String fingerprint, final SslError error) {
        if (isFinishing() || isDestroyed()) {
            handler.cancel();
            return;
        }
        String issuedTo = "";
        String issuedBy = "";
        try {
            SslCertificate cert = error == null ? null : error.getCertificate();
            if (cert != null && cert.getIssuedTo() != null) {
                issuedTo = cert.getIssuedTo().getDName();
            }
            if (cert != null && cert.getIssuedBy() != null) {
                issuedBy = cert.getIssuedBy().getDName();
            }
        } catch (Exception ignored) {
        }
        dismissActiveDialog();
        activeDialog = new AlertDialog.Builder(this)
                .setTitle(R.string.ssl_title)
                .setMessage(getString(R.string.ssl_message, host,
                        issuedTo.isEmpty() ? "-" : issuedTo,
                        issuedBy.isEmpty() ? "-" : issuedBy,
                        fingerprint.isEmpty() ? "-" : fingerprint))
                .setCancelable(false)
                .setNegativeButton(R.string.cancel, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int w) {
                        handler.cancel();
                    }
                })
                .setPositiveButton(R.string.ssl_trust, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int w) {
                        if (!host.isEmpty() && !fingerprint.isEmpty()) {
                            prefs.edit()
                                    .putString(KEY_TRUSTED_CERT_PREFIX + host, fingerprint)
                                    .apply();
                        }
                        handler.proceed();
                    }
                })
                .show();
    }

    private void showErrorServerDialog(int httpStatusCode) {
        if (serverDialogShown || isFinishing() || isDestroyed()) {
            return;
        }
        serverDialogShown = true;
        if (httpStatusCode >= 400) {
            Toast.makeText(this, getString(R.string.load_http_error, httpStatusCode), Toast.LENGTH_LONG).show();
        } else {
            Toast.makeText(this, R.string.load_failed, Toast.LENGTH_LONG).show();
        }
        showServerDialog(false);
    }

    private void dismissActiveDialog() {
        if (activeDialog != null) {
            if (activeDialog.isShowing()) {
                activeDialog.dismiss();
            }
            activeDialog = null;
        }
    }

    private void showServerDialog(final boolean isFirst) {
        if (isFinishing() || isDestroyed()) {
            return;
        }
        dismissActiveDialog();

        final EditText input = new EditText(this);
        input.setHint(R.string.server_url_hint);
        input.setSingleLine(true);
        String current = prefs.getString(KEY_SERVER_URL, "");
        input.setText(current != null && !current.isEmpty() ? current : getString(R.string.default_url));
        input.setSelection(input.getText().length());

        LinearLayout wrap = new LinearLayout(this);
        int pad = (int) (20 * getResources().getDisplayMetrics().density);
        wrap.setPadding(pad, pad / 2, pad, 0);
        wrap.addView(input, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        activeDialog = new AlertDialog.Builder(this)
                .setTitle(isFirst ? R.string.confirm_server_title : R.string.settings)
                .setView(wrap)
                .setCancelable(false)
                .setNegativeButton(R.string.exit, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int w) {
                        if (isFirst) {
                            finish();
                        } else {
                            d.dismiss();
                        }
                    }
                })
                .setPositiveButton(R.string.save, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int w) {
                        String url = input.getText().toString().trim();
                        if (url.isEmpty()) {
                            Toast.makeText(MainActivity.this, R.string.server_url_hint, Toast.LENGTH_SHORT).show();
                            showServerDialog(isFirst);
                            return;
                        }
                        String normalized;
                        try {
                            normalized = normalizeUrl(url);
                        } catch (IllegalArgumentException e) {
                            Toast.makeText(MainActivity.this, e.getMessage(), Toast.LENGTH_SHORT).show();
                            showServerDialog(isFirst);
                            return;
                        }
                        prefs.edit().putString(KEY_SERVER_URL, normalized).apply();
                        loadUrl(normalized);
                    }
                })
                .show();
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        menu.add(0, 1, 0, R.string.settings);
        menu.add(0, 2, 0, R.string.refresh);
        menu.add(0, 3, 0, R.string.exit);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        switch (item.getItemId()) {
            case 1:
                showServerDialog(false);
                return true;
            case 2:
                reloadCurrent();
                return true;
            case 3:
                showExitConfirm();
                return true;
        }
        return super.onOptionsItemSelected(item);
    }

    private void showExitConfirm() {
        if (isFinishing() || isDestroyed()) {
            return;
        }
        dismissActiveDialog();

        String saved = prefs.getString(KEY_SERVER_URL, "");
        String url = (saved != null && !saved.trim().isEmpty()) ? normalizeUrl(saved.trim()) : getString(R.string.default_url);
        activeDialog = new AlertDialog.Builder(this)
                .setTitle(R.string.exit_confirm_title)
                .setMessage(getString(R.string.exit_confirm_msg, url))
                .setCancelable(true)
                .setNegativeButton(R.string.cancel, null)
                .setNeutralButton(R.string.change_server, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int w) {
                        showServerDialog(false);
                    }
                })
                .setPositiveButton(R.string.confirm_exit, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int w) {
                        finish();
                    }
                })
                .show();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        // 返回键优先回退网页历史，无法回退时弹出退出确认
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (webView.canGoBack()) {
                webView.goBack();
            } else {
                showExitConfirm();
            }
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        dismissActiveDialog();
        if (webView != null) {
            webView.stopLoading();
            container.removeView(webView);
            webView.destroy();
        }
        super.onDestroy();
    }
}
