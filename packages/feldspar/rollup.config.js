import fs from "fs";

// Read package.json directly
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

// Export a function that returns the config to allow for async plugin loading
export default async function() {
  // Dynamically import plugins
  const typescript = (await import("@rollup/plugin-typescript")).default;
  const { nodeResolve } = await import("@rollup/plugin-node-resolve");
  const commonjs = (await import("@rollup/plugin-commonjs")).default;
  const terser = (await import("@rollup/plugin-terser")).default;
  const peerDepsExternal = (await import("rollup-plugin-peer-deps-external"))
    .default;
  const dts = (await import("rollup-plugin-dts")).default;
  const url = (await import("@rollup/plugin-url")).default;
  const json = (await import("@rollup/plugin-json")).default;
  const copy = (await import("rollup-plugin-copy")).default;

  return [
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
          limit: Infinity,
          publicPath: '',
          emitFiles: true
        }),
        json({
          include: ['**/*.json'],
          compact: true
        }),
        nodeResolve({
          extensions: ['.js', '.ts', '.json']
        }),
        commonjs(),
        typescript({ 
          tsconfig: './tsconfig.json',
          resolveJsonModule: true
        }),
        terser(),
        copy({
          targets: [
            { 
              src: 'src/fonts/*', 
              dest: 'dist/fonts' 
            }
          ]
        })
      ],
      external: ['react', 'react-dom', ...Object.keys(packageJson.dependencies || {})],
    },
    {
      input: 'src/index.ts',
      output: [{ file: packageJson.types, format: 'esm' }],
      plugins: [dts()],
    },
  ];
}
