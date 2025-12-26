module.exports = {
  apps: [
    {
      name: 'boot-calendar',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
  ],
};


