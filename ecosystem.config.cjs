const path = require('path')

module.exports = {
  apps: [{
    name: 'nlib-api',
    script: 'src/index.js',
    cwd: __dirname,
    interpreter: 'node',
    instances: 1,
    exec_mode: 'fork',
    env_file: path.join(__dirname, '.env'),
    env: {
      NODE_ENV: 'production'
    }
  }]
}
