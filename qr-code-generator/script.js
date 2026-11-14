const
  qrTarget = document.querySelector("#target-input"),
  generateButton = document.querySelector("#btn-generate"),
  downloadButton = document.querySelector("#btn-download"),
  qrResultElement = document.querySelector(".qr-result");

generateButton.addEventListener("click", () => {
  qrResultElement.innerHTML = "";

  const
    containerWidth = qrResultElement.offsetWidth,
    containerHeight = qrResultElement.offsetHeight,
    qrSize = '512',
    displaySize = Math.max(containerWidth, containerHeight) * 0.6

  QRCode.toCanvas(qrTarget.value, { width: qrSize }, (error, canvas) => {
    if (error) console.log(error)
    canvas.style.width = `${displaySize}px`
    canvas.style.height = `${displaySize}px`
    qrResultElement.appendChild(canvas)
  });
});

downloadButton.addEventListener('click', () => {
  const qrCanvas = qrResultElement.querySelector('canvas');
  if (qrCanvas) {
    const image = qrCanvas
      .toDataURL("image/png")
      .replace("image/png", "image/octet-stream");
    const link = document.createElement('a');
    link.download = 'qr-code.png'
    link.href = image
    link.click();
  }
})
