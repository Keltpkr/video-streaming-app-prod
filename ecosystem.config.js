module.exports = {
  apps: [
    {
      name: "VideoStream Server",
      script: "index.js",
      watch: true,
      ignore_watch: ["node_modules", "logs"],
      watch_options: {
        followSymlinks: false,
      },
    },
  ],
};
