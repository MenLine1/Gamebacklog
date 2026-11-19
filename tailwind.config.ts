import type { Config } from 'tailwindcss';
const config: Config = { content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'], theme: { extend: { colors: { ink: '#0b0e13', panel: '#121720', lime: '#c6f36b' } } }, plugins: [] };
export default config;
