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
var VideoPathArr = ['D:/Users/aywhe/Videos']; // 不同视频位置
var VideoPathVisualArr = ['/DVideos']; // 不同视频位置的虚拟目录

let allImages = []; // 存储所有图片路径
var VideoNameList = new Map(); // 视频文件名列表
var VideoPathTagMap = new Map(); // 不同视频位置有不同的标记名称

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
      VideoPathArr = data.VideoPathArr; // 不同视频位置
      VideoPathVisualArr = data.VideoPathVisualArr; // 不同视频位置的虚拟目录
    }catch (err) {
      console.error('读取配置信息失败', err);
    }
  }else{
    console.log('config file ' + ConfigFilePath + 'is not found, use default config.');
  }
}
// 初始化工作
function initDatas(){

  assert(VideoPathVisualArr.length == VideoPathArr.length,'目录数量必需相同');
  
  for(let i = 0; i < VideoPathArr.length; i++){
    if (fs.existsSync(VideoPathArr[i])) {
      VideoPathTagMap.set(VideoPathVisualArr[i], VideoPathArr[i]);
    }
  }

  assert(fs.existsSync(PicturePath), "图片目录不存在");

  // 设置静态资源目录
  app.use(express.static('public'));
  app.use('/images', express.static(PicturePath));  
  // app use
  VideoPathTagMap.forEach((val, key) => {app.use(key, express.static(val));});

  // 调用函数读取指定目录
  VideoPathTagMap.forEach((val, key) => {
    const videolist = getFilesAndFoldersInDir(val, VideoFilter);
    VideoNameList.set(key, videolist);
    console.log(' ' + key + ' => ' + val);
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

function makeVideoTreeHtml(pathTag){
  const videoList = VideoNameList.get(pathTag);
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
app.get('/', (req, res) => {
  var lis = [];
  VideoPathTagMap.forEach((val, key) => {
    var li = '<li>'+ '<a href="/videos' + key + '">' + key + '</a></li>';
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

app.get('/videos', (req, res) => {
  res.redirect('/videos'+VideoPathVisualArr[0]);
});

// 主页 - 展示树结构
app.get('/videos/:type', (req, res) => {
  const { type } = req.params;
  var pathTag = VideoPathVisualArr[0];
  if(VideoPathTagMap.has('/'+type)){
    pathTag = '/'+type;
  }
  var html = makeVideoTreeHtml(pathTag);
  res.send(html);
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
        
        allImages.push(`/images/${relativePath}`);
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
  allImages = shuffleArray(allImages);
  res.sendFile(path.join(__dirname, 'views', 'imageshow.html'));
});
////////////////////////// 运行脚本 ////////////////////////////////////
// 初始化工作
initConfig();
initDatas();
// 初始化时读取所有图片
readImagesFromDir(PicturePath);
// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`${PicturePath} 找到 ${allImages.length} 张图片`);
});