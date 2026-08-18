import rawCss from '../../public/resources/fonts/ctv-icons.css?inline';

const css = rawCss.replace(
  'url("CTV-Icons.woff2")',
  'url("/resources/fonts/CTV-Icons.woff")',
);

export const ctvIconSheet = new CSSStyleSheet();
ctvIconSheet.replaceSync(css);
