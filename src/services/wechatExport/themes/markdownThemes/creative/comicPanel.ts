/** 漫画分镜 — 轻漫画感：柔和撞色 + 细线分镜，适合趣味科普、动漫影评、轻松吐槽 */
export default `/* 漫画分镜 */
#nice {
  padding: 16px 0;
  background: #FFFEF8;
  font-family: "PingFang SC", "Helvetica Neue", sans-serif;
  color: #2D2D2D;
  line-height: 1.78;
  letter-spacing: 0.02em;
}

#nice p {
  margin: 1em 10px;
  font-size: 16px;
  color: #3D3D3D;
  line-height: 1.78;
}

#nice h1 {
  margin: 1.2em 10px 0.8em;
  padding: 0;
  border: none;
  text-align: left;
}

#nice h1 .content {
  display: inline-block;
  max-width: 100%;
  box-sizing: border-box;
  font-size: 21px;
  line-height: 1.45;
  font-weight: 800;
  color: #2D2D2D;
  padding: 6px 0 6px 12px;
  border-left: 4px solid #FF6B6B;
  background: linear-gradient(90deg, #FFF8E1 0%, transparent 100%);
  letter-spacing: 0.03em;
  word-break: break-word;
}

#nice h1 .prefix, #nice h1 .suffix { display: none; }

#nice h2 {
  margin: 1.4em 10px 0.6em;
}

#nice h2 .content {
  display: inline-block;
  max-width: 100%;
  box-sizing: border-box;
  font-size: 19px;
  line-height: 1.45;
  font-weight: 700;
  color: #FF6B6B;
  padding: 0 0 0 10px;
  border-left: 3px solid #FFD166;
  word-break: break-word;
}

#nice h2 .prefix, #nice h2 .suffix { display: none; }

#nice h3 .content {
  display: inline-block;
  font-size: 17px;
  line-height: 1.45;
  font-weight: 700;
  color: #5B8DEF;
  word-break: break-word;
}

#nice h3 .prefix, #nice h3 .suffix { display: none; }

#nice blockquote,
#nice .multiquote-1 {
  margin: 1.3em 10px;
  padding: 0.9em 1.1em;
  border: none;
  border-left: 4px solid #FFD166;
  background: #FFFBF0;
  color: #4A4A4A;
  border-radius: 0 10px 10px 0;
  font-style: normal;
  font-weight: 400;
}

#nice blockquote p {
  margin: 0;
  color: inherit;
  font-size: 15px;
  line-height: 1.75;
}

#nice strong {
  color: #FF6B6B;
  font-weight: 700;
  background: #FFF8E1;
  padding: 0 4px;
  border-radius: 3px;
}

#nice a {
  color: #5B8DEF;
  font-weight: 600;
  text-decoration: none;
  border-bottom: 1px solid #FFD166;
}

#nice em {
  color: #888888;
  font-style: italic;
  font-weight: 400;
}

#nice hr {
  border: none;
  height: 1px;
  background: #E8E0D0;
  margin: 1.8em 10px;
}

#nice p code, #nice li code {
  padding: 2px 6px;
  background: #F5F5F5;
  color: #FF6B6B;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.88em;
  border-radius: 4px;
}

#nice pre {
  margin: 1.3em 10px;
  padding: 1em 1.1em;
  background: #2D2D2D;
  color: #F5F5F5;
  border-radius: 8px;
  overflow-x: auto;
}

#nice pre code {
  color: #F5F5F5;
  font-size: 13px;
  line-height: 1.65;
  font-weight: 400;
}

#nice img {
  display: block;
  max-width: 100%;
  margin: 1.3em auto;
  border-radius: 8px;
  border: 1px solid #E8E0D0;
}

#nice figcaption {
  margin-top: 0.5em;
  font-size: 13px;
  color: #888888;
  text-align: center;
  font-weight: 400;
}

#nice li section {
  font-size: 16px;
  line-height: 1.78;
  color: #3D3D3D;
}

#nice table tr th {
  background: #FFF8E1;
  color: #FF6B6B;
  border: 1px solid #E8E0D0;
  padding: 8px;
  font-weight: 700;
}

#nice table tr td {
  border: 1px solid #E8E0D0;
  padding: 8px;
  color: #3D3D3D;
  background: #FFFFFF;
}
`;
