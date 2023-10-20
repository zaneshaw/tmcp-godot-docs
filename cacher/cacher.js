// Based on https://github.com/christopherwk210/gm-bot/blob/master/tools/cache-docs.js

import { promises as fs } from "node:fs";
import path from "node:path";
import url from "node:url";
import cliProgress from "cli-progress";
import axios from "axios";

const cacherVersion = 1; // Increments upon restructure of JSON output
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const outputPath = path.join(__dirname, "../docs-index.json");

const baseSrcURL = "https://raw.githubusercontent.com/godotengine/godot-docs/4.1/";
const baseDocsURL = "https://docs.godotengine.org/en/4.1/";
const indexURL = baseSrcURL + "index.rst";

const progressFormat = "{bar}" + " {percentage}%";
const fetchingProgress = new cliProgress.Bar(
	{ format: "Fetching\t" + progressFormat },
	cliProgress.Presets.shades_classic
);
const indexingProgress = new cliProgress.Bar(
	{ format: "Indexing\t" + progressFormat },
	cliProgress.Presets.shades_classic
);
const savingProgress = new cliProgress.Bar(
	{ format: "Saving\t\t" + progressFormat },
	cliProgress.Presets.shades_classic
);

export async function cacheDocs() {
	fetchingProgress.start(1, 0);
	const res1 = await axios.get(indexURL);
	if (res1.status !== 200) return console.error("Error fetching!");
	fetchingProgress.update(1);
	fetchingProgress.stop();

	let tempIndex = {};
	let indexTopLevel = parseRST(res1.data);
	indexingProgress.start(indexTopLevel.length, 0);
	for (let i = 0; i < indexTopLevel.length; i++) {
		let route = indexTopLevel[i];
		if (route.endsWith("/index")) {
			route = route.slice(0, -6);
			tempIndex[route] = {};
			const res2 = await axios.get(`${baseSrcURL}${route}/index.rst`);
			const parsed = parseRST(res2.data);
			for (let j = 0; j < parsed.length; j++) {
				const subRoute = parsed[j];
				tempIndex[route][subRoute] = `${baseDocsURL}${route}/${subRoute}.html`;
			}
		} else {
			tempIndex[route] = `${baseDocsURL}${route}.html`;
		}
		indexingProgress.increment();
	}
	indexingProgress.stop();

	let obj = {
		time: Date.now(),
		version: cacherVersion,
		index: {}
	};
	Object.keys(tempIndex).forEach((key) => {
		const [route1, route2] = key.split("/");
		if (route2) {
			if (!Object.keys(obj.index).includes(route1)) obj.index[route1] = {};
			obj.index[route1][route2] = tempIndex[key];
		} else {
			obj.index[route1] = tempIndex[key];
		}
	});

	savingProgress.start(1, 0);
	await fs.writeFile(outputPath, JSON.stringify(obj, null, 4), (err) => {
		if (err) throw err;
	});
	savingProgress.update(1);
	savingProgress.stop();
}

function parseRST(data) {
	/** @type {string[]} */
	let arr = [];
	let isTOCTree = false;
	data.split("\n").forEach((line) => {
		if (line.startsWith("..")) {
			isTOCTree = line == ".. toctree::";
		}

		if (
			isTOCTree &&
			line.startsWith("   ") &&
			!line.trim().startsWith(":")
		) {
			arr.push(line.trim());
		}
	});

	return arr;
}

cacheDocs();
