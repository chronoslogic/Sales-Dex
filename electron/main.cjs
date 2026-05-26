const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const PORT = Number(process.env.SALES_DEX_PORT || 4317);
let apiServer;
let mainWindow;

function getWindowIcon() {
  if (process.platform === "darwin") {
    return undefined;
  }
  return path.join(__dirname, "..", "build", "icon.ico");
}

async function startLocalApi() {
  process.env.SALES_DEX_DATA_DIR = path.join(app.getPath("userData"), "data");
  const serverUrl = pathToFileURL(path.join(__dirname, "..", "server", "server.mjs")).href;
  const { startServer } = await import(serverUrl);
  apiServer = await startServer({ port: PORT });
}

async function createWindow() {
  const devUrl = process.env.ELECTRON_START_URL;
  if (!devUrl) {
    await startLocalApi();
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1080,
    minHeight: 720,
    title: "Sales Dex",
    icon: getWindowIcon(),
    backgroundColor: "#eef3f8",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadURL(devUrl || `http://127.0.0.1:${PORT}`);
}

app.setName("Sales Dex");

app.whenReady().then(createWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});

app.on("before-quit", () => {
  if (apiServer) {
    apiServer.close();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
