plugins {
    id("com.android.application")
}

android {
    namespace = "com.daxiangabao.health"
    compileSdk = 35
    buildToolsVersion = "35.0.0"

    defaultConfig {
        applicationId = "com.daxiangabao.health"
        minSdk = 23
        targetSdk = 35
        versionCode = 7
        versionName = "1.2.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
