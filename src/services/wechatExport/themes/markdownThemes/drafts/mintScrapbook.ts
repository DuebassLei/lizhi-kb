export default `/** 薄荷手帐 */
#nice {
      padding: 20px 0 48px;
      background-color: #FAFFFC;
      background-image:
        linear-gradient(#E8F8F0 1px, transparent 1px),
        linear-gradient(90deg, #E8F8F0 1px, transparent 1px);
      background-size: 20px 20px;
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      color: #334155;
      line-height: 1.8;
    }

#nice p {
      margin: 1em 16px;
      font-size: 16px;
      color: #475569;
     padding-top: 0; padding-bottom: 0; }

#nice h1 {
      margin: 0.5em 16px 1.2em;
      text-align: center;
    }

#nice h1 .content {
      display: inline-block;
      font-size: 24px;
      font-weight: 800;
      color: #065F46;
      padding: 0.35em 1.2em;
      background: linear-gradient(135deg, #FFB4C2 0%, #FFB4C2 48%, transparent 48%, transparent 52%, #7ECBA1 52%, #7ECBA1 100%);
      background-size: 100% 100%;
      border-radius: 4px;
      box-shadow: 2px 3px 0 #A7F3D0;
      transform: rotate(-0.5deg);
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
      font-size: 19px;
      font-weight: 700;
      color: #047857;
      padding: 0.25em 1.4em;
      background: rgb(167 243 208 / 0.45);
      border-radius: 999px;
      border: 2px dashed #7ECBA1;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h2 .prefix, #nice h2 .suffix { display: none; }

#nice h3 .content {
      font-size: 17px;
      font-weight: 700;
      color: #BE185D;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h3 .prefix { color: #FFB4C2; margin-right: 4px; }

#nice h3 .prefix::before { content: "✿ "; }

#nice h3 .suffix { display: none; }

#nice blockquote,
#nice .multiquote-1 {
      margin: 1.4em 16px;
      padding: 1em 1.1em;
      border-radius: 12px;
      border: 2px solid #BBF7D0;
      background: #fff;
      box-shadow: 3px 3px 0 #A7F3D0;
      color: #64748B;
    }

#nice blockquote p { margin: 0; font-size: 15px; }

#nice strong {
      color: #BE185D;
      font-weight: 700;
      background: rgb(255 180 194 / 0.25);
      padding: 0 4px;
      border-radius: 4px;
    }

#nice em { color: #059669; font-style: normal; font-weight: 600; }

#nice a { color: #059669; text-decoration: underline wavy #7ECBA1; }

#nice ul, #nice ol { margin: 1em 16px 1em 28px; }

#nice li { margin: 0.5em 0; }

#nice hr {
      border: none;
      height: 12px;
      margin: 2em 16px;
      background: repeating-linear-gradient(
        90deg,
        #FFB4C2 0, #FFB4C2 8px,
        transparent 8px, transparent 12px,
        #7ECBA1 12px, #7ECBA1 20px,
        transparent 20px, transparent 24px
      );
      opacity: 0.7;
    }

#nice p code, #nice li code {
      padding: 2px 8px;
      background: #ECFDF5;
      color: #047857;
      font-family: "JetBrains Mono", monospace;
      font-size: 0.88em;
      border-radius: 6px;
      border: 1px solid #A7F3D0;
    }

#nice pre {
      margin: 1.2em 16px;
      padding: 1em;
      background: #fff;
      border: 2px solid #BBF7D0;
      border-radius: 12px;
      box-shadow: 3px 3px 0 #A7F3D0;
      font-size: 13px;
      overflow-x: auto;
    }

#nice table {
      width: calc(100% - 32px);
      margin: 1.2em 16px;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 14px;
      border-radius: 12px;
      overflow: hidden;
      border: 2px solid #BBF7D0;
    }

#nice th {
      background: #ECFDF5;
      color: #047857;
      padding: 10px 8px;
    }

#nice td {
      padding: 10px 8px;
      border-top: 1px solid #D1FAE5;
      background: #fff;
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
