const electron = require("electron");
const remote = require("@electron/remote");
const fs = remote.require("fs/promises");
const path = remote.require("path");

tmcp.addItem({
	text: "Reload TMCP",
	action: async () => {
		await electron.ipcRenderer.invoke("reload-plugins");
		location.reload();
	},
});

const godotVersion = tmcp.addSetting({
	type: "select",
	text: "Godot version",
	help: "The version of Godot to use",
	value: "4.1",
	options: ["4.1"],
});

let docsCache = { time: -1, version: -1, index: {} };

const jsonPath = path.join(__dirname, "docs-cache.json");

const data = await fs.readFile(jsonPath, { encoding: "utf-8" }).catch((err) => null);
docsCache = JSON.parse(data);

Object.entries(docsCache.index).forEach(([key, value]) => {
	if (key === "classes") {
		Object.entries(docsCache.index["classes"]).forEach(([key, value]) => {
			tmcp.addItem({
				text: key.split("_")[1],
				action: () => require("electron").shell.openExternal(value),
			});
		});
	}
});
