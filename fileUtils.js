// fileUtils.js
const fs = require('fs').promises;
const path = require('path');

class FileUtils {
  // 检验文件名的后缀是否符合
  static matchFilterName(name, filter) {
    const ext = path.extname(name).toLowerCase();
    return filter.includes(ext);
  }

  // 获取文件及其子文件的文件名（异步版本）
  static async getFilesAndFoldersInDir(dir, filter = []) {
    const result = [];
    const items = await fs.readdir(dir);
    const bUseFilter = Array.isArray(filter) && filter.length > 0;
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stats = await fs.stat(itemPath);
      
      if (stats.isDirectory()) {
        const children = await this.getFilesAndFoldersInDir(itemPath, filter);
        if (children.length > 0) {
          result.push({ type: 'folder', name: item, children });
        }
      } else if (!bUseFilter || this.matchFilterName(item, filter)) {
        result.push({ type: 'file', name: item });
      }
    }
    return result;
  }

  // 获取同一个目录中同文件名的其他类型文件
  static async findOtherExtFiles(fullPath, exts) {
    const dirName = path.dirname(fullPath);
    const baseName = path.basename(fullPath);
    const parts = baseName.split(".");
    const prefix = parts.slice(0, -1).join(".");
    const foundFiles = [];

    const items = await fs.readdir(dirName);
    for (const item of items) {
      const itemPath = path.join(dirName, item);
      const ext = path.extname(item).toLowerCase();
      const stats = await fs.stat(itemPath);
      
      if (!stats.isDirectory()) {
        if (prefix === item.substring(0, prefix.length) && exts.includes(ext)) {
          const labels = item.substring(prefix.length).split(/[_\-\(\)\.]/).filter(item => item !== '' && item.length >= 2);
          const label = labels[0].replace(/[^a-zA-Z]/g, '');
          foundFiles.push({ file: item, label: label });
        }
      }
    }
    return foundFiles;
  }

  // 递归读取图片目录
  static async readVpathFileFromDir(dirPath, exts, vpath, vroot) {
    const files = await fs.readdir(dirPath);
    let data = [];
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = await fs.stat(filePath);

      if (stat.isDirectory()) {
        // 如果是子目录，递归处理
        const indata = await this.readVpathFileFromDir(filePath, exts, vpath, vroot);
        data = data.concat(indata);
      } else {
        // 只添加图片文件
        const ext = path.extname(file).toLowerCase();
        if (exts.includes(ext)) {
          // 添加相对URL路径
          const relativePath = path.relative(vroot, filePath)
            .replace(/\\/g, '/'); // Windows兼容

          data.push(`${vpath}/${relativePath}`);
        }
      }
    }
    return data;
  }

  // 安全路径检查，防止目录遍历攻击
  static isPathSafe(requestedPath, allowedRoot) {
    const normalizedPath = path.resolve(requestedPath);
    const normalizedRoot = path.resolve(allowedRoot);
    return normalizedPath.startsWith(normalizedRoot);
  }
}

module.exports = FileUtils;