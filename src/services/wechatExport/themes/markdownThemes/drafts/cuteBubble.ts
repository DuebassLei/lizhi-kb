export default `/** 软萌泡泡 */
#nice {
      padding: 20px 0 48px;
      background-color: #FFFBFC;
      background-image:
        radial-gradient(circle at 15% 20%, rgb(255 200 221 / 0.35) 0, transparent 35%),
        radial-gradient(circle at 85% 75%, rgb(255 214 165 / 0.25) 0, transparent 30%);
      font-family: "PingFang SC", "Hiragino Sans GB", sans-serif;
      color: #5C4A52;
      line-height: 1.85;
    }

#nice p {
      margin: 1em 16px;
      font-size: 16px;
      color: #6B5A62;
     padding-top: 0; padding-bottom: 0; }

#nice h1 {
      margin: 0.5em 16px 1.2em;
      text-align: center;
    }

#nice h1 .prefix::before { content: "🌸 "; }

#nice h1 .suffix::after { content: " ✨"; }

#nice h1 .content {
      display: inline;
      font-size: 24px;
      font-weight: 800;
      color: #FF6B9D;
      background: linear-gradient(transparent 65%, rgb(255 200 221 / 0.6) 65%);
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h1 .prefix, #nice h1 .suffix { display: inline; font-size: 20px; }

#nice h2 {
      margin: 2em 16px 0.8em;
      text-align: center;
    }

#nice h2 .content {
      display: inline-block;
      font-size: 18px;
      font-weight: 700;
      color: #fff;
      padding: 0.4em 1.3em;
      background: linear-gradient(135deg, #FF8FAB 0%, #FFB3C6 100%);
      border-radius: 999px;
      box-shadow: 0 4px 0 #FF6B9D, 0 6px 16px rgb(255 107 157 / 0.25);
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h2 .prefix, #nice h2 .suffix { display: none; }

#nice h3 .prefix::before { content: "♡ "; color: #FF8FAB; }

#nice h3 .content {
      font-size: 17px;
      font-weight: 700;
      color: #C9184A;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h3 .suffix { display: none; }

#nice blockquote,
#nice .multiquote-1 {
      margin: 1.4em 16px;
      padding: 1em 1.1em;
      border-radius: 20px 20px 20px 4px;
      border: 2px solid #FFC8DD;
      background: #fff;
      color: #9D8189;
      box-shadow: 4px 4px 0 rgb(255 200 221 / 0.5);
    }

#nice blockquote p { margin: 0; font-size: 15px; }

#nice strong {
      color: #FF6B9D;
      font-weight: 700;
      background: rgb(255 200 221 / 0.4);
      padding: 0 5px;
      border-radius: 6px;
    }

#nice em { color: #FFB347; font-style: normal; }

#nice a { color: #FF6B9D; text-decoration: wavy underline #FFC8DD; }

#nice ul, #nice ol { margin: 1em 16px 1em 28px; }

#nice li { margin: 0.55em 0; }

#nice li::marker { content: "🍡 "; }

#nice hr {
  display: block;
  border: none;
      text-align: center;
      margin: 2em 16px;
      height: auto;
      background: none;
    }

#nice hr::before {
      content: "· · · ✿ · · ·";
      color: #FFC8DD;
      font-size: 14px;
      letter-spacing: 0.3em;
    }

#nice p code, #nice li code {
      padding: 2px 8px;
      background: #FFF0F3;
      color: #FF6B9D;
      font-family: "JetBrains Mono", monospace;
      font-size: 0.88em;
      border-radius: 8px;
      border: 1px dashed #FFC8DD;
    }

#nice pre {
      margin: 1.2em 16px;
      padding: 1em;
      background: #FFF0F3;
      border: 2px solid #FFC8DD;
      border-radius: 16px;
      font-size: 13px;
      overflow-x: auto;
    }

#nice table {
      width: calc(100% - 32px);
      margin: 1.2em 16px;
      border-collapse: separate;
      border-spacing: 0;
      border-radius: 16px;
      overflow: hidden;
      border: 2px solid #FFC8DD;
      font-size: 14px;
    }

#nice th {
      background: #FFC8DD;
      color: #9D174D;
      padding: 10px 8px;
    }

#nice td {
      padding: 10px 8px;
      background: #fff;
      border-top: 1px solid #FFE0EB;
    }
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
