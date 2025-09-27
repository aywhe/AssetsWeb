// app.js
const { startServer } = require('./server');
const { startFtpServer } = require('./ftp');
const logger = require('./logger');

async function startServers() {
  try {
    // 启动HTTP服务
    const httpServer = startServer();

    // 启动FTP服务
    const ftpServer = startFtpServer();

    // 优雅关闭处理
    const shutdown = () => {
      logger.info('正在关闭服务器...');
      
      // 关闭HTTP服务器
      httpServer.close(() => {
        logger.info('HTTP服务器已关闭');
      });
      
      // 关闭FTP服务器
      if (ftpServer) {
        ftpServer.close(() => {
          logger.info('FTP服务器已关闭');
        });
      }
      
      // 退出进程
      setTimeout(() => {
        logger.info('强制退出');
        process.exit(0);
      }, 6000);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    return { httpServer, ftpServer };
  } catch (error) {
    logger.error('启动服务器失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则启动服务
if (require.main === module) {
  startServers();
}

module.exports = { startServers };