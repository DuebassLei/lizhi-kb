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
