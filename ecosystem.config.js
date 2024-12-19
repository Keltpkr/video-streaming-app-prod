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
        },
        env_development: {
          NODE_ENV: "development",
          DEV_IP: "0.0.0.0",
          DEV_PORT: 8001,
          DEV_VIDEO_DIR: "//192.168.1.46/USBDrive/Films"
        }
      }
    ]
};