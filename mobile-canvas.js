(() => {
  const BASE_W = 1240;
  const BASE_H = 440;
  const MOBILE_QUERY = '(max-width: 600px)';

  const frame = document.getElementById('gameFrame');
  const canvas = document.getElementById('cv');
  if (!frame || !canvas) return;

  function syncMobileCanvasSize() {
    const isMobile = window.matchMedia(MOBILE_QUERY).matches;
    if (!isMobile) {
      canvas.width = BASE_W;
      canvas.height = BASE_H;
      return;
    }

    const frameWidth = frame.clientWidth || canvas.clientWidth || BASE_W;
    const frameHeight = frame.clientHeight || canvas.clientHeight || BASE_H;
    const nextHeight = Math.max(BASE_H, Math.round(BASE_W * frameHeight / frameWidth));

    canvas.width = BASE_W;
    canvas.height = nextHeight;
  }

  syncMobileCanvasSize();
})();
