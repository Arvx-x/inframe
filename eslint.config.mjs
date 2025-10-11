import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      // Disable unused vars in both JS and TS contexts
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      // Disable "Unexpected any" errors
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default eslintConfig;
