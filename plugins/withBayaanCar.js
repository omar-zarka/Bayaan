const {
  withInfoPlist,
  withEntitlementsPlist,
  withAppDelegate,
  createRunOncePlugin,
} = require('expo/config-plugins');

const START_MARKER = '// @bayaan-car scene bridge start';
const END_MARKER = '// @bayaan-car scene bridge end';

const ORIGINAL_WINDOW_BLOCK = `    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)`;

const BRIDGE_BLOCK = `    ${START_MARKER}
    BayaanCarSceneBridge.shared.configure(
      start: { hostWindow, extra in
        let merged = (launchOptions ?? [:]).merging(extra) { _, new in new }
        factory.startReactNative(withModuleName: "main", in: hostWindow, launchOptions: merged)
      },
      onWindow: { [weak self] hostWindow in self?.window = hostWindow })
    ${END_MARKER}`;

function withCarPlayInfoPlist(config) {
  return withInfoPlist(config, cfg => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: true,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Phone',
            UISceneDelegateClassName: 'PhoneSceneDelegate',
          },
        ],
        CPTemplateApplicationSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'CarPlay',
            UISceneDelegateClassName: 'CarPlaySceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });
}

function withCarPlayEntitlement(config) {
  return withEntitlementsPlist(config, cfg => {
    cfg.modResults['com.apple.developer.carplay-audio'] = true;
    return cfg;
  });
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, cfg => {
    let src = cfg.modResults.contents;
    if (src.includes(START_MARKER)) return cfg;
    if (!src.includes(ORIGINAL_WINDOW_BLOCK)) {
      throw new Error(
        '[withBayaanCar] AppDelegate window block not found. Update ORIGINAL_WINDOW_BLOCK for this Expo SDK.',
      );
    }
    src = src.replace(ORIGINAL_WINDOW_BLOCK, BRIDGE_BLOCK);
    if (!src.includes('import BayaanCar')) {
      if (!src.includes('import React\n')) {
        throw new Error(
          '[withBayaanCar] AppDelegate "import React" anchor not found. Update the import anchor for this Expo SDK.',
        );
      }
      src = src.replace(
        'import React\n',
        'import React\ninternal import BayaanCar\n',
      );
    }
    cfg.modResults.contents = src;
    return cfg;
  });
}

// Forks without Apple's CarPlay audio entitlement can pass {carPlayAudioEntitlement: false}.
function withBayaanCar(config, props) {
  const {carPlayAudioEntitlement = true} = props ?? {};
  config = withCarPlayInfoPlist(config);
  if (carPlayAudioEntitlement) config = withCarPlayEntitlement(config);
  config = withSceneAppDelegate(config);
  return config;
}

module.exports = createRunOncePlugin(withBayaanCar, 'withBayaanCar', '1.0.0');
