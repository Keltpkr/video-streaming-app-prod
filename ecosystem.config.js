module.exports = {
  apps: [
    {
      name: "VideoStream(Dev)",
      script: "index.js",
      watch: true,
      ignore_watch: ["node_modules", "logs"],
      watch_options: {
        followSymlinks: false,
      },
    },
  ],
};
