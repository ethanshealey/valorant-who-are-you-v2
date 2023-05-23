// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import Lockfile from 'models/Lockfile';
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels = 'ipc-example';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

contextBridge.exposeInMainWorld('bridge', {

  // wait to die
  awaitDeath: (cb: any) => {
    ipcRenderer.send('await-death', cb)
  },

  // User
  requestUser: (user: any) => {
    ipcRenderer.send('request-user', user)
  },
  getUser: (cb: any) => {
    ipcRenderer.once('get-user', cb)
  },

  // Match Loop
  beginMatchLoop: (match: any) => {
    ipcRenderer.send('begin-match-loop', match)
  },

  // Match
  requestMatch: (match: any) => {
    ipcRenderer.send('request-match', match)
  },
  getMatch: (match: any) => {
    ipcRenderer.once('get-match', match)
  }

});

export type ElectronHandler = typeof electronHandler;
