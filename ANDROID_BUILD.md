# Android Build Checklist — Levonis

A reproducible checklist to build the Android app on **any machine** without
running into Gradle, ProGuard, or Capacitor sync issues.

---

## 1. Prerequisites (install once per machine)

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | 20 LTS or newer | `node -v` |
| **Bun** *(or npm)* | latest | Project uses `bun.lock` |
| **JDK** | **17** (Temurin / Adoptium) | AGP 8.x requires Java 17 |
| **Android Studio** | Hedgehog (2023.1) or newer | Includes SDK + emulator |
| **Android SDK** | Platform 34, Build-Tools 34.0.0 | Install via Android Studio → SDK Manager |
| **Gradle** | Bundled wrapper (do NOT install globally) | We use `./gradlew` |

### Required environment variables

**Windows (System Environment Variables):**
```
JAVA_HOME = C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot
ANDROID_HOME = C:\Users\<you>\AppData\Local\Android\Sdk
Path += %JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools
```

**macOS / Linux (`~/.zshrc` or `~/.bashrc`):**
```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)   # macOS
# export JAVA_HOME=/usr/lib/jvm/temurin-17-jdk     # Linux
export ANDROID_HOME="$HOME/Library/Android/sdk"     # macOS
# export ANDROID_HOME="$HOME/Android/Sdk"          # Linux
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
```

Verify:
```bash
java -version    # must print 17.x
echo $JAVA_HOME
adb --version
```

---

## 2. First-time setup (after `git clone`)

```bash
# 1. Install web deps
bun install            # or: npm install

# 2. Build the web bundle into /dist
bun run build          # or: npm run build

# 3. Add the Android platform (only if /android folder is missing)
npx cap add android

# 4. Sync web assets + native plugins into /android
npx cap sync android
```

> ⚠️ **Never commit edits to `/android` that conflict with `capacitor.config.ts`.**
> `cap sync` will overwrite generated parts.

---

## 3. Every rebuild (after pulling changes)

```bash
bun install            # if package.json changed
bun run build
npx cap sync android
npx cap run android    # launches emulator or connected device
```

Open in Android Studio instead:
```bash
npx cap open android
```

---

## 4. Known issues & fixes (already applied in this repo)

### ✅ ProGuard error: `proguard-android.txt` not found
Fixed in `android/app/build.gradle` — release build uses
`proguard-android-optimize.txt` (bundled with AGP) instead of the deprecated
`proguard-android.txt`.

### ✅ App opens Lovable preview instead of local files
Fixed in `capacitor.config.ts` — the `server.url` block has been removed so
the app loads bundled assets from `/dist`. **Do not re-add `server.url`** for
release builds.

### ✅ Notification permissions
Declared in `android/app/src/main/AndroidManifest.xml`:
- `POST_NOTIFICATIONS` (Android 13+)
- `VIBRATE`, `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED`
- `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`

Runtime request handled by `src/hooks/useNotificationPermission.ts` via
`@capacitor/local-notifications`.

### ✅ JAVA_HOME not set
Install JDK 17 from https://adoptium.net and ensure `JAVA_HOME` points to it
(see section 1).

---

## 5. Building a release APK / AAB

```bash
bun run build
npx cap sync android
cd android
./gradlew assembleRelease        # APK  → android/app/build/outputs/apk/release/
./gradlew bundleRelease          # AAB  → android/app/build/outputs/bundle/release/
```

### Signing (one-time)

1. Generate a keystore (keep the `.jks` file safe, **never commit**):
   ```bash
   keytool -genkey -v -keystore levonis-release.jks \
     -keyalg RSA -keysize 2048 -validity 10000 -alias levonis
   ```
2. Create `android/keystore.properties` (git-ignored):
   ```
   storeFile=../../levonis-release.jks
   storePassword=********
   keyAlias=levonis
   keyPassword=********
   ```
3. Reference it from `android/app/build.gradle` `signingConfigs` block.

---

## 6. Detailed build logs (recommended)

Use the bundled runner at `scripts/android-build.mjs` for **timestamped,
file-saved logs** of every step. All output is mirrored to your terminal
**and** written to `logs/android-build-<timestamp>.log`.

| Command | What it runs |
|---|---|
| `npm run android:doctor` | Environment diagnostics only (Java, SDK, env vars, project files) |
| `npm run android:sync` | `vite build` + `npx cap sync android` |
| `npm run android:gradle` | `./gradlew assembleDebug --stacktrace --info` |
| `npm run android:build` | Full: build + sync + Gradle debug |
| `npm run android:release` | Full + `./gradlew assembleRelease --stacktrace --info` |

Each run produces:
- A live colored console stream
- A complete log file under `logs/` (timestamped)
- A **summary section** listing every captured `error/failure/exception` line

**Always run `npm run android:doctor` first** if you hit issues — it will
tell you immediately whether `JAVA_HOME`, `ANDROID_HOME`, or `dist/` are
missing.

> Add `logs/` to `.gitignore` so log files aren't committed.

---

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `JAVA_HOME is not set` | Install JDK 17, set env var, restart terminal |
| `SDK location not found` | Set `ANDROID_HOME` or create `android/local.properties` with `sdk.dir=...` |
| `Could not find proguard-android.txt` | Already fixed — pull latest `build.gradle` |
| App shows Lovable preview | Already fixed — remove any `server.url` from `capacitor.config.ts` |
| White screen on launch | Run `bun run build && npx cap sync android` again |
| Plugin not found at runtime | Re-run `npx cap sync android` after `bun add` |
| Gradle daemon hangs | `cd android && ./gradlew --stop` then retry |
| `Execution failed for task ':app:processDebugResources'` | Update Android SDK Platform 34 in SDK Manager |
| Emulator not detected | `adb devices` — if empty, start emulator from Android Studio first |

---

## 7. Quick command reference

```bash
# Web
bun run build                 # build web app into /dist
bun run dev                   # web dev server

# Capacitor
npx cap sync android          # copy /dist + plugins into /android
npx cap open android          # open in Android Studio
npx cap run android           # build + install + launch on device
npx cap run android --livereload --external   # live reload from dev server

# Gradle (from /android)
./gradlew clean
./gradlew assembleDebug
./gradlew assembleRelease
./gradlew --stop              # kill Gradle daemon
```

---

**Repo files relevant to Android builds:**
- `capacitor.config.ts` — Capacitor config (no `server.url`)
- `android/app/build.gradle` — uses `proguard-android-optimize.txt`
- `android/app/src/main/AndroidManifest.xml` — permissions
- `src/hooks/useNotificationPermission.ts` — runtime perm logic
