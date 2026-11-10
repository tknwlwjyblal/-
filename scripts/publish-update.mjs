#!/usr/bin/env node
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifact = 'downloads/haya-najmaha-debug.apk';
const feedFile = path.join(root, 'downloads/latest.json');
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const notesIndex = args.indexOf('--notes');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
try {
  const sdk = process.env.ANDROID_HOME || '/workspace/android-sdk';
  const directories = (await readdir(path.join(sdk, 'build-tools'))).sort((a,b) => b.localeCompare(a, undefined, { numeric: true }));
  const tools = directories.map(item => path.join(sdk, 'build-tools', item)).find(item => existsSync(path.join(item, 'aapt2')) && existsSync(path.join(item, 'apksigner')));
  if (!tools) throw new Error('Android build tools are required to validate the APK.');
  const apkPath = path.join(root, artifact);
  const signatureReport = execFileSync(path.join(tools, 'apksigner'), ['verify', '--print-certs', apkPath], { encoding: 'utf8' });
  const expectedCertificate = (await readFile(path.join(root, 'downloads/SIGNING_CERT_SHA256'), 'utf8')).trim();
  const certificates = [...signatureReport.matchAll(/Signer #\d+ certificate SHA-256 digest: ([a-f0-9]+)/g)].map(match => match[1]);
  if (certificates.length !== 1 || certificates[0] !== expectedCertificate) throw new Error('APK is not signed with the existing distribution certificate.');
  const badging = execFileSync(path.join(tools, 'aapt2'), ['dump', 'badging', apkPath], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  const packageLine = badging.match(/package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/);
  if (!packageLine || packageLine[1] !== 'com.hayanajmaha.app') throw new Error('Unexpected APK package.');
  const bytes = await readFile(apkPath);
  if (bytes.length === 0 || bytes.length > 150 * 1024 * 1024) throw new Error('APK exceeds the supported update size.');
  const hash = createHash('sha256').update(bytes).digest('hex');
  const commit = git('rev-parse', 'HEAD');
  const committedBlob = git('rev-parse', `${commit}:${artifact}`);
  if (committedBlob !== git('hash-object', artifact)) throw new Error('Commit the freshly built APK before publishing update metadata.');
  const versionCode = Number(packageLine[2]), versionName = packageLine[3];
  if (!Number.isInteger(versionCode) || versionCode < 1 || versionCode > 2147483647) throw new Error('Unsupported versionCode.');
  const gradle = await readFile(path.join(root, 'android/app/build.gradle'), 'utf8');
  if (Number(gradle.match(/versionCode\s+(\d+)/)?.[1]) !== versionCode || gradle.match(/versionName\s+"([^"]+)"/)?.[1] !== versionName) throw new Error('APK version does not match Android source.');
  const manifest = { schemaVersion: 1, appId: packageLine[1], versionCode, versionName, apkUrl: `https://raw.githubusercontent.com/tknwlwjyblal/-/${commit}/${artifact}`, sha256: hash, sizeBytes: bytes.length, notes: notesIndex >= 0 ? args[notesIndex + 1] : 'تحسينات وإصلاحات للتطبيق.' };
  if (!manifest.notes || manifest.notes.length > 2000) throw new Error('Release notes must contain 1–2000 characters.');
  if (checkOnly) {
    const saved = JSON.parse(await readFile(feedFile, 'utf8'));
    const target = saved.apkUrl?.match(/^https:\/\/raw\.githubusercontent\.com\/tknwlwjyblal\/-\/([a-f0-9]{40})\/downloads\/haya-najmaha-debug\.apk$/)?.[1];
    if (!target || git('rev-parse', `${target}:${artifact}`) !== committedBlob) throw new Error('Feed does not reference the committed artifact.');
    for (const key of ['schemaVersion','appId','versionCode','versionName','sha256','sizeBytes']) if (saved[key] !== manifest[key]) throw new Error(`Feed mismatch: ${key}`);
    console.log(`Verified update feed for ${versionName} (${versionCode}), ${bytes.length} bytes.`);
  } else {
    let previous;
    try { previous = JSON.parse(await readFile(feedFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (previous && previous.versionCode >= versionCode) throw new Error('Increment versionCode and build a new APK before publishing a release.');
    await writeFile(feedFile, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`Prepared update feed for ${versionName} (${versionCode}) pinned to ${commit}. Commit downloads/latest.json and push main to publish.`);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
