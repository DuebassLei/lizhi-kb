/**
 * 微信公众号基础排版兜底 CSS
 * 参考 md-wechat-editor / markdown-nice basic.js，提供微信兼容的默认样式。
 */
export const WECHAT_BASE_CSS = `
#nice {
  font-size: 16px;
  color: #3f3f3f;
  padding: 0 10px;
  line-height: 1.6;
  word-spacing: 0px;
  letter-spacing: 0px;
  word-break: break-word;
  word-wrap: break-word;
  text-align: left;
  font-family: Optima-Regular, Optima, PingFangSC-light, PingFangTC-light, 'PingFang SC', Cambria, Cochin, Georgia, Times, 'Times New Roman', serif;
  margin-top: -10px;
}

#nice p {
  font-size: 16px;
  padding-top: 8px;
  padding-bottom: 8px;
  margin: 0;
  line-height: 1.75;
  color: #3f3f3f;
}

#nice h1, #nice h2, #nice h3, #nice h4, #nice h5, #nice h6 {
  margin-top: 30px;
  margin-bottom: 15px;
  font-weight: bold;
  color: #3f3f3f;
  line-height: 1.5;
}
#nice h1 { font-size: 24px; }
#nice h2 { font-size: 22px; }
#nice h3 { font-size: 20px; }
#nice h4 { font-size: 18px; }
#nice h5 { font-size: 16px; }
#nice h6 { font-size: 16px; }

#nice h1 .prefix, #nice h2 .prefix, #nice h3 .prefix,
#nice h4 .prefix, #nice h5 .prefix, #nice h6 .prefix { display: none; }
#nice h1 .suffix, #nice h2 .suffix, #nice h3 .suffix,
#nice h4 .suffix, #nice h5 .suffix, #nice h6 .suffix { display: none; }

#nice ul, #nice ol {
  margin-top: 8px;
  margin-bottom: 8px;
  padding-left: 25px;
}
#nice ul { list-style-type: disc; }
#nice ul ul { list-style-type: square; }
#nice ol { list-style-type: decimal; }

#nice li section {
  margin-top: 5px;
  margin-bottom: 5px;
  line-height: 1.75;
  text-align: left;
  color: rgb(1, 1, 1);
  font-weight: 500;
}

#nice blockquote {
  display: block;
  font-size: 0.9em;
  overflow: auto;
  border-left: 3px solid rgba(0, 0, 0, 0.4);
  background: rgba(0, 0, 0, 0.05);
  color: #6a737d;
  padding: 10px 10px 10px 20px;
  margin: 20px 0;
}
#nice blockquote p {
  margin: 0;
  color: #3f3f3f;
  line-height: 1.75;
}

#nice a {
  text-decoration: none;
  color: #1e6bb8;
  word-wrap: break-word;
  font-weight: bold;
  border-bottom: 1px solid #1e6bb8;
}

#nice strong { font-weight: bold; color: #3f3f3f; }
#nice em { font-style: italic; color: #3f3f3f; }
#nice em strong { font-weight: bold; color: #3f3f3f; }
#nice del { font-style: italic; color: #3f3f3f; }

#nice hr {
  height: 1px;
  margin: 10px 0;
  border: none;
  border-top: 1px solid #ccc;
}

/* 代码块容器 — 深色底 + 左强调条，与 md-wechat-editor 草案主题一致 */
#nice pre {
  margin: 10px 0;
  padding: 14px 16px 14px 14px;
  overflow-x: auto;
  overflow-scrolling: touch;
  background: #282c34;
  color: #abb2bf;
  border-radius: 8px;
  border-left: 4px solid #6366f1;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre;
  word-break: normal;
}

#nice pre code {
  display: block;
  font-family: Operator Mono, Consolas, Monaco, Menlo, monospace;
  border-radius: 0;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre;
  word-break: normal;
  overflow-x: auto;
  overflow-scrolling: touch;
  background: none;
  padding: 0;
  color: #abb2bf;
}

#nice pre code span {
  line-height: 1.75;
}

/* 行内代码 — 与 pre 分离，避免主题 #nice code 污染代码块 */
#nice p code, #nice li code {
  font-size: 14px;
  word-wrap: break-word;
  padding: 2px 4px;
  border-radius: 4px;
  margin: 0 2px;
  color: #1e6bb8;
  background-color: rgba(27, 31, 35, 0.05);
  font-family: Operator Mono, Consolas, Monaco, Menlo, monospace;
  word-break: break-all;
}

#nice img {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  height: auto;
}

#nice figure { margin: 10px 0; }
#nice figcaption {
  margin-top: 5px;
  text-align: center;
  color: #888;
  font-size: 14px;
}

#nice table {
  display: table;
  text-align: left;
  border-collapse: collapse;
}
#nice tbody { border: 0; }
#nice table tr {
  border: 0;
  border-top: 1px solid #ccc;
  background-color: white;
}
#nice table tr:nth-child(2n) { background-color: #f8f8f8; }
#nice table tr th, #nice table tr td {
  font-size: 16px;
  border: 1px solid #ccc;
  padding: 5px 10px;
  text-align: left;
}
#nice table tr th {
  font-weight: bold;
  background-color: #f0f0f0;
}

#nice sub, #nice sup { line-height: 0; }
`;
