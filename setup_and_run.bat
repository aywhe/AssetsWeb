@echo off
chcp 65001 >nul
title AssetsWeb 一键启动工具

echo ===============================================
echo        AssetsWeb 多媒体服务器一键启动工具
echo ===============================================
echo.

REM 检测Node.js
echo 1. 检测Node.js环境...
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Node.js 已安装
    node --version
) else (
    echo ✗ 未检测到Node.js
    echo 请先安装Node.js，然后重新运行此脚本
    echo 下载地址：https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo.
echo 2. 配置文件说明
echo 注意：请先打开 assets_config.json 文件，根据您的电脑环境修改以下路径：
echo    - AudioPathTagMap.paths[].path: 音频文件所在目录
echo    - PicturePathTagMap.paths[].path: 图片文件所在目录  
echo    - VideoPathTagMap[].path: 视频文件所在目录
echo    - FtpConfig.paths[].rootPath: FTP共享的目录
echo.
echo    例如将 "D:/Users/aywhe/Music" 改为您电脑上的实际音乐文件夹路径
echo.
set /p continue=确认已修改配置文件？(按 Enter 继续，Ctrl+C 取消)：

echo.
echo 3. 检测并安装依赖...
if exist "package-lock.json" (
    echo package-lock.json 已存在，跳过npm install
) else (
    echo 正在安装依赖包...
    npm install --registry https://mirrors.cloud.tencent.com/npm/
    if %errorlevel% neq 0 (
        echo 安装依赖失败，请检查网络连接
        pause
        exit /b 1
    )
    echo ✓ 依赖安装完成
)

echo.
echo 4. 启动服务器...
echo 服务器即将启动，请稍候...
echo 当看到 "服务器运行在 http://localhost:3000" 时，表示启动成功
echo.
echo 提示：服务器启动后不要关闭此窗口，否则服务会停止
echo.

REM 启动应用
node app.js

pause