import nextConfig from "eslint-config-next";

const config = [
  {
    ignores: ["app/.well-known/workflow/**"],
  },
  ...nextConfig,
];

export default config;
