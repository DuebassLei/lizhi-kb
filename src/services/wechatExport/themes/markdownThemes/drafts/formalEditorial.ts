export default `/** 专栏纪述 */
#nice {
      padding: 28px 0 52px;
      background: #fafaf9;
      font-family: "Songti SC", "STSong", "Source Han Serif SC", "PingFang SC", serif;
      color: #292524; line-height: 1.92;
      letter-spacing: 0.03em;
    }

#nice p {
      margin: 1.1em 16px; font-size: 16px;
      color: #44403c; text-align: justify;
     padding-top: 0; padding-bottom: 0; }

#nice h1 {
      margin: 0 16px 1.3em;
      text-align: center;
      padding-bottom: 0.9em;
      border-bottom: 1px solid #d6d3d1;
    }

#nice h1 .content {
      display: block; font-size: 24px; font-weight: 700;
      color: #1c1917; line-height: 1.4;
      letter-spacing: 0.06em;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h1 .prefix, #nice h1 .suffix { display: none; }

#nice h2 {
      margin: 2.2em 16px 0.85em;
      text-align: center;
    }

#nice h2 .content {
      display: inline-block; font-size: 19px; font-weight: 700;
      color: #292524; letter-spacing: 0.1em;
      padding: 0 0.5em;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h2 .prefix::before { content: "— "; color: #a8a29e; }

#nice h2 .suffix::after { content: " —"; color: #a8a29e; }

#nice h2 .prefix, #nice h2 .suffix { display: inline; }

#nice h3 .content {
      font-size: 16px; font-weight: 600; color: #57534e;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h3 .prefix, #nice h3 .suffix { display: none; }

#nice blockquote,
#nice .multiquote-1 {
      margin: 1.8em 24px;
      padding: 0;
      border: none;
      background: transparent;
      color: #78716c;
      text-align: center;
      font-style: italic;
    }

#nice blockquote p { margin: 0; font-size: 15px; line-height: 1.85; }

#nice strong {
      color: #1c1917; font-weight: 700;
      border-bottom: 1px solid #d6d3d1;
    }

#nice em { color: #78716c; font-style: italic; }

#nice a { color: #44403c; text-decoration: none; border-bottom: 1px solid #a8a29e; }

#nice ul, #nice ol { margin: 1em 16px 1em 28px; color: #44403c; }

#nice li { margin: 0.45em 0; }

#nice hr {
      border: none; height: 1px; margin: 2.5em 32px;
      background: linear-gradient(90deg, transparent, #d6d3d1, transparent);
    }

#nice p code, #nice li code {
      padding: 1px 6px; background: #f5f5f4; color: #57534e;
      font-family: "JetBrains Mono", monospace; font-size: 0.86em;
      border-radius: 2px;
    }

#nice pre {
      margin: 1.4em 16px; padding: 1em;
      background: #f5f5f4; border: 1px solid #e7e5e4;
      font-family: "PingFang SC", sans-serif;
      font-size: 13px; overflow-x: auto; line-height: 1.7;
      color: #44403c;
    }

#nice table {
      width: calc(100% - 32px); margin: 1.2em 16px;
      border-collapse: collapse; font-size: 14px;
      font-family: "PingFang SC", sans-serif;
    }

#nice th {
      background: #f5f5f4; color: #292524;
      padding: 10px 8px; border: 1px solid #e7e5e4;
      font-weight: 600;
    }

#nice td {
      padding: 10px 8px; border: 1px solid #e7e5e4; color: #57534e;
    }
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
