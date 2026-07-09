export default `/** 极客蓝图 */
#nice {
      padding: 20px 0 48px;
      background-color: #FFFFFF;
      background-image:
        linear-gradient(rgb(14 165 233 / 0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgb(14 165 233 / 0.04) 1px, transparent 1px);
      background-size: 24px 24px;
      font-family: "PingFang SC", "Helvetica Neue", sans-serif;
      color: #1E293B;
      line-height: 1.75;
    }

#nice p {
      margin: 1em 16px;
      font-size: 16px;
      color: #334155;
     padding-top: 0; padding-bottom: 0; }

#nice h1 {
      margin: 0 16px 1.2em;
      padding: 0.8em 1em;
      background: #0F172A;
      border-left: 4px solid #22D3EE;
    }

#nice h1 .content {
      display: block;
      font-size: 24px;
      font-weight: 800;
      color: #F8FAFC;
      font-family: "JetBrains Mono", "PingFang SC", monospace;
      letter-spacing: -0.02em;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h1 .prefix::before {
      content: "// ";
      color: #22D3EE;
      font-family: "JetBrains Mono", monospace;
    }

#nice h1 .prefix, #nice h1 .suffix { display: inline; }

#nice h1 .suffix { display: none; }

#nice h2 {
      margin: 2em 16px 0.7em;
      padding: 0.5em 0.8em;
      background: rgb(14 165 233 / 0.08);
      border: 1px solid rgb(14 165 233 / 0.2);
    }

#nice h2 .content {
      font-size: 19px;
      font-weight: 700;
      color: #0369A1;
      font-family: "JetBrains Mono", "PingFang SC", monospace;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h2 .prefix::before { content: "## "; color: #0EA5E9; font-family: "JetBrains Mono", monospace; }

#nice h2 .prefix { display: inline; }

#nice h2 .prefix, #nice h2 .suffix { display: none; }

#nice h3 .content {
      font-size: 17px;
      font-weight: 600;
      color: #0EA5E9;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h3 .prefix::before { content: "▸ "; color: #22D3EE; }

#nice h3 .prefix { display: inline; }

#nice h3 .suffix { display: none; }

#nice blockquote,
#nice .multiquote-1 {
      margin: 1.4em 16px;
      padding: 0.9em 1em;
      border-left: 4px solid #0EA5E9;
      background: #F8FAFC;
      color: #475569;
      font-family: "JetBrains Mono", monospace;
      font-size: 14px;
    }

#nice blockquote p { margin: 0; }

#nice strong {
      color: #0369A1;
      font-weight: 700;
      background: rgb(34 211 238 / 0.12);
      padding: 0 4px;
    }

#nice em { color: #0EA5E9; font-style: normal; font-weight: 600; }

#nice a { color: #0284C7; text-decoration: none; border-bottom: 1px dashed #22D3EE; }

#nice ul, #nice ol { margin: 1em 16px 1em 28px; color: #334155; }

#nice li { margin: 0.45em 0; }

#nice hr {
      border: none;
      height: 2px;
      margin: 2em 16px;
      background: repeating-linear-gradient(
        90deg,
        #0EA5E9 0, #0EA5E9 8px,
        transparent 8px, transparent 16px
      );
      opacity: 0.4;
    }

#nice p code, #nice li code {
      padding: 2px 6px;
      background: #F1F5F9;
      color: #0369A1;
      font-family: "JetBrains Mono", monospace;
      font-size: 0.9em;
      border-radius: 3px;
      border: 1px solid #E2E8F0;
    }

#nice pre {
      margin: 1.3em 16px;
      padding: 1em;
      background: #0F172A;
      color: #E2E8F0;
      border-radius: 6px;
      font-family: "JetBrains Mono", monospace;
      font-size: 13px;
      line-height: 1.6;
      overflow-x: auto;
      border: 1px solid #1E293B;
    }

#nice pre code { color: #22D3EE; background: none; border: none; }

#nice table {
      width: calc(100% - 32px);
      margin: 1.2em 16px;
      border-collapse: collapse;
      font-size: 14px;
      font-family: "JetBrains Mono", monospace;
    }

#nice th {
      background: #0F172A;
      color: #22D3EE;
      padding: 8px;
      border: 1px solid #334155;
      text-align: left;
    }

#nice td {
      padding: 8px;
      border: 1px solid #E2E8F0;
      color: #334155;
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
