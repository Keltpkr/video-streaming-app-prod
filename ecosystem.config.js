module.exports = {
    apps: [
      {
        name: "video-streaming-app",
        script: "index.js",
        env_production: {
          NODE_ENV: "production",
          PORT: 8000,
          IP: "0.0.0.0",
          VIDEO_DIR: "/mnt/usbdrive/Films"
        }
      }
    ]
};
