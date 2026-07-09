export default `/** 清风浅蓝 */
#nice {
      padding: 28px 0 48px;
      background: linear-gradient(180deg, #F0FDFA 0%, #FFFFFF 120px);
      font-family: "PingFang SC", "Helvetica Neue", sans-serif;
      color: #334155;
      line-height: 1.8;
    }

#nice p {
      margin: 1.15em 16px;
      font-size: 16px;
      color: #475569;
     padding-top: 0; padding-bottom: 0; }

#nice h1 {
      margin: 0 16px 1.2em;
      padding-bottom: 0.6em;
      border-bottom: 2px solid transparent;
      border-image: linear-gradient(90deg, #38BDF8, #86EFAC) 1;
    }

#nice h1 .content {
      display: block;
      font-size: 26px;
      font-weight: 700;
      color: #0C4A6E;
      letter-spacing: 0.04em;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h1 .prefix, #nice h1 .suffix { display: none; }

#nice h2 {
      margin: 2em 16px 0.7em;
      display: flex;
      align-items: center;
      gap: 8px;
    }

#nice h2::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: linear-gradient(135deg, #38BDF8, #86EFAC);
      flex-shrink: 0;
    }

#nice h2 .content {
      font-size: 20px;
      font-weight: 700;
      color: #0369A1;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h2 .prefix, #nice h2 .suffix { display: none; }

#nice h3 .content {
      font-size: 17px;
      font-weight: 600;
      color: #059669;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h3 .prefix, #nice h3 .suffix { display: none; }

#nice blockquote,
#nice .multiquote-1 {
      margin: 1.5em 16px;
      padding: 1em 1.1em;
      border-radius: 12px;
      border: 1px solid #A7F3D0;
      background: linear-gradient(135deg, #ECFDF5 0%, #F0FDFA 100%);
      color: #047857;
    }

#nice blockquote p { margin: 0; font-size: 15px; }

#nice strong {
      color: #0369A1;
      font-weight: 700;
    }

#nice em { color: #059669; font-style: italic; }

#nice a { color: #0284C7; text-decoration: underline; text-decoration-color: #86EFAC; text-underline-offset: 3px; }

#nice ul, #nice ol { margin: 1em 16px 1em 28px; color: #475569; }

#nice li { margin: 0.45em 0; }

#nice hr {
      border: none;
      height: 1px;
      margin: 2.2em 24px;
      background: linear-gradient(90deg, transparent, #7DD3FC, #86EFAC, transparent);
    }

#nice p code, #nice li code {
      padding: 2px 7px;
      background: #F0FDFA;
      color: #0E7490;
      font-family: "JetBrains Mono", monospace;
      font-size: 0.88em;
      border-radius: 4px;
      border: 1px solid #CCFBF1;
    }

#nice pre {
      margin: 1.3em 16px;
      padding: 1em;
      background: #F0FDFA;
      border: 1px solid #99F6E4;
      border-radius: 10px;
      font-size: 13px;
      color: #134E4A;
      overflow-x: auto;
    }

#nice table {
      width: calc(100% - 32px);
      margin: 1.2em 16px;
      border-collapse: collapse;
      font-size: 14px;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #BAE6FD;
    }

#nice th {
      background: linear-gradient(135deg, #E0F2FE, #D1FAE5);
      color: #0369A1;
      padding: 10px 8px;
    }

#nice td {
      padding: 10px 8px;
      border-top: 1px solid #E0F2FE;
    }
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
