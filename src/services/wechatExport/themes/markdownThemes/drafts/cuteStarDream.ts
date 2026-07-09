export default `/** 星梦软糖 */
#nice {
      padding: 20px 0 48px;
      background-color: #FDFCFF;
      background-image:
        radial-gradient(circle at 18% 15%, rgb(196 181 253 / 0.35) 0, transparent 36%),
        radial-gradient(circle at 82% 80%, rgb(186 230 253 / 0.3) 0, transparent 34%);
      font-family: "PingFang SC", "Hiragino Sans GB", sans-serif;
      color: #4c4668;
      line-height: 1.85;
    }

#nice p { margin: 1em 16px; font-size: 16px; color: #5e5878;  padding-top: 0; padding-bottom: 0; }

#nice h1 { margin: 0.5em 16px 1.1em; text-align: center; }

#nice h1 .prefix::before { content: "🌙 "; }

#nice h1 .suffix::after { content: " ⭐"; }

#nice h1 .content {
      display: inline;
      font-size: 20px;
      font-weight: 800;
      color: #7c3aed;
      background: linear-gradient(transparent 65%, rgb(196 181 253 / 0.5) 65%);
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h1 .prefix, #nice h1 .suffix { display: inline; font-size: 18px; }

#nice h2 { margin: 1.85em 16px 0.75em; text-align: center; }

#nice h2 .content {
      display: inline-block;
      font-size: 17px;
      font-weight: 700;
      color: #fff;
      padding: 0.35em 1.2em;
      background: linear-gradient(135deg, #a78bfa 0%, #93c5fd 100%);
      border-radius: 999px;
      box-shadow: 0 4px 0 #7c3aed, 0 5px 14px rgb(124 58 237 / 0.2);
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h2 .prefix, #nice h2 .suffix { display: none; }

#nice h3 .prefix::before { content: "✦ "; color: #a78bfa; }

#nice h3 .content { font-size: 16px; font-weight: 700; color: #5b21b6;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h3 .suffix { display: none; }

#nice blockquote,
#nice .multiquote-1 {
      margin: 1.3em 16px;
      padding: 1em 1.05em;
      border-radius: 18px 18px 18px 4px;
      border: 2px solid #ddd6fe;
      background: #fff;
      color: #7c7494;
      box-shadow: 4px 4px 0 rgb(196 181 253 / 0.4);
    }

#nice blockquote p { margin: 0; font-size: 15px; }

#nice strong {
      color: #7c3aed;
      font-weight: 700;
      background: rgb(196 181 253 / 0.35);
      padding: 0 5px;
      border-radius: 6px;
    }

#nice em { color: #60a5fa; font-style: normal; }

#nice a { color: #8b5cf6; text-decoration: wavy underline #c4b5fd; }

#nice ul, #nice ol { margin: 1em 16px 1em 28px; }

#nice li { margin: 0.5em 0; }

#nice li::marker { content: "💫 "; }

#nice hr {
  display: block;
  border: none; text-align: center; margin: 2em 16px; height: auto; background: none;
    }

#nice hr::before {
      content: "· · · ✦ · · ·";
      color: #c4b5fd;
      font-size: 14px;
      letter-spacing: 0.25em;
    }

#nice p code, #nice li code {
      padding: 2px 8px;
      background: #f5f3ff;
      color: #6d28d9;
      font-family: "JetBrains Mono", monospace;
      font-size: 0.88em;
      border-radius: 8px;
      border: 1px dashed #ddd6fe;
    }

#nice pre {
      margin: 1.2em 16px;
      padding: 1em;
      background: #f5f3ff;
      border: 2px solid #ddd6fe;
      border-radius: 14px;
      font-size: 13px;
      overflow-x: auto;
    }

#nice table {
      width: calc(100% - 32px);
      margin: 1.2em 16px;
      border-collapse: separate;
      border-spacing: 0;
      border-radius: 14px;
      overflow: hidden;
      border: 2px solid #ddd6fe;
      font-size: 14px;
    }

#nice th { background: #ddd6fe; color: #5b21b6; padding: 10px 8px; }

#nice td { padding: 10px 8px; background: #fff; border-top: 1px solid #ede9fe; }
#nice h3 .prefix { display: inline; }

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
