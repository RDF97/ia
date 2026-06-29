module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // En SDK 54 (Reanimated 4) el plugin de worklets lo añade babel-preset-expo.
  };
};
