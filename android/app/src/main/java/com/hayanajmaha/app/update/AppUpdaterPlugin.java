package com.hayanajmaha.app.update;

import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static final String FEED = "https://raw.githubusercontent.com/tknwlwjyblal/-/main/downloads/latest.json";
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private volatile Manifest checked;
    private volatile Manifest prepared;
    private volatile boolean downloading;

    private static final class Manifest {
        long code, size;
        String name, url, hash, notes;
    }

    @PluginMethod
    public void checkForUpdate(PluginCall call) {
        worker.execute(() -> {
            try {
                Manifest manifest = fetchManifest();
                checked = manifest;
                JSObject result = new JSObject();
                result.put("available", UpdatePolicy.isNewer(version(installed()), manifest.code));
                result.put("versionCode", manifest.code);
                result.put("versionName", manifest.name);
                result.put("sizeBytes", manifest.size);
                result.put("notes", manifest.notes);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("تعذر فحص التحديثات. تأكد من اتصالك بالإنترنت وحاول مجددًا.", "UPDATE_CHECK_FAILED");
            }
        });
    }

    @PluginMethod
    public synchronized void downloadUpdate(PluginCall call) {
        Manifest manifest = checked;
        if (downloading) { call.reject("تنزيل التحديث جارٍ بالفعل.", "DOWNLOAD_BUSY"); return; }
        if (manifest == null || call.getInt("versionCode", -1).longValue() != manifest.code) { call.reject("أعد فحص الإصدار المتاح للتحديث.", "CHECK_REQUIRED"); return; }
        downloading = true;
        worker.execute(() -> {
            File partial = null;
            try {
                if (!UpdatePolicy.isNewer(version(installed()), manifest.code)) throw new IllegalArgumentException("Not newer");
                File directory = updateDirectory();
                File apk = apkFile(manifest);
                if (apk.exists()) {
                    try { verifyApk(apk, manifest); prepared = manifest; call.resolve(); return; }
                    catch (Exception error) { if (!apk.delete()) throw new IllegalStateException("Cannot replace cached APK"); }
                }
                File[] staleFiles = directory.listFiles();
                if (staleFiles != null) for (File stale : staleFiles) if (!stale.equals(apk)) stale.delete();
                partial = new File(directory, "pending.apk");
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                HttpURLConnection connection = open(manifest.url);
                try {
                    long declared = connection.getContentLengthLong();
                    if (declared >= 0 && declared != manifest.size) throw new IllegalArgumentException("Unexpected length");
                    try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(partial)) {
                        byte[] buffer = new byte[64 * 1024];
                        long downloaded = 0, lastProgress = 0;
                        int count;
                        while ((count = input.read(buffer)) != -1) {
                            downloaded += count;
                            if (downloaded > manifest.size || downloaded > UpdatePolicy.MAX_APK_BYTES) throw new IllegalArgumentException("Download too large");
                            output.write(buffer, 0, count); digest.update(buffer, 0, count);
                            long now = System.currentTimeMillis();
                            if (now - lastProgress > 250 || downloaded == manifest.size) {
                                JSObject progress = new JSObject(); progress.put("bytes", downloaded); progress.put("total", manifest.size);
                                notifyListeners("downloadProgress", progress); lastProgress = now;
                            }
                        }
                        output.getFD().sync();
                        if (downloaded != manifest.size || !hex(digest.digest()).equals(manifest.hash)) throw new IllegalArgumentException("Checksum mismatch");
                    }
                } finally { connection.disconnect(); }
                verifyApk(partial, manifest);
                if (!partial.renameTo(apk)) throw new IllegalStateException("Cannot finalize APK");
                prepared = manifest;
                call.resolve();
            } catch (Exception error) {
                if (partial != null) partial.delete();
                prepared = null;
                call.reject("تعذر تنزيل التحديث أو التحقق من سلامته. لم يبدأ التثبيت؛ حاول مجددًا.", "UPDATE_DOWNLOAD_FAILED");
            } finally { downloading = false; }
        });
    }

    @PluginMethod
    public void installUpdate(PluginCall call) {
        Manifest manifest = prepared;
        if (manifest == null) { call.reject("نزّل التحديث أولاً.", "DOWNLOAD_REQUIRED"); return; }
        worker.execute(() -> {
            try {
                File apk = apkFile(manifest);
                verifyApk(apk, manifest);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
                    JSObject result = new JSObject(); result.put("status", "permission_required"); call.resolve(result); return;
                }
                getActivity().runOnUiThread(() -> {
                    try {
                        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                        Intent intent = new Intent(Intent.ACTION_VIEW);
                        intent.setDataAndType(uri, "application/vnd.android.package-archive");
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        intent.setClipData(ClipData.newRawUri("تحديث هيا نجمعها", uri));
                        getActivity().startActivity(intent);
                        JSObject result = new JSObject(); result.put("status", "installer_opened"); call.resolve(result);
                    } catch (Exception error) { call.reject("تعذر فتح نافذة تثبيت Android.", "INSTALLER_UNAVAILABLE"); }
                });
            } catch (Exception error) {
                prepared = null;
                call.reject("لم يجتز الملف فحص التحديث. أعد تنزيله وحاول مجددًا.", "UPDATE_VERIFICATION_FAILED");
            }
        });
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName())));
                } else getActivity().startActivity(new Intent(Settings.ACTION_SECURITY_SETTINGS));
                call.resolve();
            } catch (Exception error) { call.reject("افتح إعدادات الهاتف للسماح بالتثبيت من هذا التطبيق.", "SETTINGS_UNAVAILABLE"); }
        });
    }

    private Manifest fetchManifest() throws Exception {
        HttpURLConnection connection = open(FEED + "?check=" + System.currentTimeMillis() / 60000);
        byte[] data;
        try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096]; int count;
            while ((count = input.read(buffer)) != -1) { if (output.size() + count > 65536) throw new IllegalArgumentException("Manifest too large"); output.write(buffer, 0, count); }
            data = output.toByteArray();
        } finally { connection.disconnect(); }
        JSONObject json = new JSONObject(new String(data, java.nio.charset.StandardCharsets.UTF_8));
        if (json.getInt("schemaVersion") != 1) throw new IllegalArgumentException("Unknown schema");
        Manifest manifest = new Manifest();
        manifest.code = json.getLong("versionCode"); manifest.name = json.getString("versionName");
        manifest.url = json.getString("apkUrl"); manifest.hash = json.getString("sha256");
        manifest.size = json.getLong("sizeBytes"); manifest.notes = json.optString("notes", "تحسينات وإصلاحات للتطبيق.");
        if (manifest.name.isEmpty() || manifest.name.length() > 40 || manifest.notes.length() > 2000) throw new IllegalArgumentException("Invalid release details");
        UpdatePolicy.validate(json.getString("appId"), getContext().getPackageName(), manifest.code, manifest.url, manifest.hash, manifest.size);
        return manifest;
    }

    private HttpURLConnection open(String value) throws Exception {
        URL url = new URL(value);
        for (int redirect = 0; redirect < 6; redirect++) {
            if (!"https".equals(url.getProtocol()) || !allowedHost(url.getHost()) || url.getUserInfo() != null || url.getPort() != -1) throw new IllegalArgumentException("Untrusted URL");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(15000); connection.setReadTimeout(30000);
            connection.setInstanceFollowRedirects(false); connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("Cache-Control", "no-cache");
            int status;
            try { status = connection.getResponseCode(); } catch (Exception error) { connection.disconnect(); throw error; }
            if (status == 200) return connection;
            if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                String location = connection.getHeaderField("Location"); connection.disconnect();
                if (location == null) throw new IllegalArgumentException("Missing redirect"); url = new URL(url, location);
            } else { connection.disconnect(); throw new IllegalStateException("HTTP " + status); }
        }
        throw new IllegalArgumentException("Too many redirects");
    }

    private boolean allowedHost(String host) {
        return host.equals("raw.githubusercontent.com") || host.equals("github.com") || host.equals("objects.githubusercontent.com") || host.equals("release-assets.githubusercontent.com");
    }

    private File updateDirectory() throws Exception {
        File directory = new File(getContext().getCacheDir(), "updates");
        if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("Cannot create update cache");
        return directory;
    }
    private File apkFile(Manifest manifest) throws Exception { return new File(updateDirectory(), "update-" + manifest.code + ".apk"); }
    private int signatureFlags() { return Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES; }
    private PackageInfo installed() throws Exception { return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), signatureFlags()); }
    private long version(PackageInfo info) { return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode; }
    private Set<String> signers(PackageInfo info) throws Exception {
        Signature[] signatures = Build.VERSION.SDK_INT >= 28 ? (info.signingInfo == null ? null : info.signingInfo.getApkContentsSigners()) : info.signatures;
        Set<String> hashes = new HashSet<>();
        if (signatures != null) for (Signature signature : signatures) hashes.add(hex(MessageDigest.getInstance("SHA-256").digest(signature.toByteArray())));
        return hashes;
    }
    private void verifyApk(File apk, Manifest manifest) throws Exception {
        if (!apk.isFile() || apk.length() != manifest.size) throw new IllegalArgumentException("Unexpected APK size");
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(apk)) { byte[] buffer = new byte[65536]; int count; while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count); }
        if (!hex(digest.digest()).equals(manifest.hash)) throw new IllegalArgumentException("Checksum mismatch");
        PackageInfo archive = getContext().getPackageManager().getPackageArchiveInfo(apk.getAbsolutePath(), signatureFlags());
        PackageInfo current = installed();
        if (archive == null || !getContext().getPackageName().equals(archive.packageName) || version(archive) != manifest.code || !UpdatePolicy.isNewer(version(current), version(archive)) || !UpdatePolicy.sameSigners(signers(current), signers(archive))) throw new IllegalArgumentException("APK identity, version or signature mismatch");
    }
    private static String hex(byte[] value) { StringBuilder result = new StringBuilder(); for (byte item : value) result.append(String.format(java.util.Locale.ROOT, "%02x", item & 255)); return result.toString(); }
    @Override protected void handleOnDestroy() { worker.shutdownNow(); super.handleOnDestroy(); }
}
