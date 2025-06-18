// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

//////////////////////// global datas ///////////////////////////////////
const PORT = 3000;
const ConfigFilePath = 'assets_config.json';
const VideoFilter = ['.mp4','.flv','.mkv','.rmvb'];
const ImageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', 'webp'];

var PicturePath = 'D:/Users/aywhe/Pictures/Pictures'; // 图片位置
var PictureVisualPath = '/ImageShow'; // 图片位置的虚拟目录
var PicturePathPic = 'imageshow.jpg'; // 图片位置的虚拟目录中卡片图片位置

let allImages = []; // 存储所有图片路径
var VideoNameList = new Map(); // 视频文件名列表
var VideoPathTagMap = new Map([
  ['DVideos', {path: 'D:/Users/aywhe/Videos', vpath: 'DVideos', vpic: 'DVideos.png'}]
]); // 不同视频位置有不同的标记名称

//////////////////////// tool functions /////////////////////////////////

// 检验文件名的后缀是否符合
function matchFilterName(name, filter){
  const ext = path.extname(name).toLowerCase();
  return filter.includes(ext);
}

// 获取文件及其子文件的文件名
function getFilesAndFoldersInDir(dir,filter=[]) {
  const result = [];
  const items = fs.readdirSync(dir);
  var bUseFilter = false;
  if(Array.isArray(filter) && filter.length > 0){
      bUseFilter = true;
  }
  items.forEach(item => {
      const itemPath = path.join(dir, item);
      const stats = fs.statSync(itemPath);
      if (stats.isDirectory()) {
          const children = getFilesAndFoldersInDir(itemPath,filter);
          if(children.length > 0) {
              result.push({ type: 'folder', name: item, children });
          }
      } else if(!bUseFilter || matchFilterName(item,filter)){
          result.push({ type: 'file', name: item });
      }
  });
  return result;
}

// 自定义断言
function assert(condition, message){
  if(!condition){
    throw new Error(message || 'Assertion failed');
  }
}

// 随机排列数组元素
function shuffleArray(arr){
  for(let i = arr.length -1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
}


////////////////////////// running functions //////////////////////////////////////

// 读取配置文件信息
function initConfig(){
  if(fs.existsSync(ConfigFilePath)){
    try{
      console.log('reading config from ' + ConfigFilePath);
      const content = fs.readFileSync(ConfigFilePath, 'utf8');
      console.log(content);
      const data = JSON.parse(content);
      PicturePath = data.PicturePath; // 图片位置
      PicturePathPic = data.PicturePathPic;
      VideoPathTagMap = new Map(Object.entries(data.VideoPathTagMap));
    }catch (err) {
      console.error('读取配置信息失败，将使用默认配置', err);
    }
  }else{
    console.log('config file ' + ConfigFilePath + 'is not found, use default config.');
  }
}
// 初始化工作
function initDatas(){
  // 删除无效的视频目录
  for(let [key, val] of VideoPathTagMap){
    if (!fs.existsSync(val.path)) {
      VideoPathTagMap.delete(key);
    }
  }

  //assert(fs.existsSync(PicturePath), "图片目录不存在");

  // 设置静态资源目录
  app.use(express.static('public'));
  if(!PicturePath === ''){
    app.use(PictureVisualPath, express.static(PicturePath));  
    // 初始化时读取所有图片
    readImagesFromDir(PicturePath);
  }
  // app use
  VideoPathTagMap.forEach((val, key) => {app.use(val.vpath, express.static(val.path));});

  // 调用函数读取指定目录
  console.log('use videos bellow: ')
  VideoPathTagMap.forEach((val, key) => {
    const videolist = getFilesAndFoldersInDir(val.path, VideoFilter);
    VideoNameList.set(key, videolist);
    console.log('' + key + ' => ' + val.path);
    //console.log(JSON.stringify(videolist, null, 2));
  });
}



// 递归生成 HTML 树结构
function buildTreeHtml(nodes, pathTag, currentPath = []) {
  return `
    <ul>
      ${nodes.map(node => {
        const newPath = [...currentPath, node.name];
        if (node.children) {
          return `
            <li>
              ${node.name}
              ${buildTreeHtml(node.children, pathTag, newPath)}
            </li>
          `;
        } else {
          // 文件节点，生成带完整路径的链接
          var fullPath = pathTag + '/' + newPath.join('/');
          return `
            <li>
              <a href="/play?path=${encodeURIComponent(fullPath)}">${node.name}</a>
            </li>
          `;
        }
      }).join('')}
    </ul>
  `;
}

function makeVideoTreeHtml(pathTag, videoList){
  const treesHtml = videoList.map((node, index) => `
    <div class="tree-root">
      <h3>${index + 1}: ${node.name} (${node.type})</h3>
      ${buildTreeHtml([node], pathTag)}
    </div>
  `).join('');
  const html = `
    <!DOCTYPE html>
    <html lang="zh">
    <head>
      <meta charset="UTF-8" />
      <title>视频列表</title>
      <link rel="stylesheet" href="css/assert-tree.css" />
    </head>
    <body>
      <h1>文件列表</h1>
      ${treesHtml}
    </body>
    </html>
  `;
  return html;
}

//
app.get('/videos', (req, res) => {
  var lis = [];
  VideoPathTagMap.forEach((val, key) => {
    var li = '<li>'+ '<a href="/videos/' + key + '">' + val.vpath + '</a></li>';
    lis.push(li);
  });
  const treesHtml = '<ul>' + lis.join('') + '</ul>';
  const html = `
    <!DOCTYPE html>
    <html lang="zh">
    <head>
      <meta charset="UTF-8" />
      <title>位置列表</title>
      <link rel="stylesheet" href="css/assert-tree.css" />
    </head>
    <body>
      <h1>位置列表</h1>
      ${treesHtml}
    </body>
    </html>
  `;
  res.send(html);
});

app.get('/api/server-content', (req, res) => {
  let content = [];
  if(allImages.length > 0){
    let PicContent = {uri:'/imageshow', imguri:'/images/' + PicturePathPic, til:'/imageshow'};
    content.push(PicContent);
  }
  VideoPathTagMap.forEach((val, key) => {
    const ele = {uri:'/videos/' + key, imguri:'/images/' + val.vpic, til: '/' + key};
    content.push(ele);
  });
  res.json(content);
});

app.get('/',(req, res) => {
  res.sendFile(path.join(__dirname, 'views','index.html'));
});

// 主页 - 展示树结构
app.get('/videos/:type', (req, res) => {
  const { type } = req.params;
  if(VideoPathTagMap.has(type)){
    const videoList = VideoNameList.get(type);
    var html = makeVideoTreeHtml(VideoPathTagMap.get(type).vpath, videoList);
    res.send(html);
  }
  else{
    res.redirect('/videos');
  }
});

// 播放页面
app.get('/play', (req, res) => {
  res.sendFile(path.join(__dirname, 'views','play.html'));
});

/**
 * 递归读取图片目录
 * @param {string} dirPath - 当前目录路径
 */
function readImagesFromDir(dirPath) {
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // 如果是子目录，递归处理
      readImagesFromDir(filePath);
    } else {
      // 只添加图片文件
      const ext = path.extname(file).toLowerCase();
      if (ImageExts.includes(ext)) {
        // 添加相对URL路径
        const relativePath = path.relative(PicturePath, filePath)
          .replace(/\\/g, '/'); // Windows兼容
        
        allImages.push(`${PictureVisualPath}/${relativePath}`);
      }
    }
  });
}


// 获取所有图片列表接口（用于slideshow）
app.get('/api/all-images', (req, res) => {
  res.json({ images: allImages });
});

// 主页路由
app.get('/imageshow', (req, res) => {
  if(!PicturePath === ''){
    allImages = shuffleArray(allImages);
    res.sendFile(path.join(__dirname, 'views', 'imageshow.html'));
  }else{
    res.send('没有图片可以显示');
  }
});
////////////////////////// 运行脚本 ////////////////////////////////////
// 初始化工作
initConfig();
initDatas();
// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`${PicturePath} 找到 ${allImages.length} 张图片`);
});