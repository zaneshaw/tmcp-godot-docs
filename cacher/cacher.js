// Based on https://github.com/christopherwk210/gm-bot/blob/master/tools/cache-docs.js

import { promises as fs } from "node:fs";
import path from "node:path";
import url from "node:url";
import cliProgress from "cli-progress";
import axios from "axios";
import * as cheerio from "cheerio";

const version = 2; // Increments upon restructure of JSON output
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const outputPath = path.join(__dirname, "../docs-cache.json");

const baseSrcURL = "https://raw.githubusercontent.com/godotengine/godot-docs/4.1/";
const baseDocsURL = "https://docs.godotengine.org/en/4.1/";
const indexURL = baseSrcURL + "index.rst";

const progressFormat = "{bar} {percentage}%, {value}/{total}, {eta_formatted}";
const multibar = new cliProgress.MultiBar(
	{
		clearOnComplete: false,
		hideCursor: true,
		format: "{filename}\t" + progressFormat,
	},
	cliProgress.Presets.shades_classic
);
const savingProgress = new cliProgress.Bar(
	{ format: "Saving\t\t" + progressFormat },
	cliProgress.Presets.shades_classic
);

export async function cacheDocs() {
	const fetchingProgress = multibar.create(1, 0, { filename: "Fetching" });
	const indexingProgress = multibar.create(Infinity, 0, { filename: "Indexing" });
	const generatingProgress = multibar.create(1, 0, { filename: "Generating" });

	const res1 = await axios.get(indexURL);
	if (res1.status !== 200) return console.error("Error fetching!");
	fetchingProgress.update(1);
	fetchingProgress.stop();

	let tempIndex = {};
	let totalGens = 0;
	let indexTopLevel = parseRST(res1.data);
	indexingProgress.setTotal(indexTopLevel.length - 1);
	for (let i = 0; i < indexTopLevel.length; i++) {
		let route = indexTopLevel[i];
		if (route.endsWith("/index")) {
			route = route.slice(0, -6);
			tempIndex[route] = {};
			const res2 = await axios.get(`${baseSrcURL}${route}/index.rst`);
			const parsed = parseRST(res2.data);
			totalGens += parsed.length;
			generatingProgress.setTotal(totalGens);
			for (let j = 0; j < parsed.length; j++) {
				const subRoute = parsed[j];
				const url = `${baseDocsURL}${route}/${subRoute}.html`;
				if (true) {
					const html = (await axios.get(url)).data;

					const data = {
						url,
						title: "",
						blurb: "",
						description: "",
					};
					const $ = cheerio.load(html);
					const articleBody = $(".rst-content").children(".document").children().children("section");
					data.title = articleBody.children("h1").first().text().slice(0, -1);
					data.blurb = articleBody.children("p").text();
					articleBody.children("#description").children().first().remove();
					data.description = articleBody.children("#description").html();
					tempIndex[route][subRoute] = data;
				} else {
					tempIndex[route][subRoute] = url;
				}
				generatingProgress.increment();
			}
		} else {
			tempIndex[route] = `${baseDocsURL}${route}.html`;
		}
		indexingProgress.increment();
	}
	multibar.stop();

	let cache = {
		time: Date.now(),
		version,
		index: {},
	};
	Object.keys(tempIndex).forEach((key) => {
		const [route1, route2] = key.split("/");
		if (route2) {
			if (!Object.keys(cache.index).includes(route1)) cache.index[route1] = {};
			cache.index[route1][route2] = tempIndex[key];
		} else {
			cache.index[route1] = tempIndex[key];
		}
	});

	savingProgress.start(1, 0);
	await fs.writeFile(outputPath, JSON.stringify(cache, null, 4), (err) => {
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

		if (isTOCTree && line.startsWith("   ") && !line.trim().startsWith(":")) {
			arr.push(line.trim());
		}
	});

	return arr;
}

cacheDocs();
