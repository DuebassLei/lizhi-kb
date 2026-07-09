/** 极光诗集 — 靛蓝标题 + 金质点缀 + 渐变引文，适合诗歌、散文、深夜随笔 */
export default `/* 极光诗集 */
#nice {
  padding: 20px 0;
  background: #FAFBFE;
  font-family: "Songti SC", "STSong", "Source Han Serif SC", serif;
  color: #2E3440;
  line-height: 1.92;
  letter-spacing: 0.05em;
}

#nice p {
  margin: 1.2em 10px;
  font-size: 16px;
  color: #3B4252;
  line-height: 1.92;
}

#nice h1 {
  margin: 2em 10px 1.2em;
  padding: 0;
  border: none;
  text-align: center;
}

#nice h1 .content {
  display: inline-block;
  font-size: 28px;
  font-weight: 700;
  color: #4338CA;
  letter-spacing: 0.14em;
  padding: 0.2em 0;
  border-bottom: 1px solid #C4B5FD;
}

#nice h1 .prefix, #nice h1 .suffix { display: none; }

#nice h2 {
  margin: 1.8em 10px 0.8em;
  text-align: center;
}

#nice h2 .content {
  display: inline-block;
  font-size: 21px;
  font-weight: 600;
  color: #6366F1;
  letter-spacing: 0.1em;
}

#nice h2 .prefix, #nice h2 .suffix { display: none; }

#nice h3 .content {
  font-size: 18px;
  font-weight: 600;
  color: #B8956A;
  letter-spacing: 0.08em;
}

#nice h3 .prefix, #nice h3 .suffix { display: none; }

#nice blockquote,
#nice .multiquote-1 {
  margin: 1.8em 10px;
  padding: 1.2em 1.4em;
  border: none;
  background: linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 50%, #ECFDF5 100%);
  color: #4C566A;
  font-style: italic;
  border-radius: 12px;
  text-align: center;
}

#nice blockquote p {
  margin: 0.3em 0;
  color: #4C566A;
  font-size: 15px;
  line-height: 1.9;
}

#nice strong {
  color: #4338CA;
  font-weight: 700;
  border-bottom: 1px solid #C4B5FD;
}

#nice a {
  color: #6366F1;
  text-decoration: none;
  border-bottom: 1px solid #C4B5FD;
}

#nice em {
  color: #B8956A;
  font-style: italic;
}

#nice hr {
  border: none;
  height: 1px;
  background: linear-gradient(90deg, transparent, #6366F1 30%, #2DD4BF 70%, transparent);
  margin: 2.5em 10px;
}

#nice p code, #nice li code {
  padding: 1px 6px;
  background: #EEF2FF;
  color: #4338CA;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.88em;
  border-radius: 4px;
}

#nice pre {
  margin: 1.4em 10px;
  padding: 1em 1.2em;
  background: #1E1B4B;
  color: #C4B5FD;
  border-radius: 10px;
  overflow-x: auto;
}

#nice pre code {
  color: #E0E7FF;
  font-size: 13px;
  line-height: 1.7;
}

#nice img {
  display: block;
  max-width: 100%;
  margin: 1.6em auto;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.12);
}

#nice figcaption {
  margin-top: 0.6em;
  font-size: 13px;
  color: #B8956A;
  text-align: center;
  font-style: italic;
}

#nice li section {
  font-size: 16px;
  line-height: 1.92;
  color: #3B4252;
}

#nice table tr th {
  background: linear-gradient(135deg, #4338CA, #6366F1);
  color: #FFFFFF;
  border: none;
  padding: 8px;
}

#nice table tr td {
  border: 1px solid #E5E7EB;
  padding: 8px;
  color: #3B4252;
}
`;
