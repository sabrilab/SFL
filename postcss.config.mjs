import { fileURLToPath } from "node:url";

const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    // Les fonds transparents restent transparents sans color-mix() (vieux Chrome, vieux Safari).
    [fileURLToPath(new URL("./postcss-repli-opacite.cjs", import.meta.url))]: {},
  },
};

export default config;
