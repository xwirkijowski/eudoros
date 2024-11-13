import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";

export default {
	input: ['dist/index.js'],
	output: [
		{
			file: "dist/index.cjs",
			format: 'cjs'
		},
		{
			file: 'dist/index.esm.js',
			format: 'esm'
		}
	],
	plugins: [
		commonjs(),
		resolve()
	]
}