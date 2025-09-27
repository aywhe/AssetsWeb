// server.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const config = require('./config');
const logger = require('./logger');
const FileUtils = require('./fileUtils');

//////////////////////// global datas ///////////////////////////////////
const ConfigFilePath = 'assets_config.json';

// 从配置中读取默认值
var PORT = config.getPort();
var VideoFilter = config.get('VideoFilter', ['.mp4', '.flv', '.mkv', '.rmvb']);
var ImageExts = config.get('ImageExts', ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']);
var AudioExts = config.get('AudioExts', ['.mp3', '.wma', '.ogg', '.wav']);

// 图片
var PicturePathTagMap = config.get('PicturePathTagMap', {
  images: [], // 存储所有图片路径
  vpic: 'imageshow.jpg', // 图片位置的虚拟目录中卡片图片位置
  paths: [{ path: 'D:/Users/aywhe/Pictures/Pictures', vpath: '/dimages' }] // 不同位置有不同的标记名称
});

// 视频
var VideoNameList = new Map(); // 视频文件名列表
var VideoPathTagMap = new Map(Object.entries(config.get('VideoPathTagMap', {
  'DVideos': { path: 'D:/Users/aywhe/Videos', vpath: '/DVideos', vpic: 'DVideos.png' }
}))); // 不同视频位置有不同的标记名称

// 音频
var AudioPathTagMap = config.get('AudioPathTagMap', {
  audios: [], // 存储所有路径
  vpic: 'playaudio.jpg', // 音频位置的虚拟目录中卡片图片位置
  paths: [{ path: 'D:/Users/aywhe/Music', vpath: '/daudios' }] // 不同位置有不同的标记名称
});

////////////////////////// running functions //////////////////////////////////////

// 读取配置文件信息
async function initConfig() {
  try {
    const data = config.get(null, {});
    
    PORT = data.ServerPort || PORT;
    VideoFilter = data.VideoFilter || VideoFilter;
    ImageExts = data.ImageExts || ImageExts;
    AudioExts = data.AudioExts || AudioExts;
    
    PicturePathTagMap = data.PicturePathTagMap || PicturePathTagMap;
    PicturePathTagMap.images = [];
    
    AudioPathTagMap = data.AudioPathTagMap || AudioPathTagMap;
    AudioPathTagMap.audios = [];
    
    VideoPathTagMap = new Map(Object.entries(data.VideoPathTagMap || Object.fromEntries(VideoPathTagMap)));
  } catch (err) {
    logger.error('读取配置信息失败，将使用默认配置', err);
  }
}

// 初始化工作
async function initDatas() {
  try {
    // 删除无效的视频目录
    for (let [key, val] of VideoPathTagMap) {
      try {
        await fs.access(val.path);
      } catch {
        VideoPathTagMap.delete(key);
        logger.warn(`视频目录不存在，已删除: ${key}`);
      }
    }

    // 设置静态资源目录
    app.use(express.static('public'));

    // 读取图片文件名
    logger.info('使用图片路径:');
    for (const val of PicturePathTagMap.paths) {
      try {
        await fs.access(val.path);
        app.use(val.vpath, express.static(val.path));
        logger.info(val.path);
        const indata = await FileUtils.readVpathFileFromDir(val.path, ImageExts, val.vpath, val.path);
        PicturePathTagMap.images = PicturePathTagMap.images.concat(indata);
      } catch {
        logger.warn(`图片目录不存在: ${val.path}`);
      }
    }
    logger.info(`找到 ${PicturePathTagMap.images.length} 张图片`);

    // 读取音频文件名
    logger.info('使用音频路径:');
    for (const val of AudioPathTagMap.paths) {
      try {
        await fs.access(val.path);
        app.use(val.vpath, express.static(val.path));
        logger.info(val.path);
        const indata = await FileUtils.readVpathFileFromDir(val.path, AudioExts, val.vpath, val.path);
        AudioPathTagMap.audios = AudioPathTagMap.audios.concat(indata);
      } catch {
        logger.warn(`音频目录不存在: ${val.path}`);
      }
    }
    logger.info(`找到 ${AudioPathTagMap.audios.length} 个音频文件`);

    // app use
    VideoPathTagMap.forEach((val, key) => { 
      app.use(val.vpath, express.static(val.path)); 
    });

    // 调用函数读取指定目录
    logger.info('使用视频路径:');
    for (let [key, val] of VideoPathTagMap) {
      try {
        const videolist = await FileUtils.getFilesAndFoldersInDir(val.path, VideoFilter);
        VideoNameList.set(key, videolist);
        logger.info(`${key} => ${val.path}`);
      } catch (err) {
        logger.error(`读取视频目录失败: ${val.path}`, err);
      }
    }
  } catch (err) {
    logger.error('初始化数据失败', err);
  }
}

///////////////////////////////////////////////////////////
// API路由
app.get('/api/server-content', (req, res) => {
  try {
    let content = [];
    if (PicturePathTagMap.images.length > 0) {
      let PicContent = { 
        uri: '/imageshow', 
        imguri: '/images/' + PicturePathTagMap.vpic, 
        til: PicturePathTagMap.tag 
      };
      content.push(PicContent);
    }
    if (AudioPathTagMap.audios.length > 0) {
      let PicContent = { 
        uri: '/music', 
        imguri: '/images/' + AudioPathTagMap.vpic, 
        til: AudioPathTagMap.tag 
      };
      content.push(PicContent);
    }

    VideoPathTagMap.forEach((val, key) => {
      const ele = { 
        uri: '/videos?key=' + encodeURIComponent(key), 
        imguri: '/images/' + val.vpic, 
        til: val.tag 
      };
      content.push(ele);
    });
    res.json(content);
  } catch (err) {
    logger.error('获取服务器内容失败', err);
    res.status(500).json({ error: '获取内容失败' });
  }
});

app.get('/api/play-list', async (req, res) => {
  try {
    const fullPath = req.query.fullPath;
    if (!fullPath) {
      return res.status(400).json({ error: '缺少 fullPath 参数' });
    }
    
    const dirs = fullPath.split(/[\\/]/);
    const vpath = '/' + dirs[1];
    let file_list = [];
    
    // 获取key
    const entry = Array.from(VideoPathTagMap.entries()).find(([key, val]) => {
      return val.vpath == vpath;
    });
    
    if (entry) {
      const [key, val] = entry;
      if (VideoPathTagMap.has(key)) {
        const videoInfo = VideoNameList.get(key);
        let subdir_files = videoInfo;
        
        // 目录一层一层的匹配下去
        for (let i = 2; i < dirs.length - 1; i++) {
          const subdir = dirs[i];
          const folder = subdir_files.find((val) => {
            return val.type == 'folder' && val.name == subdir;
          });
          
          if (folder && folder.children) {
            subdir_files = folder.children;
          } else {
            subdir_files = [];
            break;
          }
        }
        
        // 找到了同一个目录中的文件
        file_list = subdir_files
          .filter((val) => val.type == 'file')
          .map((val) => {
            return [...dirs.slice(0, -1), val.name].join('/');
          });
      }
    }
    
    res.json(file_list);
  } catch (err) {
    logger.error('获取播放列表失败', err);
    res.status(500).json({ error: '获取播放列表失败' });
  }
});

app.get('/api/video-list', (req, res) => {
  try {
    const key = req.query.key;
    let videoInfo = {};
    let vpath = '';
    
    if (key && VideoPathTagMap.has(key)) {
      videoInfo = VideoNameList.get(key);
      vpath = VideoPathTagMap.get(key).vpath;
    }
    
    res.json({ videoInfo: videoInfo, key: key, vpath: vpath });
  } catch (err) {
    logger.error('获取视频列表失败', err);
    res.status(500).json({ error: '获取视频列表失败' });
  }
});

app.get('/api/video-paths', (req, res) => {
  try {
    const videoPathList = Array.from(VideoPathTagMap.entries()).map(([key, val]) => {
      return { key: key, vpath: val.vpath };
    });
    res.json({ videoPathList: videoPathList });
  } catch (err) {
    logger.error('获取视频路径失败', err);
    res.status(500).json({ error: '获取视频路径失败' });
  }
});

app.get('/api/page-music', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    
    let audios = [];
    if (AudioPathTagMap.audios.length > 0) {
      let filter = req.query.filter;
      
      if (!filter || !filter.trim()) {
        audios = AudioPathTagMap.audios;
      } else {
        filter = filter.trim();
        audios = AudioPathTagMap.audios.filter((val) => {
          return path.basename(val).includes(filter);
        });
      }
    }
    
    const total = audios.length;
    let sendData = [];
    
    if (total > 0) {
      const startId = Math.max(0, (page - 1) * pageSize);
      const endId = Math.min(total, startId + pageSize);
      sendData = audios.slice(startId, endId);
    }
    
    res.json({ audios: sendData, total: total });
  } catch (err) {
    logger.error('获取音乐列表失败', err);
    res.status(500).json({ error: '获取音乐列表失败' });
  }
});

app.get('/api/lookfor-subtitles', async (req, res) => {
  try {
    const vitualPath = req.query.path;
    const subtitleExts = JSON.parse(req.query.subtitleExts);
    
    if (!vitualPath || !subtitleExts) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    let realdir = '';
    let vpath = '';
    
    // 获取实际目录和文件名
    for (const [key, val] of VideoPathTagMap) {
      if (val.vpath === vitualPath.substring(0, val.vpath.length)) {
        realdir = val.path;
        vpath = val.vpath;
        break;
      }
    }
    
    if (!realdir || !vpath) {
      return res.status(400).json({ error: '无效的路径' });
    }
    
    const realPath = path.join(realdir, vitualPath.substring(vpath.length));
    
    // 寻找字幕文件
    const subtitleFiles = await FileUtils.findOtherExtFiles(realPath, subtitleExts);

    // 修改字幕文件到虚拟目录
    const subtitles = [];
    const dirName = path.dirname(vitualPath);
    subtitleFiles.forEach((val) => {
      const tmp = path.join(dirName, val.file).replace(/\\/g, '/');
      subtitles.push({ file: tmp, label: val.label });
    });
    
    res.json({ subtitles: subtitles });
  } catch (err) {
    logger.error('获取字幕文件失败', err);
    res.status(500).json({ error: '获取字幕文件失败' });
  }
});

app.get('/api/all-images', (req, res) => {
  try {
    const subDirs = req.query.subDirs;
    const subDir = req.query.subDir;
    const excludes = req.query.excludes;

    const parseSubDirs = function (dirs) {
      if (!dirs || !dirs.trim()) {
        return [];
      } else {
        return dirs.trim().split(',');
      }
    };
    
    // 整理后的子目录 
    const actSubDirs = [...parseSubDirs(subDirs), ...parseSubDirs(subDir)];
    // 排除的目录
    const actExcludes = parseSubDirs(excludes);

    const genFilterPath = function (dirs) {
      if (!dirs || dirs.length === 0) {
        return [];
      }
      return PicturePathTagMap.paths.flatMap((_path) => {
        return dirs.map((_dir) => {
          return path.join(_path.vpath, _dir).replace(/\\/g, '/');
        });
      });
    };

    // 构造前缀，筛选文件
    let images = PicturePathTagMap.images;
    if (actSubDirs.length > 0) {
      const fullSubDirs = genFilterPath(actSubDirs);
      images = images.filter((item) => {
        return fullSubDirs.some((val) => item.includes(val));
      });
    }
    
    // 构造前缀，筛选文件
    if (actExcludes.length > 0) {
      const fullExcludes = genFilterPath(actExcludes);
      images = images.filter((item) => {
        return !fullExcludes.some((val) => item.includes(val));
      });
    }
    
    res.json({ images: images });
  } catch (err) {
    logger.error('获取图片列表失败', err);
    res.status(500).json({ error: '获取图片列表失败' });
  }
});

/////////////////////////////////////////////////////////////////////////
// 页面路由
app.get('/imageshow', (req, res) => {
  if (PicturePathTagMap.images.length > 0) {
    res.sendFile(path.join(__dirname, 'views', 'imageshow.html'));
  } else {
    res.send('没有图片可以显示');
  }
});

app.get('/play', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'play.html'));
});

app.get('/music', (req, res) => {
  if (AudioPathTagMap.audios.length > 0) {
    res.sendFile(path.join(__dirname, 'views', 'music.html'));
  } else {
    res.send('没有音频可以播放');
  }
});

app.get('/videos', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'treeinfos.html'));
});

app.get('/api/lookfor-danmaku', async (req, res) => {
  try {
    const danmakuSuffix = 'danmaku.xml';
    const vitualPath = req.query.path;
    
    if (!vitualPath) {
      return res.status(400).send('缺少路径参数');
    }
    
    let realdir = '';
    let vpath = '';
    
    // 获取实际目录和文件名
    for (const [key, val] of VideoPathTagMap) {
      if (val.vpath === vitualPath.substring(0, val.vpath.length)) {
        realdir = val.path;
        vpath = val.vpath;
        break;
      }
    }
    
    if (!realdir || !vpath) {
      return res.status(400).send('无效的路径');
    }
    
    const realPath = path.join(realdir, vitualPath.substring(vpath.length));
    const realDanmakuFilePath = realPath.substring(0, realPath.lastIndexOf('.') + 1) + danmakuSuffix;

    const data = await fs.readFile(realDanmakuFilePath, 'utf8');
    res.set('Content-Type', 'application/xml');
    res.send(data);
  } catch (err) {
    logger.error('获取弹幕文件失败', err);
    res.status(404).send('弹幕文件不存在');
  }
});

app.get('/gitlog', async (req, res) => {
  try {
    res.set('Content-Type', 'text/plain');
    const data = await fs.readFile('./gitlog.txt', 'utf8');
    res.status(200).send(data);
  } catch (err) {
    logger.error('读取gitlog失败', err);
    res.status(500).send(err.message);
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'cards.html'));
});

////////////////////////// 运行脚本 ////////////////////////////////////
// 全局错误处理
process.on('uncaughtException', (err) => {
  logger.error('未捕获的异常:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的 Promise 拒绝:', reason);
  process.exit(1);
});

// 初始化工作
async function initialize() {
  await initConfig();
  await initDatas();
}

// 如果直接运行 server.js，则启动服务器
if (require.main === module) {
  initialize().then(() => {
    app.listen(PORT, () => {
      logger.info(`服务器运行在 http://localhost:${PORT}`);
    });
  }).catch(err => {
    logger.error('服务器启动失败', err);
    process.exit(1);
  });
}

app.set('port', PORT);
module.exports = app;