import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Disable overly strict rule — data fetching + initialization in effects is valid
      "react-hooks/set-state-in-effect": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='skip']",
          message: "Do not commit .skip tests",
        },
        {
          selector: "CallExpression[callee.property.name='only']",
          message: "Do not commit .only tests",
        },
      ],
    },
  },
  {
    ignores: [".next/", "node_modules/", "worker/", "dist/", "coverage/", "scripts/", "src/lib/cache-handler.js"],
  },
);
