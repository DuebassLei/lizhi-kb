export default `/** 藏青纪事 */
#nice {
      padding: 24px 0 48px;
      background: #fff;
      background-image: linear-gradient(180deg, rgb(30 58 95 / 0.03) 0, transparent 120px);
      font-family: "PingFang SC", -apple-system, sans-serif;
      color: #1e293b; line-height: 1.82;
    }

#nice p { margin: 1em 16px; font-size: 16px; color: #475569; text-align: justify;  padding-top: 0; padding-bottom: 0; }

#nice h1 {
      margin: 0 16px 1.2em;
      padding: 0.85em 1em;
      background: #1e3a5f;
      border-radius: 2px;
    }

#nice h1 .content {
      display: block; font-size: 21px; font-weight: 700;
      color: #f8fafc; line-height: 1.45;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h1 .prefix, #nice h1 .suffix { display: none; }

#nice h2 { margin: 2em 16px 0.75em; }

#nice h2 .content {
      display: inline-block; font-size: 18px; font-weight: 700;
      color: #1e3a5f;
      padding-bottom: 0.3em;
      border-bottom: 2px solid #1e3a5f;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h2 .prefix, #nice h2 .suffix { display: none; }

#nice h3 .content {
      font-size: 16px; font-weight: 600; color: #334155;
      padding-left: 10px; border-left: 2px solid #94a3b8;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h3 .prefix, #nice h3 .suffix { display: none; }

#nice blockquote,
#nice .multiquote-1 {
      margin: 1.5em 16px; padding: 1em 1.1em;
      border: 1px solid #cbd5e1;
      border-left: 4px solid #1e3a5f;
      background: #f8fafc; color: #64748b;
    }

#nice blockquote p { margin: 0; font-size: 15px; }

#nice strong { color: #1e3a5f; font-weight: 700; }

#nice em { color: #64748b; font-style: normal; font-weight: 500; }

#nice a { color: #1e3a5f; text-decoration: none; border-bottom: 1px solid #94a3b8; }

#nice ul, #nice ol { margin: 1em 16px 1em 28px; color: #475569; }

#nice li { margin: 0.45em 0; }

#nice ul li::marker { color: #1e3a5f; }

#nice hr {
      border: none; height: 1px; margin: 2.2em 24px;
      background: linear-gradient(90deg, transparent, #cbd5e1, transparent);
    }

#nice p code, #nice li code {
      padding: 2px 6px; background: #f1f5f9; color: #1e3a5f;
      font-family: "JetBrains Mono", monospace; font-size: 0.88em;
      border-radius: 3px;
    }

#nice pre {
      margin: 1.3em 16px; padding: 1em;
      background: #1e293b; color: #e2e8f0;
      border-left: 4px solid #1e3a5f;
      font-size: 13px; overflow-x: auto; line-height: 1.65;
    }

#nice table {
      width: calc(100% - 32px); margin: 1.2em 16px;
      border-collapse: collapse; font-size: 14px;
      border: 1px solid #cbd5e1;
    }

#nice th {
      background: #1e3a5f; color: #f8fafc;
      padding: 10px 8px; text-align: left;
    }

#nice td {
      padding: 10px 8px; border-top: 1px solid #e2e8f0; color: #475569;
    }

#nice tr:nth-child(even) td { background: #f8fafc; }
#nice pre code {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  color: inherit;
  font-size: inherit;
  font-family: inherit;
}
#nice h1, #nice h2, #nice h3, #nice h4, #nice h5, #nice h6 {
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
}


#nice li section {
  margin-top: 0;
  margin-bottom: 0;
  font-size: inherit;
  line-height: inherit;
  color: inherit;
  font-weight: inherit;
}

#nice img {
  display: block;
  max-width: 100%;
  margin: 1.2em auto;
}

#nice figcaption {
  margin-top: 0.5em;
  font-size: 13px;
  text-align: center;
  opacity: 0.75;
}

#nice table tr th,
#nice table tr td {
  font-size: inherit;
}`;
