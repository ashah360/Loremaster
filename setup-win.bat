@echo off

NET SESSION >nul 2>&1

IF %ERRORLEVEL% NEQ 0 (
    echo This setup needs admin permissions. Please run this file as admin.
    pause
    exit
)

set NODE_VER=null
set NODE_EXEC=node-v13.3.0-x86.msi
set SETUP_DIR=%CD%

echo Using directory: %cd%

pause

node -v >tmp.txt
set /p NODE_VER=<tmp.txt
del tmp.txt

IF %NODE_VER% NEQ null (
    echo Installing node v13.3.0...

    IF NOT EXIST tmp (
        mkdir tmp
    )

    IF NOT EXIST tmp/%NODE_EXEC% (
        echo Node setup file does not exist. Downloading ...
        cd ../bin
        START /WAIT curl http://nodejs.org/dist/v13.3.0/%NODE_EXEC% --output tmp/%NODE_EXEC%
        move %NODE_EXEC% %SETUP_DIR%/tmp
    )
    cd %SETUP_DIR%/tmp
    START /WAIT %NODE_EXEC%
    cd %SETUP_DIR%
) ELSE (
    echo Node is already installed. Proceeding ...
)

echo Continue once node is done installing
pause

echo Installing modules...
cd %~dp0
npm install --production -q

echo Setup complete