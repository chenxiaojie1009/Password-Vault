@echo off
rem ============================================================
rem  设备管理器 APK 构建脚本（离线，使用本机 Android SDK）
rem  前置要求：JDK 17 + Android SDK（已配置 local.properties）
rem ============================================================
setlocal
set JAVA_HOME=C:\Users\chen\.jdks\jdk-17.0.20+8
set PATH=%JAVA_HOME%\bin;%PATH%

echo [1/3] 构建 Release APK（离线）...
call gradlew.bat assembleRelease --offline --no-daemon
if errorlevel 1 goto :fail

echo [2/3] 生成签名密钥（若不存在）...
if not exist device-manager.keystore (
    keytool -genkeypair -v -keystore device-manager.keystore -alias devicemanager ^
        -keyalg RSA -keysize 2048 -validity 36500 ^
        -storepass dm123456 -keypass dm123456 -dname "CN=Device Manager, OU=IT, O=Device Manager, L=City, ST=State, C=CN"
)

echo [3/3] 签名 APK（输出到 deploy 目录）...
set BUILD_TOOLS=C:\Users\chen\AppData\Local\Android\Sdk\build-tools\36.1.0
set OUT_APK=%~dp0..\deploy\DeviceManager-v2.1.0.apk
if not exist "%~dp0..\deploy" mkdir "%~dp0..\deploy"
"%BUILD_TOOLS%\apksigner.bat" sign --ks device-manager.keystore --ks-pass pass:dm123456 --key-pass pass:dm123456 ^
    --out "%OUT_APK%" ^
    "app\build\outputs\apk\release\app-release-unsigned.apk"

echo.
echo 构建完成：%OUT_APK%
goto :eof

:fail
echo 构建失败，请检查错误信息。
exit /b 1
