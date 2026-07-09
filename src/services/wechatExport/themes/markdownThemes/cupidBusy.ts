export default `#nice {
  margin: 0;
  padding: 0 10px;
  font-family: Optima, Microsoft YaHei, PingFangSC-regular, serif;
  font-size: 16px;
  color: rgba(0, 0, 0, 1);
  line-height: 1.5em;
  letter-spacing: 0;
  word-break: break-word;
  word-wrap: break-word;
  text-align: left;
}

#nice p {
  color: rgba(0, 0, 0, 1);
  font-size: 15px;
  line-height: 1.8em;
  letter-spacing: 0;
  text-indent: 0;
  margin: 0;
  padding: 8px 0;
}

#nice h1,
#nice h2 {
  display: flex;
  justify-content: center;
  margin: 30px 0 15px;
  line-height: 1.5em;
}

#nice h1 .content {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px;
  border-radius: 30px;
  font-size: 20px;
  font-weight: bold;
  color: rgba(255, 255, 255, 1);
  background-color: rgba(130, 127, 196, 1);
}

#nice h1 .prefix {
  display: none;
}

#nice h1 .suffix {
  display: block;
  width: 20px;
  height: 20px;
  background-image: url("https://files.mdnice.com/pic/4e116911-86c9-40c7-80ec-bd05e65efa5b.png");
  background-size: 100% 100%;
  background-repeat: no-repeat;
}

#nice h2 .content {
  display: flex;
  align-items: center;
  font-size: 18px;
  font-weight: bold;
  color: rgba(130, 127, 196, 1);
}

#nice h2 .prefix {
  display: block;
  width: 35px;
  height: 35px;
  margin-right: -20px;
  background-image: url("https://files.mdnice.com/pic/c6dd0d41-e95d-4d0d-a202-afa9ca0731af.png");
  background-size: 100% 100%;
  background-repeat: no-repeat;
}

#nice h2 .suffix {
  display: block;
  width: 15px;
  height: 15px;
  background-image: url("https://files.mdnice.com/pic/4e116911-86c9-40c7-80ec-bd05e65efa5b.png");
  background-size: 100% 100%;
  background-repeat: no-repeat;
}

#nice h3,
#nice h4,
#nice h5,
#nice h6 {
  display: block;
  margin: 30px 0 15px;
}

#nice h3 .content,
#nice h4 .content,
#nice h5 .content,
#nice h6 .content {
  display: block;
  font-weight: bold;
  text-align: left;
  line-height: 1.5em;
}

#nice h3 .content {
  font-size: 20px;
}

#nice h4 .content {
  font-size: 18px;
}

#nice h5 .content {
  font-size: 16px;
}

#nice h6 .content {
  font-size: 14px;
}

#nice h3 .prefix,
#nice h4 .prefix,
#nice h5 .prefix,
#nice h6 .prefix,
#nice h3 .suffix,
#nice h4 .suffix,
#nice h5 .suffix,
#nice h6 .suffix {
  display: none;
}

#nice ul,
#nice ol {
  margin: 8px 0;
  padding-left: 25px;
  color: rgba(0, 0, 0, 1);
}

#nice ul {
  list-style-type: disc;
}

#nice ol {
  list-style-type: decimal;
}

#nice ul li section,
#nice ol li section {
  color: rgba(1, 1, 1, 1);
  font-size: 15px;
  line-height: 1.8em;
  letter-spacing: 0;
  text-align: left;
}

#nice blockquote {
  margin: 20px 0;
  padding: 10px 10px 10px 20px;
  border-left: 3px solid rgba(130, 127, 196, 1);
  background-color: rgba(112, 103, 166, 0.05);
  box-shadow: none;
}

#nice blockquote p {
  margin: 0;
  color: rgba(0, 0, 0, 1);
  font-size: 15px;
  line-height: 1.8em;
}

#nice a {
  color: rgba(130, 127, 196, 1);
  font-weight: bold;
  text-decoration: none;
  border-bottom: 1px solid rgba(130, 127, 196, 1);
}

#nice strong {
  color: rgba(130, 127, 196, 1);
  font-weight: bold;
}

#nice em,
#nice em strong {
  color: rgba(130, 127, 196, 1);
}

#nice hr {
  margin: 10px 0;
  border: none;
  border-top: 1px solid rgba(0, 0, 0, 1);
  height: 1px;
}

#nice img {
  display: block;
  margin: 0 auto;
  max-width: 100%;
}

#nice figure {
  margin: 10px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

#nice figure figcaption {
  margin-top: 5px;
  color: rgba(136, 136, 136, 1);
  font-size: 14px;
  line-height: 1.5em;
  text-align: center;
}

#nice p code,
#nice li code {
  font-family: Operator Mono, Consolas, Monaco, Menlo, monospace;
  color: rgba(130, 127, 196, 1);
  background-color: rgba(27, 31, 35, 0.05);
  border-radius: 4px;
  margin: 0 2px;
  padding: 2px 4px;
  word-break: break-all;
}

#nice pre.custom code {
  display: -webkit-box;
  font-family: Consolas, Monaco, Menlo, monospace;
  font-size: 12px;
}

#nice pre.custom code span {
  line-height: 26px;
}`;
