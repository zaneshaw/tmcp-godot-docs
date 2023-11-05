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

const version = 3;
const godotVersion = tmcp.addSetting({
	type: "select",
	text: "Godot version",
	help: "The version of Godot to use",
	value: "4.1",
	options: ["4.1"],
});

let docs = { time: -1, version: -1, index: {} };

const jsonPath = path.join(__dirname, "docs-cache.json");

const data = await fs.readFile(jsonPath, { encoding: "utf-8" }).catch((err) => null);
docs = JSON.parse(data);

if (version > docs.version) {
	console.error("Godot Docs: Docs cache is out of date!");
	return;
} else if (version < docs.version) {
	console.error("Godot Docs: Plugin is out of date!");
	return;
}

Object.entries(docs.index).forEach(([key, value]) => {
	if (key === "classes") {
		Object.entries(docs.index["classes"]).forEach(([key, value]) => {
			let content = "";
			content += `<h1>${value.title}</h1>`
			content += `${value.blurb}`
			value.sections.forEach(section => {
				content += `<h2>${section.header}</h2>`
				content += `${section.content}`
			});

			tmcp.addItem({
				text: value.title,
				action: () => require("electron").shell.openExternal(value.url),
				display: {
					type: "markdown",
					content,
				},
			});
		});
	}
});
