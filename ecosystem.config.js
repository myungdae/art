module.exports = {
  apps : [
    {
      name: 'linked_esl_app',
      script: 'app.js',
      exec_mode: 'cluster',
      max_memory_restart: '300M',
      watch: '.',
      ignore_watch: ['node_modules', 'uploads', 'service-worker'],

      env: {
        NODE_ENV: 'development',
        Server_Port: 8608,
        Server_Host: 'localhost',
        Server_Protocol: 'http',
        Server_Url: 'http://localhost:8608',
        Server_Url_With_Port: 'http://localhost:8608',
        // PortOne Payment Configuration
        PORTONE_STORE_ID: 'store-3ba0c64e-b600-4174-b3b0-652fa76be2ff',
        PORTONE_TEST_MODE: 'true',
        // PayPal (International)
        PORTONE_PAYPAL_CHANNEL_KEY: 'channel-key-fbce0f54-b483-4364-9993-f0971b3e307d',
        PAYPAL_MID: 'UFYSG9T7RFW2A',
        // Toss Payments (Korea)
        PORTONE_TOSSPAYMENTS_CHANNEL_KEY: 'channel-key-84d35b65-d8e8-4a22-8ad9-2d186749b80e',
        TOSSPAYMENTS_MID: 'tosstest'
      }
    }
  ],

  deploy : {
      production : {
      user : 'SSH_USERNAME',
      host : 'SSH_HOSTMACHINE',
      ref  : 'origin/master',
      repo : 'GIT_REPOSITORY',
      path : 'DESTINATION_PATH',
      'pre-deploy-local': '',
      'post-deploy' : 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};