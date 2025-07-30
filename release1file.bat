@echo off
chcp 65001 > nul
:: 设置代码为 utf8
setlocal enabledelayedexpansion
rem 只复制一个文件

:: 参数
if "%1"=="" (
    echo 请指定复制的文件
    goto :END
) else (
    set "target_file=%~1"
)
if "%2"=="" (
    set "target_dir=.\build"
) else (
    set "target_dir=%~2"
)
if not exist "%target_file%" (
    echo 文件不存在：%target_file%
    goto :END
)

:: 处理空格
for %%A in ("%target_file%") do set "target_file_from=%%~fA"
for %%A in ("%target_file%") do set "target_file_to=%target_dir%\%%~A"
for %%A in ("%target_file_to%") do set "target_sub_dir=%%~dpA"

if not exist "%target_sub_dir%" (
    echo 创建目录："%target_sub_dir%"
    mkdir "%target_sub_dir%"
)


:: 拷贝文件
echo 复制： "%target_file_from%"
echo 到： "%target_file_to%"
copy "%target_file_from%" "%target_file_to%"

:END
:: 结束
echo 操作结束
pause