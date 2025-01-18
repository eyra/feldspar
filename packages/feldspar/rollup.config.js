import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import dts from 'rollup-plugin-dts';
import url from '@rollup/plugin-url';
import json from '@rollup/plugin-json';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const packageJson = require('./package.json');

const config = [
  {
    input: 'src/index.ts',
    output: [
      {
        file: packageJson.main,
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: packageJson.module,
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      peerDepsExternal(),
      url({
        include: ['**/*.svg'],
        limit: 0,
        fileName: '[name][extname]'
      }),
      json({
        include: ['**/*.json'],
        compact: true
      }),
      resolve({
        extensions: ['.js', '.ts', '.json']
      }),
      commonjs(),
      typescript({ 
        tsconfig: './tsconfig.json',
        resolveJsonModule: true
      }),
      terser(),
    ],
    external: ['react', 'react-dom', ...Object.keys(packageJson.dependencies || {})],
  },
  {
    input: 'src/index.ts',
    output: [{ file: packageJson.types, format: 'esm' }],
    plugins: [dts()],
  },
];

export default config;
