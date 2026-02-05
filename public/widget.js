(function () {
  'use strict';

  var script = document.currentScript;
  var university = script.getAttribute('data-university') || '';
  var lang = script.getAttribute('data-lang') || 'ko';
  var baseUrl = script.getAttribute('data-base-url') || script.src.replace(/\/widget\.js.*$/, '');

  // Create container
  var container = document.createElement('div');
  container.id = 'k-student-widget-container';
  container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999;font-family:sans-serif;';

  // Create toggle button
  var toggleBtn = document.createElement('button');
  toggleBtn.id = 'k-student-widget-toggle';
  toggleBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  toggleBtn.style.cssText = 'width:56px;height:56px;border-radius:28px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:transform 0.2s;background:#0066CC;';
  toggleBtn.onmouseenter = function() { toggleBtn.style.transform = 'scale(1.05)'; };
  toggleBtn.onmouseleave = function() { toggleBtn.style.transform = 'scale(1)'; };

  // Create chat window
  var chatWindow = document.createElement('div');
  chatWindow.id = 'k-student-widget-window';
  chatWindow.style.cssText = 'display:none;width:380px;height:600px;max-height:80vh;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.12);margin-bottom:12px;background:white;';

  // Create iframe
  var iframe = document.createElement('iframe');
  iframe.src = baseUrl + '/widget/' + university + '?lang=' + lang;
  iframe.style.cssText = 'width:100%;height:100%;border:none;';
  iframe.title = 'K-Student AI Guide Chat';

  // Create close button
  var closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = 'position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:14px;border:none;background:rgba(255,255,255,0.9);cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;color:#666;z-index:1;';

  var chatWindowWrapper = document.createElement('div');
  chatWindowWrapper.style.cssText = 'position:relative;';
  chatWindowWrapper.appendChild(closeBtn);
  chatWindowWrapper.appendChild(iframe);
  chatWindow.appendChild(chatWindowWrapper);

  var isOpen = false;

  function toggle() {
    isOpen = !isOpen;
    chatWindow.style.display = isOpen ? 'block' : 'none';
    toggleBtn.innerHTML = isOpen
      ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
      : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  }

  toggleBtn.onclick = toggle;
  closeBtn.onclick = toggle;

  container.appendChild(chatWindow);
  container.appendChild(toggleBtn);
  document.body.appendChild(container);

  // Mobile responsive
  if (window.innerWidth < 640) {
    chatWindow.style.width = 'calc(100vw - 32px)';
    chatWindow.style.height = 'calc(100vh - 100px)';
    chatWindow.style.maxHeight = 'none';
    chatWindow.style.borderRadius = '12px';
  }
})();
