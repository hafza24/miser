# Android Resources for Fur&Fir APK Build

These XML files should be placed into the Android project after running `npx cap add android`.

## File placement guide

| Source file | Copy to |
|---|---|
| `values/colors.xml` | `android/app/src/main/res/values/colors.xml` |
| `values/styles.xml` | `android/app/src/main/res/values/styles.xml` |
| `drawable/splash.xml` | `android/app/src/main/res/drawable/splash.xml` |
| `xml/network_security_config.xml` | `android/app/src/main/res/xml/network_security_config.xml` |

## After copying

1. Place your app icons in `android/app/src/main/res/mipmap-*` folders
2. Run `npx cap sync android`
3. Open in Android Studio: `npx cap open android`

## Network security

The `network_security_config.xml` allows cleartext traffic to the dev server.
For production builds, remove the dev server domain and keep only necessary domains.
