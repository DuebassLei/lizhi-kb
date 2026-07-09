export default `/** 蓝莓果冻 */
#nice {
      padding: 20px 0 48px;
      background-color: #FAFBFF;
      background-image:
        radial-gradient(circle at 15% 18%, rgb(165 180 252 / 0.32) 0, transparent 37%),
        radial-gradient(circle at 85% 76%, rgb(186 230 253 / 0.28) 0, transparent 33%);
      font-family: "PingFang SC", "Hiragino Sans GB", sans-serif;
      color: #3f4260; line-height: 1.85;
    }

#nice p { margin: 1em 16px; font-size: 16px; color: #505578;  padding-top: 0; padding-bottom: 0; }

#nice h1 { margin: 0.5em 16px 1.1em; text-align: center; }

#nice h1 .prefix::before { content: "🫐 "; }

#nice h1 .suffix::after { content: " 💎"; }

#nice h1 .content {
      display: inline; font-size: 20px; font-weight: 800; color: #4338ca;
      background: linear-gradient(transparent 65%, rgb(165 180 252 / 0.5) 65%);
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h1 .prefix, #nice h1 .suffix { display: inline; font-size: 18px; }

#nice h2 { margin: 1.85em 16px 0.75em; text-align: center; }

#nice h2 .content {
      display: inline-block; font-size: 17px; font-weight: 700; color: #fff;
      padding: 0.35em 1.2em;
      background: linear-gradient(135deg, #818cf8 0%, #7dd3fc 100%);
      border-radius: 999px;
      box-shadow: 0 4px 0 #4338ca, 0 5px 14px rgb(67 56 202 / 0.2);
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h2 .prefix, #nice h2 .suffix { display: none; }

#nice h3 .prefix::before { content: "♡ "; color: #818cf8; }

#nice h3 .content { font-size: 16px; font-weight: 700; color: #3730a3;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h3 .suffix { display: none; }

#nice blockquote,
#nice .multiquote-1 {
      margin: 1.3em 16px; padding: 1em 1.05em;
      border-radius: 18px 18px 18px 4px;
      border: 2px solid #c7d2fe; background: #fff; color: #6b7280;
      box-shadow: 4px 4px 0 rgb(165 180 252 / 0.42);
    }

#nice blockquote p { margin: 0; font-size: 15px; }

#nice strong { color: #4338ca; font-weight: 700; background: rgb(199 210 254 / 0.4); padding: 0 5px; border-radius: 6px; }

#nice em { color: #0ea5e9; font-style: normal; }

#nice a { color: #6366f1; text-decoration: wavy underline #c7d2fe; }

#nice ul, #nice ol { margin: 1em 16px 1em 28px; }

#nice li { margin: 0.5em 0; }

#nice li::marker { content: "🍬 "; }

#nice hr {
  display: block;
  border: none; text-align: center; margin: 2em 16px; height: auto; background: none; }

#nice hr::before { content: "· · · 🫐 · · ·"; color: #c7d2fe; font-size: 14px; letter-spacing: 0.25em; }

#nice p code, #nice li code {
      padding: 2px 8px; background: #eef2ff; color: #3730a3;
      font-family: "JetBrains Mono", monospace; font-size: 0.88em;
      border-radius: 8px; border: 1px dashed #c7d2fe;
    }

#nice pre {
      margin: 1.2em 16px; padding: 1em; background: #eef2ff;
      border: 2px solid #c7d2fe; border-radius: 14px; font-size: 13px; overflow-x: auto;
    }

#nice table {
      width: calc(100% - 32px); margin: 1.2em 16px;
      border-collapse: separate; border-spacing: 0;
      border-radius: 14px; overflow: hidden; border: 2px solid #c7d2fe; font-size: 14px;
    }

#nice th { background: #c7d2fe; color: #3730a3; padding: 10px 8px; }

#nice td { padding: 10px 8px; background: #fff; border-top: 1px solid #e0e7ff; }
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
