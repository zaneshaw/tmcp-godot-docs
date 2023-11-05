// Based on https://github.com/christopherwk210/gm-bot/blob/master/tools/cache-docs.js

import { promises as fs } from "node:fs";
import path from "node:path";
import url from "node:url";
import cliProgress from "cli-progress";
import axios from "axios";
import * as cheerio from "cheerio";

const version = 3; // Increments upon restructure of JSON output
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const outputPath = path.join(__dirname, "../docs-cache.json");

const baseSrcURL = "https://raw.githubusercontent.com/godotengine/godot-docs/4.1/";
const baseDocsURL = "https://docs.godotengine.org/en/4.1/";
const indexURL = baseSrcURL + "index.rst";

const progressFormat = "{bar} {percentage}% | {value}/{total} | {eta_formatted}";
const fetchingProgress = new cliProgress.Bar(
	{ format: "Fetching\t" + progressFormat },
	cliProgress.Presets.shades_classic
);
const indexingProgress = new cliProgress.Bar(
	{ format: "Indexing\t" + progressFormat },
	cliProgress.Presets.shades_classic
);
const generatingProgress = new cliProgress.Bar(
	{ format: "Generating\t" + progressFormat },
	cliProgress.Presets.shades_classic
);
const savingProgress = new cliProgress.Bar(
	{ format: "Saving\t\t" + progressFormat },
	cliProgress.Presets.shades_classic
);

export async function cacheDocs() {
	fetchingProgress.start(1, 0);

	const res = await axios.get(indexURL);
	if (res.status !== 200) return console.error("Error fetching!");
	fetchingProgress.update(1);

	fetchingProgress.stop();

	indexDocs(res.data);
}

async function indexDocs(rawRST) {
	let index = {};
	let indexTopLevel = parseRST(rawRST);
	indexingProgress.start(indexTopLevel.length, 0);

	for (let i = 0; i < indexTopLevel.length; i++) {
		let route = indexTopLevel[i];
		if (route.endsWith("/index")) {
			route = route.slice(0, -6);
			const res = await axios.get(`${baseSrcURL}${route}/index.rst`);
			const parsed = parseRST(res.data);
			index[route] = parsed;
		} else {
			index[route] = undefined;
		}
		indexingProgress.increment();
	}

	indexingProgress.stop();
	generateDocs(index);
}

async function generateDocs(_index) {
	const index = {};
	const raw = Object.entries(_index);
	let routes = raw.map((x) => x[0]);
	let subRoutes = raw.map((x) => x[1]);

	const total = subRoutes.reduce((acc, val) => acc + (val?.length || 1), 0);
	generatingProgress.start(total, 0);

	async function generate(url) {
		// TODO: Generate curated markdown instead of copy-pasting the HTML
		const html = (await axios.get(url)).data;
		const data = {
			url,
			title: "",
			blurb: "",
			sections: [],
		};
		const $ = cheerio.load(html);
		const articleBody = $(".rst-content").children(".document").children().children("section");
		data.title = articleBody.children("h1").first().text().slice(0, -1);
		articleBody.children("p").each((i, el) => {
			data.blurb += `<p>${$(el).html()}</p>`;
		});
		articleBody.children("section").each((i, el) => {
			data.sections.push({
				header: $(el).find("h2").text().slice(0, -1),
				content: $(el).html().split("\n").slice(2).join(""),
			});
		});

		return data;
	}

	for (let i = 0; i < routes.length; i++) {
		const route = routes[i];
		index[route] = {};
		if (subRoutes[i] === undefined) {
			const url = `${baseDocsURL}${route}.html`;
			const data = await generate(url);

			index[route] = data;
			generatingProgress.increment();
		} else {
			for (let j = 0; j < subRoutes[i].length; j++) {
				const subRoute = subRoutes[i][j];
				const url = `${baseDocsURL}${route}/${subRoute}.html`;
				const data = await generate(url);

				index[route][subRoute] = data;
				generatingProgress.increment();
			}
		}
	}

	let cache = {
		time: Date.now(),
		version,
		index: {},
	};
	Object.keys(index).forEach((key) => {
		const [route1, route2] = key.split("/");
		if (route2) {
			if (!Object.keys(cache.index).includes(route1)) cache.index[route1] = {};
			cache.index[route1][route2] = index[key];
		} else {
			cache.index[route1] = index[key];
		}
	});

	generatingProgress.stop();
	saveDocs(cache);
}

async function saveDocs(cache) {
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
