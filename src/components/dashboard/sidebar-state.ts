export const SIDEBAR_KEY = "onhand:sidebar";

/**
 * Runs while the HTML is being parsed, before the first paint, so a collapsed
 * sidebar never flashes open. It only sets an attribute on <html>; CSS reads
 * that attribute, and React never renders it.
 */
export const SIDEBAR_BOOT_SCRIPT = `try{if(localStorage.getItem("${SIDEBAR_KEY}")==="collapsed")document.documentElement.dataset.sidebar="collapsed"}catch(e){}`;
