module.exports = {
  apps: [
    {
      name: "moodify-api",
      script: "src/index.js",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      env: { NODE_ENV: "production" },
    },
    {
      name: "moodify-cron",
      script: "src/cron/index.js",
      cwd: __dirname,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      env: { NODE_ENV: "production" },
    },
  ],
};
