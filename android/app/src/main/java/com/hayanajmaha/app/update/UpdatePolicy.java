package com.hayanajmaha.app.update;

import java.net.URI;
import java.util.Set;
import java.util.regex.Pattern;

public final class UpdatePolicy {
    public static final long MAX_APK_BYTES = 150L * 1024 * 1024;
    private static final Pattern APK_PATH = Pattern.compile("/tknwlwjyblal/-/[a-f0-9]{40}/downloads/haya-najmaha-debug\\.apk");
    private UpdatePolicy() {}

    public static void validate(String appId, String expectedAppId, long versionCode, String apkUrl, String sha256, long sizeBytes) {
        if (!expectedAppId.equals(appId) || versionCode < 1 || versionCode > Integer.MAX_VALUE) throw new IllegalArgumentException("Invalid app or version");
        URI uri = URI.create(apkUrl);
        if (!"https".equals(uri.getScheme()) || !"raw.githubusercontent.com".equals(uri.getHost()) || uri.getUserInfo() != null || uri.getPort() != -1 || uri.getQuery() != null || uri.getFragment() != null || !APK_PATH.matcher(uri.getPath()).matches()) throw new IllegalArgumentException("Invalid immutable APK URL");
        if (sha256 == null || !sha256.matches("[a-f0-9]{64}")) throw new IllegalArgumentException("Invalid checksum");
        if (sizeBytes <= 0 || sizeBytes > MAX_APK_BYTES) throw new IllegalArgumentException("Invalid APK size");
    }

    public static boolean isNewer(long installed, long candidate) { return candidate > installed; }

    public static boolean sameSigners(Set<String> installed, Set<String> candidate) {
        return !installed.isEmpty() && installed.equals(candidate);
    }
}
