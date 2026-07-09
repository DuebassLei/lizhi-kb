/** 蜡笔手账 — 仿手账纸纹 + 蜡笔色块标题 + 虚线框，适合日记、旅行、手作、校园 */
export default `/* 蜡笔手账 */
#nice {
  padding: 18px 0;
  background: #FFFEF7;
  font-family: "PingFang SC", "Helvetica Neue", sans-serif;
  color: #4A4035;
  line-height: 1.85;
  letter-spacing: 0.04em;
}

#nice p {
  margin: 1.1em 10px;
  font-size: 16px;
  color: #4A4035;
  line-height: 1.85;
}

#nice h1 {
  margin: 1.6em 10px 1em;
  padding: 0;
  border: none;
  text-align: left;
}

#nice h1 .content {
  display: inline-block;
  font-size: 26px;
  font-weight: 800;
  color: #E07A5F;
  padding: 6px 0 6px 14px;
  border-left: 8px solid #F2CC8F;
  background: linear-gradient(90deg, #FDF6EC 0%, transparent 100%);
  letter-spacing: 0.05em;
}

#nice h1 .prefix, #nice h1 .suffix { display: none; }

#nice h2 {
  margin: 1.5em 10px 0.7em;
}

#nice h2 .content {
  display: inline-block;
  font-size: 21px;
  font-weight: 800;
  color: #3D405B;
  padding: 5px 14px;
  background: #E8F4EA;
  border: 2px dashed #81B29A;
  border-radius: 4px;
}

#nice h2 .prefix, #nice h2 .suffix { display: none; }

#nice h3 .content {
  display: inline-block;
  font-size: 18px;
  font-weight: 700;
  color: #81B29A;
  padding-bottom: 2px;
  border-bottom: 3px dashed #F2CC8F;
}

#nice h3 .prefix, #nice h3 .suffix { display: none; }

#nice blockquote,
#nice .multiquote-1 {
  margin: 1.4em 10px;
  padding: 1em 1.2em;
  border: 2px dashed #C9ADA7;
  background: #FDF6EC;
  color: #6D5E54;
  border-radius: 8px;
  font-style: normal;
}

#nice blockquote p {
  margin: 0;
  color: inherit;
  font-size: 15px;
  line-height: 1.8;
}

#nice strong {
  color: #E07A5F;
  font-weight: 800;
  background: #FCEADE;
  padding: 0 5px;
  border-radius: 3px;
}

#nice a {
  color: #81B29A;
  font-weight: 700;
  text-decoration: none;
  border-bottom: 2px dashed #81B29A;
}

#nice em {
  color: #C9ADA7;
  font-style: italic;
}

#nice hr {
  border: none;
  height: 0;
  border-top: 2px dashed #C9ADA7;
  margin: 2em 10px;
}

#nice p code, #nice li code {
  padding: 2px 7px;
  background: #E8F4EA;
  color: #3D405B;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.88em;
  border-radius: 4px;
  border: 1px dashed #81B29A;
}

#nice pre {
  margin: 1.4em 10px;
  padding: 1em 1.2em;
  background: #FDF6EC;
  color: #4A4035;
  border: 2px dashed #F2CC8F;
  border-radius: 8px;
  overflow-x: auto;
}

#nice pre code {
  font-size: 13px;
  line-height: 1.7;
  color: #4A4035;
}

#nice img {
  display: block;
  max-width: 100%;
  margin: 1.4em auto;
  border-radius: 6px;
  border: 3px solid #F2CC8F;
  padding: 4px;
  background: #FFFFFF;
}

#nice figcaption {
  margin-top: 0.5em;
  font-size: 13px;
  color: #C9ADA7;
  text-align: center;
}

#nice li section {
  font-size: 16px;
  line-height: 1.85;
  color: #4A4035;
}

#nice ul {
  list-style-type: circle;
}

#nice table tr th {
  background: #FCEADE;
  color: #E07A5F;
  border: 2px dashed #F2CC8F;
  padding: 8px;
  font-weight: 800;
}

#nice table tr td {
  border: 1px dashed #E8E0D8;
  padding: 8px;
  color: #4A4035;
  background: #FFFEF7;
}
`;
