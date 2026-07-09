/** 宣纸水墨 — 暖米纸底 + 墨色宋体 + 细线引文，适合文化随笔、书评、节气文案 */
export default `/* 宣纸水墨 */
#nice {
  padding: 20px 0;
  background: #FBF7F0;
  font-family: "Songti SC", "STSong", "Source Han Serif SC", "PingFang SC", serif;
  color: #3D3530;
  line-height: 1.9;
  letter-spacing: 0.06em;
  text-indent: 0;
}

#nice p {
  margin: 1.1em 10px;
  font-size: 16px;
  color: #3D3530;
  line-height: 1.9;
  text-align: justify;
}

#nice h1 {
  margin: 2em 10px 1em;
  padding: 0 0 0.6em;
  border-bottom: 1px solid #8B7355;
  text-align: center;
}

#nice h1 .content {
  font-size: 26px;
  font-weight: 700;
  color: #2C2420;
  letter-spacing: 0.15em;
}

#nice h1 .prefix, #nice h1 .suffix { display: none; }

#nice h2 {
  margin: 1.8em 10px 0.8em;
  padding: 0;
}

#nice h2 .content {
  display: inline-block;
  font-size: 21px;
  font-weight: 700;
  color: #2C2420;
  padding-left: 0.8em;
  border-left: 3px solid #8B7355;
  letter-spacing: 0.08em;
}

#nice h2 .prefix, #nice h2 .suffix { display: none; }

#nice h3 .content {
  font-size: 18px;
  font-weight: 600;
  color: #5C4F45;
  letter-spacing: 0.06em;
}

#nice h3 .prefix, #nice h3 .suffix { display: none; }

#nice blockquote,
#nice .multiquote-1 {
  margin: 1.5em 10px;
  padding: 1em 1.2em;
  border: none;
  border-top: 1px solid #C4B5A0;
  border-bottom: 1px solid #C4B5A0;
  background: transparent;
  color: #6B5E54;
  font-style: italic;
  text-align: center;
}

#nice blockquote p {
  margin: 0;
  color: inherit;
  font-size: 15px;
}

#nice strong {
  color: #2C2420;
  font-weight: 700;
  border-bottom: 1px solid #C4B5A0;
}

#nice a {
  color: #6B5344;
  text-decoration: none;
  border-bottom: 1px solid #C4B5A0;
}

#nice em { color: #8B7355; font-style: italic; }

#nice hr {
  border: none;
  height: 1px;
  background: linear-gradient(90deg, transparent, #C4B5A0 20%, #C4B5A0 80%, transparent);
  margin: 2.5em 10px;
}

#nice p code, #nice li code {
  padding: 1px 5px;
  background: #F0EBE3;
  color: #5C4F45;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.9em;
  border-radius: 2px;
}

#nice pre {
  margin: 1.4em 10px;
  padding: 1em;
  background: #F0EBE3;
  border-left: 3px solid #8B7355;
  border-radius: 0;
  overflow-x: auto;
}

#nice pre code {
  color: #3D3530;
  font-size: 13px;
  line-height: 1.7;
}

#nice img {
  display: block;
  max-width: 100%;
  margin: 1.5em auto;
  border: 8px solid #F0EBE3;
  box-shadow: 0 2px 12px rgba(44, 36, 32, 0.08);
}

#nice figcaption {
  margin-top: 0.5em;
  font-size: 13px;
  color: #8B7355;
  text-align: center;
}

#nice ul, #nice ol { padding-left: 1.4em; margin: 1em 10px; }

#nice li section {
  font-size: 16px;
  line-height: 1.85;
  color: #3D3530;
}

#nice table tr th {
  background: #F0EBE3;
  color: #2C2420;
  border: 1px solid #C4B5A0;
  padding: 8px;
}

#nice table tr td {
  border: 1px solid #E8E0D4;
  padding: 8px;
  color: #3D3530;
}
`;
