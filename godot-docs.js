const electron = require("electron");

tmcp.addItem({
	text: "Reload TMCP",
	action: async () => {
		await electron.ipcRenderer.invoke("reload-plugins");
		location.reload();
	},
});
