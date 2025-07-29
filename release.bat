@echo off
chcp 65001 > nul
:: 设置代码为 utf8
setlocal enabledelayedexpansion
rem 发布程序

:: 参数
if "%1"=="" (
    set "target_dir=.\build"
) else (
    set "target_dir=%~1"
)

:: 处理空格
for %%A in ("%target_dir%") do set "target_dir=%%~fA"

:: 创建目录
if exist "%target_dir%" (
    echo 删除目录...
    rmdir /s /q "%target_dir%"
)
echo 创建目录：%target_dir%
mkdir "%target_dir%"

:: 拷贝文件
copy "server.js" "%target_dir%\server.js"
echo copied server.js
copy "assets_config.json" "%target_dir%\assets_config.json"
echo copied assets_config.json
xcopy /s /e /i "views" "%target_dir%\views"
xcopy /s /e /i "public" "%target_dir%\public"

:: 程序日志
git log --encoding=UTF-8 --oneline > "%target_dir%\gitlog.txt"

:: 结束
echo 操作结束
pause