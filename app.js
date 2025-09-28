// app.js
const httpServer = require('./server');
const ftpServer = require('./ftp');
const logger = require('./logger');

async function startServers() {
  try {
    // 启动HTTP服务
    await httpServer.startServer();

    // 启动FTP服务
    await ftpServer.startFtpServer();
  } catch (error) {
    logger.error('启动服务器失败:', error);
    process.exit(1);
  }
  return { httpServer, ftpServer };
}
async function stopServers() {
  httpServer.stopServer();
  ftpServer.stopFtpServer();
}

process.on('SIGINT', async () => {
  logger.info('收到SIGINT信号，正在关闭服务器...');
  await stopServers();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  logger.info('收到SIGTERM信号，正在关闭服务器...');
  await stopServers();
  process.exit(0);
});


// 如果直接运行此文件，则启动服务
if (require.main === module) {
  startServers();
}

module.exports = { startServers, stopServers };