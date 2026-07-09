export default `/** 朱砂印谱 */
#nice {
      padding: 24px 0 48px;
      background: #FBF6EE;
      background-image:
        radial-gradient(circle at 20% 10%, rgb(139 30 30 / 0.03) 0, transparent 45%),
        radial-gradient(circle at 80% 90%, rgb(201 168 108 / 0.08) 0, transparent 40%);
      font-family: "Songti SC", "STSong", "Source Han Serif SC", "PingFang SC", serif;
      color: #3A322C;
      line-height: 1.9;
      letter-spacing: 0.05em;
    }

#nice p {
      margin: 1.1em 16px;
      font-size: 16px;
      text-align: justify;
      color: #3A322C;
     padding-top: 0; padding-bottom: 0; }

#nice h1 {
      margin: 0 16px 1.2em;
      padding: 1.2em 0 0.8em;
      text-align: center;
      border-bottom: 1px solid #C9A86C;
      position: relative;
    }

#nice h1::after {
      content: "印";
      position: absolute;
      right: 16px;
      top: 0.6em;
      width: 36px;
      height: 36px;
      line-height: 36px;
      text-align: center;
      font-size: 14px;
      font-weight: 700;
      color: #FBF6EE;
      background: #8B1E1E;
      border-radius: 4px;
      box-shadow: inset 0 0 0 2px rgb(201 168 108 / 0.5);
      transform: rotate(-6deg);
      letter-spacing: 0;
    }

#nice h1 .content {
      display: block;
      font-size: 26px;
      font-weight: 700;
      color: #2A2018;
      letter-spacing: 0.2em;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h1 .prefix, #nice h1 .suffix { display: none; }

#nice h2 {
      margin: 2em 16px 0.8em;
      text-align: center;
    }

#nice h2 .content {
      display: inline-block;
      font-size: 20px;
      font-weight: 700;
      color: #8B1E1E;
      padding: 0 1em 0.3em;
      border-bottom: 2px solid #8B1E1E;
      letter-spacing: 0.12em;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h2 .prefix, #nice h2 .suffix { display: none; }

#nice h3 .content {
      font-size: 17px;
      font-weight: 600;
      color: #5C4A3A;
      padding-left: 12px;
      border-left: 3px solid #C9A86C;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h3 .prefix, #nice h3 .suffix { display: none; }

#nice blockquote,
#nice .multiquote-1 {
      margin: 1.6em 16px;
      padding: 1.2em 1em;
      border: none;
      border-top: 1px solid #D4C4A8;
      border-bottom: 1px solid #D4C4A8;
      background: transparent;
      color: #6B5A48;
      font-style: italic;
      text-align: center;
    }

#nice blockquote p { margin: 0; font-size: 15px; }

#nice strong {
      color: #8B1E1E;
      font-weight: 700;
      border-bottom: 1px solid rgb(139 30 30 / 0.25);
    }

#nice em { color: #9A7B4F; font-style: italic; }

#nice a { color: #8B1E1E; text-decoration: none; border-bottom: 1px solid #C9A86C; }

#nice ul, #nice ol {
      margin: 1em 16px 1em 28px;
      color: #3A322C;
    }

#nice li { margin: 0.4em 0; }

#nice hr {
      border: none;
      height: 1px;
      margin: 2.5em 32px;
      background: linear-gradient(90deg, transparent, #C9A86C, transparent);
    }

#nice p code, #nice li code {
      padding: 1px 6px;
      background: #F0E8DA;
      color: #6B4A3A;
      font-family: "JetBrains Mono", monospace;
      font-size: 0.88em;
      border-radius: 2px;
    }

#nice pre {
      margin: 1.4em 16px;
      padding: 1em;
      background: #F0E8DA;
      border-left: 3px solid #8B1E1E;
      overflow-x: auto;
      font-size: 13px;
      line-height: 1.6;
    }

#nice pre code { background: none; padding: 0; }

#nice table {
      width: calc(100% - 32px);
      margin: 1.2em 16px;
      border-collapse: collapse;
      font-size: 14px;
    }

#nice th {
      background: rgb(139 30 30 / 0.08);
      color: #8B1E1E;
      padding: 8px;
      border: 1px solid #D4C4A8;
    }

#nice td {
      padding: 8px;
      border: 1px solid #E8DFD0;
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
