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
        Server_Url_With_Port: 'http://localhost:8608'
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