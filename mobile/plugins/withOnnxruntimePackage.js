const { withMainApplication } = require('@expo/config-plugins');

/**
 * onnxruntime-react-native is not picked up by this project's autolinking, so its native module is never
 * registered and `NativeModules.Onnxruntime` is null ("Cannot read property 'install' of null" at start).
 * This adds the package to MainApplication by hand, in the spot the Expo template reserves for that.
 * Remove it if a later autolinking or library release lists the package in PackageList on its own.
 */
module.exports = function withOnnxruntimePackage(config) {
  return withMainApplication(config, (c) => {
    if (c.modResults.language !== 'kt') throw new Error('withOnnxruntimePackage: MainApplication is not Kotlin');
    let src = c.modResults.contents;
    if (!src.includes('OnnxruntimePackage')) {
      src = src.replace('import com.facebook.react.PackageList', 'import ai.onnxruntime.reactnative.OnnxruntimePackage\nimport com.facebook.react.PackageList');
      src = src.replace('// add(MyReactNativePackage())', '// add(MyReactNativePackage())\n          add(OnnxruntimePackage())');
      if (!src.includes('add(OnnxruntimePackage())')) throw new Error('withOnnxruntimePackage: could not find the place to add the package');
    }
    c.modResults.contents = src;
    return c;
  });
};
