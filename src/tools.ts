import { workspace, env } from 'vscode';
import { exec, type ExecException } from "child_process";

// 切换当前 VSCode 窗口到前台
export function bringVscodeToFront() {
  // 获取当前工作区的第一个文件夹名称
  const workspaceName = workspace.workspaceFolders![0].name;
  // 获取当前语言环境下的工作区名称
  const workArea = {
    'en': 'Workspace',
    'zh-cn': '工作区',
    'zh-tw': '工作區',
    'ja': 'ワークスペース',
    'ko': '작업 영역',
  }[env.language] || 'Workspace';
  // 根据操作系统平台执行不同的命令
  const map = {
    win32: `powershell -Command "$wshell = New-Object -ComObject wscript.shell; $wshell.AppActivate('${workspaceName} - Visual Studio Code'); $wshell.AppActivate('${workspaceName} (${workArea}) - Visual Studio Code')"`,
    darwin: `osascript -e 'tell application "Visual Studio Code" to activate' -e 'delay 0.1' -e 'tell application "System Events" to keystroke "${workspaceName}"'`,
    linux: `xdotool search --name "${workspaceName} - Visual Studio Code" windowactivate; xdotool search --name "${workspaceName} (${workArea}) - Visual Studio Code" windowactivate`,
  };
  const command = process.platform in map ? map[process.platform as keyof typeof map] : null;
  // 执行命令
  return new Promise<ExecException | null | Error>((resolve) => {
    command ? exec(command, resolve) : resolve(Error("不支持的操作系统平台"));
  });
}
