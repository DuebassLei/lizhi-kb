use tiny_http::Request;

pub fn extract_bearer_token(request: &Request) -> Option<String> {
    request
        .headers()
        .iter()
        .find(|h| h.field.equiv("Authorization"))
        .and_then(|h| {
            let value = h.value.as_str();
            value
                .strip_prefix("Bearer ")
                .or_else(|| value.strip_prefix("bearer "))
                .map(|t| t.trim().to_string())
        })
}

pub fn validate_token(request: &Request, expected_token: &str) -> Result<(), &'static str> {
    let Some(token) = extract_bearer_token(request) else {
        return Err("UNAUTHORIZED");
    };
    if token != expected_token {
        return Err("UNAUTHORIZED");
    }
    Ok(())
}
