use std::env;
use std::process;
use std::sync::Arc;

use lizhi_kb_lib::mcp::{load_mcp_config, StandaloneServer};
use lizhi_kb_lib::{data_dir, init_app_state, sync_document_connection, AppState};

fn print_help() {
    eprintln!(
        "lizhi-mcpd — 狸知知识库 MCP Sidecar（Phase 2）

用法:
  lizhi-mcpd [--port=13722] [--write] [--no-timeout]

说明:
  - 狸知桌面应用未运行时可独立访问 vault
  - 通过 ~/.lizhi-kb/mcp-config.json 中的 token 鉴权
  - 加密库启动时在终端提示输入主密码（不会写入环境变量）
  - 与桌面应用互斥：不可同时运行

环境变量:
  LIZHI_KB_DATA_DIR  可选，覆盖默认 ~/.lizhi-kb 路径
"
    );
}

struct CliOptions {
    port: Option<u16>,
    write_enabled: Option<bool>,
    no_timeout: bool,
}

fn parse_args() -> CliOptions {
    let mut opts = CliOptions {
        port: None,
        write_enabled: None,
        no_timeout: false,
    };
    for arg in env::args().skip(1) {
        match arg.as_str() {
            "--help" | "-h" => {
                print_help();
                process::exit(0);
            }
            "--write" => opts.write_enabled = Some(true),
            "--read-only" => opts.write_enabled = Some(false),
            "--no-timeout" => opts.no_timeout = true,
            other if let Some(value) = other.strip_prefix("--port=") => {
                opts.port = value.parse().ok();
            }
            _ => {
                eprintln!("未知参数: {arg}（使用 --help 查看帮助）");
                process::exit(2);
            }
        }
    }
    opts
}

fn ensure_unlocked(app_state: &AppState) -> Result<(), String> {
    let status = app_state
        .vault_service
        .lock()
        .map_err(|_| "vault service lock poisoned".to_string())?
        .get_status();

    if !status.exists {
        return Err("知识库尚未初始化，请先用狸知桌面应用创建 vault".into());
    }

    if !status.encryption_enabled || !status.is_locked {
        return Ok(());
    }

    let password = rpassword::prompt_password("狸知主密码: ")
        .map_err(|e| format!("读取密码失败: {e}"))?;
    if password.is_empty() {
        return Err("主密码不能为空".into());
    }

    {
        let mut vault = app_state
            .vault_service
            .lock()
            .map_err(|_| "vault service lock poisoned".to_string())?;
        vault
            .unlock_vault(password)
            .map_err(|e| format!("解锁失败: {e}"))?;
    }

    let mut document_service = app_state
        .document_service
        .lock()
        .map_err(|_| "document service lock poisoned".to_string())?;
    let vault_service = app_state
        .vault_service
        .lock()
        .map_err(|_| "vault service lock poisoned".to_string())?;
    sync_document_connection(&mut document_service, &vault_service)
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn main() {
    let cli = parse_args();
    let data_dir = data_dir().expect("failed to resolve lizhi-kb data directory");

    let mut mcp_config = load_mcp_config(&data_dir)
        .unwrap_or_else(|e| {
            eprintln!("加载 MCP 配置失败: {e}");
            process::exit(1);
        });

    if let Some(port) = cli.port {
        mcp_config.standalone_port = port;
    }
    if let Some(write) = cli.write_enabled {
        mcp_config.write_enabled = write;
    }
    if cli.no_timeout {
        mcp_config.session_timeout_minutes = 0;
    }

    let app_state = Arc::new(init_app_state().unwrap_or_else(|e| {
        eprintln!("初始化知识库失败: {e}");
        process::exit(1);
    }));

    if let Err(e) = ensure_unlocked(&app_state) {
        eprintln!("{e}");
        process::exit(1);
    }

    let _server = StandaloneServer::start(app_state, mcp_config, &data_dir).unwrap_or_else(
        |e| {
            eprintln!("{e}");
            process::exit(1);
        },
    );

    // 阻塞主线程，直到 Sidecar 进程被终止
    loop {
        std::thread::park();
    }
}
