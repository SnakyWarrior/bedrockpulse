const { contextBridge, ipcRenderer } = require('electron');

const invoke = channel => arg => ipcRenderer.invoke(channel, arg);

contextBridge.exposeInMainWorld('bedrockpulse', {
  getState: invoke('state:get'),
  setState: invoke('state:set'),
  defaultPath: invoke('mc:default-path'),
  selectDirectory: invoke('mc:select-dir'),
  scan: invoke('mc:scan'),
  httpGet: invoke('http:get'),
  installFromUrl: invoke('pack:install-url'),
  installFromFile: invoke('pack:install-file'),
  openExternal: invoke('shell:open'),
  showFolder: invoke('shell:show-folder')
});
