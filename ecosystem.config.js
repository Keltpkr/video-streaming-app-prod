module.exports = {
    apps: [
      {
        name: "video-streaming-app",
        script: "index.js",
        env_production: {
          NODE_ENV: "production",
          PORT: 8080,
          VIDEO_DIR: "/mnt/usbdrive/Films"
        }
      }
    ]
  };
  