// Entry point — boots up the game

window.addEventListener('load', () => {
    const canvas = document.getElementById('gameCanvas');

    // Track mouse position for hover effects in menu
    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = CONFIG.CANVAS_WIDTH / rect.width;
        const scaleY = CONFIG.CANVAS_HEIGHT / rect.height;
        canvas._mousePos = {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    });
    canvas.addEventListener('mouseleave', () => { canvas._mousePos = null; });

    // Boot
    const game = new Game(canvas);
    window.game = game; // expose for debugging
});
