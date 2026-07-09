export default `/** 圆润物语 */
#nice {









      padding: 20px 0 52px;
      background-color: #f9fafc;
      background-image:
        radial-gradient(ellipse 120% 80% at 100% -20%, rgb(91 108 254 / 0.07), transparent 50%),
        radial-gradient(ellipse 80% 60% at -10% 100%, rgb(139 154 255 / 0.05), transparent 45%);
      font-family: "PingFang SC", -apple-system, "Helvetica Neue", sans-serif;
      color: #3d4660;
      line-height: 1.78;
      letter-spacing: 0.01em;
    }

#nice p {
      margin: 0.85em 16px;
      font-size: 16px;
      color: #6b7590;
     padding-top: 0; padding-bottom: 0; }

#nice h1 {
      margin: 0 16px 1.1em;
      padding: 2px 0 2px 14px;
      border-left: 3px solid #5b6cfe;
      border-radius: 0 2px 2px 0;
    }

#nice h1 .content {
      display: block;
      font-size: 20px;
      font-weight: 600;
      line-height: 1.5;
      color: #2a3142;
      letter-spacing: -0.02em;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h1 .prefix, #nice h1 .suffix { display: none; }

#nice h2 {
      margin: 1.75em 16px 0.7em;
    }

#nice h2 .content {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 17px;
      font-weight: 600;
      color: #434fdb;
      padding: 0.28em 0.85em;
      background: #ffffff;
      border: 1px solid #d5dcff;
      border-radius: 999px;
      box-shadow: 0 1px 2px rgb(91 108 254 / 0.04);
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h2 .content::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #5b6cfe;
      flex-shrink: 0;
    }

#nice h2 .prefix, #nice h2 .suffix { display: none; }

#nice h3 {
      margin: 1.35em 16px 0.45em;
    }

#nice h3 .content {
      font-size: 16px;
      font-weight: 600;
      color: #4a5568;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

#nice h3 .prefix, #nice h3 .suffix { display: none; }

#nice blockquote,
#nice .multiquote-1 {
      margin: 1.25em 16px;
      padding: 0.95em 1.05em;
      border-radius: 12px;
      border: 1px solid #d5dcff;
      background: #ffffff;
      box-shadow: 0 2px 12px rgb(91 108 254 / 0.05);
      color: #6b7590;
    }

#nice blockquote p {
      margin: 0;
      font-size: 15px;
      line-height: 1.7;
    }

#nice strong {
      color: #434fdb;
      font-weight: 600;
      background: #eef1ff;
      padding: 0 5px;
      border-radius: 4px;
    }

#nice em {
      color: #5a6a8a;
      font-style: italic;
    }

#nice a {
      color: #5b6cfe;
      text-decoration: none;
      border-bottom: 1px solid rgb(91 108 254 / 0.35);
      padding-bottom: 1px;
    }

#nice ul, #nice ol {
      margin: 0.75em 16px 0.75em 28px;
      color: #6b7590;
    }

#nice li {
      margin: 0.4em 0;
      padding-left: 2px;
    }

#nice ul li::marker { color: #d5dcff; }

#nice hr {
      border: none;
      height: 1px;
      margin: 2em 24px;
      background: linear-gradient(90deg, transparent, #d5dcff, transparent);
    }

#nice p code, #nice li code {
      padding: 2px 7px;
      background: #eef1ff;
      color: #434fdb;
      font-family: "SF Mono", "JetBrains Mono", monospace;
      font-size: 0.86em;
      border-radius: 6px;
      border: 1px solid #d5dcff;
    }

#nice pre {
      margin: 1.1em 16px;
      padding: 0.95em 1em;
      background: #2b3044;
      color: #e2e8f0;
      border-radius: 12px;
      font-family: "SF Mono", "JetBrains Mono", monospace;
      font-size: 13px;
      line-height: 1.65;
      overflow-x: auto;
      border: 1px solid #3d4460;
    }

#nice pre code {
      background: none;
      border: none;
      color: #a5b4fc;
      padding: 0;
    }

#nice table {
      width: calc(100% - 32px);
      margin: 1.1em 16px;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 14px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #d5dcff;
      background: #ffffff;
    }

#nice th {
      background: #eef1ff;
      color: #434fdb;
      font-weight: 600;
      padding: 10px 12px;
      text-align: left;
    }

#nice td {
      padding: 10px 12px;
      color: #6b7590;
      border-top: 1px solid #f0f2f8;
    }

#nice tr:nth-child(even) td {
      background: rgb(249 250 252 / 0.6);
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
