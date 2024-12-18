module.exports = {
  apps: [
    {
      name: "VideoStream(Prod)",
      script: "index.js",
      watch: true,
      ignore_watch: ["node_modules", "logs", "public"],
      watch_options: {
        followSymlinks: false,
      },
    },
  ],
};
