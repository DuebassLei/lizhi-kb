use std::process::Command;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Build a child process that does not flash a console window on Windows.
pub fn hidden_command(program: impl AsRef<std::ffi::OsStr>) -> Command {
    let mut cmd = Command::new(program);
    hide_console_window(&mut cmd);
    cmd
}

/// No-op on non-Windows; on Windows sets CREATE_NO_WINDOW.
#[cfg(windows)]
pub fn hide_console_window(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
pub fn hide_console_window(_cmd: &mut Command) {}

/// Terminate a process and its children (Windows process tree / Unix kill).
pub fn kill_process_tree(pid: u32) -> Result<(), String> {
    #[cfg(windows)]
    {
        let status = hidden_command("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .status()
            .map_err(|e| format!("终止 Agent 进程失败: {e}"))?;
        if !status.success() {
            return Err("终止 Agent 进程失败".into());
        }
    }
    #[cfg(not(windows))]
    {
        let status = hidden_command("kill")
            .arg(pid.to_string())
            .status()
            .map_err(|e| format!("终止 Agent 进程失败: {e}"))?;
        if !status.success() {
            return Err("终止 Agent 进程失败".into());
        }
    }
    Ok(())
}
