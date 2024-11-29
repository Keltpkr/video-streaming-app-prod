module.exports = {
  apps: [
    {
      name: "VideoStream(Dev)",
      script: "index.js",
      watch: true,
      ignore_watch: ["node_modules", "logs","/home/kelt_/video-streaming-app-dev/public"],
      watch_options: {
        usePolling: false,
        interval: 5000,
        followSymlinks: false
      },
    },
  ],
};
