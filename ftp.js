// ftp.js
const FtpSrv = require('ftp-srv');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./logger');

// 读取配置文件信息
function ftpConfig() {
  try {
    return config.get('FtpConfig', {});
  } catch (err) {
    logger.error('读取FTP配置失败', err);
    return {};
  }
}

// ftp监听
function startFtpServer() {
  const ftpconfig = ftpConfig();
  if (!ftpconfig || !ftpconfig.port) {
    logger.info('没有FTP配置，跳过FTP服务');
    return null;
  }

  // 修改后:
  const ftpServer = new FtpSrv(`ftp://localhost:${ftpconfig.port}`, {
    anonymous: false
  });

  // 添加服务器错误处理
  ftpServer.on('error', (err) => {
    logger.error('FTP服务器错误:', err.message);
    if (err.code === 'ECONNRESET') {
      logger.warn('连接被客户端重置，这是常见现象，服务器将继续运行');
      return;
    }
    if (err.stack) {
      logger.error('错误堆栈:', err.stack);
    }
  });

  ftpServer.on('login', ({ connection, username, password }, resolve, reject) => {
    try {
      if (ftpconfig.paths && Array.isArray(ftpconfig.paths)) {
        for (const pathConfig of ftpconfig.paths) {
          if (pathConfig.users && Array.isArray(pathConfig.users)) {
            for (const user of pathConfig.users) {
              if (user.username === username && user.password === password) {
                const rootPath = pathConfig.rootPath;
                if (rootPath && fs.existsSync(rootPath)) {
                  connection.userPermissions = user.permissions || 'elr';
                  connection.username = username;
                  logger.info(`用户 ${username} 登录成功，根目录: ${rootPath}，权限: ${connection.userPermissions}`);
                  resolve({ root: rootPath });
                  return;
                } else {
                  logger.error(`用户 ${username} 的根目录不存在: ${rootPath}`);
                  reject(new Error('根目录不存在'));
                  return;
                }
              }
            }
          }
        }
      }
    } catch (err) {
      logger.error('FTP登录处理错误:', err);
      reject(new Error('服务器错误'));
      return;
    }
    reject(new Error('无效的用户名或密码'));
  });

  // 检查用户是否有指定权限
  function hasPermission(connection, permission) {
    const permissions = connection.userPermissions || 'elr';
    return permissions.includes(permission);
  }

  // 文件上传前检查权限
  ftpServer.on('STOR', (data, resolve, reject) => {
    try {
      const { connection, filename } = data;
      if (hasPermission(connection, 'w')) {
        logger.info(`用户 ${connection.username} 开始上传文件: ${filename}`);
        resolve();
      } else {
        logger.warn(`用户 ${connection.username} 没有上传文件权限: ${filename}`);
        reject(new Error('权限不足，无法上传文件'));
      }
    } catch (err) {
      logger.error('文件上传准备失败:', err);
      reject(err);
    }
  });

  // 文件上传完成事件
  ftpServer.on('file:stor', (data) => {
    const { connection, filename, absolutePath } = data;
    logger.info(`用户 ${connection.username} 成功上传文件: ${filename}`);
  });

  // 创建目录前检查权限
  ftpServer.on('MKD', (data, resolve, reject) => {
    try {
      const { connection, path } = data;
      if (hasPermission(connection, 'w')) {
        logger.info(`用户 ${connection.username} 创建目录: ${path}`);
        resolve();
      } else {
        logger.warn(`用户 ${connection.username} 没有创建目录权限: ${path}`);
        reject(new Error('权限不足，无法创建目录'));
      }
    } catch (err) {
      logger.error('目录创建失败:', err);
      reject(err);
    }
  });

  // 删除文件前检查权限
  ftpServer.on('DELE', (data, resolve, reject) => {
    try {
      const { connection, filename } = data;
      if (hasPermission(connection, 'd')) {
        logger.info(`用户 ${connection.username} 删除文件: ${filename}`);
        resolve();
      } else {
        logger.warn(`用户 ${connection.username} 没有删除文件权限: ${filename}`);
        reject(new Error('权限不足，无法删除文件'));
      }
    } catch (err) {
      logger.error('文件删除失败:', err);
      reject(err);
    }
  });

  // 删除目录前检查权限
  ftpServer.on('RMD', (data, resolve, reject) => {
    try {
      const { connection, path } = data;
      if (hasPermission(connection, 'd')) {
        logger.info(`用户 ${connection.username} 删除目录: ${path}`);
        resolve();
      } else {
        logger.warn(`用户 ${connection.username} 没有删除目录权限: ${path}`);
        reject(new Error('权限不足，无法删除目录'));
      }
    } catch (err) {
      logger.error('目录删除失败:', err);
      reject(err);
    }
  });

  // 重命名/移动文件前检查权限
  ftpServer.on('RNTO', (data, resolve, reject) => {
    try {
      const { connection, filename } = data;
      if (hasPermission(connection, 'w')) {
        logger.info(`用户 ${connection.username} 重命名/移动到: ${filename}`);
        resolve();
      } else {
        logger.warn(`用户 ${connection.username} 没有重命名/移动文件权限: ${filename}`);
        reject(new Error('权限不足，无法重命名或移动文件'));
      }
    } catch (err) {
      logger.error('文件重命名失败:', err);
      reject(err);
    }
  });

  ftpServer.listen()
    .then(() => {
      logger.info(`FTP服务器运行在 ftp://localhost:${ftpconfig.port}`);
    })
    .catch(err => {
      logger.error('FTP服务器启动失败:', err);
    });

  return ftpServer;
}

// 为整个进程添加错误处理，防止服务器因未处理的错误而退出
process.on('uncaughtException', (err) => {
    logger.error('未捕获的异常:', err.message);
    if (err.code !== 'ECONNRESET') {
        logger.error('错误堆栈:', err.stack);
    } else {
        logger.warn('忽略ECONNRESET错误，服务器继续运行');
    }
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('未处理的Promise拒绝:', reason);
    // 不要因为Promise拒绝而退出进程
});

// 如果直接运行 ftp.js，则启动FTP服务器
if (require.main === module) {
  startFtpServer();
}

module.exports = { startFtpServer };