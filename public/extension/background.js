// Extension install ya start hone par Offscreen document create karo
chrome.runtime.onInstalled.addListener(async () => {
  await setupOffscreenDocument('offscreen.html');
});

// Browser start hone par bhi ensure karo ki listener chal raha hai
chrome.runtime.onStartup.addListener(async () => {
  await setupOffscreenDocument('offscreen.html');
});

// Extension icon click karne par SARA open karo
chrome.action.onClicked.addListener(() => {
  openSaraApp();
});

async function setupOffscreenDocument(path) {
  // Check karo agar pehle se chal raha hai
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });

  if (existingContexts.length > 0) {
    return; 
  }

  // Naya hidden page create karo jisme Mic ka access ho
  await chrome.offscreen.createDocument({
    url: path,
    reasons: ['USER_MEDIA'],
    justification: 'Waiting for SARA wake word',
  });
}

function openSaraApp() {
  const saraUrl = "https://ais-pre-5ucyjqvv22vdfauqzmux65-557778769004.asia-southeast1.run.app";
  
  chrome.tabs.query({ url: "*://*.run.app/*" }, (tabs) => {
    if (tabs.length > 0) {
      // Agar pehle se khula hai to us tab par jao
      chrome.tabs.update(tabs[0].id, { active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      // Naya tab kholo
      chrome.tabs.create({ url: saraUrl });
    }
  });
}

// Jab Offscreen page wake word detect karega
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'WAKE_WORD_DETECTED') {
    console.log("Wake word detected! SARA is waking up... 🚀");
    
    // Notification dikhao
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.svg",
      title: "SARA AI",
      message: "Yes, I am listening..."
    });

    // SARA web app kholo
    openSaraApp();
  }
});
