@echo off
rem ============================================================
rem  Device Manager APK build script (offline, local Android SDK)
rem  Requirements: JDK 17 + Android SDK
rem  - JDK: env JAVA_HOME (falls back to a local default path)
rem  - SDK: env ANDROID_HOME (falls back to a local default path)
rem  - Signing password: env DEVICE_MANAGER_KS_PASS (prompted if unset)
rem  NOTE: keep this file ASCII-only and CRLF; cmd mishandles
rem        multi-byte comments and ^ continuations inside blocks.
rem ============================================================
setlocal
cd /d "%~dp0"

rem ---------- JDK ----------
if defined JAVA_HOME goto java_ok
if exist "C:\Users\chen\.jdks\jdk-17.0.20+8" set "JAVA_HOME=C:\Users\chen\.jdks\jdk-17.0.20+8"
if defined JAVA_HOME goto java_ok
echo [ERROR] JDK not found. Please set JAVA_HOME.
goto :fail
:java_ok
set "PATH=%JAVA_HOME%\bin;%PATH%"

rem ---------- build-tools (pick the latest) ----------
if defined BUILD_TOOLS goto tools_ok
set "BUILD_TOOLS="
if defined ANDROID_HOME goto tools_scan
goto tools_fallback
:tools_scan
for /f "delims=" %%d in ('dir /b /ad /o-n "%ANDROID_HOME%\build-tools" 2^>nul') do set "BUILD_TOOLS=%ANDROID_HOME%\build-tools\%%d"
if defined BUILD_TOOLS goto tools_ok
:tools_fallback
if exist "C:\Users\chen\AppData\Local\Android\Sdk\build-tools\36.1.0" set "BUILD_TOOLS=C:\Users\chen\AppData\Local\Android\Sdk\build-tools\36.1.0"
:tools_ok
if defined BUILD_TOOLS goto tools_done
echo [ERROR] Android build-tools not found. Please set ANDROID_HOME.
goto :fail
:tools_done
echo Using build-tools: %BUILD_TOOLS%

rem ---------- version (single source: version.properties) ----------
set "APP_VERSION="
for /f "usebackq tokens=1,2 delims==" %%a in ("%~dp0version.properties") do if "%%a"=="versionName" set "APP_VERSION=%%b"
if defined APP_VERSION goto version_ok
echo [ERROR] Cannot read versionName from version.properties.
goto :fail
:version_ok
echo Building version: %APP_VERSION%

echo [1/4] Building release APK (offline)...
call gradlew.bat assembleRelease --offline --no-daemon
if errorlevel 1 goto :fail

echo [2/4] Preparing signing keystore (if missing)...
if exist device-manager.keystore goto sign_ready
if defined DEVICE_MANAGER_KS_PASS goto genkey
set /p DEVICE_MANAGER_KS_PASS=Enter password for NEW keystore, or set DEVICE_MANAGER_KS_PASS env var:
:genkey
keytool -genkeypair -v -keystore device-manager.keystore -alias devicemanager -keyalg RSA -keysize 2048 -validity 36500 -storepass "%DEVICE_MANAGER_KS_PASS%" -keypass "%DEVICE_MANAGER_KS_PASS%" -dname "CN=Device Manager, OU=IT, O=Device Manager, L=City, ST=State, C=CN"
if errorlevel 1 goto :fail
:sign_ready
if defined DEVICE_MANAGER_KS_PASS goto sign2
set /p DEVICE_MANAGER_KS_PASS=Enter keystore password, or set DEVICE_MANAGER_KS_PASS env var:
:sign2

echo [3/4] Signing APK (output to deploy)...
set "OUT_APK=%~dp0..\deploy\DeviceManager-v%APP_VERSION%.apk"
if not exist "%~dp0..\deploy" mkdir "%~dp0..\deploy"
call "%BUILD_TOOLS%\apksigner.bat" sign --ks device-manager.keystore --ks-pass "pass:%DEVICE_MANAGER_KS_PASS%" --key-pass "pass:%DEVICE_MANAGER_KS_PASS%" ^
    --out "%OUT_APK%" ^
    "app\build\outputs\apk\release\app-release-unsigned.apk"
if errorlevel 1 goto :fail

echo [4/4] Verifying signature...
call "%BUILD_TOOLS%\apksigner.bat" verify "%OUT_APK%"
if errorlevel 1 goto :fail

echo.
echo Build OK: %OUT_APK%
goto :eof

:fail
echo Build FAILED. Check the error messages above.
exit /b 1
