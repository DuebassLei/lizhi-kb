/** 报纸专栏 — 黑白红经典报刊排版，适合深度报道、评论、时事分析 */
export default `/* 报纸专栏 */
#nice {
  padding: 16px 0;
  background: #FFFFFF;
  font-family: "Songti SC", "STSong", "Source Han Serif SC", serif;
  color: #1A1A1A;
  line-height: 1.8;
  letter-spacing: 0.04em;
}

#nice p {
  margin: 1em 8px;
  font-size: 16px;
  color: #1A1A1A;
  line-height: 1.8;
  text-align: justify;
}

#nice h1 {
  margin: 1.6em 8px 0.6em;
  padding: 0.5em 0;
  border-top: 3px double #1A1A1A;
  border-bottom: 3px double #1A1A1A;
  text-align: center;
}

#nice h1 .content {
  font-size: 28px;
  font-weight: 900;
  color: #1A1A1A;
  letter-spacing: 0.08em;
  line-height: 1.4;
}

#nice h1 .prefix, #nice h1 .suffix { display: none; }

#nice h2 {
  margin: 1.6em 8px 0.6em;
}

#nice h2 .content {
  display: inline-block;
  font-size: 22px;
  font-weight: 800;
  color: #C41E3A;
  padding-bottom: 4px;
  border-bottom: 2px solid #1A1A1A;
}

#nice h2 .prefix, #nice h2 .suffix { display: none; }

#nice h3 .content {
  font-size: 18px;
  font-weight: 700;
  color: #1A1A1A;
  font-style: italic;
}

#nice h3 .prefix, #nice h3 .suffix { display: none; }

#nice blockquote,
#nice .multiquote-1 {
  margin: 1.4em 8px;
  padding: 0.8em 1em;
  border-left: 5px solid #C41E3A;
  background: #FAFAFA;
  color: #333333;
  font-style: normal;
}

#nice blockquote p {
  margin: 0;
  color: #333333;
  font-size: 15px;
  line-height: 1.75;
}

#nice blockquote p:first-child::before {
  content: "「";
  color: #C41E3A;
  font-weight: 700;
}

#nice strong {
  color: #C41E3A;
  font-weight: 800;
}

#nice a {
  color: #1A1A1A;
  text-decoration: underline;
  text-decoration-color: #C41E3A;
  text-underline-offset: 3px;
}

#nice em { color: #555555; font-style: italic; }

#nice hr {
  border: none;
  border-top: 1px solid #1A1A1A;
  margin: 2em 8px;
}

#nice p code, #nice li code {
  padding: 1px 5px;
  background: #F5F5F5;
  color: #C41E3A;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.9em;
}

#nice pre {
  margin: 1.4em 8px;
  padding: 1em;
  background: #1A1A1A;
  color: #F5F5F5;
  overflow-x: auto;
}

#nice pre code {
  color: #F5F5F5;
  font-size: 13px;
  line-height: 1.65;
}

#nice img {
  display: block;
  max-width: 100%;
  margin: 1.4em auto;
  border: 1px solid #CCCCCC;
}

#nice figcaption {
  margin-top: 0.4em;
  font-size: 12px;
  color: #888888;
  text-align: center;
  font-family: "PingFang SC", sans-serif;
}

#nice li section {
  font-size: 16px;
  line-height: 1.8;
  color: #1A1A1A;
}

#nice table tr th {
  background: #1A1A1A;
  color: #FFFFFF;
  border: 1px solid #1A1A1A;
  padding: 8px;
  font-weight: 700;
}

#nice table tr td {
  border: 1px solid #DDDDDD;
  padding: 8px;
  color: #1A1A1A;
}
`;
