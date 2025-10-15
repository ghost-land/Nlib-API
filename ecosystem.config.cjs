module.exports = {
  apps: [{
    name: 'nlib-api',
    script: 'src/index.js',
    interpreter: 'bun',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production'
    }
  }]
}
