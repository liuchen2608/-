plugins {
    id("com.android.application")
}

android {
    namespace = "com.daxiangabao.health"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.daxiangabao.health"
        minSdk = 23
        targetSdk = 35
        versionCode = 6
        versionName = "1.1.4"
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
