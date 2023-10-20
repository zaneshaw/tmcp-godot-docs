const electron = require("electron");

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
