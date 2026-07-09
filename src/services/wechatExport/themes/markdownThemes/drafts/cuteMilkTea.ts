export default `/** 奶茶波波 */
#nice {
      padding: 20px 0 48px;
      background-color: #FFFCF8;
      background-image:
        radial-gradient(circle at 12% 18%, rgb(237 201 165 / 0.35) 0, transparent 38%),
        radial-gradient(circle at 88% 78%, rgb(255 228 196 / 0.3) 0, transparent 32%);
      font-family: "PingFang SC", "Hiragino Sans GB", sans-serif;
      color: #5c4a3f;
      line-height: 1.85;
    }

#nice p { margin: 1em 16px; font-size: 16px; color: #6b5a4f;  padding-top: 0; padding-bottom: 0; }

#nice h1 { margin: 0.5em 16px 1.1em; text-align: center; }

#nice h1 .prefix::before { content: "🧋 "; }

#nice h1 .suffix::after { content: " 🍮"; }

#nice h1 .content {
      display: inline;
      font-size: 20px;
      font-weight: 800;
      color: #a16207;
      background: linear-gradient(transparent 65%, rgb(237 201 165 / 0.55) 65%);
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
      background: linear-gradient(135deg, #d4a574 0%, #e8c4a0 100%);
      border-radius: 999px;
      box-shadow: 0 4px 0 #b8895a, 0 5px 14px rgb(180 120 70 / 0.22);
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h2 .prefix, #nice h2 .suffix { display: none; }

#nice h3 .prefix::before { content: "♡ "; color: #d4a574; }

#nice h3 .content { font-size: 16px; font-weight: 700; color: #92400e;
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
      border: 2px solid #ecd9c8;
      background: #fff;
      color: #8b7355;
      box-shadow: 4px 4px 0 rgb(237 201 165 / 0.45);
    }

#nice blockquote p { margin: 0; font-size: 15px; }

#nice strong {
      color: #b45309;
      font-weight: 700;
      background: rgb(254 243 199 / 0.55);
      padding: 0 5px;
      border-radius: 6px;
    }

#nice em { color: #ca8a04; font-style: normal; }

#nice a { color: #c2784a; text-decoration: wavy underline #ecd9c8; }

#nice ul, #nice ol { margin: 1em 16px 1em 28px; }

#nice li { margin: 0.5em 0; }

#nice li::marker { content: "🫧 "; }

#nice hr {
  display: block;
  border: none; text-align: center; margin: 2em 16px; height: auto; background: none;
    }

#nice hr::before {
      content: "· · · 🧋 · · ·";
      color: #ecd9c8;
      font-size: 14px;
      letter-spacing: 0.25em;
    }

#nice p code, #nice li code {
      padding: 2px 8px;
      background: #fef9f3;
      color: #b45309;
      font-family: "JetBrains Mono", monospace;
      font-size: 0.88em;
      border-radius: 8px;
      border: 1px dashed #ecd9c8;
    }

#nice pre {
      margin: 1.2em 16px;
      padding: 1em;
      background: #fef9f3;
      border: 2px solid #ecd9c8;
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
      border: 2px solid #ecd9c8;
      font-size: 14px;
    }

#nice th { background: #ecd9c8; color: #78350f; padding: 10px 8px; }

#nice td { padding: 10px 8px; background: #fff; border-top: 1px solid #f5ebe0; }
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
