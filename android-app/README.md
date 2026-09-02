# 大象阿宝 Android 闹钟助手

这是“大象阿宝”的 Android 手机入口与系统闹钟桥接应用。应用提供可交互的手机首页，支持进入网页版主页、手动设置任务闹钟、查看系统闹钟；网页也可以通过 `daxiangabao://alarm` 链接传递任务标题和自动识别的时间。应用只在设备本地调用系统 `AlarmClock`，不读取闹钟列表，也不上传手机数据。

## 行为

- `operation=set`：打开系统新建闹钟页面，带入小时、分钟和任务标题，由用户确认保存。
- `operation=show`：打开系统闹钟列表。Android 没有可靠的跨厂商“按网页任务删除闹钟”接口，因此关闭开关或删除任务后，需要用户在系统闹钟中确认删除。
- 没有明确时间的任务不会创建闹钟。
- 直接启动应用：显示手机版主页，可进入完整网页版、手动输入任务并设置时间、查看系统闹钟。

## 构建

使用 JDK 17、Android SDK 35 和 Gradle 8.9：

```bash
./gradlew :app:assembleDebug
```

当前发布文件使用英文版本名 `daxiang-abao-alarm-xiaomi12spro-v1.1.4.apk`，同时复制为网站内部稳定资源 `public/downloads/daxiang-abao-alarm.apk`。对外下载路由应返回版本化英文文件名，避免与手机里的旧下载同名后被浏览器保存成 `.apk.1`。
