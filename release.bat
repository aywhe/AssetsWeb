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

:: 是否全部重新复制
if "%2"=="rebuild" (
    if exist "%target_dir%" (
        echo 删除目录："%target_dir%"
        rmdir /s /q "%target_dir%"
    )
)
:: 创建目录
if not exist "%target_dir%" (
    echo 创建目录："%target_dir%"
    mkdir "%target_dir%"
)


:: 拷贝文件
xcopy ".\*.js" "%target_dir%\" /D /Y
xcopy ".\assets_config.json" "%target_dir%\" /D /Y
xcopy "views" "%target_dir%\views" /D /Y /E /I
xcopy "public" "%target_dir%\public" /D /Y /E /I

:: 程序日志
git log --encoding=UTF-8 --oneline > "%target_dir%\gitlog.txt"

:: 结束
echo 操作结束
pause