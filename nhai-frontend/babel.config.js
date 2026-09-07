module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind', worklets: false }],
      'nativewind/babel',
    ],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@screens': './src/screens',
            '@hooks': './src/hooks',
            '@store': './src/store',
            '@lib': './src/lib',
            '@types': './src/types',
            '@utils': './src/utils',
            '@navigation': './src/navigation',
            '@assets': './assets',
            '@storage': './src/storage',
          },
        },
      ],
      'react-native-worklets/plugin',
    ],
  };
};
