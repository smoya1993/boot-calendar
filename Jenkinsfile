pipeline {
  agent any

  environment {
    COMPOSE_PROJECT_NAME = 'boot-calendar'
  }

  options { timestamps() }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Deploy') {
      steps {
        withCredentials([
          // Crea estos credentials en Jenkins (tipo: "Secret text"):
          // - TELEGRAM_BOT_TOKEN
          // - TELEGRAM_WEBHOOK_SECRET
          // - N8N_WEBHOOK_URL
          // Opcionalmente puedes añadir N8N_TIMEOUT_MS como "Secret text" si lo quieres parametrizar.
          string(credentialsId: 'TELEGRAM_BOT_TOKEN', variable: 'TELEGRAM_BOT_TOKEN'),
          string(credentialsId: 'TELEGRAM_WEBHOOK_SECRET', variable: 'TELEGRAM_WEBHOOK_SECRET'),
          string(credentialsId: 'N8N_WEBHOOK_URL', variable: 'N8N_WEBHOOK_URL')
        ]) {
          script {
            if (isUnix()) {
              sh """
                set -e

                export PORT=4000
                export NODE_ENV=production
                export TELEGRAM_BOT_TOKEN='${TELEGRAM_BOT_TOKEN}'
                export TELEGRAM_WEBHOOK_SECRET='${TELEGRAM_WEBHOOK_SECRET}'
                # N8N_WEBHOOK_URL se pasa al build como ARG vía docker-compose.yml
                export N8N_WEBHOOK_URL='${N8N_WEBHOOK_URL}'
                export N8N_TIMEOUT_MS=4000

                docker compose -p ${COMPOSE_PROJECT_NAME} down || true
                docker compose -p ${COMPOSE_PROJECT_NAME} up -d --build --remove-orphans
                docker compose -p ${COMPOSE_PROJECT_NAME} ps
              """
            } else {
              bat """
                set PORT=4000
                set NODE_ENV=production
                set TELEGRAM_BOT_TOKEN=%TELEGRAM_BOT_TOKEN%
                set TELEGRAM_WEBHOOK_SECRET=%TELEGRAM_WEBHOOK_SECRET%
                rem N8N_WEBHOOK_URL se pasa al build como ARG vía docker-compose.yml
                set N8N_WEBHOOK_URL=%N8N_WEBHOOK_URL%
                set N8N_TIMEOUT_MS=4000

                docker compose -p %COMPOSE_PROJECT_NAME% down
                docker compose -p %COMPOSE_PROJECT_NAME% up -d --build --remove-orphans
                docker compose -p %COMPOSE_PROJECT_NAME% ps
              """
            }
          }
        }
      }
    }
  }

  post {
    always {
      script {
        if (isUnix()) {
          sh 'docker image prune -f || true'
        } else {
          bat 'docker image prune -f'
        }
      }
    }
  }
}


