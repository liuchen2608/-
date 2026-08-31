# 大象阿宝 Android 闹钟助手

这是网页与 Android 系统闹钟之间的最小桥接应用。网页通过 `daxiangabao://alarm` 链接传递任务标题和自动识别的时间；应用只在设备本地调用系统 `AlarmClock`，不读取闹钟列表，也不上传手机数据。

## 行为

- `operation=set`：打开系统新建闹钟页面，带入小时、分钟和任务标题，由用户确认保存。
- `operation=show`：打开系统闹钟列表。Android 没有可靠的跨厂商“按网页任务删除闹钟”接口，因此关闭开关或删除任务后，需要用户在系统闹钟中确认删除。
- 没有明确时间的任务不会创建闹钟。

## 构建

使用 JDK 17、Android SDK 35 和 Gradle 8.9：

```bash
./gradlew :app:assembleDebug
```

将输出的 APK 复制到网站的 `public/downloads/daxiang-abao-alarm.apk` 后再构建网站。
