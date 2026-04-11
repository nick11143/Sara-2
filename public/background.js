chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'index.html' });
});

// Listen for messages from the SARA UI tab to control other tabs
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'EXECUTE_WEB_COMMAND') {
    executeCommand(request.command).then(sendResponse);
    return true; 
  }
  if (request.type === 'EXECUTE_NATIVE_COMMAND') {
    executeNativeCommand(request.command).then(sendResponse);
    return true;
  }
});

async function executeNativeCommand(command) {
  try {
    const response = await fetch("http://127.0.0.1:8000/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
    return await response.json();
  } catch (error) {
    return { success: false, message: "Native Bridge not found. Make sure sara_native_bridge.py is running." };
  }
}

async function executeCommand(command) {
  try {
    // Get the active tab that is NOT the SARA tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let targetTab = tabs.find(t => !t.url.includes(chrome.runtime.id));
    
    // If SARA is the only active tab, try to find the most recently used other tab
    if (!targetTab) {
      const allTabs = await chrome.tabs.query({ currentWindow: true });
      targetTab = allTabs.find(t => !t.url.includes(chrome.runtime.id));
    }

    if (!targetTab) {
      return { success: false, message: "No active web tab found to control." };
    }

    if (command.action === 'close_tab') {
      await chrome.tabs.remove(targetTab.id);
      return { success: true, message: "Tab closed." };
    }

    if (command.action === 'navigate') {
      await chrome.tabs.update(targetTab.id, { url: command.target });
      return { success: true, message: `Navigated to ${command.target}` };
    }

    // Execute script in the target tab for DOM manipulation
    const results = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id },
      func: domManipulation,
      args: [command]
    });

    return results[0].result;
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// This function runs INSIDE the target web page
function domManipulation(command) {
  try {
    if (command.action === 'youtube_quality') {
      const settingsBtn = document.querySelector('.ytp-settings-button');
      if (!settingsBtn) return { success: false, message: "YouTube player not found." };
      settingsBtn.click();
      
      setTimeout(() => {
        const menuItems = Array.from(document.querySelectorAll('.ytp-menuitem'));
        const qualityItem = menuItems.find(item => item.textContent.includes('Quality') || item.textContent.includes('गुणवत्ता'));
        if (qualityItem) {
          qualityItem.click();
          setTimeout(() => {
            const qualityOptions = Array.from(document.querySelectorAll('.ytp-menuitem'));
            const targetOption = qualityOptions.find(item => item.textContent.includes(command.value));
            if (targetOption) {
              targetOption.click();
            }
          }, 500);
        }
      }, 500);
      return { success: true, message: `Attempted to change YouTube quality to ${command.value}` };
    }

    if (command.action === 'click') {
      // Try to find the element by text or selector
      let el = document.querySelector(command.target);
      if (!el) {
        const elements = Array.from(document.querySelectorAll('a, button'));
        el = elements.find(e => e.textContent.toLowerCase().includes(command.target.toLowerCase()));
      }
      if (el) {
        el.click();
        return { success: true, message: `Clicked on ${command.target}` };
      }
      return { success: false, message: `Element ${command.target} not found.` };
    }

    if (command.action === 'scroll') {
      window.scrollBy(0, parseInt(command.value) || window.innerHeight);
      return { success: true, message: "Scrolled page." };
    }

    return { success: false, message: "Unknown action." };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
