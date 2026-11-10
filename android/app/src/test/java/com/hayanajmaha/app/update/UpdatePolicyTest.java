package com.hayanajmaha.app.update;

import static org.junit.Assert.*;
import java.util.Collections;
import java.util.Set;
import org.junit.Test;

public class UpdatePolicyTest {
    private static final String APP = "com.hayanajmaha.app";
    private static final String URL = "https://raw.githubusercontent.com/tknwlwjyblal/-/0123456789abcdef0123456789abcdef01234567/downloads/haya-najmaha-debug.apk";
    private static final String HASH = "a".repeat(64);
    private void rejected(String app, long code, String url, String hash, long size) {
        assertThrows(IllegalArgumentException.class, () -> UpdatePolicy.validate(app, APP, code, url, hash, size));
    }
    @Test public void acceptsImmutablePublicApk() { UpdatePolicy.validate(APP, APP, 6, URL, HASH, 16000000); }
    @Test public void rejectsMutableBranchAndForeignRepository() {
        rejected(APP, 6, URL.replace("0123456789abcdef0123456789abcdef01234567", "main"), HASH, 10);
        rejected(APP, 6, URL.replace("tknwlwjyblal", "other"), HASH, 10);
    }
    @Test public void rejectsInsecureAndCredentialBearingUrls() {
        rejected(APP, 6, URL.replace("https:", "http:"), HASH, 10);
        rejected(APP, 6, URL.replace("https://", "https://token@"), HASH, 10);
        rejected(APP, 6, URL.replace(".com/", ".com:443/"), HASH, 10);
        rejected(APP, 6, URL + "?token=secret", HASH, 10);
    }
    @Test public void rejectsWrongAppHashAndSizes() {
        rejected("other.app", 6, URL, HASH, 10);
        rejected(APP, 6, URL, "bad", 10);
        rejected(APP, 6, URL, HASH, 0);
        rejected(APP, 6, URL, HASH, UpdatePolicy.MAX_APK_BYTES + 1);
    }
    @Test public void rejectsInvalidVersionCodes() {
        rejected(APP, 0, URL, HASH, 10);
        rejected(APP, 2147483648L, URL, HASH, 10);
    }
    @Test public void neverOffersEqualOrOlderVersions() {
        assertFalse(UpdatePolicy.isNewer(5, 5));
        assertFalse(UpdatePolicy.isNewer(5, 4));
        assertTrue(UpdatePolicy.isNewer(5, 6));
    }
    @Test public void requiresNonemptyExactSigningIdentity() {
        assertFalse(UpdatePolicy.sameSigners(Collections.emptySet(), Collections.emptySet()));
        assertFalse(UpdatePolicy.sameSigners(Set.of("old"), Set.of("other")));
        assertFalse(UpdatePolicy.sameSigners(Set.of("old"), Set.of("old", "extra")));
        assertTrue(UpdatePolicy.sameSigners(Set.of("old"), Set.of("old")));
    }
}
