// Barcode rendering dependency

const bwipjs = require('bwip-js');

// Render a Code 128 barcode as SVG

const renderBarcodeSvg = (barcodeId) =>
  bwipjs.toSVG({
    bcid: 'code128',
    text: barcodeId,
    scale: 2,
    height: 10,
    includetext: false,
  });

// Extract reusable SVG content for embedding

const renderBarcodeForEmbed = (barcodeId) => {
  const svg = renderBarcodeSvg(barcodeId);
  const match = svg.match(/<svg[^>]*viewBox="([^"]*)"[^>]*>([\s\S]*)<\/svg>/);

  return {
    viewBox: match ? match[1] : '0 0 268 58',
    innerSvg: match ? match[2] : '',
  };
};

// Export barcode rendering helpers

module.exports = {
  renderBarcodeSvg,
  renderBarcodeForEmbed,
};
