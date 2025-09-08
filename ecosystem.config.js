// ~/esl/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'linked_esl_app',
      script: 'app.js',

      // 기존 설정 유지
      exec_mode: 'cluster',
      instances: 1,                 // 필요하면 'max' 로 변경
      max_memory_restart: '300M',
      watch: '.',                   // 운영에선 보통 false 권장
      ignore_watch: ['node_modules', 'uploads', 'service-worker'],

      // 개발 기본값
      env: {
        NODE_ENV: 'development',
        PORT: 8608,
        Server_Port: 8608,
        Server_Host: 'localhost',
        Server_Protocol: 'http',
        Server_Url: 'http://localhost:8608',
        Server_Url_With_Port: 'http://localhost:8608',

        // ▼ Year-end 프로모 환경변수 (개발에서도 테스트 가능)
        FREE_UNTIL: '2025-12-31T23:59:59Z',
        FREE_QUOTA_EMPLOYER: '1',
        FREE_DURATION_SEEKER_DAYS: '90',
        FREE_DURATION_TUTOR_DAYS: '90',
      },

      // pm2 —env production 으로 올릴 때 사용
      env_production: {
        NODE_ENV: 'production',
        PORT: 8608,
        Server_Port: 8608,
        Server_Host: '0.0.0.0',
        Server_Protocol: 'https',
        Server_Url: 'https://eslplus.org',
        Server_Url_With_Port: 'https://eslplus.org',

        // ▼ Year-end 프로모 환경변수 (운영값)
        FREE_UNTIL: '2025-12-31T23:59:59Z',
        FREE_QUOTA_EMPLOYER: '1',
        FREE_DURATION_SEEKER_DAYS: '90',
        FREE_DURATION_TUTOR_DAYS: '90',
      },
    },
  ],

  deploy: {
    production: {
      user: 'SSH_USERNAME',
      host: 'SSH_HOSTMACHINE',
      ref: 'origin/master',
      repo: 'GIT_REPOSITORY',
      path: 'DESTINATION_PATH',
      'pre-deploy-local': '',
      'post-deploy': 'npm ci --omit=dev && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
    },
  },
};
