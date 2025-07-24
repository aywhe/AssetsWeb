// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const __DEBUG__ = false;

//////////////////////// global datas ///////////////////////////////////
const ConfigFilePath = 'assets_config.json';
var PORT = 3000;
var VideoFilter = ['.mp4', '.flv', '.mkv', '.rmvb'];
var ImageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
var AudioExts = ['.mp3', '.wma', '.ogg', '.wav'];
//const SubtitleExts = ['.srt','.vtt', '.ass'];

// 图片
var PicturePathTagMap = {
  images: [], // 存储所有图片路径
  vpic: 'imageshow.jpg', // 图片位置的虚拟目录中卡片图片位置
  paths: [{ path: 'D:/Users/aywhe/Pictures/Pictures', vpath: '/dimages' }] // 不同位置有不同的标记名称
};

// 视频
var VideoNameList = new Map(); // 视频文件名列表
var VideoPathTagMap = new Map([
  ['DVideos', { path: 'D:/Users/aywhe/Videos', vpath: '/DVideos', vpic: 'DVideos.png' }]
]); // 不同视频位置有不同的标记名称

// 音频
var AudioPathTagMap = {
  audios: [], // 存储所有路径
  vpic: 'playaudio.jpg', // 音频位置的虚拟目录中卡片图片位置
  paths: [{ path: 'D:/Users/aywhe/Music', vpath: '/daudios' }] // 不同位置有不同的标记名称
};

//////////////////////// tool functions /////////////////////////////////

// 检验文件名的后缀是否符合
function matchFilterName(name, filter) {
  const ext = path.extname(name).toLowerCase();
  return filter.includes(ext);
}

// 获取文件及其子文件的文件名
function getFilesAndFoldersInDir(dir, filter = []) {
  const result = [];
  const items = fs.readdirSync(dir);
  var bUseFilter = false;
  if (Array.isArray(filter) && filter.length > 0) {
    bUseFilter = true;
  }
  items.forEach(item => {
    const itemPath = path.join(dir, item);
    const stats = fs.statSync(itemPath);
    if (stats.isDirectory()) {
      const children = getFilesAndFoldersInDir(itemPath, filter);
      if (children.length > 0) {
        result.push({ type: 'folder', name: item, children });
      }
    } else if (!bUseFilter || matchFilterName(item, filter)) {
      result.push({ type: 'file', name: item });
    }
  });
  return result;
}
// 获取同一个目录中同文件名的其他类型文件
function findOtherExtFiles(fullPath, exts) {
  const dirName = path.dirname(fullPath);
  const baseName = path.basename(fullPath);
  const parts = baseName.split(".");
  var prefix = parts.slice(0, -1).join(".");
  var foundFiles = [];

  const items = fs.readdirSync(dirName);
  items.forEach(item => {
    const itemPath = path.join(dirName, item);
    const ext = path.extname(item).toLowerCase();
    const stats = fs.statSync(itemPath);
    if (!stats.isDirectory()) {
      if (prefix === item.substring(0, prefix.length) && exts.includes(ext)) {
        var label = item.substring(prefix.length + 1).split(".")[0];
        foundFiles.push({ file: item, label: label });
      }
    }
  });
  return foundFiles;
}
// 自定义断言
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// 随机排列数组元素
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}


/**
 * 递归读取图片目录
 * @param {string} dirPath - 当前目录路径
 */
function readVpathFileFromDir(dirPath, exts, vpath, vroot) {
  const files = fs.readdirSync(dirPath);
  var data = [];
  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // 如果是子目录，递归处理
      var indata = readVpathFileFromDir(filePath, exts, vpath, vroot);
      Array.prototype.push.apply(data, indata);
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
  });
  return data;
}

////////////////////////// running functions //////////////////////////////////////

// 读取配置文件信息
function initConfig() {
  if (fs.existsSync(ConfigFilePath)) {
    try {
      console.log('reading config from ' + ConfigFilePath);
      const content = fs.readFileSync(ConfigFilePath, 'utf8');
      console.log(content);
      const data = JSON.parse(content);
      //
      PORT = data.ServerPort;//3000;
      VideoFilter = data.VideoFilter;//['.mp4', '.flv', '.mkv', '.rmvb'];
      ImageExts = data.ImageExts;//['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
      AudioExts = data.AudioExts;//['.mp3', '.wma', '.ogg', '.wav'];
      //
      PicturePathTagMap = data.PicturePathTagMap;
      PicturePathTagMap.images = [];
      AudioPathTagMap = data.AudioPathTagMap;
      AudioPathTagMap.audios = [];
      VideoPathTagMap = new Map(Object.entries(data.VideoPathTagMap));
    } catch (err) {
      console.error('读取配置信息失败，将使用默认配置', err);
    }
  } else {
    console.log('config file ' + ConfigFilePath + 'is not found, use default config.');
  }
}
// 初始化工作
function initDatas() {
  // 删除无效的视频目录
  for (let [key, val] of VideoPathTagMap) {
    if (!fs.existsSync(val.path)) {
      VideoPathTagMap.delete(key);
    }
  }

  //assert(fs.existsSync(PicturePath), "图片目录不存在");

  // 设置静态资源目录
  app.use(express.static('public'));

  // 读取图片文件名
  console.log('use picture paths bellow: ')
  PicturePathTagMap.paths.forEach((val) => {
    if (fs.existsSync(val.path)) {
      app.use(val.vpath, express.static(val.path));
      // 初始化时读取所有图片
      console.log(val.path);
      const indata = readVpathFileFromDir(val.path, ImageExts, val.vpath, val.path);
      Array.prototype.push.apply(PicturePathTagMap.images, indata);
    }
  });
  console.log('找到 ' + PicturePathTagMap.images.length + ' 张图片');

  // 读取音频文件名
  console.log('use audio paths bellow: ')
  AudioPathTagMap.paths.forEach((val) => {
    if (fs.existsSync(val.path)) {
      app.use(val.vpath, express.static(val.path));
      // 初始化时读取所有图片
      console.log(val.path);
      const indata = readVpathFileFromDir(val.path, AudioExts, val.vpath, val.path);
      Array.prototype.push.apply(AudioPathTagMap.audios, indata);
    }
  });
  console.log('找到 ' + AudioPathTagMap.audios.length + ' 个音频文件');

  // app use
  VideoPathTagMap.forEach((val, key) => { app.use(val.vpath, express.static(val.path)); });

  // 调用函数读取指定目录
  console.log('use video paths bellow: ')
  VideoPathTagMap.forEach((val, key) => {
    const videolist = getFilesAndFoldersInDir(val.path, VideoFilter);
    VideoNameList.set(key, videolist);
    console.log('' + key + ' => ' + val.path);
    //console.log(JSON.stringify(videolist, null, 2));
  });
}


///////////////////////////////////////////////////////////
// 列举服务项目
app.get('/api/server-content', (req, res) => {
  let content = [];
  if (PicturePathTagMap.images.length > 0) {
    let PicContent = { uri: '/imageshow', imguri: '/images/' + PicturePathTagMap.vpic, til: PicturePathTagMap.tag };
    content.push(PicContent);
  }
  if (AudioPathTagMap.audios.length > 0) {
    let PicContent = { uri: '/music', imguri: '/images/' + AudioPathTagMap.vpic, til: AudioPathTagMap.tag };
    content.push(PicContent);
  }

  VideoPathTagMap.forEach((val, key) => {
    const ele = { uri: '/videos?key=' + encodeURIComponent(key), imguri: '/images/' + val.vpic, til: val.tag };
    content.push(ele);
  });
  res.json(content);
});
// 获取播放页同目录列表
app.get('/api/play-list', (req, res) => {
  const fullPath = req.query.fullPath;
  const dirs = fullPath.split(/[\\/]/);
  const vpath = '/' + dirs[1];
  var file_list = [];
  try {
    const key = Array.from(VideoPathTagMap.entries()).filter(([key, val]) => {
      return val.vpath == vpath;
    })[0][0];
    if ((!(undefined === key)) && (!('' === key)) && VideoPathTagMap.has(key)) {
      const videoInfo = VideoNameList.get(key);
      var folder_ind = 2;
      var subdir_files = videoInfo;
      dirs.slice(2, -1).forEach((subdir) => {
        subdir_files = subdir_files.filter((val) => {
          return val.type == 'folder' && val.name == subdir;
        })[0].children;
      });
      file_list = subdir_files.map((val) => {
        return [...dirs.slice(0, -1), val.name].join('/');
      });
    } else {

    }
  } catch (err) {
    console.error('获取播放列表失败', err);
  }
  res.json(file_list);
});
// 获取视频目录结构
app.get('/api/video-list', (req, res) => {
  const key = req.query.key;
  var videoInfo = {};
  var vpath = '';
  if ((!(undefined === key)) && (!('' === key)) && VideoPathTagMap.has(key)) {
    videoInfo = VideoNameList.get(key);
    vpath = VideoPathTagMap.get(key).vpath;
  }
  res.json({ videoInfo: videoInfo, key: key, vpath: vpath });
});

// 获取视频目录结构
app.get('/api/video-paths', (req, res) => {
  const videoPathList = Array.from(VideoPathTagMap.entries()).map(([key, val]) => {
    return { key: key, vpath: val.vpath };
  });
  res.json({ videoPathList: videoPathList });
});

// 获取音乐文件信息
app.get('/api/page-music', (req, res) => {
  const page = parseInt(req.query.page);
  const pageSize = parseInt(req.query.pageSize);
  //
  if (AudioPathTagMap.audios.length > 0) {
    var filter = req.query.filter;
    var audios = [];
    //
    if (undefined === filter || null === filter || '' === filter.trim()) {
      audios = AudioPathTagMap.audios;
    } else {
      audios = [];
      filter = filter.trim();
      AudioPathTagMap.audios.forEach((val, ind) => {
        if (path.basename(val).includes(filter)) {
          audios.push(val);
        }
      });
    }
  }
  const total = audios.length;
  var sendData = [];
  if (total > 0) {
    // 
    if (page <= 0) { page = 1; }
    if (pageSize <= 0) { pageSize = 10; }
    var startId = (page - 1) * pageSize;
    if (startId < 0 || startId >= total) { startId = 0; }
    var endId = startId + pageSize;
    if (endId <= 0 || endId > total) { endId = total; }
    //console.log(page + ',' + pageSize + ',' + startId + ',' + endId);
    sendData = audios.slice(startId, endId);
  }
  //console.log('send ' + sendData.length + ' audios')
  res.json({ audios: sendData, total: total });
});

// 获取字幕文件
app.get('/api/lookfor-subtitles', (req, res) => {
  const vitualPath = req.query.path;
  const subtitleExts = JSON.parse(req.query.subtitleExts);
  var realdir = '';
  var vpath = '';
  // 获取实际目录和文件名
  for (const [key, val] of VideoPathTagMap) {
    if (val.vpath === vitualPath.substring(0, val.vpath.length)) {
      realdir = val.path;
      vpath = val.vpath;
      break;
    }
  }
  var realPath = path.join(realdir, vitualPath.substring(vpath.length));
  // 寻找字幕文件
  var subtitleFiles = findOtherExtFiles(realPath, subtitleExts);

  // 修改字幕文件到虚拟目录
  var subtitles = [];
  var dirName = path.dirname(vitualPath);
  subtitleFiles.forEach((val, ind) => {
    var tmp = path.join(dirName, val.file).replace(/\\/g, '/');
    subtitles.push({ file: tmp, label: val.label });
  });
  res.json({ subtitles: subtitles });
});

// 获取所有图片列表（用于slideshow）
app.get('/api/all-images', (req, res) => {
  const subDirs = req.query.subDirs;
  const subDir = req.query.subDir;
  const excludes = req.query.excludes;

  const parseSubDirs = function(dirs){
    // 分割字符串参数
    if (undefined === dirs || null === dirs || '' === dirs.trim()) {
      return [];
    } else {
      return dirs.trim().split(',');
    }
  };
  // 整理后的子目录 
  var actSubDirs = [...parseSubDirs(subDirs), ...parseSubDirs(subDir)];
  // 排除的目录
  var actExcludes = parseSubDirs(excludes);

  if(__DEBUG__) {console.dir(actSubDirs);}
  if(__DEBUG__) {console.dir(actExcludes);}

  const genFilterPath = function(dirs){
    // 构造完整目录前缀
    if (undefined === dirs || null === dirs || 0 == dirs.length) {
      return [];
    }
    return PicturePathTagMap.paths.map((_path) => {
      return dirs.map((_dir) => {
        return path.join(_path.vpath, _dir).replace(/\\/g, '/');
      });
    }).flat();
  };

  // 构造前缀，筛选文件
  var images = PicturePathTagMap.images;
  if (actSubDirs.length > 0) {
    var fullSubDirs = genFilterPath(actSubDirs);
    images = images.filter((item) => {
      // 筛选
      return fullSubDirs.some((val) => {
        return item.includes(val);
      });
    });
  }
  // 构造前缀，筛选文件
  if (actExcludes.length > 0) {
    var fullExcludes = genFilterPath(actExcludes);
    images = images.filter((item) => {
      // 排除
      return !fullExcludes.some((val) => {
        return item.includes(val);
      });
    });
  }
  // response
  res.json({ images: images });
});

/////////////////////////////////////////////////////////////////////////
// 图片轮播页面
app.get('/imageshow', (req, res) => {
  if (PicturePathTagMap.images.length > 0) {
    PicturePathTagMap.images = shuffleArray(PicturePathTagMap.images);
    res.sendFile(path.join(__dirname, 'views', 'imageshow.html'));
  } else {
    res.send('没有图片可以显示');
  }
});

// 播放视频页面
app.get('/play', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'play.html'));
});

// 播放音乐页面
app.get('/music', (req, res) => {
  if (AudioPathTagMap.audios.length > 0) {
    res.sendFile(path.join(__dirname, 'views', 'music.html'));
  } else {
    res.send('没有音频可以播放');
  }
});

// 视频列表页面
app.get('/videos', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'treeinfos.html'));
});

// 主页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'cards.html'));
});

////////////////////////// 运行脚本 ////////////////////////////////////
// 初始化工作
initConfig();
initDatas();

if(__DEBUG__) {PORT = 3001;}

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});