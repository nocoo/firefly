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
          // Unconditional `.skip()` / `.skip("reason")` — committed skip.
          selector:
            "CallExpression[callee.property.name='skip'][arguments.length<2]",
          message: "Do not commit unconditional .skip tests",
        },
        {
          // Declared skip such as `test.skip("scenario name", fn)` or
          // `test.skip(true, "reason")`. Conditional skips
          // `test.skip(condition, reason)` where the condition is an
          // expression (MemberExpression / CallExpression / Identifier)
          // remain allowed — they are how the L3 BDD specs gate empty-data
          // scenarios per docs/25-l3-bdd-refactor.md §2.4.
          selector:
            "CallExpression[callee.property.name='skip'][arguments.0.type='Literal']",
          message:
            "Do not commit declared .skip tests; use conditional test.skip(condition, reason) only",
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
