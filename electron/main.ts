import { app, BrowserWindow, Tray, Menu, shell, nativeImage } from "electron";
import path from "path";
import { spawn } from "child_process";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let backendProcess: any = null;
const BACKEND_PORT = 3001;

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: "MyRecSub - מעקב חשבוניות",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, "../resources/icon.png"),
  });

  if (isDev) {
    // In development, load from Next.js dev server
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load static export
    const frontendPath = path.join(process.resourcesPath, "frontend", "index.html");
    mainWindow.loadFile(frontendPath);
  }

  mainWindow.on("close", (event) => {
    if (tray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, "../resources/icon.png");
  try {
    tray = new Tray(nativeImage.createFromPath(iconPath));
  } catch {
    // If icon not found, create empty tray
    tray = new Tray(nativeImage.createEmpty());
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "פתח MyRecSub",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: "סנכרן עכשיו",
      click: async () => {
        try {
          await fetch(`http://localhost:${BACKEND_PORT}/api/gmail/sync-all`, {
            method: "POST",
          });
        } catch {
          // Backend might not be running
        }
      },
    },
    { type: "separator" },
    {
      label: "יציאה",
      click: () => {
        tray?.destroy();
        tray = null;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("MyRecSub - מעקב חשבוניות");
  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function startBackend() {
  if (isDev) {
    // In development, backend runs separately via npm run dev:backend
    console.log("Development mode: expecting backend on port", BACKEND_PORT);
    return;
  }

  // In production, start the backend server
  const backendPath = path.join(process.resourcesPath, "backend", "server.js");
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(BACKEND_PORT),
    HOST: "127.0.0.1",
    DATA_DIR: path.join(app.getPath("userData"), "data"),
    DATABASE_URL: `file:${path.join(app.getPath("userData"), "data", "myrecsub.db")}`,
    ATTACHMENTS_DIR: path.join(app.getPath("userData"), "data", "attachments"),
    LOGS_DIR: path.join(app.getPath("userData"), "data", "logs"),
  };

  backendProcess = spawn("node", [backendPath], { env, stdio: "pipe" });

  backendProcess.stdout?.on("data", (data: Buffer) => {
    console.log("[Backend]", data.toString().trim());
  });

  backendProcess.stderr?.on("data", (data: Buffer) => {
    console.error("[Backend Error]", data.toString().trim());
  });

  backendProcess.on("close", (code: number) => {
    console.log(`Backend process exited with code ${code}`);
  });
}

// App lifecycle
app.whenReady().then(async () => {
  startBackend();

  // Wait for backend to be ready
  if (!isDev) {
    await waitForBackend(BACKEND_PORT, 30000);
  }

  createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // On macOS, keep running in tray
  if (process.platform !== "darwin" && !tray) {
    app.quit();
  }
});

app.on("before-quit", () => {
  // Kill backend process
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});

// Handle external links
app.on("web-contents-created", (_, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
});

async function waitForBackend(port: number, timeout: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`http://localhost:${port}/api/health`);
      if (res.ok) return;
    } catch {
      // Not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.warn("Backend did not start within timeout, loading anyway...");
}
