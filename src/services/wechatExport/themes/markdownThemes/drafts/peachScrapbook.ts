export default `/** 蜜桃手帐 */
#nice {
      padding: 20px 0 48px;
      background-color: #FFFBF7;
      background-image:
        linear-gradient(#FFE8D6 1px, transparent 1px),
        linear-gradient(90deg, #FFE8D6 1px, transparent 1px);
      background-size: 20px 20px;
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      color: #44403c;
      line-height: 1.8;
    }

#nice p { margin: 1em 16px; font-size: 16px; color: #57534e;  padding-top: 0; padding-bottom: 0; }

#nice h1 { margin: 0.5em 16px 1.2em; text-align: center; }

#nice h1 .content {
      display: inline-block;
      font-size: 24px;
      font-weight: 800;
      color: #9A3412;
      padding: 0.35em 1.2em;
      background: linear-gradient(135deg, #FDE68A 0%, #FDE68A 48%, transparent 48%, transparent 52%, #FDBA74 52%, #FDBA74 100%);
      border-radius: 4px;
      box-shadow: 2px 3px 0 #FED7AA;
      transform: rotate(0.6deg);
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h1 .prefix, #nice h1 .suffix { display: none; }

#nice h2 { margin: 2em 16px 0.8em; text-align: center; }

#nice h2 .content {
      display: inline-block;
      font-size: 19px;
      font-weight: 700;
      color: #C2410C;
      padding: 0.25em 1.4em;
      background: rgb(254 215 170 / 0.45);
      border-radius: 999px;
      border: 2px dashed #FB923C;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h2 .prefix, #nice h2 .suffix { display: none; }

#nice h3 .content { font-size: 17px; font-weight: 700; color: #B45309;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h3 .prefix { color: #FDBA74; margin-right: 4px; }

#nice h3 .prefix::before { content: "🍑 "; }

#nice h3 .suffix { display: none; }

#nice blockquote,
#nice .multiquote-1 {
      margin: 1.4em 16px;
      padding: 1em 1.1em;
      border-radius: 12px;
      border: 2px solid #FED7AA;
      background: #fff;
      box-shadow: 3px 3px 0 #FDBA74;
      color: #78716c;
    }

#nice blockquote p { margin: 0; font-size: 15px; }

#nice strong {
      color: #C2410C;
      font-weight: 700;
      background: rgb(253 230 138 / 0.35);
      padding: 0 4px;
      border-radius: 4px;
    }

#nice em { color: #EA580C; font-style: normal; font-weight: 600; }

#nice a { color: #EA580C; text-decoration: underline wavy #FDBA74; }

#nice ul, #nice ol { margin: 1em 16px 1em 28px; }

#nice li { margin: 0.5em 0; }

#nice hr {
      border: none;
      height: 12px;
      margin: 2em 16px;
      background: repeating-linear-gradient(
        90deg,
        #FDE68A 0, #FDE68A 8px,
        transparent 8px, transparent 12px,
        #FDBA74 12px, #FDBA74 20px,
        transparent 20px, transparent 24px
      );
      opacity: 0.75;
    }

#nice p code, #nice li code {
      padding: 2px 8px;
      background: #FFF7ED;
      color: #C2410C;
      font-family: "JetBrains Mono", monospace;
      font-size: 0.88em;
      border-radius: 6px;
      border: 1px solid #FED7AA;
    }

#nice pre {
      margin: 1.2em 16px;
      padding: 1em;
      background: #fff;
      border: 2px solid #FED7AA;
      border-radius: 12px;
      box-shadow: 3px 3px 0 #FDBA74;
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
      border: 2px solid #FED7AA;
    }

#nice th { background: #FFF7ED; color: #C2410C; padding: 10px 8px; }

#nice td { padding: 10px 8px; border-top: 1px solid #FFEDD5; background: #fff; }
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
