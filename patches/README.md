# Native tab direction

`react-native-screens+4.23.0.patch` makes the iOS tab controller's layout-direction
trait follow `RCTI18nUtil.isRTL`. Bayaan reloads the React Native runtime when its
language changes, so each new controller reads the selected direction. This
mirrors the native tabs and the separate iOS 26 Search button without changing
their design or manually reversing routes.

The installed Screens version predates its
[native tabs RTL support](https://github.com/software-mansion/react-native-screens/pull/3613).
This patch uses the same UIKit trait approach on iOS 17+, covering Bayaan's
iOS 26 native-tab shell. Older iOS versions use the custom tab bar. The Yoga
wrapper remains LTR to preserve the native mini-player accessory's coordinates;
the screen and player contents apply the app's direction explicitly.

`npm install` applies the patch through the existing `patch-package` postinstall
step. A native rebuild is required. When upgrading Expo Router/Screens, replace
the patch with the supported tab direction prop, then verify Arabic and English
tab order, Search placement, tab switching, and the regular/minimized accessory.
