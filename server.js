// version 1.0 wwy 20250616
// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

//////////////////////// global datas ///////////////////////////////////
const PORT = 3000;
const PicturePath = 'D:/Users/aywhe/Pictures/Pictures'; // 图片位置
const VideoPathArr = ['D:/Users/aywhe/Videos', 'E:/电影']; // 不同视频位置
const VideoPathVisualArr = ['/DVideos', '/EVideos']; // 不同视频位置的虚拟目录
const VideoPathTag = ['DV', 'EV']; // 不同视频位置有不同的标记名称
const VideoFilter = ['.mp4','.flv','.mkv','.rmvb'];

let allImages = []; // 存储所有图片路径
var VideoPathNum = 1; // 视频位置数量
var VideoNameList = []; // 视频文件名列表
var VideoPathTagMap = new Map(); // 不同视频位置有不同的标记名称

//////////////////////// tool functions /////////////////////////////////

// 检验文件名的后缀是否符合
function matchFilterName(name, filter){
  name = name.toLowerCase();
  for(let i = 0; i < filter.length; i++){
      item = filter[i].toLowerCase();
      if(item.length < name.length && item === name.slice(-item.length)){
          return true;
      }
  };
  return false;
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

////////////////////////// 运行脚本 //////////////////////////////////////
// 初始化工作
function initDatas(){
  assert(VideoPathVisualArr.length == VideoPathArr.length && VideoPathArr.length == VideoPathTag.length,'目录数量必需相同');
  VideoPathNum = VideoPathVisualArr.length;
  for(let i = 0; i < VideoPathNum; i++){
    if (!fs.existsSync(VideoPathArr[i])) {
      VideoPathNum = i;
      break;
    }
  }
  assert(VideoPathNum > 0, "必需有视频目录存在");
  assert(fs.existsSync(PicturePath), "图片目录不存在");

  // 设置静态资源目录
  app.use(express.static('public'));
  app.use('/images', express.static(PicturePath));  
  // app use
  for(let i = 0; i < VideoPathNum; i++){
    app.use(VideoPathVisualArr[i], express.static(VideoPathArr[i]));
  }

  // 调用函数读取指定目录
  for(let i = 0; i < VideoPathNum; i++){
    const videolist = getFilesAndFoldersInDir(VideoPathArr[i],VideoFilter);
    VideoNameList.push(videolist);
    console.log(JSON.stringify(videolist, null, 2));
  }
  // 不同目录的索引位置
  for(let i = 0; i < VideoPathNum; i++){
    VideoPathTagMap.set(VideoPathTag[i], i);
  }
}
// 初始化工作
initDatas();


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
          const fullPath = newPath.join('/');
          return `
            <li>
              <a href="/play?pathTag=${pathTag}&path=${encodeURIComponent(fullPath)}">${node.name}</a>
            </li>
          `;
        }
      }).join('')}
    </ul>
  `;
}

function makeVideoTreeHtml(pathTag){
  const videoList = VideoNameList[VideoPathTagMap.get(pathTag)];
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
      <style>
        ul { list-style-type: none; padding-left: 20px; }
        li { margin: 5px 0; }
        a { text-decoration: none; color: blue; cursor: pointer; }
        .tree-root { margin-bottom: 2em; border: 1px solid #ddd; padding: 1em; border-radius: 8px; background: #f9f9f9; }
        h3 { margin-top: 0; color: #333; }
      </style>
    </head>
    <body>
      <h1>树状结构 - 视频播放器</h1>
      ${treesHtml}
    </body>
    </html>
  `;
  return html;
}

// 主页 - 展示树结构
app.get('/videos', (req, res) => {
  var pathTag = VideoPathTag[0];
  if(VideoPathTagMap.has(req.query.pathTag)){
    pathTag = req.query.pathTag;
  }
  var html = makeVideoTreeHtml(pathTag);
  res.send(html);
});

// 播放页面
app.get('/play', (req, res) => {
  const fullPath = req.query.path;
  const pathTag = req.query.pathTag;
  if (!fullPath) return res.status(400).send('缺少路径参数');
  if (!pathTag) return res.status(400).send('缺少位置参数');
  if(!VideoPathTagMap.has(pathTag)) return res.status(400).send('位置参数错误');
  // 将路径转换为实际的文件系统路径
  const pathIdx = VideoPathTagMap.get(pathTag);
  const videoFilePath = path.join(VideoPathArr[pathIdx], fullPath);//.replace(/\//g, '\\')); // 将 / 替换为 \

  // 检查文件是否存在
  const fs = require('fs');
  if (!fs.existsSync(videoFilePath)) {
    return res.status(404).send('文件不存在');
  }

  const videoUrlPath = `${VideoPathVisualArr[pathIdx]}/${fullPath}`; // URL 路径保持使用 /
  var ext = fullPath.substring(fullPath.lastIndexOf('.')+1);
    const html = `
      <!DOCTYPE html>
      <html lang="zh">
      <head>
        <meta charset="UTF-8" />
        <title>正在播放 ${fullPath}</title>
        <style>
          body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #111; color: white; }
          video { width: 80%; max-width: 800px; }
        </style>
      </head>
      <body>
        <div>
          <h2>正在播放：${fullPath}</h2>
          <video controls autoplay>
            <source src="${videoUrlPath}" type="video/${ext}">
            您的浏览器不支持视频播放。
          </video>
        </div>
      </body>
      </html>
    `;
  
  res.send(html);
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
      if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(ext)) {
        // 添加相对URL路径
        const relativePath = path.relative(PicturePath, filePath)
          .replace(/\\/g, '/'); // Windows兼容
        
        allImages.push(`/images/${relativePath}`);
      }
    }
  });
}

// 初始化时读取所有图片
readImagesFromDir(PicturePath);


// 获取所有图片列表接口（用于slideshow）
app.get('/api/all-images', (req, res) => {
  res.json({ images: allImages });
});

// 主页路由
app.get('/imageshow', (req, res) => {
  allImages = shuffleArray(allImages);
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`找到 ${allImages.length} 张图片`);
});