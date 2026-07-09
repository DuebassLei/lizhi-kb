/** 复古蒸汽 — 日落渐变标题 + 紫粉撞色，适合潮流文化、设计分享、音乐影评 */
export default `/* 复古蒸汽 */
#nice {
  padding: 16px 0;
  background: #FFF8F5;
  font-family: "PingFang SC", "Helvetica Neue", sans-serif;
  color: #2D1B4E;
  line-height: 1.78;
  letter-spacing: 0.03em;
}

#nice p {
  margin: 1em 8px;
  font-size: 16px;
  color: #3D2D5C;
  line-height: 1.78;
}

#nice h1 {
  margin: 1.6em 8px 1em;
  padding: 0;
  border: none;
  text-align: left;
}

#nice h1 .content {
  display: inline-block;
  font-size: 28px;
  font-weight: 800;
  background: linear-gradient(135deg, #FF6B9D 0%, #7B2CBF 50%, #FF9E44 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: #7B2CBF;
  letter-spacing: 0.02em;
  line-height: 1.35;
}

#nice h1 .prefix, #nice h1 .suffix { display: none; }

#nice h2 {
  margin: 1.6em 8px 0.7em;
  padding: 0;
}

#nice h2 .content {
  display: inline-block;
  font-size: 22px;
  font-weight: 700;
  color: #7B2CBF;
  padding: 4px 14px;
  border: 2px solid #FF6B9D;
  border-radius: 0;
  box-shadow: 4px 4px 0 #FFD166;
}

#nice h2 .prefix, #nice h2 .suffix { display: none; }

#nice h3 .content {
  font-size: 18px;
  font-weight: 700;
  color: #FF6B9D;
  border-bottom: 2px dashed #FFD166;
}

#nice h3 .prefix, #nice h3 .suffix { display: none; }

#nice blockquote,
#nice .multiquote-1 {
  margin: 1.4em 8px;
  padding: 1em 1.2em;
  border-left: 5px solid #7B2CBF;
  background: linear-gradient(135deg, #FFF0F5 0%, #F3E8FF 100%);
  color: #4A3066;
  border-radius: 0 12px 12px 0;
}

#nice blockquote p { margin: 0; color: inherit; }

#nice strong {
  color: #7B2CBF;
  font-weight: 800;
  background: linear-gradient(transparent 60%, #FFD166 60%);
  padding: 0 2px;
}

#nice a {
  color: #FF6B9D;
  font-weight: 600;
  text-decoration: none;
  border-bottom: 2px solid #FFD166;
}

#nice em { color: #9D4EDD; font-style: italic; }

#nice hr {
  border: none;
  height: 3px;
  background: repeating-linear-gradient(
    90deg,
    #FF6B9D 0px, #FF6B9D 8px,
    #FFD166 8px, #FFD166 16px,
    #7B2CBF 16px, #7B2CBF 24px
  );
  margin: 2em 8px;
}

#nice p code, #nice li code {
  padding: 2px 7px;
  background: #F3E8FF;
  color: #7B2CBF;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.88em;
  border-radius: 4px;
  border: 1px solid #E9D5FF;
}

#nice pre {
  margin: 1.4em 8px;
  padding: 1em 1.2em;
  background: #2D1B4E;
  color: #FFD166;
  border-radius: 8px;
  border: 2px solid #FF6B9D;
  overflow-x: auto;
}

#nice pre code {
  color: #F3E8FF;
  font-size: 13px;
  line-height: 1.65;
}

#nice img {
  display: block;
  max-width: 100%;
  margin: 1.4em auto;
  border-radius: 4px;
  border: 3px solid #FF6B9D;
  box-shadow: 6px 6px 0 #FFD166;
}

#nice figcaption {
  margin-top: 0.5em;
  font-size: 13px;
  color: #9D4EDD;
  text-align: center;
  font-weight: 600;
}

#nice li section { font-size: 16px; line-height: 1.78; color: #3D2D5C; }
`;
